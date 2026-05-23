import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  Plus,
  Trash2,
  Pencil,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  X,
  Save,
  Search,
  Upload,
  ImageIcon,
  Loader2,
  Crop,
} from "lucide-react";
import { sanitizeText, sanitizeUrl } from "@/lib/sanitize";
import { logAdminAction } from "@/lib/auditLog";

// Heavy crop modal (react-image-crop) — only load when user opens it
const ImageCropModal = lazy(() => import("./ImageCropModal"));

interface TalentRow {
  id: string;
  alias: string;
  name: string | null;
  genre: string;
  bio: string;
  image_url: string;
  instagram_url: string | null;
  soundcloud_url: string | null;
  spotify_url: string | null;
  location: string | null;
  preview_track_url: string | null;
  sort_order: number;
  visible: boolean;
  created_at: string;
}

const emptyForm = {
  alias: "",
  name: "",
  genre: "",
  bio: "",
  image_url: "",
  instagram_url: "",
  soundcloud_url: "",
  spotify_url: "",
  location: "",
  preview_track_url: "",
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const getPublicUrl = (path: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/talent-images/${path}`;

const AdminTalentManager = () => {
  const [talent, setTalent] = useState<TalentRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageDragOver, setImageDragOver] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadTalent();
  }, []);

  const loadTalent = async () => {
    const { data } = await supabase
      .from("talent")
      .select("*")
      .order("sort_order", { ascending: true });
    if (data) setTalent(data);
  };

  const handleImageSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 5MB.", variant: "destructive" });
      return;
    }
    // Open crop modal instead of setting directly
    const objectUrl = URL.createObjectURL(file);
    setCropSource(objectUrl);
    setShowCropModal(true);
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    const croppedFile = new File([croppedBlob], `cropped-${Date.now()}.jpg`, { type: "image/jpeg" });
    setImageFile(croppedFile);
    setImagePreview(URL.createObjectURL(croppedBlob));
    setShowCropModal(false);
    setCropSource(null);
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return form.image_url || null;
    setImageUploading(true);
    const ext = imageFile.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("talent-images").upload(path, imageFile, { upsert: false });
    setImageUploading(false);
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      return null;
    }
    return getPublicUrl(path);
  };

  const resetImageState = () => {
    setImageFile(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleAdd = async () => {
    if (!form.alias || !form.genre || !form.bio) {
      toast({ title: "Missing fields", description: "Alias, genre, and bio are required.", variant: "destructive" });
      return;
    }
    if (!imageFile && !form.image_url) {
      toast({ title: "Missing image", description: "Upload a photo or enter an image URL.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const imageUrl = await uploadImage();
    if (!imageUrl) { setSaving(false); return; }
    const maxOrder = talent.length > 0 ? Math.max(...talent.map((t) => t.sort_order)) : 0;
    const { error } = await supabase.from("talent").insert({
      alias: sanitizeText(form.alias),
      name: sanitizeText(form.name) || null,
      genre: sanitizeText(form.genre),
      bio: sanitizeText(form.bio),
      image_url: imageUrl,
      instagram_url: sanitizeUrl(form.instagram_url) || null,
      soundcloud_url: sanitizeUrl(form.soundcloud_url) || null,
      spotify_url: sanitizeUrl(form.spotify_url) || null,
      location: sanitizeText(form.location) || null,
      preview_track_url: sanitizeUrl(form.preview_track_url) || null,
      sort_order: maxOrder + 1,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Artist added!" });
      logAdminAction("create", "talent", undefined, { alias: sanitizeText(form.alias) });
      setForm(emptyForm);
      resetImageState();
      setShowAdd(false);
      loadTalent();
    }
  };

  const handleUpdate = async (id: string) => {
    if (!form.alias || !form.genre || !form.bio) {
      toast({ title: "Missing fields", description: "Alias, genre, and bio are required.", variant: "destructive" });
      return;
    }
    if (!imageFile && !form.image_url) {
      toast({ title: "Missing image", description: "Upload a photo or keep the existing one.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const imageUrl = imageFile ? await uploadImage() : form.image_url;
    if (!imageUrl) { setSaving(false); return; }
    const { error } = await supabase
      .from("talent")
      .update({
        alias: sanitizeText(form.alias),
        name: sanitizeText(form.name) || null,
        genre: sanitizeText(form.genre),
        bio: sanitizeText(form.bio),
        image_url: imageUrl,
        instagram_url: sanitizeUrl(form.instagram_url) || null,
        soundcloud_url: sanitizeUrl(form.soundcloud_url) || null,
        spotify_url: sanitizeUrl(form.spotify_url) || null,
        location: sanitizeText(form.location) || null,
        preview_track_url: sanitizeUrl(form.preview_track_url) || null,
      })
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Artist updated!" });
      logAdminAction("update", "talent", id, { alias: sanitizeText(form.alias) });
      setEditing(null);
      resetImageState();
      loadTalent();
    }
  };

  const toggleVisibility = async (t: TalentRow) => {
    await supabase.from("talent").update({ visible: !t.visible }).eq("id", t.id);
    logAdminAction("toggle_visibility", "talent", t.id, { alias: t.alias, visible: !t.visible });
    loadTalent();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("talent").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Artist removed" });
      logAdminAction("delete", "talent", id);
      loadTalent();
    }
  };

  const moveOrder = async (id: string, direction: "up" | "down") => {
    const idx = talent.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= talent.length) return;
    const a = talent[idx];
    const b = talent[swapIdx];
    await Promise.all([
      supabase.from("talent").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("talent").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    loadTalent();
  };

  const startEdit = (t: TalentRow) => {
    setEditing(t.id);
    setShowAdd(false);
    resetImageState();
    setForm({
      alias: t.alias,
      name: t.name || "",
      genre: t.genre,
      bio: t.bio,
      image_url: t.image_url,
      instagram_url: t.instagram_url || "",
      soundcloud_url: t.soundcloud_url || "",
      spotify_url: t.spotify_url || "",
      location: t.location || "",
      preview_track_url: t.preview_track_url || "",
    });
  };

  const filtered = talent.filter(
    (t) =>
      !searchQuery ||
      t.alias.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.genre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const imageUploader = (
    <div>
      <label className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">Photo *</label>
      <div
        onDragOver={(e) => { e.preventDefault(); setImageDragOver(true); }}
        onDragLeave={() => setImageDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setImageDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleImageSelect(file);
        }}
        onClick={() => imageInputRef.current?.click()}
        className={`mt-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
          imageDragOver
            ? "border-primary/60 bg-primary/5"
            : "border-border/40 hover:border-border/70"
        }`}
      >
        {imagePreview || form.image_url ? (
          <div className="flex items-center gap-3">
            <img
              src={imagePreview || form.image_url}
              alt="Preview"
              className="w-16 h-16 rounded-md object-cover"
            />
            <div className="text-left flex-1 min-w-0">
              <p className="text-xs text-foreground truncate">
                {imageFile?.name || "Current image"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Click or drag to replace
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const src = imagePreview || form.image_url;
                if (src) {
                  setCropSource(src);
                  setShowCropModal(true);
                }
              }}
              className="p-1.5 rounded-md bg-muted hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Crop image"
            >
              <Crop className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="py-2 space-y-1.5">
            <Upload className="w-5 h-5 mx-auto text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Drop image here or <span className="text-foreground">browse</span>
            </p>
            <p className="text-[10px] text-muted-foreground/60">JPG, PNG, WebP — max 5MB</p>
          </div>
        )}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImageSelect(file);
          }}
        />
      </div>
    </div>
  );

  const formFields = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">Alias *</label>
          <input
            value={form.alias}
            onChange={(e) => setForm({ ...form, alias: e.target.value })}
            className="w-full bg-background border border-border/50 rounded-md px-3 py-2 text-sm text-foreground mt-1"
            placeholder="PHANTOM"
          />
        </div>
        <div>
          <label className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full bg-background border border-border/50 rounded-md px-3 py-2 text-sm text-foreground mt-1"
            placeholder="DJ Phantom"
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">Genre *</label>
        <input
          value={form.genre}
          onChange={(e) => setForm({ ...form, genre: e.target.value })}
          className="w-full bg-background border border-border/50 rounded-md px-3 py-2 text-sm text-foreground mt-1"
          placeholder="House / Tech House"
        />
      </div>
      <div>
        <label className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">Bio *</label>
        <textarea
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          rows={3}
          className="w-full bg-background border border-border/50 rounded-md px-3 py-2 text-sm text-foreground mt-1 resize-none"
          placeholder="Short bio..."
        />
      </div>
      {imageUploader}
      <div>
        <label className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">Location</label>
        <input
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          className="w-full bg-background border border-border/50 rounded-md px-3 py-2 text-sm text-foreground mt-1"
          placeholder="Toronto, ON"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">Instagram URL</label>
          <input
            value={form.instagram_url}
            onChange={(e) => setForm({ ...form, instagram_url: e.target.value })}
            className="w-full bg-background border border-border/50 rounded-md px-3 py-2 text-sm text-foreground mt-1"
            placeholder="https://instagram.com/..."
          />
        </div>
        <div>
          <label className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">SoundCloud URL</label>
          <input
            value={form.soundcloud_url}
            onChange={(e) => setForm({ ...form, soundcloud_url: e.target.value })}
            className="w-full bg-background border border-border/50 rounded-md px-3 py-2 text-sm text-foreground mt-1"
            placeholder="https://soundcloud.com/..."
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">Spotify URL</label>
        <input
          value={form.spotify_url}
          onChange={(e) => setForm({ ...form, spotify_url: e.target.value })}
          className="w-full bg-background border border-border/50 rounded-md px-3 py-2 text-sm text-foreground mt-1"
          placeholder="https://open.spotify.com/artist/..."
        />
      </div>
      <div>
        <label className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">Preview Track URL (SoundCloud)</label>
        <input
          value={form.preview_track_url}
          onChange={(e) => setForm({ ...form, preview_track_url: e.target.value })}
          className="w-full bg-background border border-border/50 rounded-md px-3 py-2 text-sm text-foreground mt-1"
          placeholder="https://soundcloud.com/artist/track-name"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Search + Add */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search talent..."
            className="w-full bg-card border border-border/30 rounded-md pl-9 pr-3 py-2 text-sm text-foreground"
          />
        </div>
        <button
          onClick={() => {
            setShowAdd(!showAdd);
            setEditing(null);
            setForm(emptyForm);
            resetImageState();
          }}
          className="chrome-btn font-display font-semibold text-[10px] uppercase tracking-[0.15em] px-4 py-2 rounded-md flex items-center gap-1.5"
        >
          {showAdd ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showAdd ? "Cancel" : "Add Artist"}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="chrome-surface rounded-lg p-4 space-y-3"
        >
          <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">New Artist</h3>
          {formFields}
          <button
            onClick={handleAdd}
            disabled={saving || imageUploading}
            className="chrome-btn font-display font-semibold text-[10px] uppercase tracking-[0.15em] px-4 py-2.5 rounded-md flex items-center gap-1.5"
          >
            {saving || imageUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving..." : imageUploading ? "Uploading..." : "Add Artist"}
          </button>
        </motion.div>
      )}

      {/* List */}
      <div className="space-y-2">
        {filtered.map((t, idx) => (
          <div key={t.id} className="chrome-surface rounded-lg overflow-hidden">
            <div className="flex items-center gap-3 p-3">
              <img src={t.image_url} alt={t.alias} className="w-10 h-10 rounded-md object-cover" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-bold text-foreground">{t.alias}</span>
                  {!t.visible && (
                    <span className="text-[9px] font-display uppercase tracking-wider px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">Hidden</span>
                  )}
                </div>
                <span className="text-muted-foreground text-xs">{t.genre}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => moveOrder(t.id, "up")} disabled={idx === 0} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button onClick={() => moveOrder(t.id, "down")} disabled={idx === filtered.length - 1} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button onClick={() => toggleVisibility(t)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                  {t.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button onClick={() => (editing === t.id ? setEditing(null) : startEdit(t))} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                  {editing === t.id ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                </button>
                <button onClick={() => handleDelete(t.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {editing === t.id && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="px-3 pb-3 space-y-3 border-t border-border/20 pt-3"
              >
                {formFields}
                <button
                  onClick={() => handleUpdate(t.id)}
                  disabled={saving || imageUploading}
                  className="chrome-btn font-display font-semibold text-[10px] uppercase tracking-[0.15em] px-4 py-2.5 rounded-md flex items-center gap-1.5"
                >
                  {saving || imageUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saving ? "Saving..." : imageUploading ? "Uploading..." : "Save Changes"}
                </button>
              </motion.div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">No artists found.</p>
        )}
      </div>

      {/* Crop Modal */}
      {cropSource && (
        <Suspense fallback={null}>
          <ImageCropModal
            open={showCropModal}
            imageSrc={cropSource}
            onClose={() => { setShowCropModal(false); setCropSource(null); }}
            onCropComplete={handleCropComplete}
          />
        </Suspense>
      )}
    </div>
  );
};

export default AdminTalentManager;
