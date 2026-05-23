import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Save,
  Trash2,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminTwoFactorGate } from "@/components/AdminTwoFactorGate";
import { useAdminSessionTimeout } from "@/hooks/useAdminSessionTimeout";
import { useAllStudioConfigs } from "@/hooks/useStudioConfig";
import { StudioConfiguration, StudioTier, StudioKey } from "@/lib/studioConfig";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);

/**
 * Admin Services + Tiers CRUD (chunk 3).
 *
 * Reads from `studio_configurations` (DB-first), writes via the
 * `admin_update_service`, `admin_upsert_tier`, and `admin_delete_tier`
 * SECURITY DEFINER RPCs. All writes are audit-logged server-side.
 *
 * Out of scope (chunk 4): hero/gallery image upload, rich-text long copy,
 * service add/remove, tier-level images.
 */

const dollarsToCents = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
const centsToDollars = (c: number | null | undefined): string => {
  if (c === null || c === undefined) return "";
  return (c / 100).toFixed(2);
};
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || `tier-${Math.random().toString(36).slice(2, 6)}`;

/**
 * Reusable inner content of the services admin surface, without the outer
 * page chrome (header/back-button/container). Embedded by AdminDashboard's
 * "Site Content" hub and by the standalone /admin/services page below.
 *
 * `embedded=true` skips the auth-redirect side-effect (the dashboard already
 * gates admin) and uses a lighter container.
 */
export function AdminServicesPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(embedded ? true : null);
  useAdminSessionTimeout(isAdmin === true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { configs, loading } = useAllStudioConfigs(refreshKey);

  useEffect(() => {
    if (embedded) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth", { replace: true });
        return;
      }
      const { data } = await supabase.rpc("has_role", {
        _user_id: session.user.id,
        _role: "admin" as const,
      });
      if (!data) {
        navigate("/", { replace: true });
        return;
      }
      setIsAdmin(true);
    })();
  }, [navigate, embedded]);

  const selectedKey = (params.get("service") as StudioKey | null) ?? null;
  const visible = useMemo(
    () => configs.filter((c) => c.studio_key !== "backdrops"),
    [configs],
  );
  const selected = visible.find((c) => c.studio_key === selectedKey) ?? null;

  if (isAdmin === null || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="space-y-6">
      {selected && (
        <button
          type="button"
          onClick={() => setParams({})}
          className="flex items-center gap-2 text-xs uppercase tracking-wider font-display text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          All services
        </button>
      )}
      {selected && (
        <h2 className="font-display text-base font-bold text-foreground uppercase tracking-wider">
          {selected.display_name}
        </h2>
      )}
      {!selected && (
        <ServiceList configs={visible} onPick={(k) => setParams({ service: k })} />
      )}
      {selected && (
        <ServiceDetail
          key={selected.studio_key}
          config={selected}
          onRefresh={refresh}
        />
      )}
    </div>
  );
}

