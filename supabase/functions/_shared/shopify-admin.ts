// Shared Shopify Admin API helpers.
//
// Client-credentials token exchange + Admin GraphQL, plus customer mirror and
// booking-history writes. Used by customer-sync (signup -> mirror customer) and
// stripe-webhook (booking paid -> record booking on the customer).
//
// Required Supabase secrets:
//   SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, SHOPIFY_STORE_DOMAIN
//
// The Shopify custom app must have the `write_customers` scope (covers customer
// create/update, tags, and customer-owned metafields).

const SHOPIFY_CLIENT_ID = Deno.env.get("SHOPIFY_CLIENT_ID") ?? "";
const SHOPIFY_CLIENT_SECRET = Deno.env.get("SHOPIFY_CLIENT_SECRET") ?? "";
const SHOPIFY_STORE_DOMAIN = Deno.env.get("SHOPIFY_STORE_DOMAIN") ?? "";
const SHOPIFY_API_VERSION = "2026-04";

/** True only when all three Shopify secrets are present. Callers should gate on
 *  this so missing-secret environments no-op instead of throwing. */
export function shopifyConfigured(): boolean {
  return Boolean(SHOPIFY_CLIENT_ID && SHOPIFY_CLIENT_SECRET && SHOPIFY_STORE_DOMAIN);
}

export interface ShopifyCustomer {
  id: string;
  email: string;
}

export interface CustomerInput {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  tags?: string[];
}

export interface BookingRecord {
  id: string;
  studio: string;
  date: string;
  time?: string;
  price: string;
}

interface UserError {
  field: string[] | null;
  message: string;
}

export async function getShopifyAccessToken(): Promise<string> {
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

export async function shopifyAdminGraphQL<T>(
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

export async function findCustomerByEmail(
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

export async function createCustomer(
  accessToken: string,
  input: CustomerInput,
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

export async function updateCustomer(
  accessToken: string,
  id: string,
  input: CustomerInput,
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

/** Find a customer by email, creating one if none exists. Does NOT update an
 *  existing customer's profile fields (use updateCustomer for that). */
export async function findOrCreateCustomer(
  accessToken: string,
  input: CustomerInput,
): Promise<{ customer: ShopifyCustomer; action: "found" | "created" }> {
  const existing = await findCustomerByEmail(accessToken, input.email);
  if (existing) return { customer: existing, action: "found" };
  const created = await createCustomer(accessToken, input);
  return { customer: created, action: "created" };
}

/** Append a booking to the customer's replayclub.bookings JSON metafield.
 *  Idempotent: a booking whose id is already recorded is skipped, so replayed
 *  Stripe webhooks don't duplicate history. */
export async function appendBookingToCustomer(
  accessToken: string,
  customerId: string,
  booking: BookingRecord,
): Promise<{ appended: boolean }> {
  const read = await shopifyAdminGraphQL<{
    customer: { metafield: { value: string } | null } | null;
  }>(
    accessToken,
    `query CustomerBookings($id: ID!) {
       customer(id: $id) {
         metafield(namespace: "replayclub", key: "bookings") { value }
       }
     }`,
    { id: customerId },
  );

  let bookings: BookingRecord[] = [];
  const raw = read.customer?.metafield?.value;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) bookings = parsed;
    } catch {
      bookings = [];
    }
  }

  if (bookings.some((b) => b?.id === booking.id)) {
    return { appended: false };
  }
  bookings.push(booking);

  const write = await shopifyAdminGraphQL<{
    metafieldsSet: { userErrors: UserError[] };
  }>(
    accessToken,
    `mutation SetBookings($metafields: [MetafieldsSetInput!]!) {
       metafieldsSet(metafields: $metafields) {
         userErrors { field message }
       }
     }`,
    {
      metafields: [
        {
          ownerId: customerId,
          namespace: "replayclub",
          key: "bookings",
          type: "json",
          value: JSON.stringify(bookings),
        },
      ],
    },
  );
  if (write.metafieldsSet.userErrors.length) {
    throw new Error(write.metafieldsSet.userErrors.map((e) => e.message).join("; "));
  }
  return { appended: true };
}

/** Add marketing/segment tags to a customer (Shopify dedupes existing tags). */
export async function addCustomerTags(
  accessToken: string,
  customerId: string,
  tags: string[],
): Promise<void> {
  if (!tags.length) return;
  const data = await shopifyAdminGraphQL<{
    tagsAdd: { userErrors: UserError[] };
  }>(
    accessToken,
    `mutation AddTags($id: ID!, $tags: [String!]!) {
       tagsAdd(id: $id, tags: $tags) {
         userErrors { field message }
       }
     }`,
    { id: customerId, tags },
  );
  if (data.tagsAdd.userErrors.length) {
    throw new Error(data.tagsAdd.userErrors.map((e) => e.message).join("; "));
  }
}
