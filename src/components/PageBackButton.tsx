import { ArrowLeft } from "lucide-react";
import { useNavigate, useLocation, Link } from "react-router-dom";

interface PageBackButtonProps {
  /** Override label (defaults to "Back"). */
  label?: string;
  /** Force-fall back to this route if there's no history (defaults to "/"). */
  fallback?: string;
  className?: string;
}

/**
 * Single canonical back button used in every subpage header.
 * - Lives on the LEFT side of the header, next to the logo.
 * - Uses router history (navigate(-1)) so it tracks the user's flow,
 *   falling back to a sensible route when there's no in-app history
 *   (e.g. user landed directly on a deep link).
 * - Never renders on "/" — pages should mount it conditionally if needed.
 *
 * Styling is intentionally consistent across the whole site so users
 * always recognize where to click.
 */
const PageBackButton = ({ label = "Back", fallback = "/", className = "" }: PageBackButtonProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Hide on the homepage — there's nothing to go "back" to.
  if (location.pathname === "/") return null;

  const handleClick = () => {
    // window.history.length is unreliable across browsers, but if it's >1 we
    // probably have an in-app entry to pop back to. Otherwise route to fallback.
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 text-xs font-body text-muted-foreground hover:text-foreground transition-colors ${className}`}
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  );
};

export default PageBackButton;

// Convenience: a Link-based variant for cases that explicitly want to
// route to a known parent (e.g. legal pages always go home).
export const PageBackLink = ({ to = "/", label = "Back", className = "" }: { to?: string; label?: string; className?: string }) => {
  const location = useLocation();
  if (location.pathname === "/") return null;
  return (
    <Link
      to={to}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 text-xs font-body text-muted-foreground hover:text-foreground transition-colors ${className}`}
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      <span>{label}</span>
    </Link>
  );
};
