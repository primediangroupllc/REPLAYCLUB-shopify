import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Save, Trash2, ExternalLink, Youtube } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import YouTubeFacade from "@/components/YouTubeFacade";

/**
 * Extract a YouTube ID from any common URL/ID format. Mirrors the parser in
 * the get-latest-youtube-video edge function so admins see the same preview
 * the homepage will get.
 */
const parseYouTubeId = (input: string): string | null => {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const v = url.searchParams.get("v");
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
    const parts = url.pathname.split("/").filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      if (["shorts", "embed", "live", "v"].includes(parts[i]) && parts[i + 1]) {
        const cand = parts[i + 1];
        if (/^[A-Za-z0-9_-]{11}$/.test(cand)) return cand;
      }
    }
    if (url.hostname.endsWith("youtu.be") && parts[0] && /^[A-Za-z0-9_-]{11}$/.test(parts[0])) {
      return parts[0];
    }
  } catch {
    /* ignore */
  }
  return null;
};

/**
 * Reusable inner content of the homepage-edit admin surface, without outer
 * page chrome. Embedded by AdminDashboard's "Site Content" hub and by the
 * standalone /admin/homepage page below.
 *
 * `embedded=true` skips the auth check (dashboard already gates admin) and
 * the surrounding card/header.
 */
