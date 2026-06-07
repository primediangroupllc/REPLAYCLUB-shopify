import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useRateLimiter } from "@/hooks/useRateLimiter";
import logo from "@/assets/logo.png";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DOB_MONTHS, DOB_YEARS, validateDob } from "@/lib/dob";

// Dev uses hCaptcha's official localhost test sitekey (the prod key's Domains list can't
// allow localhost); production builds use the real key. See HCaptchaWidget.tsx.
const HCAPTCHA_SITEKEY = import.meta.env.DEV
  ? "10000000-ffff-ffff-ffff-000000000001"
  : "038c4d7c-e0ea-45d6-836e-58d0bc9eb88c";

// Accounts auto-granted admin on signup (mirrors the DB trigger auto_admin_sereda).
// Used here only to show the admin-welcome popup; the DB is the source of truth.
const ADMIN_EMAILS = ["sereda.a@gmail.com", "fumix.mgmt@gmail.com"];

const Auth = () => {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">(() => {
    // Honor ?mode=signup / ?mode=forgot from the URL. Booking gates send
    // guests here via /auth?mode=signup&next=... — this param was previously
    // ignored, landing every redirected guest on the login form.
    const m = new URLSearchParams(window.location.search).get("mode");
    return m === "signup" || m === "forgot" ? m : "login";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobDay, setDobDay] = useState("");
  const [dobYear, setDobYear] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { isLocked, lockoutRemaining, recordAttempt, resetAttempts } = useRateLimiter();
  const [adminWelcome, setAdminWelcome] = useState(false);
  const skipRedirectRef = useRef(false);

  const resetCaptcha = () => {
    setCaptchaToken(null);
    captchaRef.current?.resetCaptcha();
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Don't redirect if user is on the reset-password page (recovery flow)
      if (window.location.pathname === "/reset-password") return;
      if (event === "SIGNED_IN" && session) {
        if (skipRedirectRef.current) return; // holding on the admin-welcome popup
        const next = new URLSearchParams(window.location.search).get("next");
        navigate(next && next.startsWith("/") ? next : "/");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const next = new URLSearchParams(window.location.search).get("next");
        navigate(next && next.startsWith("/") ? next : "/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      toast({ title: "Too many attempts", description: `Try again in ${lockoutRemaining}s`, variant: "destructive" });
      return;
    }
    if (!captchaToken) {
      toast({ title: "Captcha required", description: "Please complete the captcha challenge below", variant: "destructive" });
      return;
    }
    if (mode === "signup") {
      const dob = validateDob(dobYear, dobMonth, dobDay);
      if (!dob.ok) {
        // `in`-operator narrowing: robust even under this project's loose
        // tsconfig, where `!dob.ok` alone doesn't narrow the union.
        const reason = "reason" in dob ? dob.reason : "missing";
        toast(
          reason === "under18"
            ? { title: "You must be 18 or older", description: "Replay Club accounts are limited to people 18 and older. If this is incorrect, please contact support.", variant: "destructive" }
            : { title: "Date of birth required", description: "Please select a valid date of birth.", variant: "destructive" },
        );
        return;
      }
    }
    setLoading(true);

    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
          captchaToken,
        });
        if (error) throw error;
        toast({
          title: t("auth.checkEmail"),
          description: t("auth.resetLinkSent"),
        });
        setMode("login");
      } else if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: { captchaToken },
        });
        if (error) {
          recordAttempt();
          throw error;
        }
        resetAttempts();
        toast({ title: t("auth.welcomeBack") });
        if (data.session) {
          // Keep the Shopify customer mirror in sync on login. Fire-and-forget +
          // idempotent (customer-sync updates if the customer already exists);
          // also covers the email-confirmation-on case where signup returns no
          // session, so the customer still lands in Shopify on first login.
          supabase.functions
            .invoke("customer-sync", { body: { email: email.trim().toLowerCase() } })
            .catch((e) => console.error("Shopify customer-sync (login) failed:", e));
          const next = new URLSearchParams(window.location.search).get("next");
          navigate(next && next.startsWith("/") ? next : "/");
        }
      } else {
        const willBeAdmin = ADMIN_EMAILS.includes(email.trim().toLowerCase());
        // For admins, suppress the auto-redirect BEFORE signUp (onAuthStateChange
        // fires during the call) so we can show the welcome popup instead.
        if (willBeAdmin) skipRedirectRef.current = true;
        const dob = validateDob(dobYear, dobMonth, dobDay); // already gated 18+ above
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name, date_of_birth: dob.ok ? dob.iso : null }, captchaToken },
        });
        if (error) { skipRedirectRef.current = false; throw error; }
        if (data.session) {
          // Mirror the new signup into Shopify (CRM). Fire-and-forget so a
          // Shopify hiccup never blocks account creation; the fetch survives the
          // onAuthStateChange navigation below.
          const [firstName, ...rest] = (name ?? "").trim().split(/\s+/).filter(Boolean);
          supabase.functions
            .invoke("customer-sync", {
              body: {
                email: email.trim().toLowerCase(),
                first_name: firstName || undefined,
                last_name: rest.length ? rest.join(" ") : undefined,
              },
            })
            .catch((e) => console.error("Shopify customer-sync (signup) failed:", e));
          // Auto-confirm on: account created + signed in.
          if (willBeAdmin) {
            setAdminWelcome(true); // 🎉 you're an admin
          }
          // non-admins: onAuthStateChange already navigated home
        } else {
          // Email confirmation required (auto-confirm off): ask them to verify.
          skipRedirectRef.current = false;
          toast({
            title: t("auth.accountCreated"),
            description: t("auth.verifyEmail"),
          });
          setMode("login");
        }
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      resetCaptcha();
      setLoading(false);
    }
  };

  const title = mode === "login" ? t("auth.signIn") : mode === "signup" ? t("auth.createAccount") : t("auth.resetPassword");
  const subtitle = mode === "login" ? t("auth.welcomeBack") : mode === "signup" ? t("auth.joinClub") : t("auth.resetDesc");
  // Contextual banner when a guest was sent here from a booking action
  // (requireAuth / ?book= / ?selector=) — makes the account wall feel like a
  // continuation of booking rather than a jarring detour.
  const nextParam = new URLSearchParams(window.location.search).get("next");
  const fromBooking = !!nextParam && (nextParam.includes("book=") || nextParam.includes("selector="));
  const fromRental = !!nextParam && nextParam.includes("equipment");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-6"
      >
        <div className="text-center">
          <img
            src={logo}
            alt="Replay Club"
            className="w-64 mx-auto mb-4 mix-blend-screen cursor-pointer"
            onClick={() => navigate("/")}
          />
          <h1 className="font-display text-xl font-bold text-foreground">{title}</h1>
          <p className="text-muted-foreground text-sm font-body mt-1">{subtitle}</p>
          {(fromBooking || fromRental) && mode !== "forgot" && (
            <p className="text-sm text-foreground/90 font-body mt-3 px-3 py-2 rounded-md bg-primary/10 border border-primary/20">
              {fromRental
                ? t("auth.completeRental", "Almost there — sign in or create your account to complete your rental.")
                : t("auth.completeBooking", "Almost there — sign in or create your account to complete your booking.")}
            </p>
          )}
        </div>

        <div className="card-premium p-6 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground font-body text-xs uppercase tracking-wider">
                {t("auth.displayName")}
              </Label>
              <Input
                id="name"
              type="text"
              autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="bg-card border-border text-foreground"
                required
              />
            </div>
          )}
          {mode === "signup" && (
            <div className="space-y-2">
              <Label className="text-foreground font-body text-xs uppercase tracking-wider">
                Date of Birth
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <select aria-label="Birth month" value={dobMonth} onChange={(e) => setDobMonth(e.target.value)} required className="bg-card border border-border text-foreground rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="">Month</option>
                  {DOB_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <select aria-label="Birth day" value={dobDay} onChange={(e) => setDobDay(e.target.value)} required className="bg-card border border-border text-foreground rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="">Day</option>
                  {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                </select>
                <select aria-label="Birth year" value={dobYear} onChange={(e) => setDobYear(e.target.value)} required className="bg-card border border-border text-foreground rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="">Year</option>
                  {DOB_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <p className="text-muted-foreground text-[11px] font-body">You must be 18 or older to book.</p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground font-body text-xs uppercase tracking-wider">
              {t("booking.email")}
            </Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-card border-border text-foreground"
              required
            />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text-foreground font-body text-xs uppercase tracking-wider">
                  {t("auth.password")}
                </Label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-muted-foreground text-xs font-body hover:text-foreground transition-colors"
                  >
                    {t("auth.forgotPassword")}
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-card border-border text-foreground"
                required
                minLength={6}
              />
            </div>
          )}

          <div className="flex justify-center">
            <HCaptcha
              ref={captchaRef}
              sitekey={HCAPTCHA_SITEKEY}
              theme="dark"
              onVerify={(token) => setCaptchaToken(token)}
              onExpire={() => setCaptchaToken(null)}
              onError={() => setCaptchaToken(null)}
            />
          </div>

          <button
            type="submit"
            disabled={loading || isLocked || !captchaToken}
            className="w-full chrome-btn font-display font-semibold text-sm uppercase tracking-[0.15em] px-6 py-3 rounded-md transition-all disabled:opacity-50"
          >
            {isLocked ? `Locked (${lockoutRemaining}s)` : loading ? "..." : mode === "login" ? t("auth.signIn") : mode === "signup" ? t("auth.createAccount") : t("auth.sendResetLink")}
          </button>
        </form>

        {/* OAuth buttons hidden: still wired to lovable.auth (Lovable), which fails against the new Supabase project. Re-enable after switching to supabase.auth.signInWithOAuth + configuring Google/Apple providers. */}
        {false && (
        <>
        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/50" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground font-body">{t("auth.or")}</span>
          </div>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={async () => {
              const { error } = await lovable.auth.signInWithOAuth("google", {
                redirect_uri: window.location.origin,
              });
              if (error) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
              }
            }}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-md border border-border/50 bg-card text-foreground font-display text-sm uppercase tracking-wider hover:bg-accent transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {t("auth.continueGoogle")}
          </button>

          <button
            type="button"
            onClick={async () => {
              const { error } = await lovable.auth.signInWithOAuth("apple", {
                redirect_uri: window.location.origin,
              });
              if (error) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
              }
            }}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-md border border-border/50 bg-card text-foreground font-display text-sm uppercase tracking-wider hover:bg-accent transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            {t("auth.continueApple")}
          </button>
        </div>
        </>
        )}

        <div className="text-center space-y-3">
          {mode === "forgot" ? (
            <button
              onClick={() => setMode("login")}
              className="text-foreground underline underline-offset-4 hover:text-primary transition-colors text-sm font-body"
            >
              {t("auth.backToSignIn")}
            </button>
          ) : (
            <p className="text-muted-foreground text-sm font-body">
              {mode === "login" ? t("auth.noAccount") : t("auth.haveAccount")}{" "}
              <button
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                className="text-foreground underline underline-offset-4 hover:text-primary transition-colors"
              >
                {mode === "login" ? t("auth.signUp") : t("auth.signIn")}
              </button>
            </p>
          )}
        </div>
        </div>

        <button
          onClick={() => navigate("/")}
          className="block mx-auto text-muted-foreground text-xs font-body hover:text-foreground transition-colors"
        >
          {t("auth.backToHome")}
        </button>
      </motion.div>

      <Dialog
        open={adminWelcome}
        onOpenChange={(open) => { if (!open) { setAdminWelcome(false); navigate("/admin/dashboard"); } }}
      >
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">🎉 Admin access granted</DialogTitle>
            <DialogDescription className="text-base">
              Welcome, admin — your account now has full admin access to Replay Club.
            </DialogDescription>
          </DialogHeader>
          <button
            onClick={() => { setAdminWelcome(false); navigate("/admin/dashboard"); }}
            className="w-full chrome-btn font-display font-semibold text-sm uppercase tracking-[0.15em] px-6 py-3 rounded-md mt-2"
          >
            Go to Admin Dashboard
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;
