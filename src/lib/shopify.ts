const domain = import.meta.env.VITE_SHOPIFY_STORE_DOMAIN;
const token = import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN;

interface ShopifyFetchArgs {
  query: string;
  variables?: Record<string, unknown>;
}

export async function shopifyFetch<T>({ query, variables = {} }: ShopifyFetchArgs): Promise<T> {
  if (!domain || !token) {
    throw new Error(
      'Missing Shopify env vars (VITE_SHOPIFY_STORE_DOMAIN / VITE_SHOPIFY_STOREFRONT_TOKEN)',
    );
  }

  const res = await fetch(`https://${domain}/api/2026-04/graphql.json`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();

  if (json.errors?.length) {
    throw new Error(json.errors.map((e: { message: string }) => e.message).join('; '));
  }
  return json.data as T;
}
