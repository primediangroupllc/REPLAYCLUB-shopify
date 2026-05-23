// Origin-aware CORS helper for all edge functions.
//
// USAGE in a Deno.serve handler:
//   import { buildCorsHeaders } from "../_shared/cors.ts";
//   Deno.serve(async (req) => {
//     const corsHeaders = buildCorsHeaders(req);
//     if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
//     // ...rest of handler — existing `...corsHeaders` spreads keep working
//   });
//
// IMPORTANT — DO NOT add `Access-Control-Allow-Credentials: true` here.
// We authenticate via Bearer tokens in the Authorization header, not cookies.
// Setting credentials=true alongside origin echo (which we do below) is a
// known XSS-pivot footgun: a compromised allowlisted subdomain could ride a
// victim's session. If a future change ever requires cookie auth, that needs
// its own design review — don't just flip this flag.

const STATIC_ALLOWED_ORIGINS = new Set<string>([
  "https://replayclub.io",
  "https://www.replayclub.io",
]);

// Lovable preview domains. Lovable serves previews from three roots:
// `*.lovable.app`, `*.lovable.dev`, and `*.lovableproject.com`. Anchored
// `^...$` so neither `evil.lovableproject.com.attacker.com` nor `notlovable.app`
// can match. The single hostname-label restriction (`[a-z0-9-]+`) prevents
// nested subdomain abuse.
const LOVABLE_PREVIEW_PATTERN = /^https:\/\/[a-z0-9-]+\.(lovable\.app|lovable\.dev|lovableproject\.com)$/;

// Vercel preview/production URLs for the off-Lovable Shopify fork
// (primediangroupllc/REPLAYCLUB-shopify). Matches e.g.
// `https://replayclub-shopify-kewezdrml-replay-club.vercel.app`.
const VERCEL_REPLAYCLUB_PATTERN = /^https:\/\/replayclub-shopify(-[a-z0-9-]+)?\.vercel\.app$/;

const FALLBACK_ORIGIN = "https://replayclub.io";

// Allowed request headers (union of all patterns observed across the 63
// functions). The `x-supabase-client-*` set is non-security-sensitive
// diagnostic info the Supabase JS SDK sends in newer versions; including
// them here means functions that previously needed a custom Allow-Headers
// list (like create-booking-payment) can now use the shared helper without
// CORS preflight breakage.
const ALLOWED_HEADERS = [
  "authorization",
  "x-client-info",
  "apikey",
  "content-type",
  "x-supabase-client-platform",
  "x-supabase-client-platform-version",
  "x-supabase-client-runtime",
  "x-supabase-client-runtime-version",
].join(", ");

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (STATIC_ALLOWED_ORIGINS.has(origin)) return true;
  if (LOVABLE_PREVIEW_PATTERN.test(origin)) return true;
  return VERCEL_REPLAYCLUB_PATTERN.test(origin);
}

export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allowOrigin = isAllowedOrigin(origin) ? origin! : FALLBACK_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
}
