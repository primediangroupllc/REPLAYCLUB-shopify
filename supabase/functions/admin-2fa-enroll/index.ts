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
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return j({ error: "Forbidden" }, 403);

    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({ issuer: "ReplayClub", label: user.email, secret });
    const recovery = Array.from({ length: 8 }, () => {
      const bytes = new Uint8Array(10); // 80 bits per code
      crypto.getRandomValues(bytes);
      return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    });

    await supabase.from("admin_2fa").upsert({
      user_id: user.id,
      secret: secret.base32,
      recovery_codes: recovery,
      enabled: false,
    }, { onConflict: "user_id" });

    return j({ otpauth_url: totp.toString(), secret: secret.base32, recovery_codes: recovery });
  } catch (e) { return j({ error: String(e) }, 500); }
});
function j(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }