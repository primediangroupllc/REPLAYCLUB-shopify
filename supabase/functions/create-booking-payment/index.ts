import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { checkRateLimit, clientIp, rateLimitResponse } from "../_shared/rate-limit.ts";
import { resolveSlotLockTtlSeconds } from "../_shared/site-settings.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Hoisted so the catch handler can release a lock even on later failures.
  let slotLockId: string | null = null;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Rate-limit by IP first (cheap, no JSON parse needed).
    const ip = clientIp(req);
    const ipLimit = await checkRateLimit({
      bucket: "create-booking-payment:ip",
      identifier: ip,
      max: 20,
      windowSeconds: 60,
    });
    if (!ipLimit.allowed) return rateLimitResponse(ipLimit, corsHeaders);

    const _body = await req.json();
    let {
      roomTitle,
      bookingDate,
      bookingTime,
      customerName,
      customerEmail,
      customerPhone,
      tier,
      equipment,
      lighting,
      backdrop,
      customRequests,
      sound,
      layout,
      amountCents,
      description,
    } = _body;
    const {
      giftCardId,
      giftCardCode,
      discountCodeId,
      discountCode,
      idPhotoPath,
      consentSignaturePath,
      consentSignerName,
      consentAccepted,
      consentAcceptedAt,
      consentVersion,
      idempotencyKey,
      existingBookingId,
      hours,
      cancelPath,
    } = _body;

    // Draft-booking path: hydrate missing slot/customer fields from the
    // persisted row BEFORE the legacy required-fields guard fires. The full
    // ownership/status validation still runs in the dedicated block below.
    if (existingBookingId && typeof existingBookingId === "string") {
      const { data: hydrate } = await supabase
        .from("bookings")
        .select("room_title, booking_date, booking_time, customer_name, customer_email, customer_phone, tier, equipment, lighting, backdrop, custom_requests, sound, layout, amount_cents")
        .eq("id", existingBookingId)
        .maybeSingle();
      if (hydrate) {
        roomTitle      = roomTitle      ?? hydrate.room_title;
        bookingDate    = bookingDate    ?? hydrate.booking_date;
        bookingTime    = bookingTime    ?? hydrate.booking_time;
        customerName   = customerName   ?? hydrate.customer_name;
        customerEmail  = customerEmail  ?? hydrate.customer_email;
        customerPhone  = customerPhone  ?? hydrate.customer_phone;
        tier           = tier           ?? hydrate.tier;
        equipment      = equipment      ?? hydrate.equipment;
        lighting       = lighting       ?? hydrate.lighting;
        backdrop       = backdrop       ?? hydrate.backdrop;
        customRequests = customRequests ?? hydrate.custom_requests;
        sound          = sound          ?? hydrate.sound;
        layout         = layout         ?? hydrate.layout;
        amountCents    = amountCents    ?? hydrate.amount_cents;
      }
    }

    // Validation
    if (!roomTitle || !bookingDate || !bookingTime || !customerName || !customerEmail || !amountCents) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cap sanity-checks the payload against an obviously-wrong client value.
    // 6 hours × $165 photoshoot tier + add-ons can exceed $1000, so cap at
    // $5000 (50000¢) — anything above is almost certainly a bug or attack.
    if (amountCents < 100 || amountCents > 500000) {
      return new Response(JSON.stringify({ error: "Invalid amount. If your booking total looks correct, please contact us." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──────────────────────────────────────────────────────────────────────
    // Server-authoritative pricing (audit #7).
    //
    // `amountCents` arrives from the browser and cannot be trusted — a tampered
    // request could otherwise book a studio session for any price down to the
    // $1 floor. For the studio-tier rooms (Music / Disk Jockey / Podcast) we
    // IGNORE the client amount and recompute the base charge from the
    // admin-managed `studio_configurations` table.
    //
    // The client `tier` string is used ONLY to SELECT which DB tier — matched
    // on its embedded price tokens. The charge itself always comes from the DB
    // row's `price_cents_per_hour` + `flat_addon_cents`, so a tampered string
    // simply fails to resolve and the booking is rejected (fail closed).
    //
    // Non-studio paths (Photoshoot, Equipment Rental, Livestream custom-quote)
    // are not tier-priced; their price tables are not yet server-side, so they
    // still use the client amount — tracked as a Phase-2 follow-up.
    // ──────────────────────────────────────────────────────────────────────
    const STUDIO_KEY_BY_ROOM: Record<string, string> = {
      "Music": "music",
      "Disk Jockey": "dj",
      "Podcast": "podcast",
      "Photoshoot": "photoshoot",
    };
    const studioKey = STUDIO_KEY_BY_ROOM[(roomTitle || "").trim()];
    if (studioKey) {
      const h = Number(hours);
      if (!Number.isInteger(h) || h < 1 || h > 12) {
        return new Response(
          JSON.stringify({ error: "invalid_hours", message: "Invalid session duration. Please reselect your booking time." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const { data: cfg } = await supabase
        .from("studio_configurations")
        .select("tiers")
        .eq("studio_key", studioKey)
        .maybeSingle();
      const dbTiers = (Array.isArray(cfg?.tiers) ? cfg!.tiers : []) as Array<{
        id: string; label: string; price_cents_per_hour: number; flat_addon_cents?: number;
      }>;
      // Resolve the DB tier by the price tokens in the client `tier` string:
      // hourly = first `$N`, flat = `(+$N flat)`. (hourly, flat) is unique per
      // studio, so this matches exactly one tier or none.
      const tierStr = typeof tier === "string" ? tier : "";
      const hourlyTok = tierStr.match(/\$(\d+)/);
      const flatTok = tierStr.match(/\+\s*\$(\d+)\s*flat/i);
      const wantHourly = hourlyTok ? parseInt(hourlyTok[1], 10) * 100 : -1;
      const wantFlat = flatTok ? parseInt(flatTok[1], 10) * 100 : 0;
      const dbTier = dbTiers.find(
        (t) => t.price_cents_per_hour === wantHourly && (t.flat_addon_cents ?? 0) === wantFlat,
      );
      if (!dbTier) {
        return new Response(
          JSON.stringify({
            error: "tier_unrecognized",
            message: "We couldn't verify the price for that package. Please refresh and try again.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const serverAmount = dbTier.price_cents_per_hour * h + (dbTier.flat_addon_cents ?? 0);
      if (serverAmount < 100) {
        return new Response(
          JSON.stringify({ error: "tier_not_payable", message: "This package can't be checked out online." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (serverAmount !== amountCents) {
        console.warn(
          `[pricing] ${roomTitle} tier=${dbTier.id} hours=${h}: client sent ${amountCents}¢, ` +
          `server computed ${serverAmount}¢ — charging the server value.`,
        );
      }
      amountCents = serverAmount;
    }

    // Past-date / past-time guard. The client gates this in the date+time
    // pickers, but a stale modal (kept open for hours) or a resumed booking
    // can still POST a slot whose start has elapsed. Reject with a stable
    // error code so the client can surface specific copy AND so the
    // failure-reporter can suppress the admin alert (this is user error,
    // not a backend fault).
    {
      const slotMatch = (bookingTime || "").match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      const dateMatch = (bookingDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (slotMatch && dateMatch) {
        let h = parseInt(slotMatch[1], 10) % 12;
        if (slotMatch[3].toUpperCase() === "PM") h += 12;
        const m = parseInt(slotMatch[2], 10);
        // Studio is in America/Los_Angeles. Build the slot start in LA local
        // time using the standard `sv-SE` ISO-ish formatter trick, then
        // compare against `now()` in the same zone-aware fashion.
        const slotIsoLocal = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
        // Treat the slot as LA-local. Server runs in UTC; compute LA `now`.
        const laNowParts = new Intl.DateTimeFormat("sv-SE", {
          timeZone: "America/Los_Angeles",
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", second: "2-digit",
          hour12: false,
        }).format(new Date()).replace(" ", "T");
        if (slotIsoLocal <= laNowParts) {
          return new Response(
            JSON.stringify({
              error: "booking_in_past",
              message: "That time has already passed. Please pick a future slot.",
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────
    // Draft-booking path (Stripe Identity flow).
    //
    // When `existingBookingId` is provided, the booking row was already
    // created by `upsert_draft_booking` BEFORE Stripe Identity ran. We must:
    //   1. Validate the row exists, is owned by this email, is still pending
    //      payment, and has cleared verification.
    //   2. Reuse it (UPDATE) instead of INSERTing a new row downstream.
    //
    // Legacy callers that omit `existingBookingId` keep the original INSERT
    // path (verification_status defaults to 'not_required' for those rows).
    // ──────────────────────────────────────────────────────────────────────
    let draftBooking: {
      id: string;
      customer_email: string;
      payment_status: string;
      verification_status: string | null;
      room_title: string;
      booking_date: string;
      booking_time: string;
    } | null = null;

    if (existingBookingId && typeof existingBookingId === "string") {
      const { data: row, error: fetchErr } = await supabase
        .from("bookings")
        .select("id, customer_email, payment_status, verification_status, room_title, booking_date, booking_time")
        .eq("id", existingBookingId)
        .maybeSingle();

      if (fetchErr || !row) {
        return new Response(
          JSON.stringify({ error: "booking_not_found", message: "Draft booking not found." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if ((row.customer_email || "").toLowerCase() !== (customerEmail || "").toLowerCase()) {
        return new Response(
          JSON.stringify({ error: "email_mismatch", message: "Booking does not belong to this customer." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (row.payment_status !== "pending") {
        return new Response(
          JSON.stringify({
            error: "booking_not_payable",
            message: "Booking is not in a payable state.",
            current_status: row.payment_status,
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Verification gate. `not_required` is grandfathered for any in-flight
      // legacy rows that pre-date Stripe Identity. Everything else must be
      // explicitly approved.
      if (
        row.verification_status !== "approved" &&
        row.verification_status !== "not_required"
      ) {
        return new Response(
          JSON.stringify({
            error: "verification_required",
            message: "Booking must be verified before payment.",
            current_status: row.verification_status,
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Ensure the slot identifiers in the request match the persisted row —
      // protects against a client posting a stale draft id against a
      // different room/date/time.
      if (
        row.room_title !== roomTitle ||
        row.booking_date !== bookingDate ||
        row.booking_time !== bookingTime
      ) {
        return new Response(
          JSON.stringify({
            error: "booking_slot_mismatch",
            message: "Draft booking slot does not match the request.",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      draftBooking = row;
    }

    // Per-email rate limit — prevents spam from a single buyer using many IPs.
    const emailLimit = await checkRateLimit({
      bucket: "create-booking-payment:email",
      identifier: customerEmail,
      max: 10,
      windowSeconds: 60,
    });
    if (!emailLimit.allowed) return rateLimitResponse(emailLimit, corsHeaders);

    // Detect admin user from forwarded JWT (optional). Admins bypass density rules.
    // The override is *server-derived* — never trust a client-supplied admin flag.
    let isAdminOverride = false;
    let adminUserId: string | null = null;
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (jwt) {
      try {
        const userRes = await supabase.auth.getUser(jwt);
        const userId = userRes.data?.user?.id;
        if (userId) {
          const { data: roleRow } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .eq("role", "admin")
            .maybeSingle();
          if (roleRow) {
            isAdminOverride = true;
            adminUserId = userId;
          }
        }
      } catch (_e) { /* ignore — treat as non-admin */ }
    }

    // Audit trail: record any admin booking attempt that will bypass density/equipment
    // rules. Best-effort — never block the booking on an audit-log failure.
    if (isAdminOverride && adminUserId) {
      supabase
        .from("admin_audit_log")
        .insert({
          user_id: adminUserId,
          action: "booking_admin_override",
          metadata: {
            room_title: roomTitle,
            booking_date: bookingDate,
            booking_time: bookingTime,
            customer_email: customerEmail,
            equipment: equipment || [],
            amount_cents: amountCents,
          },
        })
        .then(({ error }) => {
          if (error) console.warn("admin_audit_log insert failed", error.message);
        });
    }

    // Density enforcement (cap + cross-type buffer). Admins bypass.
    if (!isAdminOverride) {
      const { data: settingsRows } = await supabase.rpc("get_booking_density_settings");
      const settings = Array.isArray(settingsRows) ? settingsRows[0] : settingsRows;
      const dailyCap: number = settings?.daily_session_cap ?? 4;
      const bufferMinutes: number = settings?.booking_buffer_minutes ?? 30;
      const sharedPool: boolean = settings?.shared_room_pool ?? true;

      // Cap check (cross-type)
      if (dailyCap > 0) {
        const { data: dayCount } = await supabase.rpc("get_day_booking_count", {
          p_booking_date: bookingDate,
        });
        if (typeof dayCount === "number" && dayCount >= dailyCap) {
          return new Response(
            JSON.stringify({ error: "Fully booked — try another date." }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      // Cross-type buffer check
      const slotToMin = (s: string): number => {
        const m = s?.match?.(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!m) return -1;
        let h = parseInt(m[1], 10) % 12;
        if (m[3].toUpperCase() === "PM") h += 12;
        return h * 60 + parseInt(m[2], 10);
      };
      const reqMin = slotToMin(bookingTime);
      if (reqMin >= 0) {
        const dayBookingsQuery = supabase
          .from("bookings")
          .select("booking_time, room_title")
          .eq("booking_date", bookingDate)
          .in("payment_status", ["paid", "promo"]);
        if (!sharedPool) dayBookingsQuery.eq("room_title", roomTitle);
        const { data: dayBookings } = await dayBookingsQuery;
        // MATH — must stay in lock-step with the client-side check in
        // src/lib/bookingTimeSlots.ts (applyBufferToUnavailable):
        //   - Each existing booking row is assumed to occupy 60 min starting
        //     at booking_time. A 2-hour session is two consecutive rows.
        //   - Blocked range = [start, start + 60 + bufferMinutes).
        //   - The requested slot covers [reqMin, reqMin + 60).
        //   - It conflicts iff reqMin + 60 > start AND reqMin < start + 60 + buffer.
        const ASSUMED_BOOKING_MINUTES = 60;
        const SLOT_LENGTH_MINUTES = 60;
        const buffer = Math.max(0, bufferMinutes);
        const reqEnd = reqMin + SLOT_LENGTH_MINUTES;
        const conflict = (dayBookings || []).some((b: { booking_time: string }) => {
          const start = slotToMin(b.booking_time);
          if (start < 0) return false;
          const end = start + ASSUMED_BOOKING_MINUTES + buffer;
          return reqEnd > start && reqMin < end;
        });
        if (conflict) {
          return new Response(
            JSON.stringify({ error: "This slot conflicts with an existing booking or its buffer." }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }

    // Cross-service equipment conflict check. The slot_lock above covers
    // room+date+time but not equipment overlap. If another booking at the
    // same slot (or a multi-day standalone rental) consumes the gear this
    // service requires, reject — same behavior the client-side calendar
    // enforces, repeated server-side to close the race window.
    {
      // 1) Resolve booking_type from roomTitle via booking_tabs_meta
      const { data: metaRow } = await supabase
        .from("booking_tabs_meta")
        .select("booking_type")
        .eq("title", roomTitle)
        .maybeSingle();
      const bookingType = metaRow?.booking_type as string | undefined;
      if (bookingType) {
        // 2) Required equipment for this service
        const { data: reqRows } = await supabase
          .from("service_equipment_requirements")
          .select("equipment_name")
          .eq("booking_type", bookingType);
        const requiredItems = (reqRows ?? []).map((r: any) => r.equipment_name as string);

        if (requiredItems.length > 0) {
          // 3) Map every required item to the set of OTHER booking_types
          //    (and their titles) that also use it — these compete for the slot.
          const { data: peerRows } = await supabase
            .from("service_equipment_requirements")
            .select("booking_type, equipment_name")
            .in("equipment_name", requiredItems);
          const peerTypes = new Set<string>();
          for (const r of (peerRows ?? []) as any[]) {
            if (r.booking_type && r.booking_type !== bookingType) peerTypes.add(r.booking_type);
          }
          let peerTitles: string[] = [];
          if (peerTypes.size > 0) {
            const { data: titleRows } = await supabase
              .from("booking_tabs_meta")
              .select("title, booking_type")
              .in("booking_type", Array.from(peerTypes));
            peerTitles = (titleRows ?? []).map((r: any) => r.title as string);
          }

          // 4) Check each required item against rentals, locks, and competing bookings.
          for (const eq of requiredItems) {
            // Whole-day blocks: standalone rentals covering bookingDate
            const { data: rentals } = await supabase
              .from("equipment_rentals")
              .select("pickup_date, rental_days, created_at")
              .eq("payment_status", "paid")
              .contains("items", JSON.stringify([eq]));
            const dateMs = new Date(`${bookingDate}T00:00:00Z`).getTime();
            for (const r of (rentals ?? []) as any[]) {
              const pickup = r.pickup_date || (r.created_at ? String(r.created_at).slice(0, 10) : null);
              if (!pickup) continue;
              const start = new Date(`${pickup}T00:00:00Z`).getTime();
              const end = start + Math.max(1, r.rental_days || 1) * 24 * 3600 * 1000;
              if (dateMs >= start && dateMs < end) {
                return new Response(
                  JSON.stringify({ error: `Required equipment (${eq}) is rented out on this date.` }),
                  { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
                );
              }
            }
            // In-flight equipment locks covering this date
            const { data: eqLocks } = await supabase
              .from("equipment_locks")
              .select("pickup_date, rental_days, expires_at")
              .eq("equipment_name", eq)
              .gt("expires_at", new Date().toISOString());
            for (const l of (eqLocks ?? []) as any[]) {
              if (!l.pickup_date) continue;
              const start = new Date(`${l.pickup_date}T00:00:00Z`).getTime();
              const end = start + Math.max(1, l.rental_days || 1) * 24 * 3600 * 1000;
              if (dateMs >= start && dateMs < end) {
                return new Response(
                  JSON.stringify({ error: `Required equipment (${eq}) is being checked out by another customer.` }),
                  { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
                );
              }
            }
            // Hour-level: paid bookings at the same slot with this item as
            // explicit add-on, or whose room is another service that
            // implicitly requires it.
            const conflictBookings: Array<{ room_title?: string }> = [];
            const { data: explicit } = await supabase
              .from("bookings")
              .select("room_title")
              .eq("booking_date", bookingDate)
              .eq("booking_time", bookingTime)
              .in("payment_status", ["paid", "promo"])
              .contains("equipment", JSON.stringify([eq]));
            conflictBookings.push(...((explicit ?? []) as any[]));
            if (peerTitles.length > 0) {
              const { data: implicit } = await supabase
                .from("bookings")
                .select("room_title")
                .eq("booking_date", bookingDate)
                .eq("booking_time", bookingTime)
                .in("payment_status", ["paid", "promo"])
                .in("room_title", peerTitles);
              conflictBookings.push(...((implicit ?? []) as any[]));
            }
            if (conflictBookings.length > 0) {
              return new Response(
                JSON.stringify({
                  error: `Required equipment (${eq}) is in use by another session at this hour.`,
                }),
                { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
              );
            }
          }
        }
      }
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Idempotency guard — if the same client retried (double-click, reconnect),
    // return the previously-created Stripe session instead of creating a new one.
    if (idempotencyKey && typeof idempotencyKey === "string") {
      const { data: existing } = await supabase
        .from("stripe_checkout_idempotency")
        .select("stripe_session_url, booking_id, expires_at")
        .eq("idempotency_key", idempotencyKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (existing?.stripe_session_url) {
        return new Response(
          JSON.stringify({ url: existing.stripe_session_url, bookingId: existing.booking_id, resumed: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Per-service slot lock TTL: room sessions take longer to check out
    // (consent + ID upload + Stripe redirect) than rentals. Admin can
    // override the default via site_settings.slot_lock_ttl_minutes; per-room
    // hardcoded floors still apply for the shorter-checkout services.
    const fallbackTtl = (() => {
      const t = (roomTitle || "").toString();
      if (t === "Equipment Rental") return 480;       // 8 min
      if (t === "Livestream Studio") return 600;      // 10 min
      return 900;                                     // 15 min default
    })();
    const lockTtlSeconds = await resolveSlotLockTtlSeconds(fallbackTtl);

    // Acquire an atomic slot lock. This is the authoritative race-safe guard:
    // the unique constraint on (room, date, time) inside slot_locks guarantees
    // only one in-flight checkout per slot, even under concurrent requests.
    {
      const { data: lockRows, error: lockErr } = await supabase.rpc("acquire_slot_lock", {
        p_room_title: roomTitle,
        p_booking_date: bookingDate,
        p_booking_time: bookingTime,
        p_email: customerEmail,
        p_ttl_seconds: lockTtlSeconds,
      });
      if (lockErr) throw new Error(`Slot lock error: ${lockErr.message}`);
      const lock = Array.isArray(lockRows) ? lockRows[0] : lockRows;
      if (!lock?.acquired) {
        const reason = lock?.conflict_reason === "already_booked"
          ? "This time slot was just booked. Please choose another time."
          : "Someone else is currently booking this slot. Please try a different time.";
        const code = lock?.conflict_reason === "already_booked"
          ? "slot_already_booked"
          : "slot_locked_by_other";
        return new Response(
          JSON.stringify({ error: code, message: reason, conflict_reason: lock?.conflict_reason }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      slotLockId = lock.lock_id;
    }

    // Loyalty tier — recurring % discount based on lifetime paid bookings.
    const TIER_LADDER: Array<{ min: number; name: string; percent: number }> = [
      { min: 100, name: "Obsidian", percent: 30 },
      { min: 50, name: "Diamond", percent: 25 },
      { min: 20, name: "Platinum", percent: 20 },
      { min: 10, name: "Gold", percent: 15 },
      { min: 5, name: "Silver", percent: 10 },
      { min: 3, name: "Bronze", percent: 5 },
    ];
    let discountPercent = 0;
    let loyaltyTier = "";
    try {
      const { data: loyaltyRow } = await supabase.rpc("get_loyalty_info", {
        user_email: customerEmail,
      });
      const bookingCount =
        (loyaltyRow as { booking_count?: number } | null)?.booking_count ?? 0;
      const matched = TIER_LADDER.find((t) => bookingCount >= t.min);
      if (matched) {
        discountPercent = matched.percent;
        loyaltyTier = matched.name;
      }
    } catch (_e) { /* default to no discount */ }
    const discountAmount = Math.round(amountCents * (discountPercent / 100));
    let finalAmount = Math.max(amountCents - discountAmount, 100);

    // Apply discount code (single-use, atomic claim) — applied BEFORE gift card
    let promoDiscountCents = 0;
    let validatedDiscountId: string | null = null;
    if (discountCodeId && discountCode) {
      // Atomically mark redeemed only if still active. UPDATE...RETURNING gives us
      // a race-free claim — if two requests race, only one will get a row back.
      const nowIso = new Date().toISOString();
      const { data: claimed, error: claimErr } = await supabase
        .from("discount_codes")
        .update({
          redeemed: true,
          redeemed_at: nowIso,
          redeemed_by_email: customerEmail,
        })
        .eq("id", discountCodeId)
        .eq("code", discountCode)
        .eq("redeemed", false)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .select("id, amount_cents")
        .maybeSingle();

      if (!claimErr && claimed) {
        promoDiscountCents = Math.min(claimed.amount_cents, finalAmount);
        finalAmount = Math.max(finalAmount - promoDiscountCents, 0);
        validatedDiscountId = claimed.id;
      }
    }

    // Apply gift card discount
    let giftCardDiscountCents = 0;
    let validatedGiftCardId: string | null = null;
    if (giftCardId && giftCardCode) {
      const { data: gc, error: gcErr } = await supabase
        .from("gift_cards")
        .select("id, balance_cents, payment_status, redeemed_at")
        .eq("id", giftCardId)
        .eq("code", giftCardCode)
        .single();

      if (!gcErr && gc && gc.payment_status === "paid" && gc.balance_cents > 0 && !gc.redeemed_at) {
        giftCardDiscountCents = Math.min(gc.balance_cents, finalAmount);
        finalAmount = Math.max(finalAmount - giftCardDiscountCents, 0);
        validatedGiftCardId = gc.id;
      }
    }

    // If gift card covers the full amount, skip Stripe
    if (finalAmount <= 0 && validatedGiftCardId) {
      // Create booking as paid directly — or update the existing draft row.
      const paidPayload = {
        room_title: roomTitle,
        booking_date: bookingDate,
        booking_time: bookingTime,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone || "",
        tier,
        equipment: equipment || [],
        lighting,
        backdrop: backdrop ?? null,
        custom_requests: customRequests ?? null,
        sound,
        layout,
        amount_cents: amountCents - discountAmount,
        payment_status: "paid",
        id_photo_url: idPhotoPath || null,
        id_verified: idPhotoPath ? "pending" : null,
        consent_signature_path: consentSignaturePath || null,
        consent_signed_at: consentSignaturePath ? new Date().toISOString() : null,
        consent_signer_name: consentSignerName || customerName,
        consent_accepted: !!consentAccepted,
        consent_accepted_at: consentAccepted ? (consentAcceptedAt || new Date().toISOString()) : null,
        consent_version: consentAccepted ? (consentVersion || "v1.0") : null,
      };

      const { data: booking, error: bookingError } = draftBooking
        ? await supabase
            .from("bookings")
            .update(paidPayload)
            .eq("id", draftBooking.id)
            .select()
            .single()
        : await supabase
            .from("bookings")
            .insert(paidPayload)
            .select()
            .single();

      if (bookingError) throw new Error(`Booking error: ${bookingError.message}`);

      // Link redeemed discount code to this booking (already marked redeemed above)
      if (validatedDiscountId) {
        await supabase
          .from("discount_codes")
          .update({ redeemed_by_booking_id: booking.id })
          .eq("id", validatedDiscountId);
      }

      // Deduct gift card balance atomically (audit #5). The RPC compares
      // (id, code), checks balance >= amount, and decrements in one
      // statement so two concurrent redemptions can't both succeed.
      const { data: deductRes, error: deductErr } = await supabase.rpc(
        "deduct_gift_card_balance",
        {
          p_gift_card_id: validatedGiftCardId,
          p_code: giftCardCode,
          p_amount_cents: giftCardDiscountCents,
          p_booking_id: booking.id,
        },
      );
      if (deductErr || !(deductRes as any)?.success) {
        // Roll back: the booking row was created assuming the deduct
        // succeeded. Mark it cancelled so the slot frees up and the user
        // sees a clear error.
        await supabase
          .from("bookings")
          .update({ payment_status: "cancelled" })
          .eq("id", booking.id);
        return new Response(
          JSON.stringify({
            error: "Gift card could not be applied — please refresh and try again.",
            detail: (deductRes as any)?.reason || deductErr?.message,
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Send confirmation
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-booking-confirmation`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ bookingId: booking.id }),
        });
      } catch (emailError) {
        console.error("Email confirmation failed:", emailError);
      }

      // Auto-verify ID if uploaded
      if (idPhotoPath) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/verify-id-photo`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ bookingId: booking.id, idPhotoPath, customerName }),
          });
        } catch (idErr) {
          console.error("ID auto-verify failed:", idErr);
        }
      }

      return new Response(JSON.stringify({
        paidByGiftCard: true,
        bookingId: booking.id,
        redirectUrl: `/booking-success?booking_id=${booking.id}&gift_card=true`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure minimum charge for Stripe
    if (finalAmount < 100) finalAmount = 100;

    // Run the booking insert and the Stripe customer lookup in parallel.
    // Both only need the validated input we already have, and the Stripe
    // checkout session below depends on BOTH (booking.id for metadata, and
    // customerId to attach to an existing Stripe customer if one exists).
    // This shaves ~200–400 ms vs. running them sequentially.
    // For the draft-booking path we UPDATE the existing row instead of
    // INSERTing a fresh one, preserving all upstream metadata (verification
    // status, slot lock linkage, verification_held_until).
    const pendingPayload = {
      room_title: roomTitle,
      booking_date: bookingDate,
      booking_time: bookingTime,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone || "",
      tier,
      equipment: equipment || [],
      lighting,
      sound,
      layout,
      amount_cents: finalAmount,
      payment_status: "pending",
      id_photo_url: idPhotoPath || null,
      id_verified: idPhotoPath ? "pending" : null,
      consent_signature_path: consentSignaturePath || null,
      consent_signed_at: consentSignaturePath ? new Date().toISOString() : null,
      consent_signer_name: consentSignerName || customerName,
      consent_accepted: !!consentAccepted,
      consent_accepted_at: consentAccepted ? (consentAcceptedAt || new Date().toISOString()) : null,
      consent_version: consentAccepted ? (consentVersion || "v1.0") : null,
    };

    const [bookingResult, customers] = await Promise.all([
      draftBooking
        ? supabase
            .from("bookings")
            .update(pendingPayload)
            .eq("id", draftBooking.id)
            .select()
            .single()
        : supabase
            .from("bookings")
            .insert(pendingPayload)
            .select()
            .single(),
      stripe.customers.list({ email: customerEmail, limit: 1 }),
    ]);

    const { data: booking, error: bookingError } = bookingResult;
    if (bookingError) throw new Error(`Booking error: ${bookingError.message}`);

    const customerId: string | undefined =
      customers.data.length > 0 ? customers.data[0].id : undefined;

    const discountLabel = discountPercent > 0 
      ? ` (${discountPercent}% ${loyaltyTier} discount applied)` 
      : "";

    const giftCardLabel = giftCardDiscountCents > 0
      ? ` (Gift card: -$${(giftCardDiscountCents / 100).toFixed(2)})`
      : "";

    const promoCodeLabel = promoDiscountCents > 0
      ? ` (Promo code: -$${(promoDiscountCents / 100).toFixed(2)})`
      : "";

    // Link redeemed discount code to this booking (already marked redeemed above)
    if (validatedDiscountId) {
      await supabase
        .from("discount_codes")
        .update({ redeemed_by_booking_id: booking.id })
        .eq("id", validatedDiscountId);
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : customerEmail,
      // Omit `payment_method_types` so Stripe Checkout shows every method enabled
      // in the Dashboard — Apple Pay & Google Pay are auto-surfaced on supported
      // devices when "Wallets" is enabled in Stripe → Settings → Payment methods.
      // Force the wallet button to render on the Checkout page even before
      // domain registration completes by hinting on the payment intent.
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${roomTitle} Session`,
              description: (description || `${roomTitle} — ${bookingDate} at ${bookingTime}`) + discountLabel + promoCodeLabel + giftCardLabel,
            },
            unit_amount: finalAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      // Force 3D Secure on high-value bookings (> $200) for fraud protection.
      payment_intent_data: finalAmount > 20000
        ? { payment_method_options: { card: { request_three_d_secure: "any" } } }
        : undefined,
      success_url: `${req.headers.get("origin")}/booking-success?session_id={CHECKOUT_SESSION_ID}&booking_id=${booking.id}`,
      // PR — Stripe-back handling. When the user hits back/X on the hosted
      // Checkout page, we land them back on the Pay step of the modal with
      // the slot still held. Index.tsx reads payment_cancelled=1 to surface
      // the "your slot is held — try again" toast.
      cancel_url:
        typeof cancelPath === "string" &&
        cancelPath.startsWith("/") &&
        !cancelPath.startsWith("//")
          ? `${req.headers.get("origin")}${cancelPath}?resume=${booking.id}&payment_cancelled=1`
          : `${req.headers.get("origin")}/?book=resume&booking=${booking.id}&payment_cancelled=1`,
      metadata: {
        booking_id: booking.id,
        loyalty_tier: loyaltyTier,
        discount_percent: String(discountPercent),
        gift_card_id: validatedGiftCardId || "",
        gift_card_discount_cents: String(giftCardDiscountCents),
        discount_code_id: validatedDiscountId || "",
        discount_code_cents: String(promoDiscountCents),
      },
    });

    // Update booking with stripe session id
    await supabase
      .from("bookings")
      .update({ stripe_session_id: session.id })
      .eq("id", booking.id);

    // Attach the booking + stripe session to the lock so the webhook can clear it.
    if (slotLockId) {
      await supabase
        .from("slot_locks")
        .update({ stripe_session_id: session.id, booking_id: booking.id })
        .eq("id", slotLockId);
    }

    // Persist idempotency mapping so a retry of the same key returns this URL.
    if (idempotencyKey && typeof idempotencyKey === "string" && session.url) {
      await supabase
        .from("stripe_checkout_idempotency")
        .upsert(
          {
            idempotency_key: idempotencyKey,
            stripe_session_id: session.id,
            stripe_session_url: session.url,
            booking_id: booking.id,
          },
          { onConflict: "idempotency_key" },
        );
    }

    return new Response(JSON.stringify({ 
      url: session.url, 
      bookingId: booking.id,
      loyaltyTier,
      discountPercent,
      discountAmount,
      finalAmount,
      promoDiscountCents,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    // Best-effort: release the lock so the slot frees up immediately.
    if (slotLockId) {
      try {
        await supabase.rpc("release_slot_lock", { p_lock_id: slotLockId });
      } catch { /* ignore */ }
    }
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
