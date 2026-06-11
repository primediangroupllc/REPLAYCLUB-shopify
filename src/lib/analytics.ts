// First-party funnel telemetry. Appends events to public.analytics_events
// (migration 20260610130000). Fire-and-forget: track() NEVER throws and never
// blocks the UI — a failed insert is silently dropped, because telemetry must
// never break the product. No third-party, no PII beyond the auth user id.
import { supabase } from "@/integrations/supabase/client";

const ANON_KEY = "rc_anon_id";
const SESSION_KEY = "rc_session_id";

function uuid(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Stable per-browser id (localStorage) — survives across sessions, links a
// logged-out visitor to their later signed-in self.
function anonId(): string {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return "no-storage";
  }
}

// Per-tab id (sessionStorage) — one funnel run.
function sessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = uuid();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "no-storage";
  }
}

export type AnalyticsEvent =
  | "homepage_view"
  | "deck_view"
  | "mixes_nav_click"
  | "upload_mix_click"
  | "upload_started"
  | "upload_completed" // carries { upload_index } → return_upload (>=2) / third_mix_uploaded (>=3) are DERIVED, not fired
  | "mix_analysis_started"
  | "mix_analysis_completed";

// Append one event. Best-effort, non-blocking, never rejects.
export async function track(
  event: AnalyticsEvent,
  props: Record<string, unknown> = {},
): Promise<void> {
  try {
    // getSession reads the cached session (no network) — cheap on every event.
    const { data: { session } } = await supabase.auth.getSession();
    // Cast: analytics_events isn't in the generated Database types yet (table
    // ships in this migration). Drop the cast after types are regenerated.
    await (supabase as any).from("analytics_events").insert({
      event,
      user_id: session?.user?.id ?? null,
      anonymous_id: anonId(),
      session_id: sessionId(),
      path: typeof window !== "undefined" ? window.location.pathname : null,
      props,
    });
  } catch {
    // telemetry is best-effort — never surface to the user
  }
}
