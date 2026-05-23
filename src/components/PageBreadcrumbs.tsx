import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  to?: string;
}

interface Props {
  items: Crumb[];
  className?: string;
}

/**
 * Lightweight breadcrumbs for deep pages (event detail, talent profile, etc.).
 * The last item is always rendered as the current page; previous items link
 * back via the provided `to`. Falls back to plain text when `to` is omitted.
 */
const PageBreadcrumbs = ({ items, className }: Props) => {
  if (!items.length) return null;
  return (
    <nav
      aria-label="Breadcrumb"
      className={
        "text-[10px] uppercase tracking-[0.2em] font-display text-muted-foreground " +
        (className ?? "")
      }
    >
      <ol className="flex items-center flex-wrap gap-1.5">
        {items.map((crumb, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${crumb.label}-${i}`} className="inline-flex items-center gap-1.5">
              {crumb.to && !isLast ? (
                <Link
                  to={crumb.to}
                  className="hover:text-foreground transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined} className={isLast ? "text-foreground" : undefined}>
                  {crumb.label}
                </span>
              )}
              {!isLast && <ChevronRight className="w-3 h-3 opacity-60" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default PageBreadcrumbs;