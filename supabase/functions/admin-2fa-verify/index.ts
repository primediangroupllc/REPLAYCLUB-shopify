import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";
import * as OTPAuth from "https://esm.sh/otpauth@9.3.6";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const auth = req.headers.get("authorization");
    if (!auth) return j({ error: "Unauthorized" }, 401);
    const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (!user?.email) return j({ error: "Unauthorized" }, 401);

    const { code, enable } = await req.json();
    if (!code) return j({ error: "code required" }, 400);
    const { data: row } = await supabase.from("admin_2fa").select("*").eq("user_id", user.id).maybeSingle();
    if (!row) return j({ error: "Not enrolled" }, 400);

    const totp = new OTPAuth.TOTP({ issuer: "ReplayClub", label: user.email, secret: OTPAuth.Secret.fromBase32(row.secret) });
    const delta = totp.validate({ token: String(code).replace(/\s/g, ""), window: 1 });
    const recoveryHit = (row.recovery_codes as string[]).includes(String(code));

    if (delta === null && !recoveryHit) return j({ valid: false }, 400);

    const update: Record<string, unknown> = { last_verified_at: new Date().toISOString() };
    if (enable) { update.enabled = true; update.enrolled_at = new Date().toISOString(); }
    if (recoveryHit) {
      update.recovery_codes = (row.recovery_codes as string[]).filter((c) => c !== String(code));
    }
    await supabase.from("admin_2fa").update(update).eq("user_id", user.id);
    return j({ valid: true, enabled: !!update.enabled });
  } catch (e) { return j({ error: String(e) }, 500); }
});
function j(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }