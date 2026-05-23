import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

/**
 * Vision Mode toggle — flips the admin analytics dashboard between real
 * revenue and simulated $47K/month target distribution. Display-only;
 * no underlying data is modified. Defaults to OFF.
 */
export default function AdminVisionModePanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [rowId, setRowId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("id, vision_mode_enabled")
        .order("id")
        .limit(1)
        .maybeSingle();
      if (data) {
        setRowId(data.id);
        setEnabled(!!(data as any).vision_mode_enabled);
      }
      setLoading(false);
    })();
  }, []);

  const toggle = async (next: boolean) => {
    if (rowId == null) return;
    setSaving(true);
    const prev = enabled;
    setEnabled(next);
    const { error } = await supabase
      .from("site_settings")
      .update({ vision_mode_enabled: next } as any)
      .eq("id", rowId);
    setSaving(false);
    if (error) {
      setEnabled(prev);
      toast.error(error.message);
    } else {
      toast.success(next ? "Vision Mode ON — analytics simulated" : "Vision Mode OFF — real numbers restored");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${enabled ? "border-amber-500/50 bg-amber-500/5" : "border-border/30 bg-card"}`}>
      <div className="flex items-start gap-3">
        <Sparkles className={`w-5 h-5 mt-0.5 ${enabled ? "text-amber-400" : "text-muted-foreground"}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="font-display text-sm font-bold text-foreground">
              Vision Mode — overrides real revenue with simulated $47K target distribution
            </p>
            <label className="inline-flex items-center gap-2 cursor-pointer shrink-0">
              <span className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">
                {enabled ? "On" : "Off"}
              </span>
              <input
                type="checkbox"
                checked={enabled}
                disabled={saving}
                onChange={(e) => toggle(e.target.checked)}
                className="h-5 w-9 appearance-none rounded-full bg-secondary border border-border relative cursor-pointer transition-colors checked:bg-amber-500 before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:h-3.5 before:w-3.5 before:rounded-full before:bg-background before:transition-transform checked:before:translate-x-4"
              />
            </label>
          </div>
          <p className="text-xs text-muted-foreground font-body mt-1">
            Admin analytics dashboard only. Simulated numbers display a clear amber banner and "(sim)" tags.
            Bookings, payments, emails, Stripe, exports, and customer-facing pages always use real data.
            Defaults to OFF.
          </p>
        </div>
      </div>
    </div>
  );
}
