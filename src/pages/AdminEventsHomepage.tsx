import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
// Cast to any: new tables not yet in generated types.ts
const sb = supabase as unknown as {
  from: (table: string) => any;
  storage: typeof supabase.storage;
  auth: typeof supabase.auth;
  rpc: typeof supabase.rpc;
};
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Undo2, Upload, Trash2, Plus, GripVertical, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface Settings {
  id: number;
  hero_media_type: string;
  hero_media_url: string | null;
  hero_headline: string;
  hero_subheadline: string;
  hero_cta_text: string | null;
  hero_cta_link: string | null;
  hero_overlay_opacity: number;
  upcoming_heading: string;
  upcoming_subheading: string | null;
  upcoming_layout: string;
  upcoming_limit: number | null;
  past_heading: string;
  past_show: boolean;
  notify_show: boolean;
  notify_heading: string;
  notify_description: string;
  notify_button_text: string;
  notify_success_message: string;
  about_show: boolean;
  about_heading: string;
  about_body: string | null;
  about_address: string | null;
  about_hours: string | null;
  about_contact_email: string | null;
  about_contact_phone: string | null;
  faq_show: boolean;
  faq_heading: string;
  seo_title: string;
  seo_description: string | null;
  seo_og_image_url: string | null;
  seo_og_title: string | null;
  seo_og_description: string | null;
  updated_at: string;
  updated_by: string | null;
}

interface GalleryItem {
  id: string;
  image_url: string;
  caption: string | null;
  sort_order: number;
}

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

const isValidUrl = (v: string) => {
  if (!v) return true;
  if (v.startsWith("/")) return true;
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
};

