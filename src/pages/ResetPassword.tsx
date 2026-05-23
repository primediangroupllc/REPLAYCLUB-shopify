import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifyingLink, setVerifyingLink] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [checked, setChecked] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [tokenHash, setTokenHash] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const clearRecoveryParams = () => {
    if (typeof window === "undefined") return;
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  const markRecoveryReady = () => {
    setIsRecovery(true);
    setTokenHash(null);
    setLinkError(null);
    setChecked(true);
    clearRecoveryParams();
  };

  const markInvalid = (message?: string) => {
    setIsRecovery(false);
    setLinkError(message ?? "This reset link is invalid or has expired.");
    setChecked(true);
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "PASSWORD_RECOVERY") {
        markRecoveryReady();
        return;
      }

      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        markRecoveryReady();
      }
    });

    const resolveRecoverySession = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const code = searchParams.get("code");
        const searchType = searchParams.get("type");
        const hashType = hashParams.get("type");
        const recoveryType = searchType ?? hashType;
        const incomingTokenHash = searchParams.get("token_hash") ?? hashParams.get("token_hash") ?? searchParams.get("token") ?? hashParams.get("token");
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (incomingTokenHash && recoveryType === "recovery") {
          if (!mounted) return;
          setTokenHash(incomingTokenHash);
          setLinkError(null);
          setChecked(true);
          return;
        }

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            if (mounted) markInvalid(error.message);
            return;
          }

          if (data.session) {
            if (mounted) markRecoveryReady();
            return;
          }
        }

        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            if (mounted) markInvalid(error.message);
            return;
          }

          if (data.session) {
            if (mounted) markRecoveryReady();
            return;
          }
        }

        for (let attempt = 0; attempt < 10; attempt += 1) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            if (mounted) markRecoveryReady();
            return;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 250));
        }

        if (code || accessToken || refreshToken || searchType === "recovery" || hashType === "recovery") {
          if (mounted) markInvalid();
          return;
        }

        if (mounted) markInvalid();
      } catch (error) {
        if (mounted) markInvalid(error instanceof Error ? error.message : undefined);
      }
    };

    void resolveRecoverySession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleRecoveryVerification = async () => {
    if (!tokenHash) return;

    setVerifyingLink(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        type: "recovery",
        token_hash: tokenHash,
      });

      if (error) throw error;

      if (data.session) {
        markRecoveryReady();
        return;
      }

      markInvalid();
    } catch (error: any) {
      markInvalid(error.message);
    } finally {
      setVerifyingLink(false);
    }
  };

  const handleResendReset = async () => {
    if (!resendEmail) {
      toast({ title: "Error", description: "Please enter your email address.", variant: "destructive" });
      return;
    }
    setResending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resendEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: "Check your email", description: "A new reset link has been sent." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }

    if (password.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "Password updated!", description: "You can now sign in with your new password." });
      navigate("/profile");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (checked && tokenHash && !isRecovery) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-8 text-center"
        >
          <img
            src={logo}
            alt="Replay Club"
            className="w-64 mx-auto mb-4 mix-blend-screen cursor-pointer"
            onClick={() => navigate("/")}
          />
          <div className="space-y-2">
            <h1 className="font-display text-xl font-bold text-foreground">Reset your password</h1>
            <p className="text-muted-foreground font-body text-sm">
              Continue to securely open your password reset form.
            </p>
          </div>
          <button
            onClick={handleRecoveryVerification}
            disabled={verifyingLink}
            className="w-full chrome-btn font-display font-semibold text-sm uppercase tracking-[0.15em] px-6 py-3 rounded-md transition-all disabled:opacity-50"
          >
            {verifyingLink ? "..." : "Continue"}
          </button>
        </motion.div>
      </div>
    );
  }

  if (!checked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-8 text-center"
        >
          <img
            src={logo}
            alt="Replay Club"
            className="w-64 mx-auto mb-4 mix-blend-screen cursor-pointer"
            onClick={() => navigate("/")}
          />
          <p className="text-muted-foreground font-body text-sm">
            Checking your reset link...
          </p>
        </motion.div>
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-8 text-center"
        >
          <img
            src={logo}
            alt="Replay Club"
            className="w-64 mx-auto mb-4 mix-blend-screen cursor-pointer"
            onClick={() => navigate("/")}
          />
          <p className="text-muted-foreground font-body text-sm">
            {linkError ?? "This reset link is invalid or has expired."}
          </p>
          <div className="space-y-3 w-full">
            <Input
              type="email"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-card border-border text-foreground"
            />
            <button
              onClick={handleResendReset}
              disabled={resending}
              className="w-full chrome-btn font-display font-semibold text-sm uppercase tracking-[0.15em] px-6 py-3 rounded-md transition-all disabled:opacity-50"
            >
              {resending ? "..." : "Send New Reset Link"}
            </button>
          </div>
          <button
            onClick={() => navigate("/auth")}
            className="text-foreground underline underline-offset-4 hover:text-primary transition-colors text-sm font-body"
          >
            Back to sign in
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-8"
      >
        <div className="text-center">
          <img
            src={logo}
            alt="Replay Club"
            className="w-64 mx-auto mb-4 mix-blend-screen cursor-pointer"
            onClick={() => navigate("/")}
          />
          <h1 className="font-display text-xl font-bold text-foreground">Set New Password</h1>
          <p className="text-muted-foreground text-sm font-body mt-1">
            Choose a new password for your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground font-body text-xs uppercase tracking-wider">
              New Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-card border-border text-foreground"
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm" className="text-foreground font-body text-xs uppercase tracking-wider">
              Confirm Password
            </Label>
            <Input
              id="confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-card border-border text-foreground"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full chrome-btn font-display font-semibold text-sm uppercase tracking-[0.15em] px-6 py-3 rounded-md transition-all disabled:opacity-50"
          >
            {loading ? "..." : "Update Password"}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
