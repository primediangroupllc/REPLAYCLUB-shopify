import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Cookie, X } from "lucide-react";

const COOKIE_KEY = "replay-cookie-consent";

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_KEY);
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_KEY, "accepted");
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem(COOKIE_KEY, "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 animate-in slide-in-from-bottom-4 duration-500 sm:p-4"
    >
      <div
        className="
          mx-auto w-full sm:max-w-lg
          border-t border-border sm:border sm:rounded-xl
          bg-card/95 backdrop-blur-md shadow-lg
          px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:p-4
          flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4
        "
      >
        <button
          aria-label="Dismiss"
          onClick={handleDecline}
          className="absolute top-2 right-2 sm:hidden p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3 flex-1 pr-6 sm:pr-0">
          <Cookie className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            We use cookies to improve your experience. By continuing, you agree to our{" "}
            <a href="/privacy-policy" className="underline text-foreground hover:text-primary transition-colors">
              Privacy Policy
            </a>.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={handleDecline} className="text-muted-foreground hidden sm:inline-flex">
            Decline
          </Button>
          <Button size="sm" onClick={handleAccept} className="flex-1 sm:flex-initial">
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
