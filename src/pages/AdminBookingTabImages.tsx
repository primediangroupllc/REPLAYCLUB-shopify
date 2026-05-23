import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckCircle2, GripVertical, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AdminTwoFactorGate } from "@/components/AdminTwoFactorGate";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  BOOKING_TAB_LABELS,
  BOOKING_TAB_LAYOUT_LABELS,
  fetchBookingTabImages,
  fetchBookingTabLayout,
  publicUrl,
  type BookingTabImage,
  type BookingTabLayoutVariant,
  type BookingTabType,
  type BookingTabMeta,
} from "@/lib/bookingTabImages";
import {
  useBookingTabsMeta,
  useBookingTabMetaByType,
} from "@/hooks/useBookingTabsMeta";
import { useHomeCardsCustom } from "@/hooks/useHomeCardsCustom";
import type { HomeCardCustom } from "@/lib/bookingTabImages";
import { cn } from "@/lib/utils";

const BUCKET = "booking-tab-images";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MIN_WIDTH = 1200;

const TYPES: BookingTabType[] = [
  "dj_session",
  "podcast",
  "studio_sesh",
  "backdrop",
  "equipment_rental",
  "livestream",
  "music",
];
const LAYOUT_VARIANTS: BookingTabLayoutVariant[] = ["single", "gallery", "collage"];

type SaveState = "idle" | "saving" | "dirty" | "error";

function formatBytes(n: number | null | undefined): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function getDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

/** Tiny SVG wireframe previews for the layout picker. */
function LayoutPreview({ variant }: { variant: BookingTabLayoutVariant }) {
  const fill = "currentColor";
  if (variant === "single") {
    return (
      <svg viewBox="0 0 60 40" className="w-full h-full text-muted-foreground/70">
        <rect x="2" y="2" width="56" height="36" rx="2" fill={fill} opacity="0.7" />
      </svg>
    );
  }
  if (variant === "gallery") {
    return (
      <svg viewBox="0 0 60 40" className="w-full h-full text-muted-foreground/70">
        <rect x="2" y="2" width="56" height="22" rx="2" fill={fill} opacity="0.7" />
        <rect x="2" y="28" width="12" height="10" rx="1" fill={fill} opacity="0.5" />
        <rect x="17" y="28" width="12" height="10" rx="1" fill={fill} opacity="0.5" />
        <rect x="32" y="28" width="12" height="10" rx="1" fill={fill} opacity="0.5" />
        <rect x="47" y="28" width="11" height="10" rx="1" fill={fill} opacity="0.5" />
      </svg>
    );
  }
  // collage — 1 large + 2x2 grid hint
  return (
    <svg viewBox="0 0 60 40" className="w-full h-full text-muted-foreground/70">
      <rect x="2" y="2" width="36" height="36" rx="2" fill={fill} opacity="0.7" />
      <rect x="41" y="2" width="17" height="17" rx="1" fill={fill} opacity="0.5" />
      <rect x="41" y="21" width="17" height="17" rx="1" fill={fill} opacity="0.5" />
    </svg>
  );
}

