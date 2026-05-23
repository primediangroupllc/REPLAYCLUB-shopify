import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { BOOKING_POLICY_DEFAULTS } from "@/hooks/useSiteSettings";

/**
 * Batch 2 — Booking Policies admin panel.
 *
 * All fields are optional. NULL/empty = "use the hardcoded fallback shown
 * as placeholder text." Enables admins to override lead time, lookahead,
 * cancellation cutoff, refund policy, slot lock TTLs, and per-type email
 * toggles without redeploying.
 */

// Keep keys aligned with toggleKeyForTemplate() in send-transactional-email.
const EMAIL_TOGGLE_TYPES: Array<{ key: string; label: string; hint?: string }> = [
  { key: "booking_confirmation", label: "Booking confirmation (customer)" },
  { key: "admin_notification", label: "Admin notification — new booking" },
  { key: "reminder_2h", label: "2-hour pre-session reminder" },
  { key: "followup", label: "Post-session follow-up" },
  { key: "event_confirmation", label: "Event confirmation" },
  { key: "event_reminder", label: "Event reminder" },
  { key: "rental_confirmation", label: "Equipment rental confirmation" },
  { key: "promo_code", label: "Promo code email" },
  { key: "waitlist_spot", label: "Waitlist — spot available" },
  { key: "booking_cancelled", label: "Booking cancelled receipt" },
  { key: "reschedule_confirmation", label: "Reschedule confirmation" },
  { key: "verification_email", label: "Email verification code" },
];

interface PoliciesRow {
  id: number;
  booking_lead_minutes: number | null;
  booking_lookahead_days: number | null;
  cancellation_cutoff_hours: number | null;
  refund_policy_text: string | null;
  email_toggles: Record<string, boolean>;
  slot_lock_ttl_minutes: number | null;
  equipment_lock_ttl_minutes: number | null;
}

const inputClass =
  "w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm font-body text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-muted-foreground/70 font-body">{hint}</p>}
  </div>
);

