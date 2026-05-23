/// <reference types="vite/client" />

declare module '*.webm' {
  const src: string;
  export default src;
}

/** Injected by Vite at build time. New value every build → client compares
 * against /version.json to detect stale tabs. */
declare const __BUILD_ID__: string;

interface ImportMetaEnv {
  readonly VITE_SHOPIFY_STORE_DOMAIN: string;
  readonly VITE_SHOPIFY_STOREFRONT_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
