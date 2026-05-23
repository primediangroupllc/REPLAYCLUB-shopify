import { supabase } from "@/integrations/supabase/client";

type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "toggle_visibility"
  | "approve"
  | "reject"
  | "issue"
  | "cancel"
  | "reschedule"
  | "verify"
  | "read"
  | "grant_role"
  | "revoke_role"
  | "admin_2fa_verified"
  | "admin_2fa_failed";

export async function logAdminAction(
  action: AuditAction,
  entityType: string,
  entityId?: string,
  details?: Record<string, unknown>
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await (supabase as any).from("audit_log").insert({
    admin_user_id: user.id,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    details: details ?? null,
  });
}
