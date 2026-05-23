// Admin-only: server-side HEAD-check a list of URLs and report status + final
// URL. Routed through an edge function because client-side fetch() to the
// public site host is blocked by CORS.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TIMEOUT_MS = 8000;
const MAX_URLS = 50;

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

  // 1) AuthN: require a real Supabase user JWT in Authorization header.
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
  if (!token) return json({ error: "unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: "unauthorized" }, 401);

  // 2) AuthZ: must be admin.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (roleErr || !isAdmin) return json({ error: "forbidden" }, 403);

  // 3) Parse body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const { urls, base } = (body ?? {}) as { urls?: unknown; base?: unknown };
  if (!Array.isArray(urls) || urls.length === 0 || urls.length > MAX_URLS) {
    return json({ error: "invalid_urls", max: MAX_URLS }, 400);
  }
  const baseHost = typeof base === "string" && /^https:\/\/[^\/]+$/.test(base)
    ? base
    : "https://replayclub.io";

  // 4) Run checks in parallel with timeouts.
  const results = await Promise.all(
    urls.map(async (raw) => {
      const path = String(raw);
      const fullUrl = path.startsWith("http") ? path : `${baseHost}${path}`;
      const startedAt = Date.now();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        // Try HEAD first, fall back to GET if the host rejects HEAD.
        let res = await fetch(fullUrl, {
          method: "HEAD",
          redirect: "follow",
          signal: ctrl.signal,
        });
        if (res.status === 405 || res.status === 501) {
          res = await fetch(fullUrl, {
            method: "GET",
            redirect: "follow",
            signal: ctrl.signal,
          });
        }
        return {
          url: path,
          fullUrl,
          status: res.status,
          finalUrl: res.url,
          ok: res.ok,
          durationMs: Date.now() - startedAt,
          checkedAt: new Date().toISOString(),
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          url: path,
          fullUrl,
          status: null,
          finalUrl: null,
          ok: false,
          error: /aborted|timeout/i.test(msg) ? "timeout" : msg,
          durationMs: Date.now() - startedAt,
          checkedAt: new Date().toISOString(),
        };
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  return json({ ok: true, base: baseHost, results });
});
