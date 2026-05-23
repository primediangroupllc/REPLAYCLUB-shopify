import { shopifyFetch } from '@/lib/shopify';
import type { Product, ProductVariant, ShopifyImage, Money } from '@/lib/shopify-types';

const PRODUCTS_QUERY = `
  query Products($first: Int!) {
    products(first: $first) {
      edges {
        node {
          id
          title
          handle
          description
          featuredImage { url altText }
          priceRange { minVariantPrice { amount currencyCode } }
          variants(first: 20) {
            edges {
              node {
                id
                title
                availableForSale
                price { amount currencyCode }
              }
            }
          }
        }
      }
    }
  }
`;

interface RawProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  featuredImage: ShopifyImage | null;
  priceRange: { minVariantPrice: Money };
  variants: { edges: { node: ProductVariant }[] };
}

interface ProductsResponse {
  products: { edges: { node: RawProduct }[] };
}

export async function getProducts(first = 20): Promise<Product[]> {
  const data = await shopifyFetch<ProductsResponse>({
    query: PRODUCTS_QUERY,
    variables: { first },
  });
  return data.products.edges.map(({ node }) => ({
    ...node,
    variants: node.variants.edges.map((e) => e.node),
  }));
}