const AdminEventsHomepage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [original, setOriginal] = useState<Settings | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [showPreview, setShowPreview] = useState(true);
  const heroFileRef = useRef<HTMLInputElement>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);
  const ogFileRef = useRef<HTMLInputElement>(null);

  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(original),
    [settings, original],
  );

  useEffect(() => {
    const guard = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth?redirect=/admin/events/homepage");
        return;
      }
      const { data: roleOk } = await supabase.rpc("has_role", {
        _user_id: session.user.id,
        _role: "admin" as const,
      });
      if (!roleOk) {
        navigate("/");
        return;
      }
      setIsAdmin(true);
      setAdminEmail(session.user.email ?? null);
      await Promise.all([loadSettings(), loadGallery(), loadFaqs()]);
      setLoading(false);
    };
    guard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn on unsaved navigation
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const loadSettings = async () => {
    const { data } = await sb
      .from("events_homepage_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (data) {
      setSettings(data as unknown as Settings);
      setOriginal(data as unknown as Settings);
    }
  };

  const loadGallery = async () => {
    const { data } = await sb
      .from("events_homepage_gallery")
      .select("*")
      .order("sort_order", { ascending: true });
    setGallery((data as unknown as GalleryItem[]) || []);
  };

  const loadFaqs = async () => {
    const { data } = await sb
      .from("events_homepage_faqs")
      .select("*")
      .order("sort_order", { ascending: true });
    setFaqs((data as unknown as FaqItem[]) || []);
  };

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
  };

  const uploadToBucket = async (file: File, prefix: string) => {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage
      .from("events-homepage")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    const { data: pub } = supabase.storage.from("events-homepage").getPublicUrl(path);
    return pub.publicUrl;
  };

  const handleHeroUpload = async (file: File) => {
    const isVideo = settings?.hero_media_type === "video";
    const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (file.size > limit) {
      toast({
        title: "File too large",
        description: `Max ${isVideo ? "100MB" : "10MB"}.`,
        variant: "destructive",
      });
      return;
    }
    try {
      const url = await uploadToBucket(file, "hero");
      update("hero_media_url", url);
      toast({ title: "Uploaded" });
    } catch (e) {
      toast({ title: "Upload failed", description: String(e), variant: "destructive" });
    }
  };

  const handleGalleryUpload = async (files: FileList) => {
    const uploads: { url: string; sort: number }[] = [];
    let i = gallery.length;
    for (const file of Array.from(files)) {
      if (file.size > MAX_IMAGE_BYTES) {
        toast({ title: `${file.name} too large`, description: "Max 10MB", variant: "destructive" });
        continue;
      }
      try {
        const url = await uploadToBucket(file, "gallery");
        uploads.push({ url, sort: i++ });
      } catch (e) {
        toast({ title: "Upload failed", description: String(e), variant: "destructive" });
      }
    }
    if (uploads.length === 0) return;
    const { data, error } = await sb
      .from("events_homepage_gallery")
      .insert(uploads.map((u) => ({ image_url: u.url, sort_order: u.sort })))
      .select();
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    setGallery([...gallery, ...((data as unknown as GalleryItem[]) || [])]);
    toast({ title: `Added ${uploads.length} image(s)` });
  };

  const handleOgUpload = async (file: File) => {
    if (file.size > MAX_IMAGE_BYTES) {
      toast({ title: "Too large", description: "Max 10MB", variant: "destructive" });
      return;
    }
    try {
      const url = await uploadToBucket(file, "og");
      update("seo_og_image_url", url);
      toast({ title: "Uploaded" });
    } catch (e) {
      toast({ title: "Upload failed", description: String(e), variant: "destructive" });
    }
  };

  const updateGalleryItem = async (id: string, patch: Partial<GalleryItem>) => {
    setGallery((g) => g.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    await sb.from("events_homepage_gallery").update(patch).eq("id", id);
  };

  const deleteGalleryItem = async (id: string) => {
    if (!confirm("Delete this image?")) return;
    await sb.from("events_homepage_gallery").delete().eq("id", id);
    setGallery((g) => g.filter((it) => it.id !== id));
  };

  const moveGallery = async (idx: number, dir: -1 | 1) => {
    const next = [...gallery];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    next.forEach((it, i) => (it.sort_order = i));
    setGallery(next);
    await Promise.all(
      next.map((it) =>
        sb
          .from("events_homepage_gallery")
          .update({ sort_order: it.sort_order })
          .eq("id", it.id),
      ),
    );
  };

  const addFaq = async () => {
    const { data, error } = await sb
      .from("events_homepage_faqs")
      .insert({ question: "New question", answer: "Answer goes here.", sort_order: faqs.length })
      .select()
      .single();
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    setFaqs([...faqs, data as unknown as FaqItem]);
  };

  const updateFaq = (id: string, patch: Partial<FaqItem>) => {
    setFaqs((f) => f.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const persistFaq = async (id: string) => {
    const it = faqs.find((f) => f.id === id);
    if (!it) return;
    await sb
      .from("events_homepage_faqs")
      .update({ question: it.question, answer: it.answer, updated_at: new Date().toISOString() })
      .eq("id", id);
  };

  const deleteFaq = async (id: string) => {
    if (!confirm("Delete this FAQ?")) return;
    await sb.from("events_homepage_faqs").delete().eq("id", id);
    setFaqs((f) => f.filter((it) => it.id !== id));
  };

  const moveFaq = async (idx: number, dir: -1 | 1) => {
    const next = [...faqs];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    next.forEach((it, i) => (it.sort_order = i));
    setFaqs(next);
    await Promise.all(
      next.map((it) =>
        sb
          .from("events_homepage_faqs")
          .update({ sort_order: it.sort_order })
          .eq("id", it.id),
      ),
    );
  };

  const onSave = async () => {
    if (!settings) return;
    if (settings.hero_cta_link && !isValidUrl(settings.hero_cta_link)) {
      toast({ title: "Invalid CTA link", description: "Use a full URL or a path starting with /", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payload = {
        ...settings,
        updated_at: new Date().toISOString(),
        updated_by: session?.user.id ?? null,
      };
      const { error } = await sb
        .from("events_homepage_settings")
        .update(payload)
        .eq("id", 1);
      if (error) throw error;
      setOriginal(payload);
      setSettings(payload);
      toast({ title: "Homepage updated" });
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const onDiscard = () => {
    if (!original) return;
    if (dirty && !confirm("Discard unsaved changes?")) return;
    setSettings(original);
  };

  const onBack = () => {
    if (dirty && !confirm("You have unsaved changes. Leave anyway?")) return;
    navigate("/admin/dashboard");
  };

  if (isAdmin === null || loading || !settings) {
    return <div className="min-h-screen bg-background grid place-items-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <Helmet>
        <title>Edit Events Homepage · Admin</title>
      </Helmet>

      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border/30">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Left spacer must clear the floating SiteMenu cluster (top-3 left-3 z-51, ~96px wide). */}
          <div className="w-24 sm:w-28" />
          <h1 className="font-display text-sm md:text-base font-semibold uppercase tracking-wider text-center flex-1">
            Edit Events Homepage
          </h1>
          <button
            onClick={() => setShowPreview((v) => !v)}
            className="hidden md:inline-flex items-center gap-1.5 text-xs font-display uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            Preview
          </button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 grid gap-6 lg:grid-cols-[1fr_minmax(0,460px)]">
        {/* Editor */}
        <div className="space-y-3 min-w-0">
          <p className="text-xs text-muted-foreground font-body">
            Last edited {new Date(settings.updated_at).toLocaleString()} {adminEmail ? `· you are signed in as ${adminEmail}` : ""}
          </p>

          <Accordion type="multiple" defaultValue={["hero"]} className="space-y-2">
            {/* HERO */}
            <AccordionItem value="hero" className="card-premium px-4 border-0">
              <AccordionTrigger className="font-display uppercase tracking-wider text-sm">Hero</AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <div className="flex items-center gap-3">
                  <Label className="text-xs">Media type</Label>
                  <select
                    value={settings.hero_media_type}
                    onChange={(e) => update("hero_media_type", e.target.value)}
                    className="bg-background border border-border/50 rounded px-2 py-1 text-sm"
                  >
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs">Hero media</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      ref={heroFileRef}
                      type="file"
                      accept={settings.hero_media_type === "video" ? "video/*" : "image/*"}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleHeroUpload(f);
                      }}
                    />
                    <Button variant="outline" size="sm" onClick={() => heroFileRef.current?.click()}>
                      <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload
                    </Button>
                    {settings.hero_media_url && (
                      <Button variant="ghost" size="sm" onClick={() => update("hero_media_url", null)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  {settings.hero_media_url && settings.hero_media_type === "image" && (
                    <img src={settings.hero_media_url} alt="Hero" className="mt-2 max-h-40 rounded border border-border/40" />
                  )}
                  {settings.hero_media_url && settings.hero_media_type === "video" && (
                    <video src={settings.hero_media_url} controls className="mt-2 max-h-40 rounded border border-border/40" />
                  )}
                </div>

                <div>
                  <Label className="text-xs">Headline</Label>
                  <Input value={settings.hero_headline} onChange={(e) => update("hero_headline", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Subheadline</Label>
                  <Input value={settings.hero_subheadline} onChange={(e) => update("hero_subheadline", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">CTA button text</Label>
                    <Input
                      value={settings.hero_cta_text || ""}
                      onChange={(e) => update("hero_cta_text", e.target.value || null)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">CTA link</Label>
                    <Input
                      placeholder="/events/my-event or https://…"
                      value={settings.hero_cta_link || ""}
                      onChange={(e) => update("hero_cta_link", e.target.value || null)}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Overlay opacity: {settings.hero_overlay_opacity}%</Label>
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={[settings.hero_overlay_opacity]}
                    onValueChange={(v) => update("hero_overlay_opacity", v[0])}
                    className="mt-2"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* UPCOMING */}
            <AccordionItem value="upcoming" className="card-premium px-4 border-0">
              <AccordionTrigger className="font-display uppercase tracking-wider text-sm">Upcoming Events</AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <div>
                  <Label className="text-xs">Section heading</Label>
                  <Input value={settings.upcoming_heading} onChange={(e) => update("upcoming_heading", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Subheading</Label>
                  <Input
                    value={settings.upcoming_subheading || ""}
                    onChange={(e) => update("upcoming_subheading", e.target.value || null)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Layout</Label>
                    <select
                      value={settings.upcoming_layout}
                      onChange={(e) => update("upcoming_layout", e.target.value)}
                      className="w-full bg-background border border-border/50 rounded px-2 py-1.5 text-sm"
                    >
                      <option value="list">List</option>
                      <option value="grid">Grid</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Limit (blank = all)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={settings.upcoming_limit ?? ""}
                      onChange={(e) =>
                        update("upcoming_limit", e.target.value ? parseInt(e.target.value, 10) : null)
                      }
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* PAST / GALLERY */}
            <AccordionItem value="past" className="card-premium px-4 border-0">
              <AccordionTrigger className="font-display uppercase tracking-wider text-sm">Past Events / Gallery</AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <div className="flex items-center gap-3">
                  <Switch checked={settings.past_show} onCheckedChange={(v) => update("past_show", v)} />
                  <Label className="text-xs">Show this section</Label>
                </div>
                <div>
                  <Label className="text-xs">Heading</Label>
                  <Input value={settings.past_heading} onChange={(e) => update("past_heading", e.target.value)} />
                </div>
                <div>
                  <input
                    ref={galleryFileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && handleGalleryUpload(e.target.files)}
                  />
                  <Button variant="outline" size="sm" onClick={() => galleryFileRef.current?.click()}>
                    <Upload className="w-3.5 h-3.5 mr-1.5" /> Add images
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {gallery.map((g, idx) => (
                    <div key={g.id} className="rounded border border-border/40 overflow-hidden bg-card/40">
                      <img src={g.image_url} alt={g.caption || ""} className="w-full h-24 object-cover" />
                      <div className="p-2 space-y-1">
                        <Input
                          placeholder="Caption"
                          value={g.caption || ""}
                          onChange={(e) => updateGalleryItem(g.id, { caption: e.target.value })}
                          className="h-7 text-xs"
                        />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <button onClick={() => moveGallery(idx, -1)} className="text-xs text-muted-foreground hover:text-foreground" aria-label="Move up">↑</button>
                            <button onClick={() => moveGallery(idx, 1)} className="text-xs text-muted-foreground hover:text-foreground" aria-label="Move down">↓</button>
                          </div>
                          <button
                            onClick={() => deleteGalleryItem(g.id)}
                            className="text-xs text-destructive hover:opacity-80"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* NEWSLETTER */}
            <AccordionItem value="notify" className="card-premium px-4 border-0">
              <AccordionTrigger className="font-display uppercase tracking-wider text-sm">Newsletter / Notify Me</AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <div className="flex items-center gap-3">
                  <Switch checked={settings.notify_show} onCheckedChange={(v) => update("notify_show", v)} />
                  <Label className="text-xs">Show this section</Label>
                </div>
                <div>
                  <Label className="text-xs">Heading</Label>
                  <Input value={settings.notify_heading} onChange={(e) => update("notify_heading", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Description</Label>
                  <Textarea value={settings.notify_description} onChange={(e) => update("notify_description", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Button text</Label>
                  <Input value={settings.notify_button_text} onChange={(e) => update("notify_button_text", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Success message</Label>
                  <Textarea value={settings.notify_success_message} onChange={(e) => update("notify_success_message", e.target.value)} />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ABOUT */}
            <AccordionItem value="about" className="card-premium px-4 border-0">
              <AccordionTrigger className="font-display uppercase tracking-wider text-sm">About / Venue</AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <div className="flex items-center gap-3">
                  <Switch checked={settings.about_show} onCheckedChange={(v) => update("about_show", v)} />
                  <Label className="text-xs">Show this section</Label>
                </div>
                <div>
                  <Label className="text-xs">Heading</Label>
                  <Input value={settings.about_heading} onChange={(e) => update("about_heading", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Body</Label>
                  <Textarea
                    rows={5}
                    value={settings.about_body || ""}
                    onChange={(e) => update("about_body", e.target.value || null)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Address</Label>
                  <Input
                    value={settings.about_address || ""}
                    onChange={(e) => update("about_address", e.target.value || null)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Hours</Label>
                  <Textarea
                    rows={3}
                    value={settings.about_hours || ""}
                    onChange={(e) => update("about_hours", e.target.value || null)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Contact email</Label>
                    <Input
                      type="email"
                      value={settings.about_contact_email || ""}
                      onChange={(e) => update("about_contact_email", e.target.value || null)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Contact phone</Label>
                    <Input
                      value={settings.about_contact_phone || ""}
                      onChange={(e) => update("about_contact_phone", e.target.value || null)}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* FAQ */}
            <AccordionItem value="faq" className="card-premium px-4 border-0">
              <AccordionTrigger className="font-display uppercase tracking-wider text-sm">Homepage FAQ</AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <div className="flex items-center gap-3">
                  <Switch checked={settings.faq_show} onCheckedChange={(v) => update("faq_show", v)} />
                  <Label className="text-xs">Show this section</Label>
                </div>
                <div>
                  <Label className="text-xs">Heading</Label>
                  <Input value={settings.faq_heading} onChange={(e) => update("faq_heading", e.target.value)} />
                </div>
                <div className="space-y-2">
                  {faqs.map((f, idx) => (
                    <div key={f.id} className="rounded border border-border/40 p-3 space-y-2 bg-card/40">
                      <div className="flex items-center justify-between gap-2">
                        <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
                        <div className="flex items-center gap-1">
                          <button onClick={() => moveFaq(idx, -1)} className="text-xs text-muted-foreground hover:text-foreground">↑</button>
                          <button onClick={() => moveFaq(idx, 1)} className="text-xs text-muted-foreground hover:text-foreground">↓</button>
                          <button onClick={() => deleteFaq(f.id)} className="text-destructive ml-2">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <Input
                        placeholder="Question"
                        value={f.question}
                        onChange={(e) => updateFaq(f.id, { question: e.target.value })}
                        onBlur={() => persistFaq(f.id)}
                      />
                      <Textarea
                        placeholder="Answer"
                        rows={3}
                        value={f.answer}
                        onChange={(e) => updateFaq(f.id, { answer: e.target.value })}
                        onBlur={() => persistFaq(f.id)}
                      />
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addFaq}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Add FAQ
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* SEO */}
            <AccordionItem value="seo" className="card-premium px-4 border-0">
              <AccordionTrigger className="font-display uppercase tracking-wider text-sm">SEO & Meta</AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <div>
                  <Label className="text-xs">Page title</Label>
                  <Input value={settings.seo_title} onChange={(e) => update("seo_title", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Meta description</Label>
                  <Textarea
                    rows={2}
                    value={settings.seo_description || ""}
                    onChange={(e) => update("seo_description", e.target.value || null)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Social share image</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      ref={ogFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleOgUpload(f);
                      }}
                    />
                    <Button variant="outline" size="sm" onClick={() => ogFileRef.current?.click()}>
                      <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload
                    </Button>
                    {settings.seo_og_image_url && (
                      <Button variant="ghost" size="sm" onClick={() => update("seo_og_image_url", null)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  {settings.seo_og_image_url && (
                    <img src={settings.seo_og_image_url} alt="OG" className="mt-2 max-h-32 rounded border border-border/40" />
                  )}
                </div>
                <div>
                  <Label className="text-xs">Social share title</Label>
                  <Input
                    value={settings.seo_og_title || ""}
                    onChange={(e) => update("seo_og_title", e.target.value || null)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Social share description</Label>
                  <Textarea
                    rows={2}
                    value={settings.seo_og_description || ""}
                    onChange={(e) => update("seo_og_description", e.target.value || null)}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Live preview */}
        {showPreview && (
          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-3">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-body">
                Live preview
              </div>
              <div className="rounded-lg border border-border/40 overflow-hidden bg-card/30">
                <div
                  className="relative h-44 bg-cover bg-center"
                  style={{
                    backgroundImage: settings.hero_media_url && settings.hero_media_type === "image"
                      ? `url(${settings.hero_media_url})`
                      : "linear-gradient(135deg, hsl(var(--muted)), hsl(var(--background)))",
                  }}
                >
                  <div
                    className="absolute inset-0 bg-background"
                    style={{ opacity: settings.hero_overlay_opacity / 100 }}
                  />
                  <div className="relative h-full flex flex-col items-center justify-center px-4 text-center">
                    <h2 className="font-display text-xl font-bold uppercase tracking-wider text-foreground">
                      {settings.hero_headline}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">{settings.hero_subheadline}</p>
                    {settings.hero_cta_text && (
                      <span className="mt-3 chrome-btn text-[10px] uppercase tracking-wider px-3 py-1.5 rounded">
                        {settings.hero_cta_text}
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-3 space-y-3 text-xs">
                  <div>
                    <div className="font-display uppercase tracking-wider">{settings.upcoming_heading}</div>
                    {settings.upcoming_subheading && (
                      <div className="text-muted-foreground">{settings.upcoming_subheading}</div>
                    )}
                  </div>
                  {settings.notify_show && (
                    <div>
                      <div className="font-display uppercase tracking-wider">{settings.notify_heading}</div>
                      <div className="text-muted-foreground">{settings.notify_description}</div>
                    </div>
                  )}
                  {settings.about_show && (
                    <div>
                      <div className="font-display uppercase tracking-wider">{settings.about_heading}</div>
                      <div className="text-muted-foreground line-clamp-3 whitespace-pre-line">{settings.about_body}</div>
                    </div>
                  )}
                  {settings.faq_show && (
                    <div>
                      <div className="font-display uppercase tracking-wider">{settings.faq_heading}</div>
                      <div className="text-muted-foreground">{faqs.length} item(s)</div>
                    </div>
                  )}
                </div>
              </div>
              <a
                href="/events"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                Open live page ↗
              </a>
            </div>
          </aside>
        )}
      </div>

      {/* Save bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border/40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {dirty ? "You have unsaved changes" : "All changes saved"}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onDiscard} disabled={!dirty || saving}>
              <Undo2 className="w-3.5 h-3.5 mr-1.5" /> Discard
            </Button>
            <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
              <Save className="w-3.5 h-3.5 mr-1.5" /> {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminEventsHomepage;