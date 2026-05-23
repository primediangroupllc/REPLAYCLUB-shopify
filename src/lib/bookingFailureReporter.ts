import { supabase } from "@/integrations/supabase/client";

// ---- Ring buffers ----------------------------------------------------------

type ConsoleEntry = { ts: string; level: string; message: string };
type NetworkEntry = { ts: string; method: string; url: string; status: number; error?: string };

const CONSOLE_BUFFER: ConsoleEntry[] = [];
const NETWORK_BUFFER: NetworkEntry[] = [];
const MAX_ENTRIES = 25;

function pushConsole(entry: ConsoleEntry) {
  CONSOLE_BUFFER.push(entry);
  if (CONSOLE_BUFFER.length > MAX_ENTRIES) CONSOLE_BUFFER.shift();
}
function pushNetwork(entry: NetworkEntry) {
  NETWORK_BUFFER.push(entry);
  if (NETWORK_BUFFER.length > MAX_ENTRIES) NETWORK_BUFFER.shift();
}

let installed = false;

/** Install global console.error + fetch hooks. Safe to call once at app start. */
export function installBookingFailureCapture() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    try {
      pushConsole({
        ts: new Date().toISOString(),
        level: "error",
        message: args
          .map((a) =>
            a instanceof Error
              ? `${a.name}: ${a.message}`
              : typeof a === "string"
              ? a
              : safeStringify(a),
          )
          .join(" "),
      });
    } catch {
      /* noop */
    }
    origError(...args);
  };

  const origFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const [input, init] = args;
    const method = (init?.method || (typeof input !== "string" && "method" in (input as Request) ? (input as Request).method : "GET") || "GET").toUpperCase();
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : (input as Request).url;
    try {
      const res = await origFetch(...args);
      if (!res.ok) {
        pushNetwork({ ts: new Date().toISOString(), method, url, status: res.status });
      }
      return res;
    } catch (err: any) {
      pushNetwork({
        ts: new Date().toISOString(),
        method,
        url,
        status: 0,
        error: err?.message || String(err),
      });
      throw err;
    }
  };
}

function safeStringify(v: unknown) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

// ---- PII redaction --------------------------------------------------------

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE_RE = /\+?\d[\d\s\-().]{8,}\d/g;
const CARD_RE = /\b(?:\d[ -]*?){13,19}\b/g;
const TOKEN_RE = /(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g;

function redactPii(input: string): string {
  if (!input) return input;
  return input
    .replace(EMAIL_RE, "[email]")
    .replace(CARD_RE, (m) => (m.replace(/\D/g, "").length >= 13 ? "[card]" : m))
    .replace(PHONE_RE, "[phone]")
    .replace(TOKEN_RE, "[token]");
}

// ---- Reporter --------------------------------------------------------------

export interface BookingFailureContext {
  stage: string;                 // e.g. "create-booking-payment"
  error: unknown;                // raw error
  service?: string | null;       // room title / "Equipment Rental"
  bookingDate?: string | null;
  bookingTime?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  amountCents?: number | null;
  stripeSessionId?: string | null;
  bookingId?: string | null;
}

/**
 * Fire-and-forget: emails replayclubrecords@gmail.com with full context.
 * Never throws — failure to report must not break the user's flow.
 */
export async function reportBookingFailure(ctx: BookingFailureContext) {
  try {
    const errorMessage =
      ctx.error instanceof Error
        ? `${ctx.error.name}: ${ctx.error.message}`
        : typeof ctx.error === "string"
        ? ctx.error
        : safeStringify(ctx.error);

    const consoleLog = CONSOLE_BUFFER.slice(-15)
      .map((e) => `[${e.ts}] ${e.message}`)
      .join("\n");

    const networkLog = NETWORK_BUFFER.slice(-15)
      .map((e) => `[${e.ts}] ${e.method} ${e.url} → ${e.status}${e.error ? ` (${e.error})` : ""}`)
      .join("\n");

    // Strip PII from logs before persisting/sending — keep customer email
    // intact only in dedicated columns (separate, queryable, redactable).
    const redactedConsole = redactPii(consoleLog);
    const redactedNetwork = redactPii(networkLog);

    const amountFormatted =
      typeof ctx.amountCents === "number"
        ? `$${(ctx.amountCents / 100).toFixed(2)}`
        : "";

    const payload = {
      templateName: "booking-failure-admin",
      recipientEmail: "replayclubrecords@gmail.com",
      idempotencyKey: `booking-failure-${ctx.stage}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      templateData: {
        stage: ctx.stage,
        errorMessage: errorMessage.slice(0, 500),
        route: window.location.pathname + window.location.search,
        service: ctx.service || "",
        bookingDate: ctx.bookingDate || "",
        bookingTime: ctx.bookingTime || "",
        customerName: ctx.customerName || "",
        customerEmail: ctx.customerEmail || "",
        stripeSessionId: ctx.stripeSessionId || "",
        bookingId: ctx.bookingId || "",
        amountFormatted,
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        consoleLog: redactedConsole,
        networkLog: redactedNetwork,
        occurredAt: new Date().toISOString(),
      },
    };

    // 1) Persist to failure_reports table — feeds the daily admin digest.
    try {
      await (supabase as any).from("failure_reports").insert({
        stage: ctx.stage,
        error_message: errorMessage.slice(0, 1000),
        service: ctx.service || null,
        booking_date: ctx.bookingDate || null,
        booking_time: ctx.bookingTime || null,
        customer_name: ctx.customerName || null,
        customer_email: ctx.customerEmail || null,
        amount_cents: ctx.amountCents ?? null,
        stripe_session_id: ctx.stripeSessionId || null,
        booking_id: ctx.bookingId || null,
        route: window.location.pathname + window.location.search,
        user_agent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        console_log: redactedConsole,
        network_log: redactedNetwork,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("failure_reports insert failed", e);
    }

    // 2) Still send the immediate admin email — digest is for batching follow-ups.
    await supabase.functions.invoke("send-transactional-email", { body: payload });
  } catch (e) {
    // Do not surface to the user — best-effort reporting only.
    // eslint-disable-next-line no-console
    console.warn("reportBookingFailure failed", e);
  }
}