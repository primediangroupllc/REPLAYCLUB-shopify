import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import { ADMIN_DASHBOARD_TABS } from "@/lib/adminDashboardTabs";

/**
 * Wrapper that puts a standalone admin route (Promos, QR Scan, Link Check,
 * Runbook, etc.) inside the same AdminShell the dashboard uses. The sidebar
 * keeps the dashboard's tab list — clicking a tab navigates back to
 * /admin/dashboard?tab=<id> so the user keeps a consistent IA.
 *
 * AdminShell already includes AdminTwoFactorGate, so the page itself doesn't
 * need to wrap its content in one.
 */
export const AdminPageShell = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  return (
    <AdminShell
      tabs={ADMIN_DASHBOARD_TABS}
      activeTabId=""
      onSelectTab={(id) => navigate(`/admin/dashboard?tab=${id}`)}
    >
      {children}
    </AdminShell>
  );
};

export default AdminPageShell;
