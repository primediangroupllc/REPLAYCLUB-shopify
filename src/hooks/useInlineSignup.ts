import { useState, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Inline account creation for the Layer 2 "account at checkout" step.
 *
 * Encapsulates the auth primitives the inline "your details / almost done" step
 * needs, matching Auth.tsx's signup shapes exactly (display_name + date_of_birth
 * metadata, captcha, Shopify customer-sync). The A2 OTP sub-step survives the
 * launch toggle (mailer_autoconfirm=false): when signUp returns no session, the
 * caller drives an inline 6-digit code via verifyOtp({ type: 'signup' }).
 *
 * This is a primitives hook — it does NOT own the state machine. The checkout
 * component (Chunk 2) composes details → submitting → awaiting_code → ... from
 * these calls. NOT wired into any component yet.
 */

export interface InlineSignupInput {
  email: string;
  password: string;
  displayName: string;
  /** Already validated by the caller via validateDob() (dob.ts). null only if invalid (the DB trigger is the server-side 18+ defense). */
  dobIso: string | null;
  captchaToken: string;
}

export type InlineSignUpResult =
  | { status: "session"; session: Session }   // autoconfirm on → immediately signed in
  | { status: "needs_otp" }                   // confirmation required → drive the OTP sub-step
  | { status: "email_exists" }                // already registered → offer inline login
  | { status: "error"; message: string };

export type InlineVerifyResult =
  | { status: "session"; session: Session }
  | { status: "error"; message: string };

// Fire-and-forget Shopify CRM mirror, mirroring Auth.tsx. Idempotent + .catch-guarded
// so a Shopify hiccup never blocks account creation. Runs once a session exists
// (covers both the autoconfirm path and the post-OTP path).
const syncCustomer = (email: string, displayName: string) => {
  const [firstName, ...rest] = (displayName ?? "").trim().split(/\s+/).filter(Boolean);
  supabase.functions
    .invoke("customer-sync", {
      body: {
        email: email.trim().toLowerCase(),
        first_name: firstName || undefined,
        last_name: rest.length ? rest.join(" ") : undefined,
      },
    })
    .catch((e) => console.error("Shopify customer-sync (inline signup) failed:", e));
};

export function useInlineSignup() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signUp = useCallback(async (input: InlineSignupInput): Promise<InlineSignUpResult> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: { display_name: input.displayName, date_of_birth: input.dobIso },
          captchaToken: input.captchaToken,
        },
      });

      if (error) {
        // Confirmations OFF surfaces an explicit "already registered" error.
        if (/already.*registered|already.*exists/i.test(error.message)) {
          return { status: "email_exists" };
        }
        setError(error.message);
        return { status: "error", message: error.message };
      }

      // Confirmations ON: GoTrue obfuscates an existing email as a 200 with an
      // empty identities array (anti-enumeration) — treat it as "already exists".
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return { status: "email_exists" };
      }

      if (data.session) {
        syncCustomer(input.email, input.displayName);
        return { status: "session", session: data.session };
      }

      // No session + real user → confirmation required → OTP sub-step (A2).
      return { status: "needs_otp" };
    } catch (e: any) {
      const message = e?.message ?? "Sign up failed";
      setError(message);
      return { status: "error", message };
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyOtp = useCallback(
    async ({ email, token, displayName }: { email: string; token: string; displayName: string }): Promise<InlineVerifyResult> => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.auth.verifyOtp({ type: "signup", email, token });
        if (error) {
          setError(error.message);
          return { status: "error", message: error.message };
        }
        if (!data.session) {
          const message = "Could not verify the code. Please try again.";
          setError(message);
          return { status: "error", message };
        }
        // First session for this account → mirror to Shopify now (Auth.tsx does
        // this at first login for the confirmation-required path).
        syncCustomer(email, displayName);
        return { status: "session", session: data.session };
      } catch (e: any) {
        const message = e?.message ?? "Verification failed";
        setError(message);
        return { status: "error", message };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const resendOtp = useCallback(async ({ email }: { email: string }): Promise<{ ok: boolean; message?: string }> => {
    setError(null);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) return { ok: false, message: error.message };
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: e?.message ?? "Could not resend the code" };
    }
  }, []);

  // Inline sign-in for the "email already exists" path: the guest entered an
  // email that already has an account, so sign them in (password) and continue
  // the booking. Requires a FRESH captcha token: the details-step token was
  // consumed by the signUp attempt, and login IS server-captcha-gated once
  // security_captcha_enabled=true. The caller re-shows the captcha in login mode.
  const signIn = useCallback(
    async ({ email, password, captchaToken }: { email: string; password: string; captchaToken: string }): Promise<InlineVerifyResult> => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } });
        if (error) {
          setError(error.message);
          return { status: "error", message: error.message };
        }
        if (!data.session) {
          const message = "Could not sign in. Please check your password.";
          setError(message);
          return { status: "error", message };
        }
        syncCustomer(email, ""); // login mirror — email only, matching Auth.tsx
        return { status: "session", session: data.session };
      } catch (e: any) {
        const message = e?.message ?? "Sign in failed";
        setError(message);
        return { status: "error", message };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { loading, error, signUp, verifyOtp, resendOtp, signIn };
}
