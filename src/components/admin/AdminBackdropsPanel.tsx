import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FALLBACK_IMAGES } from "@/hooks/useBackdrops";
import { cn } from "@/lib/utils";

/**
 * Backdrops admin panel — reads/writes studio_configurations.layouts for
 * the DJ studio, which is our canonical (universal) backdrop store while
 * the dedicated public.backdrops table is unavailable on prod.
 *
 * Each layout has { id, name, description?, image_url? }. Admin edits
 * propagate to every booking modal (customize step) and the DJ landing
 * page's "Available Backdrops" gallery via the existing realtime sub
 * on studio_configurations.
 */

interface BackdropLayout {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
}

const STUDIO_KEY = "dj";
const BUCKET = "studio-assets"; // existing bucket used by AdminStudioConfig
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || `backdrop-${Math.random().toString(36).slice(2, 6)}`;

async function fetchDjLayouts(): Promise<BackdropLayout[]> {
  const { data, error } = await supabase
    .from("studio_configurations")
    .select("layouts")
    .eq("studio_key", STUDIO_KEY)
    .maybeSingle();
  if (error || !data) return [];
  const layouts = (data.layouts as unknown as BackdropLayout[] | null) ?? [];
  return Array.isArray(layouts)
    ? layouts.map((l) => ({
        id: l.id || slug(l.name || ""),
        name: l.name || "",
        description: l.description,
        image_url: l.image_url,
      }))
    : [];
}

async function saveDjLayouts(next: BackdropLayout[]): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("studio_configurations")
    .update({ layouts: next as never })
    .eq("studio_key", STUDIO_KEY);
  return { error: error?.message ?? null };
}

interface RowProps {
  layout: BackdropLayout;
  index: number;
  total: number;
  onChange: (next: BackdropLayout) => void;
  onMove: (delta: number) => void;
  onDelete: () => void;
}

