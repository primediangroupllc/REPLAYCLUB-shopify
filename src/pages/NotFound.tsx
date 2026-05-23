import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowRight, Home } from "lucide-react";
import SeoHead from "@/components/SeoHead";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background text-foreground overflow-hidden px-6">
      <SeoHead
        title="Page Not Found | Replay Club"
        description="This page doesn't exist. Head back to Replay Club to book your studio session."
      />
      {/* Ambient radial backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 35%, hsl(var(--primary) / 0.10), transparent 70%)",
        }}
      />
      <div className="relative z-10 max-w-md mx-auto text-center space-y-8">
        <p className="font-display text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Replay Club
        </p>
        <h1 className="font-display text-7xl sm:text-8xl font-bold tracking-tight chrome-text">
          404
        </h1>
        <div className="space-y-2">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            This room is empty.
          </h2>
          <p className="text-sm text-muted-foreground font-body leading-relaxed">
            The page you're looking for doesn't exist or has been moved.
            Let's get you back to the booth.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 chrome-btn font-display font-semibold text-xs uppercase tracking-[0.15em] px-6 py-3 rounded-md transition-all"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            Book a Session
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 chrome-btn-outline font-display font-semibold text-xs uppercase tracking-[0.15em] px-6 py-3 rounded-md transition-all"
          >
            <Home className="w-3.5 h-3.5" />
            Home
          </Link>
        </div>

        <div className="pt-6 text-xs text-muted-foreground font-body">
          Need help?{" "}
          <a
            href="mailto:replayclubrecords@gmail.com"
            className="underline text-foreground hover:text-primary transition-colors"
          >
            replayclubrecords@gmail.com
          </a>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