function TabSettings({
  type,
  trackWrite,
}: {
  type: BookingTabType;
  trackWrite: <T,>(p: PromiseLike<T>) => Promise<T>;
}) {
  const qc = useQueryClient();
  const meta = useBookingTabMetaByType(type);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [price, setPrice] = useState("");
  const [displayOrder, setDisplayOrder] = useState<number>(0);

  useEffect(() => {
    if (!meta) return;
    setTitle(meta.title ?? "");
    setSubtitle(meta.subtitle ?? "");
    setPrice(meta.price ?? "");
    setDisplayOrder(meta.display_order ?? 0);
  }, [meta?.id, meta?.updated_at]);

  async function persist(fields: Partial<BookingTabMeta>) {
    // Optimistic update of the cached list
    qc.setQueryData<BookingTabMeta[]>(["booking-tabs-meta"], (curr) =>
      (curr ?? []).map((m) =>
        m.booking_type === type ? ({ ...m, ...fields } as BookingTabMeta) : m,
      ),
    );
    const { error } = await trackWrite(
      supabase.from("booking_tabs_meta").upsert(
        { booking_type: type, title, subtitle, price, display_order: displayOrder, ...fields },
        { onConflict: "booking_type" },
      ),
    );
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["booking-tabs-meta"] });
      return;
    }
    qc.invalidateQueries({ queryKey: ["booking-tabs-meta"] });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => meta && title !== meta.title && persist({ title })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Subtitle</Label>
          <Input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            onBlur={() => meta && subtitle !== meta.subtitle && persist({ subtitle })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Price</Label>
          <Input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={() => meta && price !== meta.price && persist({ price })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Display Order</Label>
          <Input
            type="number"
            value={displayOrder}
            onChange={(e) => {
              const next = Number(e.target.value);
              setDisplayOrder(next);
              if (meta && next !== meta.display_order) persist({ display_order: next });
            }}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 pt-1">
        <Switch
          checked={meta?.coming_soon ?? false}
          onCheckedChange={(v) => persist({ coming_soon: v })}
        />
        <span className="text-sm font-body text-muted-foreground">Coming Soon</span>
      </label>
      <label className="flex items-center gap-2 pt-1">
        <Switch
          checked={meta?.is_hidden ?? false}
          onCheckedChange={(v) => persist({ is_hidden: v })}
        />
        <span className="text-sm font-body text-muted-foreground">
          Hide on home (removes the card from the home selector)
        </span>
      </label>
    </div>
  );
}