export const AdminHomepageEditPanel = ({ embedded = false }: { embedded?: boolean } = {}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authChecked, setAuthChecked] = useState(embedded);
  const [isAdmin, setIsAdmin] = useState(embedded);
  const [url, setUrl] = useState("");
  const [storedUrl, setStoredUrl] = useState<string | null>(null);
  const [autoVideoId, setAutoVideoId] = useState<string | null>(null);

  // Auth + admin role check (skipped when embedded in the dashboard).
  useEffect(() => {
    if (embedded) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/auth?redirect=/admin/homepage");
        return;
      }
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!roleRow);
      setAuthChecked(true);
    })();
  }, [navigate, embedded]);

  // Load current setting + the auto-pulled fallback so the admin can preview both.
  useEffect(() => {
    if (!authChecked || !isAdmin) return;
    (async () => {
      const { data: row } = await supabase
        .from("site_settings")
        .select("latest_video_url")
        .eq("id", 1)
        .maybeSingle();
      const stored = row?.latest_video_url ?? null;
      setStoredUrl(stored);
      setUrl(stored ?? "");

      // Also fetch the auto-pulled latest so admins know what the site shows
      // when the override is empty.
      try {
        const { data } = await supabase.functions.invoke("get-latest-youtube-video");
        if (data?.video_id) setAutoVideoId(data.video_id);
      } catch {
        /* ignore */
      }
      setLoading(false);
    })();
  }, [authChecked, isAdmin]);

  const previewId = parseYouTubeId(url);
  const storedId = parseYouTubeId(storedUrl ?? "");

  const save = async () => {
    const cleanInput = url.trim();
    if (cleanInput && !parseYouTubeId(cleanInput)) {
      toast.error("That doesn't look like a YouTube URL or video ID.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("site_settings")
      .upsert({ id: 1, latest_video_url: cleanInput || null });
    setSaving(false);
    if (error) {
      toast.error(`Save failed: ${error.message}`);
      return;
    }
    setStoredUrl(cleanInput || null);
    toast.success(cleanInput ? "Homepage video updated." : "Override cleared — auto-latest will show.");
  };

  const clearOverride = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("site_settings")
      .upsert({ id: 1, latest_video_url: null });
    setSaving(false);
    if (error) {
      toast.error(`Clear failed: ${error.message}`);
      return;
    }
    setUrl("");
    setStoredUrl(null);
    toast.success("Override cleared. The site will auto-load the latest YouTube video.");
  };

  if (!authChecked && !embedded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin && !embedded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="card-premium p-8 max-w-sm text-center space-y-4">
          <h1 className="font-display text-lg uppercase tracking-wider text-foreground">Admins only</h1>
          <p className="text-sm text-muted-foreground font-body">
            You need an admin role to edit the homepage.
          </p>
          <button
            onClick={() => navigate("/")}
            className="text-xs uppercase tracking-wider font-display text-primary hover:underline"
          >
            ← Back to homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? "space-y-6" : "container mx-auto max-w-2xl px-4 py-10 space-y-8"}>
      {!embedded && (
        <header className="space-y-2">
          <h1 className="font-display text-xl font-bold text-foreground uppercase tracking-wider">
            Edit Homepage
          </h1>
          <p className="text-sm text-muted-foreground font-body">
            Manage what shows in the "Latest Mix" section on the homepage.
          </p>
        </header>
      )}

      <section className="card-premium p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Youtube className="w-4 h-4 text-primary" />
            <h2 className="font-display text-sm uppercase tracking-[0.15em] text-foreground">
              Latest Mix Video
            </h2>
          </div>

          <p className="text-xs text-muted-foreground font-body leading-relaxed">
            Paste any YouTube link (watch URL, youtu.be short link, /shorts, /live,
            or just the 11-character video ID). Leave blank to let the site
            auto-load the latest non-livestream upload from
            <a
              href="https://www.youtube.com/@replayclublive"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 underline text-foreground hover:text-primary inline-flex items-center gap-0.5"
            >
              @replayclublive
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
            .
          </p>

          <div className="space-y-1.5">
            <label
              htmlFor="yt-url"
              className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground"
            >
              YouTube URL or Video ID
            </label>
            <input
              id="yt-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={loading || saving}
              className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2.5 text-sm font-body focus:outline-none focus:border-chrome-dark transition-colors"
            />
            {url && !previewId && (
              <p className="text-[10px] text-destructive font-body">
                Couldn't parse a video ID from that input.
              </p>
            )}
            {url && previewId && previewId !== storedId && (
              <p className="text-[10px] text-muted-foreground font-body">
                Detected video ID: <span className="font-mono text-foreground">{previewId}</span> — preview below.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={save}
              disabled={loading || saving || (url.trim() === (storedUrl ?? ""))}
              className="chrome-btn font-display font-semibold text-xs uppercase tracking-[0.15em] px-5 py-2.5 rounded-md inline-flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </button>
            {storedUrl && (
              <button
                onClick={clearOverride}
                disabled={loading || saving}
                className="chrome-btn-outline font-display font-semibold text-xs uppercase tracking-[0.15em] px-5 py-2.5 rounded-md inline-flex items-center gap-2 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear override
              </button>
            )}
          </div>

          {/* Preview */}
          {previewId && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <p className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Preview ({url.trim() === (storedUrl ?? "") ? "currently live" : "after save"})
              </p>
              <YouTubeFacade videoId={previewId} title="Preview" />
            </div>
          )}

          {/* Auto fallback info */}
          {!storedUrl && autoVideoId && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <p className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Currently auto-showing (no override set)
              </p>
              <p className="text-xs font-body text-muted-foreground">
                Video ID: <span className="font-mono text-foreground">{autoVideoId}</span>
              </p>
              <YouTubeFacade videoId={autoVideoId} title="Auto-detected latest" />
            </div>
          )}
      </section>
    </div>
  );
};

const AdminHomepageEditPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/30">
        <div className="container mx-auto pl-24 sm:pl-28 pr-4 py-3 flex justify-between items-center">
          <button
            onClick={() => navigate("/admin/dashboard")}
            className="text-[10px] uppercase tracking-wider font-display text-muted-foreground hover:text-foreground"
          >
            ← Dashboard
          </button>
          <img src={logo} alt="Replay Club" className="w-24 mix-blend-screen" />
          <div className="w-16" />
        </div>
      </nav>
      <AdminHomepageEditPanel />
    </div>
  );
};

export default AdminHomepageEditPage;