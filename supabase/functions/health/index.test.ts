import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";

const skip = !SUPABASE_URL || !ANON;

Deno.test({
  name: "health endpoint returns ok or degraded with checks block",
  ignore: skip,
  fn: async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/health`, {
      headers: { Authorization: `Bearer ${ANON}`, apikey: ANON },
    });
    const body = await res.json();
    assert([200, 503].includes(res.status), `unexpected status ${res.status}`);
    assert(body.status === "ok" || body.status === "degraded");
    assert(body.checks?.db !== undefined, "missing db check");
    assert(body.checks?.stripe !== undefined, "missing stripe check");
  },
});

Deno.test({
  name: "health responds to OPTIONS preflight",
  ignore: skip,
  fn: async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/health`, { method: "OPTIONS" });
    await res.text();
    assertEquals(res.status, 200);
  },
});