function LayoutPicker({ type }: { type: BookingTabType }) {
  const qc = useQueryClient();
  const queryKey = ["admin-booking-tab-layout", type];
  const { data: variant } = useQuery<BookingTabLayoutVariant>({
    queryKey,
    queryFn: () => fetchBookingTabLayout(type),
    initialData: "gallery",
  });

  async function setVariant(next: BookingTabLayoutVariant) {
    if (next === variant) return;
    // Optimistic
    qc.setQueryData(queryKey, next);
    const { error } = await supabase
      .from("booking_tab_layout")
      .upsert(
        { booking_type: type, layout_variant: next },
        { onConflict: "booking_type" },
      );
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey });
      return;
    }
    qc.invalidateQueries({ queryKey: ["booking-tab-layout", type] });
    toast.success(`Layout set to ${BOOKING_TAB_LAYOUT_LABELS[next]}`);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {LAYOUT_VARIANTS.map((v) => {
          const active = v === variant;
          return (
            <button
              key={v}
              type="button"
              onClick={() => setVariant(v)}
              className={cn(
                "chrome-surface rounded-lg p-3 border-2 text-left transition-all",
                active
                  ? "border-primary"
                  : "border-border/30 hover:border-border/60",
              )}
              aria-pressed={active}
            >
              <div className="aspect-[3/2] mb-2 rounded bg-background/40 p-2">
                <LayoutPreview variant={v} />
              </div>
              <div className="font-display text-xs font-bold uppercase tracking-wider text-foreground">
                {BOOKING_TAB_LAYOUT_LABELS[v]}
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] font-body text-muted-foreground">
        Single = 1 image only (uses the first active image). Gallery = hero + thumbnails.
        Collage = grid of all active images.
      </p>
    </div>
  );
}

const SortableThumb = ({
  image,
  onToggleActive,
  onDelete,
}: {
  image: BookingTabImage;
  onToggleActive: (img: BookingTabImage, next: boolean) => void;
  onDelete: (img: BookingTabImage) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: image.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="chrome-surface rounded-lg overflow-hidden border border-border/30 flex flex-col"
    >
      <div className="relative aspect-[4/3] bg-black/40">
        <img
          src={image.url}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <button
          {...attributes}
          {...listeners}
          className="absolute top-2 left-2 p-1.5 rounded bg-background/70 text-foreground cursor-grab active:cursor-grabbing"
          aria-label="Drag to reorder"
          type="button"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        {!image.is_active && (
          <span className="absolute top-2 right-2 text-[10px] uppercase font-display tracking-wider px-2 py-0.5 rounded bg-background/80 text-muted-foreground">
            Inactive
          </span>
        )}
      </div>
      <div className="p-3 text-[11px] font-body space-y-2">
        <div className="text-muted-foreground">
          {image.width && image.height
            ? `${image.width}×${image.height}`
            : "Unknown size"}
          {" · "}
          {formatBytes(image.bytes)}
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2">
            <Switch
              checked={image.is_active}
              onCheckedChange={(v) => onToggleActive(image, v)}
            />
            <span className="text-muted-foreground">Active</span>
          </label>
          <button
            type="button"
            onClick={() => onDelete(image)}
            className="text-destructive hover:text-destructive/80"
            aria-label="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const TabPanel = ({ type }: { type: BookingTabType }) => {
  const qc = useQueryClient();
  const queryKey = ["admin-booking-tab-images", type];
  const { data, isLoading } = useQuery<BookingTabImage[]>({
    queryKey,
    queryFn: () => fetchBookingTabImages(type, false),
    staleTime: 30_000,
  });
  const [items, setItems] = useState<BookingTabImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const inflightRef = useRef(0);

  const trackWrite = async <T,>(p: PromiseLike<T>): Promise<T> => {
    inflightRef.current += 1;
    setSaveState("saving");
    try {
      const r = (await p) as T;
      inflightRef.current -= 1;
      if (inflightRef.current <= 0) setSaveState("idle");
      return r;
    } catch (e) {
      inflightRef.current -= 1;
      setSaveState("error");
      throw e;
    }
  };

  useEffect(() => {
    if (data) setItems(data);
  }, [data]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const invalidatePublic = () => {
    qc.invalidateQueries({ queryKey: ["booking-tab-images", type] });
    qc.invalidateQueries({ queryKey: ["booking-tab-layout", type] });
    qc.invalidateQueries({ queryKey });
  };

  async function publishNow() {
    // Wait for any pending writes briefly
    const start = Date.now();
    while (inflightRef.current > 0 && Date.now() - start < 5000) {
      await new Promise((r) => setTimeout(r, 100));
    }
    invalidatePublic();
    if (saveState === "error") {
      toast.error("Some changes failed to save — please retry.");
      return;
    }
    toast.success("Changes published — live on site");
    setSaveState("idle");
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setSaveState("saving");
    let nextOrder = items.length > 0 ? Math.max(...items.map((i) => i.display_order)) + 1 : 0;
    let added = 0;
    for (const file of Array.from(files)) {
      try {
        if (!ALLOWED_MIME.has(file.type)) {
          toast.error(`${file.name}: only JPG, PNG, or WebP allowed`);
          continue;
        }
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name}: exceeds 5 MB limit`);
          continue;
        }
        let dims: { width: number; height: number } | null = null;
        try {
          dims = await getDimensions(file);
        } catch {
          /* non-fatal */
        }
        if (dims && dims.width < MIN_WIDTH) {
          toast.warning(
            `${file.name}: width ${dims.width}px is below recommended ${MIN_WIDTH}px`,
          );
        }
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${type}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await trackWrite(
          supabase.storage
            .from(BUCKET)
            .upload(path, file, { contentType: file.type, upsert: false }),
        );
        if (upErr) {
          toast.error(`${file.name}: ${upErr.message}`);
          continue;
        }
        const { error: insErr } = await trackWrite(supabase.from("booking_tab_images").insert({
          booking_type: type,
          storage_path: path,
          display_order: nextOrder++,
          is_active: true,
          width: dims?.width ?? null,
          height: dims?.height ?? null,
          bytes: file.size,
          mime_type: file.type,
        }));
        if (insErr) {
          await supabase.storage.from(BUCKET).remove([path]);
          toast.error(`${file.name}: ${insErr.message}`);
          continue;
        }
        added++;
      } catch (e: any) {
        toast.error(`${file.name}: ${e?.message ?? "upload failed"}`);
      }
    }
    setUploading(false);
    if (added > 0) {
      toast.success(`Uploaded ${added} image${added === 1 ? "" : "s"}`);
      invalidatePublic();
    }
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex).map((it, idx) => ({
      ...it,
      display_order: idx,
    }));
    setItems(next);
    // Persist new order
    const updates = await trackWrite(Promise.all(
      next.map((it) =>
        supabase
          .from("booking_tab_images")
          .update({ display_order: it.display_order })
          .eq("id", it.id),
      ),
    ));
    if (updates.some((u) => u.error)) {
      toast.error("Failed to save new order");
      setSaveState("error");
      return;
    }
    invalidatePublic();
  }

  async function onToggleActive(img: BookingTabImage, next: boolean) {
    const prev = items;
    setItems((curr) => curr.map((i) => (i.id === img.id ? { ...i, is_active: next } : i)));
    const { error } = await trackWrite(
      supabase.from("booking_tab_images").update({ is_active: next }).eq("id", img.id),
    );
    if (error) {
      setItems(prev);
      toast.error(error.message);
    } else {
      invalidatePublic();
    }
  }

  async function onDelete(img: BookingTabImage) {
    if (!confirm("Delete this image? This cannot be undone.")) return;
    const prev = items;
    setItems((curr) => curr.filter((i) => i.id !== img.id));
    const { error: delDb } = await trackWrite(
      supabase.from("booking_tab_images").delete().eq("id", img.id),
    );
    if (delDb) {
      setItems(prev);
      toast.error(delDb.message);
      return;
    }
    await supabase.storage.from(BUCKET).remove([img.storage_path]);
    invalidatePublic();
    toast.success("Image deleted");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-sm font-bold text-foreground uppercase tracking-wider mb-3">
          Tab Settings
        </h2>
        <TabSettings type={type} trackWrite={trackWrite} />
      </div>
      <div>
        <h2 className="font-display text-sm font-bold text-foreground uppercase tracking-wider mb-3">
          Layout
        </h2>
        <LayoutPicker type={type} />
      </div>
      <div>
        <h2 className="font-display text-sm font-bold text-foreground uppercase tracking-wider mb-3">
          Images
        </h2>
      <label
        className="flex items-center justify-center gap-2 border-2 border-dashed border-border/50 rounded-lg p-6 cursor-pointer hover:border-primary/50 transition-colors"
      >
        <Upload className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-body text-muted-foreground">
          {uploading ? "Uploading…" : "Click to upload — JPG, PNG, or WebP up to 5 MB each"}
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {isLoading ? (
        <p className="text-sm text-muted-foreground font-body">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground font-body">
          No images yet — the page will fall back to the default hardcoded image.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((img) => (
                <SortableThumb
                  key={img.id}
                  image={img}
                  onToggleActive={onToggleActive}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      </div>

      {/* Sticky Save & Publish bar */}
      <div className="sticky bottom-0 left-0 right-0 z-20 -mx-4 px-4 py-3 mt-6 bg-background/90 backdrop-blur border-t border-border/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-body">
          {saveState === "saving" ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Saving…</span>
            </>
          ) : saveState === "dirty" ? (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-muted-foreground">Unsaved changes</span>
            </>
          ) : saveState === "error" ? (
            <>
              <span className="w-2 h-2 rounded-full bg-destructive" />
              <span className="text-destructive">Error — retry</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-muted-foreground">All changes saved</span>
            </>
          )}
        </div>
        <Button
          type="button"
          onClick={publishNow}
          disabled={saveState === "saving"}
          className="chrome-btn font-display text-xs uppercase tracking-wider"
        >
          Save &amp; Publish
        </Button>
      </div>
    </div>
  );
};

function CustomCardEditor({
  card,
  onDelete,
}: {
  card: HomeCardCustom;
  onDelete: (c: HomeCardCustom) => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(card.title);
  const [subtitle, setSubtitle] = useState(card.subtitle);
  const [price, setPrice] = useState(card.price);
  const [route, setRoute] = useState(card.route);
  const [displayOrder, setDisplayOrder] = useState<number>(card.display_order);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setTitle(card.title);
    setSubtitle(card.subtitle);
    setPrice(card.price);
    setRoute(card.route);
    setDisplayOrder(card.display_order);
  }, [card.id, card.updated_at]);

  async function persist(fields: Partial<HomeCardCustom>) {
    qc.setQueryData<HomeCardCustom[]>(["home-cards-custom"], (curr) =>
      (curr ?? []).map((c) =>
        c.id === card.id ? ({ ...c, ...fields } as HomeCardCustom) : c,
      ),
    );
    const { error } = await (supabase as any)
      .from("home_cards_custom")
      .update(fields)
      .eq("id", card.id);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["home-cards-custom"] });
      return;
    }
    qc.invalidateQueries({ queryKey: ["home-cards-custom"] });
  }

  async function handleImageUpload(file: File) {
    if (!ALLOWED_MIME.has(file.type)) {
      toast.error("Only JPG, PNG, or WebP allowed");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Exceeds 5 MB limit");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `custom-cards/${card.id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) {
        toast.error(upErr.message);
        return;
      }
      const base = publicUrl(path);
      const url = `${base}?v=${Date.now()}`;
      await persist({ image_url: url });
      toast.success("Image uploaded");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="chrome-surface rounded-lg border border-border/30 p-4 space-y-4">
      <div className="flex items-start gap-4">
        <label className="relative w-32 aspect-[3/4] rounded-lg overflow-hidden border border-border/30 cursor-pointer bg-black/40 flex items-center justify-center shrink-0">
          {card.image_url ? (
            <img
              src={card.image_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <Upload className="w-5 h-5 text-muted-foreground" />
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImageUpload(f);
              e.target.value = "";
            }}
          />
          {uploading && (
            <span className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-foreground animate-spin" />
            </span>
          )}
        </label>
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => title !== card.title && persist({ title })}
              placeholder="Card title shown on home"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Subtitle</Label>
            <Input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              onBlur={() => subtitle !== card.subtitle && persist({ subtitle })}
              placeholder="Short tagline (optional)"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Price</Label>
            <Input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onBlur={() => price !== card.price && persist({ price })}
              placeholder="$XX/hr (optional)"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Click destination</Label>
            <Input
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              onBlur={() => route !== card.route && persist({ route })}
              placeholder="/photoshoot  or  https://example.com"
            />
            <p className="text-[10px] font-body text-muted-foreground">
              Internal path (e.g. <code>/podcast</code>) navigates in-app. URL starting with <code>http</code> opens in a new tab.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Display Order</Label>
            <Input
              type="number"
              value={displayOrder}
              onChange={(e) => {
                const next = Number(e.target.value);
                setDisplayOrder(next);
                if (next !== card.display_order) persist({ display_order: next });
              }}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/20">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <Switch
              checked={card.coming_soon}
              onCheckedChange={(v) => persist({ coming_soon: v })}
            />
            <span className="text-sm font-body text-muted-foreground">Coming Soon</span>
          </label>
          <label className="flex items-center gap-2">
            <Switch
              checked={card.is_hidden}
              onCheckedChange={(v) => persist({ is_hidden: v })}
            />
            <span className="text-sm font-body text-muted-foreground">Hide on home</span>
          </label>
        </div>
        <button
          type="button"
          onClick={() => onDelete(card)}
          className="text-destructive hover:text-destructive/80 inline-flex items-center gap-1.5 text-sm font-body"
        >
          <Trash2 className="w-4 h-4" />
          Delete card
        </button>
      </div>
    </div>
  );
}

function CustomCardsPanel() {
  const qc = useQueryClient();
  const { data: cards = [] } = useHomeCardsCustom();
  const [creating, setCreating] = useState(false);

  async function addNewCard() {
    setCreating(true);
    try {
      const nextOrder =
        cards.length > 0 ? Math.max(...cards.map((c) => c.display_order)) + 1 : 100;
      const { error } = await (supabase as any)
        .from("home_cards_custom")
        .insert({
          title: "New Card",
          subtitle: "",
          price: "",
          route: "",
          display_order: nextOrder,
          coming_soon: true,
          is_hidden: false,
        });
      if (error) {
        toast.error(error.message);
        return;
      }
      qc.invalidateQueries({ queryKey: ["home-cards-custom"] });
      toast.success("New card added — fill in the details");
    } finally {
      setCreating(false);
    }
  }

  async function deleteCard(card: HomeCardCustom) {
    if (!confirm(`Delete the card "${card.title}"? This cannot be undone.`)) return;
    const { error } = await (supabase as any)
      .from("home_cards_custom")
      .delete()
      .eq("id", card.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (card.image_url) {
      const m = /\/booking-tab-images\/(custom-cards\/[^?]+)/.exec(card.image_url);
      if (m) await supabase.storage.from(BUCKET).remove([m[1]]);
    }
    qc.invalidateQueries({ queryKey: ["home-cards-custom"] });
    toast.success("Card deleted");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-body text-muted-foreground">
          Add cards to the home selector that aren't one of the fixed 7 services. Each card needs a click destination — either an internal path like <code>/podcast</code> or a full URL.
        </p>
        <Button
          type="button"
          onClick={addNewCard}
          disabled={creating}
          className="chrome-btn font-display text-xs uppercase tracking-wider shrink-0"
        >
          <Plus className="w-4 h-4 mr-1" />
          {creating ? "Adding…" : "Add card"}
        </Button>
      </div>
      {cards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/40 p-8 text-center">
          <p className="text-sm font-body text-muted-foreground">
            No custom cards yet. Click "Add card" to create one.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((c) => (
            <CustomCardEditor key={c.id} card={c} onDelete={deleteCard} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Reusable inner content of the booking-tab-images admin surface, without
 * outer page chrome. Embedded by AdminDashboard's "Site Content" hub and by
 * the standalone /admin/booking-tab-images page below.
 */
export function AdminBookingTabImagesPanel() {
  const { data: metaList = [] } = useBookingTabsMeta();
  const titleFor = (t: BookingTabType) =>
    metaList.find((m) => m.booking_type === t)?.title ?? BOOKING_TAB_LABELS[t];
  return (
    <Tabs defaultValue="dj_session" className="w-full">
      <TabsList className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 w-full">
        {TYPES.map((t) => (
          <TabsTrigger key={t} value={t} className="text-xs sm:text-sm">
            {titleFor(t)}
          </TabsTrigger>
        ))}
        <TabsTrigger value="__custom" className="text-xs sm:text-sm">
          Custom
        </TabsTrigger>
      </TabsList>
      {TYPES.map((t) => (
        <TabsContent key={t} value={t} className="mt-6">
          <TabPanel type={t} />
        </TabsContent>
      ))}
      <TabsContent value="__custom" className="mt-6">
        <CustomCardsPanel />
      </TabsContent>
    </Tabs>
  );
}

export default function AdminBookingTabImages() {
  return (
    <AdminTwoFactorGate>
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-display">Booking Tab Images</h1>
          <p className="text-sm font-body text-muted-foreground mt-1">
            Manage images shown on each booking type's landing page. Drag to reorder, toggle to
            hide. If a tab has no active images, the page falls back to the default.
          </p>
        </div>
        <AdminBookingTabImagesPanel />
      </div>
    </AdminTwoFactorGate>
  );
}
