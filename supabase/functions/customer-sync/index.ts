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
// Required Supabase secrets:
//   SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, SHOPIFY_STORE_DOMAIN
//
// Auto-injected by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHOPIFY_CLIENT_ID = Deno.env.get("SHOPIFY_CLIENT_ID")!;
const SHOPIFY_CLIENT_SECRET = Deno.env.get("SHOPIFY_CLIENT_SECRET")!;
const SHOPIFY_STORE_DOMAIN = Deno.env.get("SHOPIFY_STORE_DOMAIN")!;
const SHOPIFY_API_VERSION = "2026-04";

interface MirrorRequest {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  tags?: string[];
}

interface ShopifyCustomer {
  id: string;
  email: string;
}

interface UserError {
  field: string[] | null;
  message: string;
}

async function getShopifyAccessToken(): Promise<string> {
  const res = await fetch(
    `https://${SHOPIFY_STORE_DOMAIN}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
        grant_type: "client_credentials",
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify token exchange failed (${res.status}): ${text}`);
  }
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("Shopify token exchange returned no access_token");
  return body.access_token;
}

async function shopifyAdminGraphQL<T>(
  accessToken: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(
    `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    },
  );
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  if (!json.data) throw new Error("Shopify Admin GraphQL returned no data");
  return json.data;
}

async function findCustomerByEmail(
  accessToken: string,
  email: string,
): Promise<ShopifyCustomer | null> {
  const data = await shopifyAdminGraphQL<{
    customers: { edges: { node: ShopifyCustomer }[] };
  }>(
    accessToken,
    `query FindCustomer($q: String!) {
       customers(first: 1, query: $q) {
         edges { node { id email } }
       }
     }`,
    { q: `email:${email}` },
  );
  return data.customers.edges[0]?.node ?? null;
}

async function createCustomer(
  accessToken: string,
  input: MirrorRequest,
): Promise<ShopifyCustomer> {
  const data = await shopifyAdminGraphQL<{
    customerCreate: { customer: ShopifyCustomer | null; userErrors: UserError[] };
  }>(
    accessToken,
    `mutation CustomerCreate($input: CustomerInput!) {
       customerCreate(input: $input) {
         customer { id email }
         userErrors { field message }
       }
     }`,
    {
      input: {
        email: input.email,
        firstName: input.first_name,
        lastName: input.last_name,
        phone: input.phone,
        tags: input.tags,
      },
    },
  );
  if (data.customerCreate.userErrors.length) {
    throw new Error(data.customerCreate.userErrors.map((e) => e.message).join("; "));
  }
  if (!data.customerCreate.customer) throw new Error("customerCreate returned null customer");
  return data.customerCreate.customer;
}

async function updateCustomer(
  accessToken: string,
  id: string,
  input: MirrorRequest,
): Promise<ShopifyCustomer> {
  const data = await shopifyAdminGraphQL<{
    customerUpdate: { customer: ShopifyCustomer | null; userErrors: UserError[] };
  }>(
    accessToken,
    `mutation CustomerUpdate($input: CustomerInput!) {
       customerUpdate(input: $input) {
         customer { id email }
         userErrors { field message }
       }
     }`,
    {
      input: {
        id,
        firstName: input.first_name,
        lastName: input.last_name,
        phone: input.phone,
        tags: input.tags,
      },
    },
  );
  if (data.customerUpdate.userErrors.length) {
    throw new Error(data.customerUpdate.userErrors.map((e) => e.message).join("; "));
  }
  if (!data.customerUpdate.customer) throw new Error("customerUpdate returned null customer");
  return data.customerUpdate.customer;
}

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

  let body: MirrorRequest;
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
