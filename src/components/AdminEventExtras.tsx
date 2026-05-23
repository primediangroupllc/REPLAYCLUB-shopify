import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Upload, ArrowUp, ArrowDown } from "lucide-react";

interface Tier {
  id?: string;
  name: string;
  description: string | null;
  price_cents: number;
  capacity: number;
  sort_order: number;
  sold_out: boolean;
  is_free: boolean;
}
interface LineupItem {
  id?: string;
  name: string;
  role: string | null;
  bio: string | null;
  photo_url: string | null;
  sort_order: number;
}
interface GalleryItem {
  id: string;
  image_url: string;
  caption: string | null;
  sort_order: number;
}

const AdminEventExtras = ({ eventId, eventSlug }: { eventId: string; eventSlug: string | null }) => {
  const { toast } = useToast();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [lineup, setLineup] = useState<LineupItem[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [slug, setSlug] = useState(eventSlug || "");

  const load = async () => {
    const [t, l, g] = await Promise.all([
      supabase.from("event_ticket_tiers").select("*").eq("event_id", eventId).order("sort_order"),
      supabase.from("event_lineup").select("*").eq("event_id", eventId).order("sort_order"),
      supabase.from("event_gallery").select("*").eq("event_id", eventId).order("sort_order"),
    ]);
    setTiers((t.data as Tier[]) || []);
    setLineup((l.data as LineupItem[]) || []);
    setGallery((g.data as GalleryItem[]) || []);
  };
  useEffect(() => { load(); }, [eventId]);

  const saveSlug = async () => {
    const clean = slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/(^-|-$)/g, "");
    const { error } = await supabase.from("events").update({ slug: clean || null }).eq("id", eventId);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setSlug(clean);
    toast({ title: "Slug saved", description: `/events/${clean}` });
  };

  // Tiers
  const addTier = () => setTiers([...tiers, { name: "New tier", description: "", price_cents: 0, capacity: 50, sort_order: tiers.length, sold_out: false, is_free: false }]);
  const updateTier = (i: number, patch: Partial<Tier>) => setTiers(tiers.map((t, idx) => idx === i ? { ...t, ...patch } : t));
  const removeTier = async (i: number) => {
    const t = tiers[i];
    if (t.id) await supabase.from("event_ticket_tiers").delete().eq("id", t.id);
    setTiers(tiers.filter((_, idx) => idx !== i));
  };
  const saveTiers = async () => {
    for (let i = 0; i < tiers.length; i++) {
      const t = { ...tiers[i], sort_order: i, event_id: eventId };
      if (t.id) {
        const { id, ...rest } = t;
        await supabase.from("event_ticket_tiers").update(rest).eq("id", id);
      } else {
        await supabase.from("event_ticket_tiers").insert(t);
      }
    }
    toast({ title: "Tiers saved" });
    load();
  };

  // Lineup
  const addArtist = () => setLineup([...lineup, { name: "Artist", role: "", bio: "", photo_url: "", sort_order: lineup.length }]);
  const updateArtist = (i: number, patch: Partial<LineupItem>) => setLineup(lineup.map((a, idx) => idx === i ? { ...a, ...patch } : a));
  const removeArtist = async (i: number) => {
    const a = lineup[i];
    if (a.id) await supabase.from("event_lineup").delete().eq("id", a.id);
    setLineup(lineup.filter((_, idx) => idx !== i));
  };
  const moveArtist = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= lineup.length) return;
    const next = [...lineup];
    [next[i], next[j]] = [next[j], next[i]];
    setLineup(next);
  };
  const saveLineup = async () => {
    for (let i = 0; i < lineup.length; i++) {
      const a = { ...lineup[i], sort_order: i, event_id: eventId };
      if (a.id) {
        const { id, ...rest } = a;
        await supabase.from("event_lineup").update(rest).eq("id", id);
      } else {
        await supabase.from("event_lineup").insert(a);
      }
    }
    toast({ title: "Lineup saved" });
    load();
  };
  const uploadArtistPhoto = async (i: number, file: File) => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `lineup/${eventId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("event-covers").upload(path, file, { contentType: file.type });
    if (error) return toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    const { data: pub } = supabase.storage.from("event-covers").getPublicUrl(path);
    updateArtist(i, { photo_url: pub.publicUrl });
  };

  // Gallery
  const uploadGallery = async (files: FileList) => {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${eventId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("event-gallery").upload(path, file, { contentType: file.type });
        if (error) throw error;
        const { data: pub } = supabase.storage.from("event-gallery").getPublicUrl(path);
        await supabase.from("event_gallery").insert({ event_id: eventId, image_url: pub.publicUrl, sort_order: gallery.length });
      }
      toast({ title: "Photos uploaded" });
      load();
    } catch (e) {
      toast({ title: "Upload failed", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };
  const removeGallery = async (id: string) => {
    await supabase.from("event_gallery").delete().eq("id", id);
    setGallery(gallery.filter((g) => g.id !== id));
  };

  return (
    <div className="space-y-6 text-sm">
      {/* SLUG */}
      <section className="space-y-2 border border-border/40 rounded-lg p-4">
        <h3 className="font-display text-sm uppercase tracking-wider">Public URL slug</h3>
        <div className="flex gap-2">
          <span className="text-xs text-muted-foreground font-mono self-center">/events/</span>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="my-event-slug" className="flex-1 bg-background border border-border/60 rounded px-2 py-1 font-mono text-xs" />
          <button onClick={saveSlug} className="btn-chrome px-3 py-1 text-xs uppercase tracking-wider">Save</button>
        </div>
      </section>

      {/* TIERS */}
      <section className="space-y-3 border border-border/40 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <h3 className="font-display text-sm uppercase tracking-wider">Ticket tiers (optional)</h3>
          <div className="flex gap-2">
            <button onClick={addTier} className="text-xs inline-flex items-center gap-1 text-foreground/80 hover:text-foreground"><Plus className="w-3 h-3" /> Add</button>
            <button onClick={saveTiers} className="btn-chrome px-3 py-1 text-xs uppercase tracking-wider">Save tiers</button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">If empty, the event uses its single price + capacity.</p>
        {tiers.map((t, i) => (
          <div key={t.id ?? `new-${i}`} className="grid grid-cols-12 gap-2 items-center border border-border/30 rounded p-2">
            <input value={t.name} onChange={(e) => updateTier(i, { name: e.target.value })} placeholder="Name" className="col-span-3 bg-background border border-border/60 rounded px-2 py-1 text-xs" />
            <input type="number" value={t.price_cents} onChange={(e) => updateTier(i, { price_cents: parseInt(e.target.value) || 0 })} placeholder="Cents" className="col-span-2 bg-background border border-border/60 rounded px-2 py-1 text-xs" />
            <input type="number" value={t.capacity} onChange={(e) => updateTier(i, { capacity: parseInt(e.target.value) || 0 })} placeholder="Capacity" className="col-span-2 bg-background border border-border/60 rounded px-2 py-1 text-xs" />
            <input value={t.description ?? ""} onChange={(e) => updateTier(i, { description: e.target.value })} placeholder="Description" className="col-span-3 bg-background border border-border/60 rounded px-2 py-1 text-xs" />
            <label className="col-span-1 text-[10px] inline-flex items-center gap-1"><input type="checkbox" checked={t.is_free} onChange={(e) => updateTier(i, { is_free: e.target.checked })} /> Free</label>
            <div className="col-span-1 flex items-center gap-1">
              <label className="text-[10px] inline-flex items-center gap-1"><input type="checkbox" checked={t.sold_out} onChange={(e) => updateTier(i, { sold_out: e.target.checked })} /> Out</label>
              <button onClick={() => removeTier(i)} className="text-destructive"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        ))}
      </section>

      {/* LINEUP */}
      <section className="space-y-3 border border-border/40 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <h3 className="font-display text-sm uppercase tracking-wider">Lineup</h3>
          <div className="flex gap-2">
            <button onClick={addArtist} className="text-xs inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Add artist</button>
            <button onClick={saveLineup} className="btn-chrome px-3 py-1 text-xs uppercase tracking-wider">Save lineup</button>
          </div>
        </div>
        {lineup.map((a, i) => (
          <div key={a.id ?? `new-${i}`} className="grid grid-cols-12 gap-2 items-start border border-border/30 rounded p-2">
            <div className="col-span-2">
              {a.photo_url ? (
                <img src={a.photo_url} alt={a.name} className="w-full aspect-square object-cover rounded" />
              ) : (
                <div className="w-full aspect-square bg-card rounded grid place-items-center text-xs text-muted-foreground">No photo</div>
              )}
              <label className="mt-1 block text-[10px] text-center text-muted-foreground cursor-pointer hover:text-foreground">
                <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadArtistPhoto(i, e.target.files[0])} />
                <Upload className="w-3 h-3 inline" /> Upload
              </label>
            </div>
            <div className="col-span-9 space-y-1">
              <input value={a.name} onChange={(e) => updateArtist(i, { name: e.target.value })} placeholder="Name" className="w-full bg-background border border-border/60 rounded px-2 py-1 text-xs" />
              <input value={a.role ?? ""} onChange={(e) => updateArtist(i, { role: e.target.value })} placeholder="Role (DJ, Host, ...)" className="w-full bg-background border border-border/60 rounded px-2 py-1 text-xs" />
              <textarea value={a.bio ?? ""} onChange={(e) => updateArtist(i, { bio: e.target.value })} placeholder="Bio" rows={2} className="w-full bg-background border border-border/60 rounded px-2 py-1 text-xs" />
            </div>
            <div className="col-span-1 flex flex-col gap-1 items-center">
              <button onClick={() => moveArtist(i, -1)} className="text-foreground/60 hover:text-foreground"><ArrowUp className="w-3 h-3" /></button>
              <button onClick={() => moveArtist(i, 1)} className="text-foreground/60 hover:text-foreground"><ArrowDown className="w-3 h-3" /></button>
              <button onClick={() => removeArtist(i)} className="text-destructive"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        ))}
      </section>

      {/* GALLERY */}
      <section className="space-y-3 border border-border/40 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <h3 className="font-display text-sm uppercase tracking-wider">Gallery</h3>
          <label className="btn-chrome px-3 py-1 text-xs uppercase tracking-wider cursor-pointer inline-flex items-center gap-1">
            <Upload className="w-3 h-3" /> {uploading ? "Uploading..." : "Add photos"}
            <input type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && uploadGallery(e.target.files)} />
          </label>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {gallery.map((g) => (
            <div key={g.id} className="relative group">
              <img src={g.image_url} alt="" className="w-full aspect-square object-cover rounded" />
              <button onClick={() => removeGallery(g.id)} className="absolute top-1 right-1 bg-background/80 rounded p-1 opacity-0 group-hover:opacity-100 transition">
                <Trash2 className="w-3 h-3 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AdminEventExtras;