const BackdropRow = ({ layout, index, total, onChange, onMove, onDelete }: RowProps) => {
  const [name, setName] = useState(layout.name);
  const [description, setDescription] = useState(layout.description ?? "");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(layout.name);
    setDescription(layout.description ?? "");
  }, [layout]);

  const handleUpload = async (file: File) => {
    if (!ALLOWED_MIME.has(file.type)) {
      toast.error("Please upload a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image must be under 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `backdrops/${layout.id || slug(layout.name)}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "31536000", upsert: false });
      if (uploadErr) {
        toast.error(`Upload failed: ${uploadErr.message}`);
        return;
      }
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onChange({ ...layout, image_url: pub.publicUrl });
      toast.success("Photo updated — Save Changes to publish");
    } finally {
      setUploading(false);
    }
  };

  // Show admin-uploaded URL → bundled fallback by name → empty.
  const previewSrc =
    layout.image_url ||
    FALLBACK_IMAGES[layout.name] ||
    FALLBACK_IMAGES[`${layout.name} Backdrop`];

  return (
    <div className="rounded-md border border-border/40 p-4">
      <div className="flex items-start gap-4">
        <div className="shrink-0 space-y-2">
          <div className="relative w-32 h-24 rounded overflow-hidden bg-muted">
            {previewSrc ? (
              <img src={previewSrc} alt={layout.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground font-body text-center px-2">
                No photo
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-32 text-[10px] font-body uppercase tracking-wider py-1.5 rounded border border-border hover:bg-muted flex items-center justify-center gap-1"
          >
            <Upload className="w-3 h-3" />
            Replace photo
          </button>
        </div>

        <div className="flex-1 space-y-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (name !== layout.name) onChange({ ...layout, name });
            }}
            className="w-full px-2 py-1.5 rounded border border-input bg-background text-sm font-display font-semibold"
            placeholder="Backdrop name"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 300))}
            onBlur={() => {
              if (description !== (layout.description ?? "")) {
                onChange({ ...layout, description: description || undefined });
              }
            }}
            rows={2}
            className="w-full px-2 py-1.5 rounded border border-input bg-background text-xs font-body resize-none"
            placeholder="Description shown to customers"
          />
          <div className="flex items-center justify-end gap-1 pt-1">
            <button
              onClick={() => onMove(-1)}
              disabled={index === 0}
              className="p-1.5 rounded border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Move up"
            >
              <ArrowUp className="w-3 h-3" />
            </button>
            <button
              onClick={() => onMove(1)}
              disabled={index === total - 1}
              className="p-1.5 rounded border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Move down"
            >
              <ArrowDown className="w-3 h-3" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded border border-destructive/40 text-destructive hover:bg-destructive/10"
              aria-label="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminBackdropsPanel = () => {
  const qc = useQueryClient();
  const queryKey = ["admin", "backdrops", "dj-layouts"];
  const { data: stored, isLoading, refetch } = useQuery<BackdropLayout[]>({
    queryKey,
    queryFn: fetchDjLayouts,
    staleTime: 0,
  });
  const [draft, setDraft] = useState<BackdropLayout[] | null>(null);
  const [saving, setSaving] = useState(false);

  // Realtime: any change to studio_configurations refetches
  useEffect(() => {
    const channel = supabase
      .channel(`admin-backdrops-dj-layouts`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "studio_configurations",
          filter: `studio_key=eq.${STUDIO_KEY}`,
        },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc]);

  const current = draft ?? stored ?? [];
  const isDirty = draft !== null;

  const updateAt = (i: number, next: BackdropLayout) => {
    setDraft(current.map((l, idx) => (idx === i ? next : l)));
  };

  const handleMove = (i: number, delta: number) => {
    const target = i + delta;
    if (target < 0 || target >= current.length) return;
    const next = [...current];
    [next[i], next[target]] = [next[target], next[i]];
    setDraft(next);
  };

  const handleDelete = (i: number) => {
    if (!confirm(`Delete "${current[i].name}"?`)) return;
    setDraft(current.filter((_, idx) => idx !== i));
  };

  const handleAdd = () => {
    setDraft([
      ...current,
      {
        id: slug(`backdrop-${Date.now()}`),
        name: "New backdrop",
        description: "",
      },
    ]);
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const { error } = await saveDjLayouts(draft);
      if (error) {
        toast.error(`Save failed: ${error}`);
        return;
      }
      toast.success("Backdrops saved — live on customer site within seconds");
      setDraft(null);
      void refetch();
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = () => setDraft(null);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-body py-4">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading backdrops…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground font-body">
        Photo backdrops shown in the booking Customize step (every service) and
        on the DJ landing page's "Available Backdrops" gallery. Edits propagate
        live to the customer site within seconds. Use Save Changes to publish.
      </p>
      {current.length === 0 && (
        <p className="text-xs text-muted-foreground font-body italic">
          No backdrops yet. Click "Add backdrop" to create one.
        </p>
      )}
      {current.map((layout, i) => (
        <BackdropRow
          key={layout.id || i}
          layout={layout}
          index={i}
          total={current.length}
          onChange={(next) => updateAt(i, next)}
          onMove={(delta) => handleMove(i, delta)}
          onDelete={() => handleDelete(i)}
        />
      ))}
      <div className="flex items-center justify-between gap-2 pt-2">
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-3 py-2 rounded border border-border hover:bg-muted text-xs font-body"
        >
          <Plus className="w-3 h-3" /> Add backdrop
        </button>
        <div className={cn("flex items-center gap-2 transition-opacity", isDirty ? "opacity-100" : "opacity-50 pointer-events-none")}>
          <button
            onClick={handleRevert}
            disabled={!isDirty || saving}
            className="px-3 py-2 text-xs font-body rounded border border-border hover:bg-muted disabled:opacity-50"
          >
            Revert
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="chrome-btn px-4 py-2 text-xs font-display font-semibold uppercase tracking-wider rounded disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminBackdropsPanel;
