import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
const skip = !SUPABASE_URL || !ANON;

async function call(body: unknown) {
  return fetch(`${SUPABASE_URL}/functions/v1/validate-gift-card`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ANON}`,
      apikey: ANON,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

Deno.test({
  name: "validate-gift-card rejects missing code",
  ignore: skip,
  fn: async () => {
    const res = await call({});
    await res.text();
    assert(res.status >= 400 && res.status < 500, `expected 4xx, got ${res.status}`);
  },
});

Deno.test({
  name: "validate-gift-card returns 404 for unknown code",
  ignore: skip,
  fn: async () => {
    const res = await call({ code: "GC-DOES-NOT-EXIST-9999" });
    const body = await res.json().catch(() => ({}));
    assert(res.status === 404 || body?.valid === false, `expected not-valid, got ${res.status}`);
  },
});

Deno.test({
  name: "validate-gift-card handles OPTIONS",
  ignore: skip,
  fn: async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/validate-gift-card`, { method: "OPTIONS" });
    await res.text();
    assertEquals(res.status, 200);
  },
});