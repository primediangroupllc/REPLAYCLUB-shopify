import { shopifyFetch } from '@/lib/shopify';
import type { Cart, CartLine, CartLineInput, CartLineUpdateInput } from '@/lib/shopify-types';

const CART_FRAGMENT = `
  id
  checkoutUrl
  totalQuantity
  cost {
    subtotalAmount { amount currencyCode }
    totalAmount { amount currencyCode }
  }
  lines(first: 100) {
    edges {
      node {
        id
        quantity
        merchandise {
          ... on ProductVariant {
            id
            title
            price { amount currencyCode }
            product { title featuredImage { url altText } }
          }
        }
      }
    }
  }
`;

interface RawCart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: Cart['cost'];
  lines: { edges: { node: CartLine }[] };
}

interface CartMutationResult {
  cart: RawCart | null;
  userErrors: { field: string[] | null; message: string }[];
}

function normalizeCart(raw: RawCart | null): Cart | null {
  if (!raw) return null;
  return {
    id: raw.id,
    checkoutUrl: raw.checkoutUrl,
    totalQuantity: raw.totalQuantity,
    cost: raw.cost,
    lines: raw.lines.edges.map((e) => e.node),
  };
}

async function runCartMutation(
  mutationName: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<Cart> {
  const data = await shopifyFetch<Record<string, CartMutationResult>>({ query, variables });
  const result = data[mutationName];
  if (result.userErrors?.length) {
    throw new Error(result.userErrors.map((e) => e.message).join('; '));
  }
  const cart = normalizeCart(result.cart);
  if (!cart) throw new Error('Shopify returned no cart');
  return cart;
}

export async function createCart(lines: CartLineInput[]): Promise<Cart> {
  const query = `
    mutation CartCreate($lines: [CartLineInput!]) {
      cartCreate(input: { lines: $lines }) {
        cart { ${CART_FRAGMENT} }
        userErrors { field message }
      }
    }
  `;
  return runCartMutation('cartCreate', query, { lines });
}

export async function addToCart(cartId: string, lines: CartLineInput[]): Promise<Cart> {
  const query = `
    mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart { ${CART_FRAGMENT} }
        userErrors { field message }
      }
    }
  `;
  return runCartMutation('cartLinesAdd', query, { cartId, lines });
}

export async function updateCartLines(
  cartId: string,
  lines: CartLineUpdateInput[],
): Promise<Cart> {
  const query = `
    mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) {
        cart { ${CART_FRAGMENT} }
        userErrors { field message }
      }
    }
  `;
  return runCartMutation('cartLinesUpdate', query, { cartId, lines });
}

export async function removeCartLines(cartId: string, lineIds: string[]): Promise<Cart> {
  const query = `
    mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart { ${CART_FRAGMENT} }
        userErrors { field message }
      }
    }
  `;
  return runCartMutation('cartLinesRemove', query, { cartId, lineIds });
}

export async function getCart(cartId: string): Promise<Cart | null> {
  const query = `query GetCart($cartId: ID!) { cart(id: $cartId) { ${CART_FRAGMENT} } }`;
  const data = await shopifyFetch<{ cart: RawCart | null }>({ query, variables: { cartId } });
  return normalizeCart(data.cart);
}
