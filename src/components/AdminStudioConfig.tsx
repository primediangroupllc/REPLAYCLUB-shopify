import { useEffect, useState } from "react";
import { Save, RotateCcw, Plus, Trash2, ArrowUp, ArrowDown, Upload, ImageIcon, Code2, Palette, Youtube, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { logAdminAction } from "@/lib/auditLog";
import { useAllStudioConfigs } from "@/hooks/useStudioConfig";
import AdminOrbitRingPanel from "@/components/admin/AdminOrbitRingPanel";
import AdminBackdropsPanel from "@/components/admin/AdminBackdropsPanel";
import {
  STUDIO_KEYS,
  STUDIO_KEY_LABELS,
  StudioKey,
  StudioConfiguration,
  StudioLayout,
  StudioAddon,
} from "@/lib/studioConfig";

/**
 * Admin Studio Configuration editor — structured form per card.
 *
 * Each studio (Music, DJ, Podcast, Livestream, Backdrops) exposes three
 * sections of admin-editable cards: Layouts, Tiers, Add-ons. Per card the
 * admin edits title/description/equipment/price/image/order. Saves write
 * the JSONB columns of `studio_configurations`; the customer booking flow
 * re-reads these on page load (DB-first, hardcoded fallback in
 * `useStudioConfig`).
 *
 * An "Advanced (JSON)" toggle remains for power-edits.
 */

type Section = "layouts" | "tiers" | "addons";

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || `item-${Math.random().toString(36).slice(2, 6)}`;

const newLayout = (): StudioLayout => ({ id: slug(`layout-${Date.now()}`), name: "New layout", description: "" });
const newAddon = (): StudioAddon => ({
  id: slug(`addon-${Date.now()}`),
  name: "New add-on",
  price_cents: 0,
  unit: "flat",
  includes: [],
});

const reorder = <T,>(arr: T[], index: number, delta: number): T[] => {
  const next = [...arr];
  const target = index + delta;
  if (target < 0 || target >= next.length) return arr;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

const uploadImage = async (file: File, studioKey: StudioKey, section: Section): Promise<string | null> => {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${studioKey}/${section}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from("studio-assets")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) {
    toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    return null;
  }
  const { data } = supabase.storage.from("studio-assets").getPublicUrl(path);
  return data.publicUrl;
};

interface ImageFieldProps {
  url?: string;
  onChange: (url: string | undefined) => void;
  studioKey: StudioKey;
  section: Section;
}

const ImageField = ({ url, onChange, studioKey, section }: ImageFieldProps) => {
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] uppercase tracking-[0.18em] font-display font-semibold text-muted-foreground">
        Image
      </label>
      <div className="flex items-start gap-3">
        <div className="w-20 h-20 rounded-md bg-background border border-border/50 overflow-hidden flex items-center justify-center text-muted-foreground/60 shrink-0">
          {url ? (
            <img src={url} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1 space-y-1.5">
          <input
            type="url"
            value={url ?? ""}
            placeholder="https://… (or upload)"
            onChange={(e) => onChange(e.target.value || undefined)}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs font-body text-foreground focus:outline-none focus:ring-1 focus:ring-chrome"
          />
          <div className="flex items-center gap-2">
            <label className="chrome-btn-outline text-[10px] uppercase tracking-wider font-display px-3 py-1.5 rounded-md cursor-pointer flex items-center gap-1.5">
              <Upload className="h-3 w-3" />
              {busy ? "Uploading…" : "Upload"}
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={busy}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setBusy(true);
                  const u = await uploadImage(f, studioKey, section);
                  setBusy(false);
                  if (u) onChange(u);
                  e.target.value = "";
                }}
              />
            </label>
            {url && (
              <button
                type="button"
                onClick={() => onChange(undefined)}
                className="text-[10px] uppercase tracking-wider font-display text-muted-foreground hover:text-destructive"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface CardShellProps {
  index: number;
  total: number;
  title: string;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  children: React.ReactNode;
}

const CardShell = ({ index, total, title, onMoveUp, onMoveDown, onRemove, children }: CardShellProps) => (
  <div className="rounded-lg border border-border/50 bg-background/40 p-4 space-y-3">
    <div className="flex items-center justify-between gap-2">
      <p className="text-[10px] uppercase tracking-[0.18em] font-display font-semibold text-muted-foreground">
        #{index + 1} · {title}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={index === 0}
          onClick={onMoveUp}
          className="p-1 rounded hover:bg-muted/40 disabled:opacity-30"
          aria-label="Move up"
        >
          <ArrowUp className="h-3 w-3" />
        </button>
        <button
          type="button"
          disabled={index === total - 1}
          onClick={onMoveDown}
          className="p-1 rounded hover:bg-muted/40 disabled:opacity-30"
          aria-label="Move down"
        >
          <ArrowDown className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 rounded hover:bg-destructive/20 text-destructive"
          aria-label="Remove"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
    {children}
  </div>
);

const TextInput = ({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) => (
  <div>
    <label className="block text-[10px] uppercase tracking-[0.18em] font-display font-semibold text-muted-foreground mb-1">
      {label}
    </label>
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm font-body text-foreground focus:outline-none focus:ring-1 focus:ring-chrome"
    />
  </div>
);

const TextArea = ({
  label,
  value,
  onChange,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) => (
  <div>
    <label className="block text-[10px] uppercase tracking-[0.18em] font-display font-semibold text-muted-foreground mb-1">
      {label}
    </label>
    <textarea
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-body text-foreground focus:outline-none focus:ring-1 focus:ring-chrome resize-none"
    />
  </div>
);

const ListEditor = ({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) => (
  <div>
    <label className="block text-[10px] uppercase tracking-[0.18em] font-display font-semibold text-muted-foreground mb-1">
      {label}
    </label>
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            value={it}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
            placeholder={placeholder}
            className="flex-1 bg-background border border-border rounded-md px-2 py-1 text-xs font-body text-foreground focus:outline-none focus:ring-1 focus:ring-chrome"
          />
          <button
            type="button"
            onClick={() => onChange(reorder(items, i, -1))}
            disabled={i === 0}
            className="p-1 rounded hover:bg-muted/40 disabled:opacity-30"
            aria-label="Move up"
          >
            <ArrowUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onChange(reorder(items, i, 1))}
            disabled={i === items.length - 1}
            className="p-1 rounded hover:bg-muted/40 disabled:opacity-30"
            aria-label="Move down"
          >
            <ArrowDown className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="p-1 rounded hover:bg-destructive/20 text-destructive"
            aria-label="Remove"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="text-[10px] uppercase tracking-wider font-display text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <Plus className="h-3 w-3" /> Add item
      </button>
    </div>
  </div>
);

const AdminStudioConfig = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const { configs, loading } = useAllStudioConfigs(refreshKey);
  const [activeKey, setActiveKey] = useState<StudioKey>("music");
  const [drafts, setDrafts] = useState<Record<string, Partial<StudioConfiguration>>>({});
  const [advanced, setAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [heroHue, setHeroHue] = useState<string>("#9ca3af");
  const [heroHueSaving, setHeroHueSaving] = useState(false);
  const [heroHueDirty, setHeroHueDirty] = useState(false);

  // Load global hero hue from site_settings
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("studio_hero_hue")
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data?.studio_hero_hue) setHeroHue(data.studio_hero_hue);
    })();
  }, []);

  const active = configs.find((c) => c.studio_key === activeKey);
  const draft = drafts[activeKey] || {};

  const merged: StudioConfiguration | null = active
    ? {
        ...active,
        ...draft,
        layouts: (draft.layouts as StudioLayout[] | undefined) ?? active.layouts,
        tiers: active.tiers,
        addons: (draft.addons as StudioAddon[] | undefined) ?? active.addons,
      }
    : null;

  const updateField = <K extends keyof StudioConfiguration>(field: K, value: StudioConfiguration[K]) => {
    setDrafts((prev) => ({ ...prev, [activeKey]: { ...(prev[activeKey] || {}), [field]: value } }));
  };

  const isDirty = Object.keys(draft).length > 0;

  const handleSave = async () => {
    if (!merged) return;
    setSaving(true);
    const beforeSnapshot = active
      ? { layouts: active.layouts, addons: active.addons }
      : null;
    const { error } = await supabase
      .from("studio_configurations")
      .update({
        layouts: merged.layouts as any,
        addons: merged.addons as any,
      })
      .eq("studio_key", activeKey);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    void logAdminAction("update", "studio_configuration", activeKey, {
      before: beforeSnapshot,
      after: { layouts: merged.layouts, addons: merged.addons },
    });
    toast({ title: "Saved", description: `${STUDIO_KEY_LABELS[activeKey]} configuration updated.` });
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[activeKey];
      return next;
    });
    setRefreshKey((k) => k + 1);
  };

  const handleRevert = () => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[activeKey];
      return next;
    });
  };

  const saveHeroHue = async () => {
    setHeroHueSaving(true);
    // Single-row table; ensure id=1 exists, otherwise update first row.
    const { data: existing } = await supabase
      .from("site_settings")
      .select("id")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();
    const { error } = existing
      ? await supabase.from("site_settings").update({ studio_hero_hue: heroHue }).eq("id", existing.id)
      : await supabase.from("site_settings").insert({ studio_hero_hue: heroHue });
    setHeroHueSaving(false);
    if (error) {
      toast({ title: "Hue save failed", description: error.message, variant: "destructive" });
      return;
    }
    void logAdminAction("update", "site_settings", "studio_hero_hue", { studio_hero_hue: heroHue });
    setHeroHueDirty(false);
    toast({ title: "Hero hue saved", description: "All studio landing pages will use the new accent." });
  };

  if (loading) {
    return (
      <div className="card-premium p-6 text-center text-sm text-muted-foreground font-body">
        Loading studio configurations…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card-premium p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-sm font-bold text-foreground uppercase tracking-wider">
              Studio Configuration
            </h3>
            <p className="text-[11px] text-muted-foreground font-body leading-relaxed">
              Edit cards, prices, equipment, and images for every studio. Saves immediately update the
              customer booking flow.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAdvanced((a) => !a)}
            className="chrome-btn-outline text-[10px] uppercase tracking-wider font-display px-3 py-1.5 rounded-md flex items-center gap-1.5 shrink-0"
            aria-pressed={advanced}
          >
            <Code2 className="h-3 w-3" />
            {advanced ? "Form view" : "Advanced (JSON)"}
          </button>
        </div>
      </div>

      {/* Orbit Ring editor */}
      <AdminOrbitRingPanel />

      {/* Global hero hue picker */}
      <div className="card-premium p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          <h4 className="font-display text-xs font-bold text-foreground uppercase tracking-wider">
            Studio Hero Accent Hue
          </h4>
        </div>
        <p className="text-[11px] text-muted-foreground font-body leading-relaxed">
          Single global color applied to every studio landing page hero (Music, DJ, Podcast, Livestream,
          Backdrops). Customers see this as the accent tint on the hero overlay and CTA glow.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={heroHue}
            onChange={(e) => {
              setHeroHue(e.target.value);
              setHeroHueDirty(true);
            }}
            className="h-10 w-14 rounded border border-border bg-background cursor-pointer"
          />
          <input
            type="text"
            value={heroHue}
            onChange={(e) => {
              setHeroHue(e.target.value);
              setHeroHueDirty(true);
            }}
            placeholder="#9ca3af"
            className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-chrome"
          />
          <button
            type="button"
            onClick={saveHeroHue}
            disabled={!heroHueDirty || heroHueSaving}
            className="chrome-btn text-xs uppercase tracking-wider font-display font-semibold px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {heroHueSaving ? "Saving…" : "Save Hue"}
          </button>
        </div>
      </div>

      {/* Quick links to other admin-editable visual settings */}
      <div className="card-premium p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Youtube className="h-4 w-4 text-primary shrink-0" />
          <p className="text-[11px] text-muted-foreground font-body truncate">
            Homepage YouTube video URL is managed on the Homepage editor.
          </p>
        </div>
        <a
          href="/admin/homepage"
          className="chrome-btn-outline text-[10px] uppercase tracking-wider font-display px-3 py-1.5 rounded-md flex items-center gap-1.5 shrink-0"
        >
          Open <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Studio selector */}
      <div className="flex flex-wrap gap-1.5 bg-card rounded-lg p-1.5 border border-border/40">
        {STUDIO_KEYS.map((k) => {
          const dirty = !!drafts[k];
          return (
            <button
              key={k}
              onClick={() => setActiveKey(k)}
              className={`px-3 py-1.5 rounded-md text-xs font-display uppercase tracking-wider transition-all ${
                activeKey === k
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {STUDIO_KEY_LABELS[k]}
              {dirty && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-destructive align-middle" />}
            </button>
          );
        })}
      </div>

      {!merged ? (
        <div className="card-premium p-6 text-center text-sm text-muted-foreground font-body">
          No configuration found for this studio.
        </div>
      ) : (
        <div className="card-premium p-4 space-y-5">
          {/* Metadata (display_name, description, base price, tiers) is edited in /admin/services. */}
          <div className="rounded-md border border-border/40 bg-background/40 p-3 text-[11px] text-muted-foreground font-body">
            Title, "starting at" copy, base price, visibility, and pricing tiers are now edited in the
            <a href="/admin/services" className="ml-1 underline hover:text-foreground">Services & Tiers editor</a>.
            This panel manages layouts, add-ons, the orbit ring, and the global hero hue.
          </div>

          {advanced ? (
            // Advanced JSON view
            <div className="space-y-4">
              {(["layouts", "addons"] as const).map((field) => (
                <div key={field}>
                  <label className="block text-[10px] uppercase tracking-[0.18em] font-display font-semibold text-muted-foreground mb-1.5">
                    {field}
                  </label>
                  <textarea
                    value={JSON.stringify(merged[field], null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        if (Array.isArray(parsed)) updateField(field, parsed as any);
                      } catch {
                        /* ignore until valid */
                      }
                    }}
                    rows={10}
                    spellCheck={false}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-[11px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-chrome resize-y"
                  />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Layouts */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-display text-xs font-bold text-foreground uppercase tracking-wider">
                    Layouts ({merged.layouts.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => updateField("layouts", [...merged.layouts, newLayout()])}
                    className="chrome-btn-outline text-[10px] uppercase tracking-wider font-display px-3 py-1.5 rounded-md flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Layout
                  </button>
                </div>
                {merged.layouts.length === 0 && (
                  <p className="text-[11px] text-muted-foreground/70 font-body italic">
                    No layouts yet. Add one above.
                  </p>
                )}
                {merged.layouts.map((l, i) => (
                  <CardShell
                    key={l.id || i}
                    index={i}
                    total={merged.layouts.length}
                    title={l.name || "Untitled layout"}
                    onMoveUp={() => updateField("layouts", reorder(merged.layouts, i, -1))}
                    onMoveDown={() => updateField("layouts", reorder(merged.layouts, i, 1))}
                    onRemove={() => updateField("layouts", merged.layouts.filter((_, j) => j !== i))}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <TextInput
                        label="Title"
                        value={l.name}
                        onChange={(v) => {
                          const next = [...merged.layouts];
                          next[i] = { ...l, name: v };
                          updateField("layouts", next);
                        }}
                      />
                      <TextInput
                        label="ID (slug)"
                        value={l.id}
                        onChange={(v) => {
                          const next = [...merged.layouts];
                          next[i] = { ...l, id: slug(v) };
                          updateField("layouts", next);
                        }}
                      />
                    </div>
                    <TextArea
                      label="Description"
                      value={l.description ?? ""}
                      onChange={(v) => {
                        const next = [...merged.layouts];
                        next[i] = { ...l, description: v };
                        updateField("layouts", next);
                      }}
                    />
                    <ImageField
                      url={l.image_url}
                      studioKey={activeKey}
                      section="layouts"
                      onChange={(u) => {
                        const next = [...merged.layouts];
                        next[i] = { ...l, image_url: u };
                        updateField("layouts", next);
                      }}
                    />
                  </CardShell>
                ))}
              </section>

              {/* Add-ons */}
              <section className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-display text-xs font-bold text-foreground uppercase tracking-wider">
                    Add-ons ({merged.addons.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => updateField("addons", [...merged.addons, newAddon()])}
                    className="chrome-btn-outline text-[10px] uppercase tracking-wider font-display px-3 py-1.5 rounded-md flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add-on
                  </button>
                </div>
                {merged.addons.length === 0 && (
                  <p className="text-[11px] text-muted-foreground/70 font-body italic">No add-ons yet.</p>
                )}
                {merged.addons.map((a, i) => (
                  <CardShell
                    key={a.id || i}
                    index={i}
                    total={merged.addons.length}
                    title={a.name || "Untitled add-on"}
                    onMoveUp={() => updateField("addons", reorder(merged.addons, i, -1))}
                    onMoveDown={() => updateField("addons", reorder(merged.addons, i, 1))}
                    onRemove={() => updateField("addons", merged.addons.filter((_, j) => j !== i))}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <TextInput
                        label="Title"
                        value={a.name}
                        onChange={(v) => {
                          const next = [...merged.addons];
                          next[i] = { ...a, name: v };
                          updateField("addons", next);
                        }}
                      />
                      <TextInput
                        label="ID (slug)"
                        value={a.id}
                        onChange={(v) => {
                          const next = [...merged.addons];
                          next[i] = { ...a, id: slug(v) };
                          updateField("addons", next);
                        }}
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <TextInput
                        label="Price (USD)"
                        type="number"
                        value={String((a.price_cents ?? 0) / 100)}
                        onChange={(v) => {
                          const next = [...merged.addons];
                          next[i] = { ...a, price_cents: Math.round(parseFloat(v || "0") * 100) };
                          updateField("addons", next);
                        }}
                      />
                      <div>
                        <label className="block text-[10px] uppercase tracking-[0.18em] font-display font-semibold text-muted-foreground mb-1">
                          Unit
                        </label>
                        <select
                          value={a.unit}
                          onChange={(e) => {
                            const next = [...merged.addons];
                            next[i] = { ...a, unit: e.target.value as StudioAddon["unit"] };
                            updateField("addons", next);
                          }}
                          className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm font-body text-foreground focus:outline-none focus:ring-1 focus:ring-chrome"
                        >
                          <option value="flat">Flat (one-time)</option>
                          <option value="hourly">Hourly</option>
                          <option value="daily">Daily</option>
                          <option value="bundle">Bundle (priced via items)</option>
                        </select>
                      </div>
                    </div>
                    <TextArea
                      label="Description"
                      value={a.description ?? ""}
                      onChange={(v) => {
                        const next = [...merged.addons];
                        next[i] = { ...a, description: v };
                        updateField("addons", next);
                      }}
                    />
                    <ListEditor
                      label="Equipment / Includes"
                      items={a.includes ?? []}
                      placeholder="e.g. AlphaTheta XDJ-AZ"
                      onChange={(items) => {
                        const next = [...merged.addons];
                        next[i] = { ...a, includes: items };
                        updateField("addons", next);
                      }}
                    />
                    <ImageField
                      url={a.image_url}
                      studioKey={activeKey}
                      section="addons"
                      onChange={(u) => {
                        const next = [...merged.addons];
                        next[i] = { ...a, image_url: u };
                        updateField("addons", next);
                      }}
                    />
                  </CardShell>
                ))}
              </section>
            </>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40 sticky bottom-0 bg-card/80 backdrop-blur-sm -mx-4 px-4 -mb-4 pb-4">
            <button
              type="button"
              onClick={handleRevert}
              disabled={!isDirty || saving}
              className="chrome-btn-outline text-xs uppercase tracking-wider font-display px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <RotateCcw className="h-3 w-3" />
              Revert
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="chrome-btn text-xs uppercase tracking-wider font-display font-semibold px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Save className="h-3 w-3" />
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* Backdrop Options — the 4 selectable backdrop products shown to
          customers in the booking Customize step. Distinct from the
          backdrop homepage TAB imagery (which lives in Booking Tab Images). */}
      <div className="mt-10 pt-8 border-t border-border/30">
        <h2 className="font-display text-lg font-bold text-foreground mb-1">Backdrop Options</h2>
        <p className="text-[11px] text-muted-foreground font-body mb-4">
          For the booking customize step — what customers can pick when booking a session.
        </p>
        <AdminBackdropsPanel />
      </div>
    </div>
  );
};

export default AdminStudioConfig;
