import { createClient } from "npm:@supabase/supabase-js@2.57.2";

/**
 * Lightweight DB-backed rate limiter for edge functions.
 * Buckets requests per (bucket, identifier, time-window) using a unique-key
 * counter table. Returns 429 helpers when callers exceed the threshold.
 *
 * NOTE: this is an ad-hoc primitive — the platform doesn't ship a hardened
 * rate-limit service yet. Good enough to deflect double-clicks and crude
 * abuse, NOT a substitute for Cloudflare/WAF for sustained attacks.
 */
export interface RateLimitOpts {
  bucket: string;        // e.g. "create-booking-payment"
  identifier: string;    // ip or email
  max: number;           // requests allowed per window
  windowSeconds: number; // window length
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  retryAfter: number; // seconds
}

let _client: ReturnType<typeof createClient> | null = null;
function getClient() {
  if (_client) return _client;
  _client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  return _client;
}

export async function checkRateLimit(opts: RateLimitOpts): Promise<RateLimitResult> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_bucket: opts.bucket,
      p_identifier: opts.identifier,
      p_max: opts.max,
      p_window_seconds: opts.windowSeconds,
    });
    if (error) {
      console.warn("rate-limit RPC failed, allowing through:", error.message);
      return { allowed: true, count: 0, retryAfter: 0 };
    }
    const row = Array.isArray(data) ? data[0] : data;
    return {
      allowed: !!row?.allowed,
      count: row?.current_count ?? 0,
      retryAfter: row?.retry_after_seconds ?? 0,
    };
  } catch (e) {
    console.warn("rate-limit threw, allowing through:", e);
    return { allowed: true, count: 0, retryAfter: 0 };
  }
}

/** Extract caller IP from common proxy headers. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
}

export function rateLimitResponse(result: RateLimitResult, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({
      error: "Too many requests. Please slow down and try again shortly.",
      retry_after: result.retryAfter,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(Math.max(1, result.retryAfter)),
      },
    },
  );
}