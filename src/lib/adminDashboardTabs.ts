/**
 * Canonical AdminShell tab list — shared between the dashboard (where each
 * tab activates an internal panel) and the standalone admin pages (where
 * clicking a tab navigates to /admin/dashboard?tab=<id>). Keeping this in
 * one module guarantees the sidebar looks identical everywhere admin lands.
 */
import {
  Activity,
  Ban,
  BarChart3,
  Calendar,
  CalendarDays,
  FileSearch,
  Gift,
  Link2,
  Lock,
  MailWarning,
  Mic,
  Music,
  Package,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  UserSearch,
  Webhook,
} from "lucide-react";
import type { AdminShellTab } from "@/components/admin/AdminShell";

export const ADMIN_DASHBOARD_TABS: AdminShellTab[] = [
  // ── Daily ops (most-used first) ──
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "checkin", label: "Check-In", icon: ScanLine },
  { id: "bookings", label: "Bookings", icon: Calendar },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "screening", label: "Screening", icon: ShieldCheck },
  // ── Schedule + payment exceptions ──
  { id: "locks", label: "Holds", icon: Lock },
  { id: "blocked", label: "Blocked", icon: Ban },
  { id: "refunds", label: "Refunds", icon: RefreshCw },
  { id: "disputes", label: "Disputes", icon: ShieldAlert },
  // ── Inventory + content ──
  { id: "rentals", label: "Rentals", icon: Package },
  { id: "equipment", label: "Equipment", icon: Package },
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "mixes", label: "Mixes", icon: Music },
  { id: "talent", label: "Talent", icon: Mic },
  { id: "roster", label: "Roster", icon: UserPlus },
  { id: "giftcards", label: "Gift Cards", icon: Gift },
  { id: "links", label: "Links", icon: Link2 },
  // ── Configuration ──
  { id: "studios", label: "Site Content", icon: Music },
  { id: "settings", label: "Settings", icon: ShieldCheck },
  // ── Diagnostics / system ──
  { id: "users", label: "Users", icon: UserSearch },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "bounces", label: "Bounces", icon: MailWarning },
  { id: "errors", label: "Errors", icon: Activity },
  { id: "audit", label: "Audit", icon: FileSearch },
];
