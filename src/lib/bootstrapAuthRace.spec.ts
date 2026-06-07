/**
 * Regression test for the "Verify with Stripe" dead-lock (auth-race, 2026-06-07).
 *
 * Bug: the homepage guest prefetch cached `{ user: null }` under the shared key
 * ["booking-bootstrap", ""] (staleTime 30s). A guest who signed up via SPA
 * navigation (no reload) then had the modal read that still-fresh null → email
 * never seeded → readOnly box empty → button dead-locked.
 *
 * Fix: the cache key encodes identity (bootstrapKey: "anon" vs the user id), so a
 * guest's "anon" entry can NEVER be served to a signed-in modal. This test drives
 * the REAL prefetch + REAL bootstrapKey + REAL supabase client against the REAL
 * local backend and asserts the collision is gone and the authed fetch seeds the
 * real email.
 *
 * LOCAL-ONLY: requires the local Supabase stack + LOCAL_SERVICE_KEY. Skips
 * (does not fail) when the client isn't pointed at 127.0.0.1, so CI stays green.
 * The supabase client + prefetch helper are dynamic-imported inside the gated
 * block so the CI vitest job (which has no VITE_SUPABASE_URL) never instantiates
 * the client (createClient throws on missing env). Run via the local harness:
 *   VITE_SUPABASE_URL=http://127.0.0.1:54321 \
 *   VITE_SUPABASE_PUBLISHABLE_KEY=<local anon> LOCAL_SERVICE_KEY=<local service> \
 *   npx vitest run src/lib/bootstrapAuthRace.spec.ts
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";

const URL = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const SERVICE_KEY = process.env.LOCAL_SERVICE_KEY || "";
const LOCAL = URL.includes("127.0.0.1") && !!SERVICE_KEY;

// Triple-fake synthetic identity; deleted in afterAll by exact uid.
const EMAIL = "bootstrap-race-9c4d2@example.invalid";
const PASSWORD = "Race-Pass-9c4d2!";
const DOB = "1990-01-01"; // 18+ so handle_new_user doesn't RAISE

// Loaded dynamically in beforeAll (only when LOCAL) — see file header.
let supabase: SupabaseClient;
let prefetchBookingBootstrap: (qc: QueryClient, email?: string) => Promise<unknown>;
let bootstrapKey: (userId: string | null | undefined, email?: string) => readonly unknown[];

let createdUserId: string | null = null;
const admin = LOCAL ? createClient(URL, SERVICE_KEY, { auth: { persistSession: false } }) : (null as any);

// prefetchBookingBootstrap warms the cache; await its settling before reading.
async function settle(qc: QueryClient, key: readonly unknown[]) {
  for (let i = 0; i < 100; i++) {
    const s = qc.getQueryState(key);
    if (s && s.fetchStatus === "idle" && s.status !== "pending") return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("query did not settle");
}

describe.skipIf(!LOCAL)("booking-bootstrap auth-race regression (local backend)", () => {
  beforeAll(async () => {
    ({ supabase } = await import("@/integrations/supabase/client"));
    ({ prefetchBookingBootstrap, bootstrapKey } = await import("@/lib/prefetchBookingBootstrap"));

    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: "Race Tester", date_of_birth: DOB },
    });
    if (error && !/already.*registered/i.test(error.message)) throw error;
    createdUserId = data?.user?.id ?? null;
    if (!createdUserId) {
      const { data: list } = await admin.auth.admin.listUsers();
      createdUserId = list?.users?.find((u: any) => u.email === EMAIL)?.id ?? null;
    }
    expect(createdUserId).toBeTruthy();
  });

  afterAll(async () => {
    await supabase?.auth.signOut().catch(() => {});
    if (createdUserId) await admin.auth.admin.deleteUser(createdUserId).catch(() => {});
  });

  it("bootstrapKey encodes identity — guest 'anon' never collides with a user", () => {
    expect(bootstrapKey(null)).toEqual(["booking-bootstrap", "anon", ""]);
    expect(bootstrapKey(undefined)).toEqual(["booking-bootstrap", "anon", ""]);
    expect(bootstrapKey("user-123")).toEqual(["booking-bootstrap", "user-123", ""]);
    expect(bootstrapKey(null)).not.toEqual(bootstrapKey("user-123"));
    // email is a secondary dimension, lowercased
    expect(bootstrapKey("u", "A@B.com")).toEqual(["booking-bootstrap", "u", "a@b.com"]);
  });

  it("a guest's cached null is NOT served to the signed-in modal; the authed key seeds the real email", async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { staleTime: 30_000, retry: false, gcTime: 5 * 60_000 } },
    });

    // 1) GUEST homepage prefetch (no session) → caches under the "anon" key.
    await supabase.auth.signOut();
    prefetchBookingBootstrap(qc);
    await settle(qc, bootstrapKey(null));
    const guestCached = qc.getQueryData<any>(bootstrapKey(null));
    expect(guestCached.user, "guest entry holds a null user").toBeNull();

    // 2) Guest signs up / logs in — SPA, no reload → same QueryClient survives.
    const { error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
    expect(error).toBeNull();
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session!.user.id;
    expect(uid).toBe(createdUserId);

    // 3) The modal now keys on the user id — a DIFFERENT entry than the guest
    //    "anon" slot, so it cannot read the stale null (the bug is structurally
    //    impossible now).
    const modalKey = bootstrapKey(uid, ""); // modal opens with email state still ""
    expect(modalKey).not.toEqual(bootstrapKey(null));
    expect(qc.getQueryData(modalKey), "modal key is a cache MISS, not the stale null").toBeUndefined();

    // 4) The modal fetches under its identity key (here via the real prefetch,
    //    now authed) → the real email seeds. No dead-lock.
    prefetchBookingBootstrap(qc);
    await settle(qc, modalKey);
    const seeded = qc.getQueryData<any>(modalKey);
    expect(seeded.user?.email, "authed modal seeds the real email").toBe(EMAIL);

    // 5) The guest "anon" entry is untouched — just never read by the modal.
    expect(qc.getQueryData<any>(bootstrapKey(null)).user).toBeNull();
  });
});
