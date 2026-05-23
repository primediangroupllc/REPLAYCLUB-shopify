import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

/**
 * Site-wide settings panel — Meta Pixel ID + Conversions API token.
 * Admin-only RLS already enforces who can read/write site_settings.
 */
const AdminSiteSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pixelId, setPixelId] = useState("");
  const [capiToken, setCapiToken] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("meta_pixel_id, meta_capi_token")
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        setPixelId(data.meta_pixel_id ?? "");
        setCapiToken(data.meta_capi_token ?? "");
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("site_settings")
      .update({
        meta_pixel_id: pixelId.trim() || null,
        meta_capi_token: capiToken.trim() || null,
      })
      .eq("id", 1);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Settings saved");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="font-display text-lg font-bold text-foreground mb-1">Meta Pixel</h2>
        <p className="text-xs font-body text-muted-foreground">
          Browser pixel + server-side Conversions API for Purchase events.
          Token is stored encrypted and only read by edge functions.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-display uppercase tracking-wider text-muted-foreground">
          Meta Pixel ID
        </label>
        <input
          type="text"
          value={pixelId}
          onChange={(e) => setPixelId(e.target.value)}
          placeholder="e.g. 123456789012345"
          className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm font-body text-foreground"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-display uppercase tracking-wider text-muted-foreground">
          Conversions API Access Token
        </label>
        <input
          type="password"
          value={capiToken}
          onChange={(e) => setCapiToken(e.target.value)}
          placeholder="EAA…"
          className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm font-body text-foreground"
        />
        <p className="text-[10px] font-body text-muted-foreground">
          Generate in Meta Events Manager → your dataset → Settings → Conversions API → Generate access token.
        </p>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="chrome-btn font-display font-semibold text-xs uppercase tracking-[0.1em] px-5 py-2.5 rounded-md flex items-center gap-2 disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        Save Settings
      </button>
    </div>
  );
};

export default AdminSiteSettings;
