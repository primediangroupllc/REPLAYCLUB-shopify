import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAdminAction } from "@/lib/auditLog";
import { ShieldCheck } from "lucide-react";

const SESSION_KEY = "admin_2fa_verified_at";
const SESSION_TTL_MS = 30 * 60 * 1000; // re-verify every 30 min

interface Props {
  children: React.ReactNode;
}

/**
 * Wraps admin pages and forces TOTP verification once per session
 * for any admin who has 2FA enrolled. Admins without enrollment
 * are warned but allowed through (so they can enroll from Profile).
 */
export const AdminTwoFactorGate = ({ children }: Props) => {
  const [status, setStatus] = useState<"loading" | "needs_verify" | "passed" | "not_enrolled">("loading");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus("not_enrolled");
        return;
      }
      const { data: row } = await (supabase as any)
        .from("admin_2fa")
        .select("enabled")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!row?.enabled) {
        setStatus("not_enrolled");
        return;
      }

      // Check session cache
      try {
        const ts = Number(sessionStorage.getItem(SESSION_KEY) || 0);
        if (ts && Date.now() - ts < SESSION_TTL_MS) {
          setStatus("passed");
          return;
        }
      } catch { /* ignore */ }
      setStatus("needs_verify");
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("admin-2fa-verify", {
        body: { code, enable: false },
      });
      if (invokeErr || !(data as any)?.valid) {
        setError("Invalid code. Try again.");
        await logAdminAction("admin_2fa_failed", "admin_session");
        return;
      }
      sessionStorage.setItem(SESSION_KEY, String(Date.now()));
      await logAdminAction("admin_2fa_verified", "admin_session");
      setStatus("passed");
    } catch {
      setError("Verification failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (status === "needs_verify") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <form
          onSubmit={submit}
          className="w-full max-w-sm space-y-5 rounded-2xl border border-border/40 bg-card/40 backdrop-blur p-7 shadow-2xl"
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <ShieldCheck className="w-9 h-9 text-primary" />
            <h2 className="text-base font-display font-semibold uppercase tracking-[0.2em]">
              2FA Required
            </h2>
            <p className="text-xs text-muted-foreground">
              Enter the 6-digit code from your authenticator app to access the admin dashboard.
            </p>
          </div>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="123456"
            className="w-full text-center text-xl tracking-[0.5em] font-mono py-3 rounded-md bg-background border border-border focus:border-primary focus:outline-none"
          />
          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={submitting || code.length < 6}
            className="w-full py-2.5 rounded-md text-xs font-display font-semibold uppercase tracking-[0.2em] bg-primary text-primary-foreground disabled:opacity-50 transition-opacity"
          >
            {submitting ? "Verifying…" : "Verify"}
          </button>
          <p className="text-[10px] text-muted-foreground text-center">
            Lost your device? Enter a recovery code instead.
          </p>
        </form>
      </div>
    );
  }

  return <>{children}</>;
};