const Section = ({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) => (
  <section className="space-y-4 border-t border-border/30 pt-6 first:border-t-0 first:pt-0">
    <div>
      <h3 className="font-display text-base font-bold text-foreground">{title}</h3>
      {description && <p className="text-xs text-muted-foreground font-body mt-0.5">{description}</p>}
    </div>
    {children}
  </section>
);

const numOrNull = (v: string): number | null => {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export default function AdminBookingPoliciesPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [s, setS] = useState<PoliciesRow | null>(null);

  const set = <K extends keyof PoliciesRow>(key: K, value: PoliciesRow[K]) =>
    setS((prev) => (prev ? { ...prev, [key]: value } : prev));

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select(
          "id, booking_lead_minutes, booking_lookahead_days, cancellation_cutoff_hours, refund_policy_text, email_toggles, slot_lock_ttl_minutes, equipment_lock_ttl_minutes"
        )
        .order("id")
        .limit(1)
        .maybeSingle();
      if (error) toast.error(error.message);
      else if (data) {
        setS({
          id: data.id,
          booking_lead_minutes: data.booking_lead_minutes ?? null,
          booking_lookahead_days: data.booking_lookahead_days ?? null,
          cancellation_cutoff_hours: data.cancellation_cutoff_hours ?? null,
          refund_policy_text: data.refund_policy_text ?? null,
          email_toggles: (data.email_toggles as Record<string, boolean>) || {},
          slot_lock_ttl_minutes: data.slot_lock_ttl_minutes ?? null,
          equipment_lock_ttl_minutes: data.equipment_lock_ttl_minutes ?? null,
        });
      }
      setLoading(false);
    })();
  }, []);

  const toggleEmail = (key: string, enabled: boolean) => {
    if (!s) return;
    // We only persist explicit OFF values; missing/true are equivalent to enabled.
    const next = { ...s.email_toggles };
    if (enabled) delete next[key];
    else next[key] = false;
    set("email_toggles", next);
  };

  const save = async () => {
    if (!s) return;
    setSaving(true);
    const { error } = await supabase
      .from("site_settings")
      .update({
        booking_lead_minutes: s.booking_lead_minutes,
        booking_lookahead_days: s.booking_lookahead_days,
        cancellation_cutoff_hours: s.cancellation_cutoff_hours,
        refund_policy_text: s.refund_policy_text?.trim() || null,
        email_toggles: s.email_toggles as never,
        slot_lock_ttl_minutes: s.slot_lock_ttl_minutes,
        equipment_lock_ttl_minutes: s.equipment_lock_ttl_minutes,
      })
      .eq("id", s.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Booking policies saved");
  };

  if (loading || !s) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Section
        title="Scheduling Windows"
        description="Controls how soon and how far in advance customers can book. Empty = use the platform default."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Minimum lead time (minutes)" hint={`Default: ${BOOKING_POLICY_DEFAULTS.leadMinutes} min`}>
            <input
              type="number"
              min={0}
              className={inputClass}
              placeholder={String(BOOKING_POLICY_DEFAULTS.leadMinutes)}
              value={s.booking_lead_minutes ?? ""}
              onChange={(e) => set("booking_lead_minutes", numOrNull(e.target.value))}
            />
          </Field>
          <Field label="Lookahead window (days)" hint={`Default: ${BOOKING_POLICY_DEFAULTS.lookaheadDays} days`}>
            <input
              type="number"
              min={1}
              className={inputClass}
              placeholder={String(BOOKING_POLICY_DEFAULTS.lookaheadDays)}
              value={s.booking_lookahead_days ?? ""}
              onChange={(e) => set("booking_lookahead_days", numOrNull(e.target.value))}
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Cancellation"
        description="Controls how late customers can cancel and the refund policy text shown publicly."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Cancellation cutoff (hours before session)" hint={`Default: ${BOOKING_POLICY_DEFAULTS.cancelCutoffHours}h`}>
            <input
              type="number"
              min={0}
              className={inputClass}
              placeholder={String(BOOKING_POLICY_DEFAULTS.cancelCutoffHours)}
              value={s.cancellation_cutoff_hours ?? ""}
              onChange={(e) => set("cancellation_cutoff_hours", numOrNull(e.target.value))}
            />
          </Field>
        </div>
        <Field
          label="Refund policy text"
          hint="Surfaced on the customer Cancellation page. Leave blank to use the bundled default."
        >
          <textarea
            rows={5}
            className={inputClass}
            placeholder={BOOKING_POLICY_DEFAULTS.refundPolicyText}
            value={s.refund_policy_text ?? ""}
            onChange={(e) => set("refund_policy_text", e.target.value)}
          />
        </Field>
      </Section>

      <Section
        title="Slot Lock TTLs"
        description="How long a tentative slot is held while a customer is in checkout. Defaults preserve current behavior."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Booking slot lock TTL (minutes)" hint={`Default: ${BOOKING_POLICY_DEFAULTS.slotLockTtlMinutes} min`}>
            <input
              type="number"
              min={1}
              className={inputClass}
              placeholder={String(BOOKING_POLICY_DEFAULTS.slotLockTtlMinutes)}
              value={s.slot_lock_ttl_minutes ?? ""}
              onChange={(e) => set("slot_lock_ttl_minutes", numOrNull(e.target.value))}
            />
          </Field>
          <Field label="Equipment rental lock TTL (minutes)" hint={`Default: ${BOOKING_POLICY_DEFAULTS.equipmentLockTtlMinutes} min`}>
            <input
              type="number"
              min={1}
              className={inputClass}
              placeholder={String(BOOKING_POLICY_DEFAULTS.equipmentLockTtlMinutes)}
              value={s.equipment_lock_ttl_minutes ?? ""}
              onChange={(e) => set("equipment_lock_ttl_minutes", numOrNull(e.target.value))}
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Transactional Emails"
        description="Disable a type to short-circuit it before send. Useful for incident response or testing without a redeploy."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {EMAIL_TOGGLE_TYPES.map((t) => {
            const enabled = s.email_toggles[t.key] !== false;
            return (
              <label
                key={t.key}
                className="flex items-center gap-2 bg-card border border-border/30 rounded-md px-3 py-2 text-xs font-body text-foreground cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => toggleEmail(t.key, e.target.checked)}
                />
                <span className={enabled ? "" : "text-muted-foreground line-through"}>{t.label}</span>
              </label>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground/70 font-body">
          When OFF, the matching email is logged as <code>disabled_by_admin</code> and not sent.
        </p>
      </Section>

      <div className="sticky bottom-4 flex justify-end pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="chrome-btn font-display font-semibold text-xs uppercase tracking-[0.1em] px-5 py-2.5 rounded-md flex items-center gap-2 disabled:opacity-50 shadow-lg"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Booking Policies
        </button>
      </div>
    </div>
  );
}
