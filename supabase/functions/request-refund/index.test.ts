import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
const skip = !SUPABASE_URL || !ANON;

async function call(body: unknown) {
  return fetch(`${SUPABASE_URL}/functions/v1/request-refund`, {
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
  name: "request-refund rejects empty body",
  ignore: skip,
  fn: async () => {
    const res = await call({});
    await res.text();
    assert(res.status >= 400 && res.status < 500, `expected 4xx, got ${res.status}`);
  },
});

Deno.test({
  name: "request-refund rejects invalid booking id",
  ignore: skip,
  fn: async () => {
    const res = await call({
      bookingId: "00000000-0000-0000-0000-000000000000",
      reason: "test",
      customerEmail: "nobody@example.com",
    });
    await res.text();
    assert(res.status >= 400, `expected error, got ${res.status}`);
  },
});