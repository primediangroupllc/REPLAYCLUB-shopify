import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { PUBLIC_DESCRIPTOR } from "@/lib/studioLocation";
import BrandLogo from "@/components/BrandLogo";

/**
 * Global footer with legal + contact links.
 * Required by Meta/Google ad platforms (privacy + terms must be reachable
 * from every page) and surfaces business contact info for trust + SEO.
 */
const SiteFooter = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border/40 bg-background/60 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-6 py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 text-xs font-body text-muted-foreground">
        <div className="space-y-2">
          <p className="font-display uppercase tracking-[0.2em] text-foreground text-[10px]">
            Replay Club
          </p>
          <BrandLogo className="h-10 w-auto mix-blend-screen opacity-90" />
          <p className="leading-relaxed">
            ​
          </p>
        </div>
        <div className="space-y-2">
          <p className="font-display uppercase tracking-[0.2em] text-foreground text-[10px]">
            Policies
          </p>
          <ul className="space-y-1.5">
            <li>
              <Link to="/policies" className="hover:text-foreground transition-colors">
                Studio Policies
              </Link>
            </li>
            <li>
              <Link to="/cancellation" className="hover:text-foreground transition-colors">
                Cancellation Policy
              </Link>
            </li>
            <li>
              <Link to="/conduct" className="hover:text-foreground transition-colors">
                Code of Conduct
              </Link>
            </li>
            <li>
              <Link to="/privacy-policy" className="hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link to="/entry-terms" className="hover:text-foreground transition-colors">
                Entry Terms
              </Link>
            </li>
          </ul>
        </div>
        <div className="space-y-2">
          <p className="font-display uppercase tracking-[0.2em] text-foreground text-[10px]">
            Learn
          </p>
          <ul className="space-y-1.5">
            <li>
              <Link to="/how-it-works" className="hover:text-foreground transition-colors">
                How It Works
              </Link>
            </li>
          </ul>
        </div>
        <div className="space-y-2">
          <p className="font-display uppercase tracking-[0.2em] text-foreground text-[10px]">
            Contact
          </p>
          <a
            href="mailto:replayclubrecords@gmail.com"
            className="flex items-center gap-2 hover:text-foreground transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            replayclubrecords@gmail.com
          </a>
          <p className="text-muted-foreground/80">
            {PUBLIC_DESCRIPTOR} — by appointment only.
            Address shared with confirmed bookings.
          </p>
        </div>
      </div>
      <div className="border-t border-border/30 py-4 text-center text-[10px] font-body text-muted-foreground">
        © {year} Replay Club. All rights reserved.
      </div>
    </footer>
  );
};

export default SiteFooter;