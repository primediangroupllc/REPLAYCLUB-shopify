// Mirrors a Supabase user as a Shopify customer for CRM / order-history.
//
// Auth: requires a Supabase user JWT. Callers can only mirror their OWN email
// (so a logged-in user can't mass-create customer records in your Shopify).
//
// Flow:
//   1. OAuth client-credentials exchange against Shopify -> short-lived access token.
//   2. Admin GraphQL customers(query:"email:...") -> find existing customer.
//   3. customerUpdate if found, customerCreate if not.
//
// Token-exchange + GraphQL + customer helpers live in ../_shared/shopify-admin.ts
// (shared with stripe-webhook's booking-history writer).
//
// Required Supabase secrets:
//   SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, SHOPIFY_STORE_DOMAIN
//
// Auto-injected by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import {
  type CustomerInput,
  createCustomer,
  findCustomerByEmail,
  getShopifyAccessToken,
  shopifyConfigured,
  updateCustomer,
} from "../_shared/shopify-admin.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  if (!shopifyConfigured()) {
    return json({ error: "Shopify not configured" }, 503);
  }

  // AuthN: require a Supabase user JWT.
  const authHeader = req.headers.get("Authorization") ?? "";
  const userToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7)
    : "";
  if (!userToken) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${userToken}` } },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "unauthorized" }, 401);

  let body: CustomerInput;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  if (!body.email) return json({ error: "email required" }, 400);

  // Lock down to self-mirror only. If you later need server-to-server mirroring
  // (e.g. Stripe webhook -> mirror buyer), add a separate code path keyed off a
  // service-role bearer instead of relaxing this check.
  if (body.email.toLowerCase() !== (user.email ?? "").toLowerCase()) {
    return json({ error: "caller can only mirror their own email" }, 403);
  }

  try {
    const accessToken = await getShopifyAccessToken();
    const existing = await findCustomerByEmail(accessToken, body.email);
    const customer = existing
      ? await updateCustomer(accessToken, existing.id, body)
      : await createCustomer(accessToken, body);

    return json({
      customer_id: customer.id,
      email: customer.email,
      action: existing ? "updated" : "created",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    return json({ error: message }, 500);
  }
});
