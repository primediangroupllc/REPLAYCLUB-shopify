import { ReactNode, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Link2,
  Menu as MenuIcon,
  QrCode,
  Tag,
  X as CloseIcon,
  type LucideIcon,
} from "lucide-react";
import { AdminTwoFactorGate } from "@/components/AdminTwoFactorGate";
import { useAdminSessionTimeout } from "@/hooks/useAdminSessionTimeout";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import logo from "@/assets/logo.png";

/**
 * Phase-1 AdminShell: shared chrome that wraps the existing AdminDashboard.
 *
 * Owns: AdminTwoFactorGate, admin session timeout, responsive nav (sidebar /
 * icon-rail / mobile sheet) grouped into 5 sections.
 *
 * Does NOT own: routing (tabs are still internal `activeTab` state on the
 * dashboard), placeholder retirement, or table-to-card layout. The 26-tab
 * strip continues to render INSIDE the shell unchanged. Selecting a section
 * row in the shell nav simply calls `onSelectTab(tabId)` to set the
 * dashboard's active tab.
 */

export interface AdminShellTab {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface AdminShellLink {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
}

export interface AdminShellSection {
  id: string;
  label: string;
  /** Internal dashboard tabs (activate via onSelectTab). */
  tabIds?: string[];
  /** Standalone-route nav entries (navigate() instead of activating a tab). */
  links?: AdminShellLink[];
}

/** Canonical 5-section grouping. Internal tabs + standalone-route entries
 * (Promos, Scan, Link Check, Runbook) share the same sidebar. */
export const ADMIN_SHELL_SECTIONS: AdminShellSection[] = [
  {
    id: "operations",
    label: "Operations",
    tabIds: ["overview", "checkin", "bookings", "calendar", "blocked", "locks"],
    links: [{ id: "scan", label: "QR Scan", icon: QrCode, href: "/admin/scan" }],
  },
  {
    id: "content",
    label: "Content",
    tabIds: ["studios", "events", "talent", "roster", "mixes", "equipment", "rentals", "links"],
  },
  {
    id: "marketing",
    label: "Marketing",
    tabIds: ["giftcards"],
    links: [{ id: "promos", label: "Promos", icon: Tag, href: "/admin/promos" }],
  },
  {
    id: "trust",
    label: "Trust & Safety",
    tabIds: ["screening", "refunds", "disputes", "audit"],
  },
  {
    id: "system",
    label: "System",
    tabIds: ["settings", "users", "webhooks", "bounces", "errors"],
    links: [
      { id: "link-check", label: "Link Check", icon: Link2, href: "/admin/link-check" },
      { id: "runbook", label: "Runbook", icon: BookOpen, href: "/admin/runbook" },
    ],
  },
];

interface AdminShellProps {
  tabs: AdminShellTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  children: ReactNode;
}

export const AdminShell = ({ tabs, activeTabId, onSelectTab, children }: AdminShellProps) => {
  const navigate = useNavigate();
  // Session timeout is enforced once we're past the 2FA gate. Enabling it here
  // (rather than inside the dashboard) lets every admin page that adopts the
  // shell inherit the same idle-timeout behaviour without duplication.
  useAdminSessionTimeout(true);

  const location = useLocation();

  const tabsById = useMemo(() => {
    const map = new Map<string, AdminShellTab>();
    tabs.forEach((t) => map.set(t.id, t));
    return map;
  }, [tabs]);

  // Drop tabs that don't exist in the supplied list (defensive — keeps
  // grouping resilient if the dashboard renames or removes a tab).
  const sections = useMemo(
    () =>
      ADMIN_SHELL_SECTIONS.map((sec) => ({
        ...sec,
        tabs: (sec.tabIds ?? [])
          .map((id) => tabsById.get(id))
          .filter((t): t is AdminShellTab => Boolean(t)),
        links: sec.links ?? [],
      })).filter((s) => s.tabs.length > 0 || s.links.length > 0),
    [tabsById],
  );

  const activeSection =
    sections.find(
      (s) =>
        s.tabs.some((t) => t.id === activeTabId) ||
        s.links.some((l) => location.pathname.startsWith(l.href)),
    ) ?? sections[0];
  const activeTab = tabsById.get(activeTabId);
  const activeLink = useMemo(
    () =>
      sections
        .flatMap((s) => s.links)
        .find((l) => location.pathname.startsWith(l.href)),
    [sections, location.pathname],
  );

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSelect = (id: string) => {
    onSelectTab(id);
    setMobileOpen(false);
  };

  const handleNavigateLink = (href: string) => {
    setMobileOpen(false);
    navigate(href);
  };

  return (
    <AdminTwoFactorGate>
      <div className="min-h-screen bg-background flex">
        {/* ── Desktop sidebar (≥1024px) ─────────────────────────── */}
        <aside
          className={`hidden lg:flex sticky top-0 self-start h-screen border-r border-border/40 bg-card/40 backdrop-blur flex-col transition-[width] duration-200 ${
            collapsed ? "w-16" : "w-60"
          }`}
        >
          <div className="px-3 py-4 border-b border-border/30 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex items-center gap-2 min-w-0 hover:opacity-80"
              title="Back to site"
            >
              <img src={logo} alt="Replay Club" className="w-7 h-7 mix-blend-screen shrink-0" />
              {!collapsed && (
                <span className="font-display text-[11px] font-bold uppercase tracking-wider text-foreground truncate">
                  Admin
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="p-1.5 rounded hover:bg-muted/40 text-muted-foreground"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <ArrowLeft className={`w-3.5 h-3.5 transition-transform ${collapsed ? "rotate-180" : ""}`} />
            </button>
          </div>
          <NavBody
            sections={sections}
            activeTabId={activeTabId}
            activeLinkId={activeLink?.id ?? null}
            collapsed={collapsed}
            onSelect={handleSelect}
            onNavigateLink={handleNavigateLink}
          />
        </aside>

        {/* ── Tablet rail (768-1023px) ───────────────────────────── */}
        <aside className="hidden md:flex lg:hidden sticky top-0 self-start h-screen w-14 border-r border-border/40 bg-card/40 backdrop-blur flex-col">
          <div className="px-2 py-4 border-b border-border/30 flex items-center justify-center">
            <img src={logo} alt="Replay Club" className="w-7 h-7 mix-blend-screen" />
          </div>
          <NavBody
            sections={sections}
            activeTabId={activeTabId}
            activeLinkId={activeLink?.id ?? null}
            collapsed
            onSelect={handleSelect}
            onNavigateLink={handleNavigateLink}
          />
        </aside>

        {/* ── Main column ───────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Mobile top bar (<768px) */}
          <header className="md:hidden sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border/40 flex items-center justify-between gap-2 px-3 h-14">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="min-w-[44px] min-h-[44px] -ml-2 flex items-center justify-center rounded-md text-foreground hover:bg-muted/40"
                  aria-label="Open admin menu"
                >
                  <MenuIcon className="w-5 h-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[85%] max-w-xs p-0 bg-card border-border/40">
                <div className="px-4 py-4 border-b border-border/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src={logo} alt="Replay Club" className="w-7 h-7 mix-blend-screen" />
                    <span className="font-display text-[11px] font-bold uppercase tracking-wider text-foreground">
                      Admin
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="p-2 rounded hover:bg-muted/40 text-muted-foreground"
                    aria-label="Close menu"
                  >
                    <CloseIcon className="w-4 h-4" />
                  </button>
                </div>
                <NavBody
                  sections={sections}
                  activeTabId={activeTabId}
                  activeLinkId={activeLink?.id ?? null}
                  collapsed={false}
                  onSelect={handleSelect}
                  onNavigateLink={handleNavigateLink}
                />
              </SheetContent>
            </Sheet>
            <div className="flex flex-col items-center min-w-0 flex-1">
              <span className="text-[9px] uppercase tracking-[0.2em] font-display text-muted-foreground truncate">
                {activeSection?.label}
              </span>
              <span className="text-xs font-display font-bold text-foreground truncate">
                {activeLink?.label ?? activeTab?.label ?? "Admin"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40"
              aria-label="Exit admin"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </header>

          {/* Breadcrumbs (desktop/tablet only) */}
          <div className="hidden md:flex items-center gap-2 px-6 h-10 border-b border-border/30 text-[11px] font-display uppercase tracking-wider text-muted-foreground">
            <span>Admin</span>
            {activeSection && (
              <>
                <span className="opacity-40">/</span>
                <span>{activeSection.label}</span>
              </>
            )}
            {(activeLink || activeTab) && (
              <>
                <span className="opacity-40">/</span>
                <span className="text-foreground">{(activeLink ?? activeTab)?.label}</span>
              </>
            )}
          </div>

          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </AdminTwoFactorGate>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
interface NavBodyProps {
  sections: Array<AdminShellSection & { tabs: AdminShellTab[]; links: AdminShellLink[] }>;
  activeTabId: string;
  activeLinkId: string | null;
  collapsed: boolean;
  onSelect: (id: string) => void;
  onNavigateLink: (href: string) => void;
}

const NavBody = ({
  sections,
  activeTabId,
  activeLinkId,
  collapsed,
  onSelect,
  onNavigateLink,
}: NavBodyProps) => {
  return (
    <nav className="flex-1 overflow-y-auto py-3">
      {sections.map((section) => (
        <div key={section.id} className="mb-4">
          {!collapsed && (
            <div className="px-4 mb-1.5 text-[9px] uppercase tracking-[0.22em] font-display font-semibold text-muted-foreground/70">
              {section.label}
            </div>
          )}
          {collapsed && <div className="mx-3 mb-1.5 h-px bg-border/40" aria-hidden="true" />}
          <ul className="space-y-0.5">
            {section.tabs.map((tab) => {
              const isActive = activeLinkId === null && tab.id === activeTabId;
              return (
                <li key={tab.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(tab.id)}
                    title={collapsed ? tab.label : undefined}
                    aria-current={isActive ? "page" : undefined}
                    className={`w-full flex items-center gap-2.5 ${
                      collapsed ? "px-0 justify-center" : "px-4"
                    } min-h-[44px] text-xs font-display uppercase tracking-wider transition-colors ${
                      isActive
                        ? "bg-primary/15 text-foreground border-l-2 border-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30 border-l-2 border-transparent"
                    }`}
                  >
                    <tab.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                    {!collapsed && <span className="truncate">{tab.label}</span>}
                  </button>
                </li>
              );
            })}
            {section.links.map((link) => {
              const isActive = activeLinkId === link.id;
              return (
                <li key={link.id}>
                  <button
                    type="button"
                    onClick={() => onNavigateLink(link.href)}
                    title={collapsed ? link.label : undefined}
                    aria-current={isActive ? "page" : undefined}
                    className={`w-full flex items-center gap-2.5 ${
                      collapsed ? "px-0 justify-center" : "px-4"
                    } min-h-[44px] text-xs font-display uppercase tracking-wider transition-colors ${
                      isActive
                        ? "bg-primary/15 text-foreground border-l-2 border-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30 border-l-2 border-transparent"
                    }`}
                  >
                    <link.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                    {!collapsed && <span className="truncate">{link.label}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
};

export default AdminShell;