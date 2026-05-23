// Meta Pixel browser helper.
// Pixel ID is loaded once from site_settings via the public RPC `get_meta_pixel_id`.
// All events are no-ops until init() runs and the pixel base script is loaded.
//
// Conventions:
//  - `Purchase` events MUST use a stable `eventID` shared with the server-side
//    Conversions API send (see send-meta-capi-purchase) so Meta dedupes.
//  - All numeric values are USD unless overridden.

import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

let initPromise: Promise<string | null> | null = null;
let pixelId: string | null = null;

const loadBaseScript = (id: string) => {
  if (typeof window === "undefined" || window.fbq) return;
  /* eslint-disable */
  // Standard Meta pixel snippet, kept as close to the canonical version as possible.
  (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
    if (f.fbq) return; n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0";
    n.queue = []; t = b.createElement(e); t.async = !0;
    t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */
  window.fbq?.("init", id);
  window.fbq?.("track", "PageView");
};

export const initMetaPixel = (): Promise<string | null> => {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const { data, error } = await supabase.rpc("get_meta_pixel_id");
      if (error) return null;
      const id = (data as string | null)?.trim();
      if (!id) return null;
      pixelId = id;
      loadBaseScript(id);
      return id;
    } catch {
      return null;
    }
  })();
  return initPromise;
};

const fire = (event: string, params?: Record<string, unknown>, opts?: { eventID?: string }) => {
  if (typeof window === "undefined" || !window.fbq || !pixelId) return;
  if (opts?.eventID) {
    window.fbq("track", event, params ?? {}, { eventID: opts.eventID });
  } else {
    window.fbq("track", event, params ?? {});
  }
};

export const trackPageView = () => fire("PageView");

export const trackViewContent = (params: { contentName: string; contentCategory?: string; valueUsd?: number }) => {
  fire("ViewContent", {
    content_name: params.contentName,
    content_category: params.contentCategory,
    value: params.valueUsd,
    currency: "USD",
  });
};

export const trackInitiateCheckout = (params: { contentName?: string; valueUsd?: number; numItems?: number }) => {
  fire("InitiateCheckout", {
    content_name: params.contentName,
    value: params.valueUsd,
    currency: "USD",
    num_items: params.numItems ?? 1,
  });
};

export const trackPurchase = (params: { eventId: string; valueUsd: number; contentName?: string; contentCategory?: string }) => {
  fire("Purchase", {
    value: params.valueUsd,
    currency: "USD",
    content_name: params.contentName,
    content_category: params.contentCategory,
  }, { eventID: params.eventId });
};

// Read fbp/fbc cookies — used by server-side CAPI for better matching.
export const getMetaCookies = (): { fbp?: string; fbc?: string } => {
  if (typeof document === "undefined") return {};
  const out: { fbp?: string; fbc?: string } = {};
  for (const c of document.cookie.split(";")) {
    const [k, v] = c.trim().split("=");
    if (k === "_fbp") out.fbp = v;
    if (k === "_fbc") out.fbc = v;
  }
  return out;
};
