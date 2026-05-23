import { useEffect } from "react";

const KEY = "rc_utm_v1";
const FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

export type UtmData = Partial<Record<typeof FIELDS[number] | "referrer_url", string>>;

export function useUtmCapture() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const captured: UtmData = {};
      FIELDS.forEach((f) => {
        const v = params.get(f);
        if (v) captured[f] = v.slice(0, 200);
      });
      if (document.referrer && !document.referrer.includes(window.location.host)) {
        captured.referrer_url = document.referrer.slice(0, 500);
      }
      if (Object.keys(captured).length > 0) {
        const existing = sessionStorage.getItem(KEY);
        if (!existing) {
          sessionStorage.setItem(KEY, JSON.stringify({ ...captured, captured_at: new Date().toISOString() }));
        }
      }
    } catch { /* noop */ }
  }, []);
}

export function getUtmData(): UtmData {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const out: UtmData = {};
    FIELDS.forEach((f) => { if (parsed[f]) out[f] = parsed[f]; });
    if (parsed.referrer_url) out.referrer_url = parsed.referrer_url;
    return out;
  } catch { return {}; }
}