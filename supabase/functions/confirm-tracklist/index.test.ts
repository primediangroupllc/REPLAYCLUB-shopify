// Integration contract for confirm-tracklist. Skips unless a deployed instance +
// env are present (mirrors the other edge-fn tests), so it's green locally and in
// CI without deployment, and exercises the auth gate once deployed.
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
const skip = !SUPABASE_URL || !ANON;

Deno.test({
  name: "confirm-tracklist rejects non-admin / unauthenticated callers",
  ignore: skip,
  fn: async () => {
    // Anon-only call (no admin JWT) must be rejected (401/403), never confirm.
    const res = await fetch(`${SUPABASE_URL}/functions/v1/confirm-tracklist`, {
      method: "POST",
      headers: { apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ mix_id: "00000000-0000-0000-0000-000000000000" }),
    });
    await res.text();
    assert([401, 403].includes(res.status), `expected 401/403, got ${res.status}`);
  },
});