const AdminServices = () => {
  const navigate = useNavigate();
  return (
    <AdminTwoFactorGate>
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <header className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate("/admin/dashboard")}
              className="flex items-center gap-2 text-xs uppercase tracking-wider font-display text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </button>
            <h1 className="font-display text-base font-bold text-foreground uppercase tracking-wider">
              Services & Tiers
            </h1>
            <div className="w-20" />
          </header>
          <AdminServicesPanel />
        </div>
      </div>
    </AdminTwoFactorGate>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// List view
// ─────────────────────────────────────────────────────────────────────────────
interface ServiceListProps {
  configs: StudioConfiguration[];
  onPick: (key: StudioKey) => void;
}
const ServiceList = ({ configs, onPick }: ServiceListProps) => {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground font-body">
        Edit pricing tiers, "starting at" copy, and visibility for each service.
        Changes are written to the database immediately and shown on the
        customer-facing landing pages on next load.
      </p>
      <ul className="space-y-2">
        {configs.map((c) => (
          <li key={c.studio_key}>
            <button
              type="button"
              onClick={() => onPick(c.studio_key)}
              className="w-full chrome-surface rounded-lg p-4 flex items-center gap-4 text-left hover:border-primary/40 transition-colors"
            >
              <div className="w-14 h-14 rounded-md bg-background border border-border/50 overflow-hidden flex items-center justify-center shrink-0">
                {c.hero_image_url ? (
                  <img src={c.hero_image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-display">
                    No img
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-sm font-bold text-foreground truncate">
                    {c.display_name}
                  </h2>
                  <span
                    className={`text-[10px] uppercase tracking-wider font-display px-2 py-0.5 rounded-full ${
                      c.is_active
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {c.is_active ? "Active" : "Hidden"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground font-body mt-0.5">
                  {c.starting_at_copy ||
                    (c.base_price_cents != null
                      ? `Starting at $${centsToDollars(c.base_price_cents)}/hr`
                      : "No base price set")}
                  {" · "}
                  {c.tiers.length} tier{c.tiers.length === 1 ? "" : "s"}
                  {" · "}sort {c.sort_order}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Detail view (service edit + tier CRUD)
// ─────────────────────────────────────────────────────────────────────────────
interface ServiceFormValues {
  display_name: string;
  starting_at_copy: string;
  description: string;
  base_price_dollars: string;
  sort_order: number;
  is_active: boolean;
}
interface ServiceDetailProps {
  config: StudioConfiguration;
  onRefresh: () => void;
}
const ServiceDetail = ({ config, onRefresh }: ServiceDetailProps) => {
  const [savingService, setSavingService] = useState(false);
  const [tiersOptimistic, setTiersOptimistic] = useState<StudioTier[]>(config.tiers);

  // Reset optimistic state when the underlying config changes (e.g. after refresh)
  useEffect(() => {
    setTiersOptimistic(config.tiers);
  }, [config.tiers]);

  const form = useForm<ServiceFormValues>({
    defaultValues: {
      display_name: config.display_name,
      starting_at_copy: config.starting_at_copy ?? "",
      description: config.description ?? "",
      base_price_dollars: centsToDollars(config.base_price_cents),
      sort_order: config.sort_order,
      is_active: config.is_active ?? true,
    },
  });

  const onSaveService = form.handleSubmit(async (values) => {
    setSavingService(true);
    const payload = {
      display_name: values.display_name.trim(),
      starting_at_copy: values.starting_at_copy.trim() || null,
      description: values.description.trim() || null,
      base_price_cents: dollarsToCents(values.base_price_dollars),
      sort_order: Number(values.sort_order) || 0,
      is_active: values.is_active,
    };
    const { error } = await supabase.rpc("admin_update_service", {
      p_studio_key: config.studio_key,
      p_payload: payload as any,
    });
    setSavingService(false);
    if (error) {
      toast.error("Save failed", { description: error.message });
      return;
    }
    toast.success(`${payload.display_name} saved`);
    form.reset(values);
    onRefresh();
  });

  const upsertTier = async (tier: StudioTier, isNew: boolean) => {
    // Optimistic
    const prev = tiersOptimistic;
    const next = isNew
      ? [...prev, tier]
      : prev.map((t) => (t.id === tier.id ? tier : t));
    setTiersOptimistic(next);
    const { error } = await supabase.rpc("admin_upsert_tier", {
      p_studio_key: config.studio_key,
      p_tier: tier as any,
    });
    if (error) {
      setTiersOptimistic(prev);
      toast.error(isNew ? "Add tier failed" : "Save tier failed", { description: error.message });
      return false;
    }
    toast.success(isNew ? "Tier added" : "Tier saved");
    onRefresh();
    return true;
  };

  const deleteTier = async (tier: StudioTier) => {
    if (!window.confirm(`Delete tier "${tier.label}"? This cannot be undone.`)) return;
    const prev = tiersOptimistic;
    setTiersOptimistic(prev.filter((t) => t.id !== tier.id));
    const { error } = await supabase.rpc("admin_delete_tier", {
      p_studio_key: config.studio_key,
      p_tier_id: tier.id,
    });
    if (error) {
      setTiersOptimistic(prev);
      toast.error("Delete blocked", { description: error.message, duration: 6000, icon: <AlertTriangle className="w-4 h-4" /> });
      return;
    }
    toast.success("Tier deleted");
    onRefresh();
  };

  const reorderTier = async (idx: number, delta: number) => {
    const target = idx + delta;
    if (target < 0 || target >= tiersOptimistic.length) return;
    // Reorder is purely a sort_order rewrite. Persist by upserting each tier
    // with its new sort_order. Cheap given <10 tiers per service.
    const next = [...tiersOptimistic];
    [next[idx], next[target]] = [next[target], next[idx]];
    const renumbered = next.map((t, i) => ({ ...t, sort_order: i }));
    setTiersOptimistic(renumbered);
    // Persist the two affected tiers
    const a = renumbered[idx];
    const b = renumbered[target];
    const [{ error: errA }, { error: errB }] = await Promise.all([
      supabase.rpc("admin_upsert_tier", { p_studio_key: config.studio_key, p_tier: a as any }),
      supabase.rpc("admin_upsert_tier", { p_studio_key: config.studio_key, p_tier: b as any }),
    ]);
    if (errA || errB) {
      setTiersOptimistic(tiersOptimistic);
      toast.error("Reorder failed", { description: (errA || errB)?.message });
      return;
    }
    onRefresh();
  };

  const addBlankTier = () => {
    const t: StudioTier = {
      id: slug(`tier-${Date.now()}`),
      label: "New tier",
      price_cents_per_hour: 0,
      features: [],
      sort_order: tiersOptimistic.length,
    };
    setTiersOptimistic((prev) => [...prev, t]);
  };

  return (
    <div className="space-y-6">
      {/* Service form */}
      <form onSubmit={onSaveService} className="chrome-surface rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xs font-bold text-foreground uppercase tracking-wider">
            Service details
          </h2>
          <label className="flex items-center gap-2 text-xs font-body text-muted-foreground">
            <input
              type="checkbox"
              {...form.register("is_active")}
              className="accent-primary"
            />
            <span className="flex items-center gap-1.5">
              {form.watch("is_active") ? (
                <Eye className="w-3.5 h-3.5" />
              ) : (
                <EyeOff className="w-3.5 h-3.5" />
              )}
              {form.watch("is_active") ? "Visible to customers" : "Hidden"}
            </span>
          </label>
        </div>

        <Field label="Title">
          <input
            {...form.register("display_name", { required: true, maxLength: 80 })}
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Base price ($/hr)">
            <input
              type="number"
              step="0.01"
              min="0"
              {...form.register("base_price_dollars")}
              className={inputCls}
            />
          </Field>
          <Field label="Sort order">
            <input
              type="number"
              min="0"
              {...form.register("sort_order", { valueAsNumber: true })}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label='"Starting at" copy (overrides auto-generated)'>
          <input
            {...form.register("starting_at_copy", { maxLength: 120 })}
            placeholder={`e.g. Starting at $${centsToDollars(config.base_price_cents) || "55"}/hr`}
            className={inputCls}
          />
        </Field>

        <Field label="Description">
          <textarea
            {...form.register("description", { maxLength: 1000 })}
            rows={3}
            className={`${inputCls} resize-y`}
          />
        </Field>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="submit"
            disabled={savingService || !form.formState.isDirty}
            className="chrome-btn font-display font-semibold text-xs uppercase tracking-wider px-4 py-2 rounded-md flex items-center gap-2 disabled:opacity-50"
          >
            {savingService ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save service
          </button>
        </div>
      </form>

      {/* Tiers */}
      <div className="chrome-surface rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xs font-bold text-foreground uppercase tracking-wider">
            Pricing tiers
          </h2>
          <button
            type="button"
            onClick={addBlankTier}
            className="chrome-btn-outline text-[10px] uppercase tracking-wider font-display px-3 py-1.5 rounded-md flex items-center gap-1.5"
          >
            <Plus className="w-3 h-3" /> Add tier
          </button>
        </div>
        {tiersOptimistic.length === 0 && (
          <p className="text-xs text-muted-foreground font-body italic">
            No tiers yet. Add one to make this service bookable.
          </p>
        )}
        <ul className="space-y-3">
          {tiersOptimistic.map((tier, idx) => (
            <TierRow
              key={tier.id}
              tier={tier}
              isFirst={idx === 0}
              isLast={idx === tiersOptimistic.length - 1}
              onMove={(delta) => reorderTier(idx, delta)}
              onSave={(updated) =>
                upsertTier(updated, !config.tiers.some((t) => t.id === tier.id))
              }
              onDelete={() => deleteTier(tier)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tier row
// ─────────────────────────────────────────────────────────────────────────────
interface TierRowProps {
  tier: StudioTier;
  isFirst: boolean;
  isLast: boolean;
  onMove: (delta: number) => void;
  onSave: (updated: StudioTier) => Promise<boolean>;
  onDelete: () => void;
}
const TierRow = ({ tier, isFirst, isLast, onMove, onSave, onDelete }: TierRowProps) => {
  const [label, setLabel] = useState(tier.label);
  const [tierId, setTierId] = useState(tier.id);
  const [priceDollars, setPriceDollars] = useState(centsToDollars(tier.price_cents_per_hour));
  const [flatAddonDollars, setFlatAddonDollars] = useState(
    tier.flat_addon_cents ? centsToDollars(tier.flat_addon_cents) : "",
  );
  const [imageUrl, setImageUrl] = useState(tier.image_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState(tier.description ?? "");
  const [featuresText, setFeaturesText] = useState((tier.features ?? []).join("\n"));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLabel(tier.label);
    setTierId(tier.id);
    setPriceDollars(centsToDollars(tier.price_cents_per_hour));
    setFlatAddonDollars(tier.flat_addon_cents ? centsToDollars(tier.flat_addon_cents) : "");
    setImageUrl(tier.image_url ?? "");
    setDescription(tier.description ?? "");
    setFeaturesText((tier.features ?? []).join("\n"));
  }, [tier]);

  const dirty =
    label !== tier.label ||
    tierId !== tier.id ||
    dollarsToCents(priceDollars) !== tier.price_cents_per_hour ||
    (dollarsToCents(flatAddonDollars) || 0) !== (tier.flat_addon_cents ?? 0) ||
    imageUrl !== (tier.image_url ?? "") ||
    description !== (tier.description ?? "") ||
    featuresText !== (tier.features ?? []).join("\n");

  const handleSave = async () => {
    if (!label.trim()) {
      toast.error("Tier label required");
      return;
    }
    const cleanId = slugify(tierId) || slug(label);
    const flatCents = dollarsToCents(flatAddonDollars);
    setSaving(true);
    const ok = await onSave({
      ...tier,
      id: cleanId,
      label: label.trim(),
      price_cents_per_hour: dollarsToCents(priceDollars),
      flat_addon_cents: flatCents > 0 ? flatCents : undefined,
      image_url: imageUrl.trim() || undefined,
      description: description.trim() || undefined,
      features: featuresText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    setSaving(false);
    if (!ok) {
      // Keep edited values so admin can retry
    }
  };

  const handleUpload = async (file: File) => {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `tiers/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    setUploading(true);
    const { error } = await supabase.storage
      .from("studio-assets")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) {
      setUploading(false);
      toast.error("Upload failed", { description: error.message });
      return;
    }
    const { data } = supabase.storage.from("studio-assets").getPublicUrl(path);
    setImageUrl(data.publicUrl);
    setUploading(false);
  };

  return (
    <li className="rounded-md border border-border/60 bg-background/40 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={60}
          className={`${inputCls} flex-1 font-semibold`}
          placeholder="Tier label"
        />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={isFirst}
            className="p-1.5 rounded hover:bg-muted disabled:opacity-30"
            aria-label="Move up"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={isLast}
            className="p-1.5 rounded hover:bg-muted disabled:opacity-30"
            aria-label="Move down"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Price ($/hr)">
          <input
            type="number"
            step="0.01"
            min="0"
            value={priceDollars}
            onChange={(e) => setPriceDollars(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Flat add-on fee ($, optional)">
          <input
            type="number"
            step="0.01"
            min="0"
            value={flatAddonDollars}
            onChange={(e) => setFlatAddonDollars(e.target.value)}
            placeholder="0.00"
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="Tier id (slug)">
        <input
          value={tierId}
          onChange={(e) => setTierId(e.target.value)}
          maxLength={60}
          placeholder="auto-generated from label"
          className={`${inputCls} font-mono text-xs`}
        />
      </Field>

      <Field label="Description (optional)">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          className={inputCls}
        />
      </Field>

      <Field label="Features / included equipment (one per line)">
        <textarea
          value={featuresText}
          onChange={(e) => setFeaturesText(e.target.value)}
          rows={3}
          className={`${inputCls} resize-y font-mono text-xs`}
          placeholder={"Pro mic setup\nAcoustic-treated room"}
        />
      </Field>

      <Field label="Tier image (optional)">
        <div className="flex items-start gap-3">
          <div className="w-16 h-16 rounded-md bg-background border border-border/50 overflow-hidden flex items-center justify-center text-muted-foreground/60 shrink-0">
            {imageUrl ? (
              <img src={imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[9px] uppercase tracking-wider font-display">No img</span>
            )}
          </div>
          <div className="flex-1 space-y-1.5">
            <input
              type="url"
              value={imageUrl}
              placeholder="https://… (or upload)"
              onChange={(e) => setImageUrl(e.target.value)}
              className={inputCls}
            />
            <div className="flex items-center gap-2">
              <label className="chrome-btn-outline text-[10px] uppercase tracking-wider font-display px-3 py-1 rounded-md cursor-pointer">
                {uploading ? "Uploading…" : "Upload"}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                    e.target.value = "";
                  }}
                />
              </label>
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl("")}
                  className="text-[10px] uppercase tracking-wider font-display text-muted-foreground hover:text-destructive"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </Field>

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onDelete}
          className="text-[11px] uppercase tracking-wider font-display text-destructive/80 hover:text-destructive flex items-center gap-1"
        >
          <Trash2 className="w-3 h-3" /> Delete
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="chrome-btn font-display font-semibold text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-md flex items-center gap-1.5 disabled:opacity-40"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Save tier
        </button>
      </div>
    </li>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tiny field/input helpers
// ─────────────────────────────────────────────────────────────────────────────
const inputCls =
  "w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-body text-foreground focus:outline-none focus:ring-1 focus:ring-chrome";

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1">
    <span className="block text-[10px] uppercase tracking-[0.18em] font-display font-semibold text-muted-foreground">
      {label}
    </span>
    {children}
  </label>
);

export default AdminServices;