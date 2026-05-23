import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Upload, X, Plus } from "lucide-react";
import { PAUSABLE_SERVICES } from "@/hooks/useSiteSettings";

const EMAIL_TYPES = [
  { key: "default", label: "Default (fallback)" },
  { key: "booking_confirmation", label: "Booking confirmation" },
  { key: "admin_notification", label: "Admin notification" },
  { key: "reminder", label: "Reminders" },
  { key: "followup", label: "Post-session follow-up" },
] as const;

interface EmailSender {
  from_name?: string;
  reply_to?: string;
}

interface SettingsRow {
  id: number;
  business_legal_name: string | null;
  business_dba: string | null;
  business_tax_id: string | null;
  business_timezone: string | null;
  business_locale: string | null;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  favicon_url: string | null;
  email_senders: Record<string, EmailSender>;
  sms_sender_number: string | null;
  admin_notification_recipients: string[];
  twitch_channel: string | null;
  youtube_channel_handle: string | null;
  soundcloud_embed_url: string | null;
  maintenance_mode: boolean;
  maintenance_message: string | null;
  booking_pauses: Record<string, boolean>;
  emergency_contact_phone: string | null;
  meta_pixel_id: string | null;
  meta_capi_token: string | null;
}

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-muted-foreground/70 font-body">{hint}</p>}
  </div>
);

const Section = ({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) => (
  <section className="space-y-4 border-t border-border/30 pt-6 first:border-t-0 first:pt-0">
    <div>
      <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
      {description && <p className="text-xs text-muted-foreground font-body mt-0.5">{description}</p>}
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
  </section>
);

const inputClass =
  "w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm font-body text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

export default function AdminGeneralSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [s, setS] = useState<SettingsRow | null>(null);
  const [newRecipient, setNewRecipient] = useState("");

  const set = <K extends keyof SettingsRow>(key: K, value: SettingsRow[K]) =>
    setS((prev) => (prev ? { ...prev, [key]: value } : prev));

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select(
          "id, business_legal_name, business_dba, business_tax_id, business_timezone, business_locale, logo_light_url, logo_dark_url, favicon_url, email_senders, sms_sender_number, admin_notification_recipients, twitch_channel, youtube_channel_handle, soundcloud_embed_url, maintenance_mode, maintenance_message, booking_pauses, emergency_contact_phone, meta_pixel_id, meta_capi_token"
        )
        .order("id")
        .limit(1)
        .maybeSingle();
      if (error) toast.error(error.message);
      else if (data) {
        setS({
          ...data,
          email_senders: (data.email_senders as Record<string, EmailSender>) || {},
          admin_notification_recipients: data.admin_notification_recipients || [],
          booking_pauses: (data.booking_pauses as Record<string, boolean>) || {},
        } as SettingsRow);
      }
      setLoading(false);
    })();
  }, []);

  const uploadAsset = async (file: File, prefix: string): Promise<string | null> => {
    const path = `branding/${prefix}-${Date.now()}-${file.name.replace(/[^a-z0-9.\-_]/gi, "_")}`;
    const { error } = await supabase.storage.from("studio-assets").upload(path, file, { upsert: false });
    if (error) {
      toast.error(`Upload failed: ${error.message}`);
      return null;
    }
    const { data } = supabase.storage.from("studio-assets").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleLogoUpload = async (key: "logo_light_url" | "logo_dark_url" | "favicon_url", file: File | null) => {
    if (!file) return;
    const url = await uploadAsset(file, key);
    if (url) set(key, url);
  };

  const setEmailSender = (type: string, field: "from_name" | "reply_to", value: string) => {
    if (!s) return;
    const next = { ...s.email_senders, [type]: { ...s.email_senders[type], [field]: value } };
    set("email_senders", next);
  };

  const addRecipient = () => {
    const v = newRecipient.trim().toLowerCase();
    if (!v || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
      toast.error("Enter a valid email");
      return;
    }
    if (!s) return;
    if (s.admin_notification_recipients.includes(v)) return;
    set("admin_notification_recipients", [...s.admin_notification_recipients, v]);
    setNewRecipient("");
  };

  const removeRecipient = (email: string) => {
    if (!s) return;
    set("admin_notification_recipients", s.admin_notification_recipients.filter((r) => r !== email));
  };

  const togglePause = (key: string, value: boolean) => {
    if (!s) return;
    set("booking_pauses", { ...s.booking_pauses, [key]: value });
  };

  const save = async () => {
    if (!s) return;
    setSaving(true);
    const { error } = await supabase
      .from("site_settings")
      .update({
        business_legal_name: s.business_legal_name?.trim() || null,
        business_dba: s.business_dba?.trim() || null,
        business_tax_id: s.business_tax_id?.trim() || null,
        business_timezone: s.business_timezone?.trim() || null,
        business_locale: s.business_locale?.trim() || null,
        logo_light_url: s.logo_light_url || null,
        logo_dark_url: s.logo_dark_url || null,
        favicon_url: s.favicon_url || null,
        email_senders: s.email_senders as any,
        sms_sender_number: s.sms_sender_number?.trim() || null,
        admin_notification_recipients: s.admin_notification_recipients,
        twitch_channel: s.twitch_channel?.trim() || null,
        youtube_channel_handle: s.youtube_channel_handle?.trim() || null,
        soundcloud_embed_url: s.soundcloud_embed_url?.trim() || null,
        maintenance_mode: s.maintenance_mode,
        maintenance_message: s.maintenance_message?.trim() || null,
        booking_pauses: s.booking_pauses as any,
        emergency_contact_phone: s.emergency_contact_phone?.trim() || null,
        meta_pixel_id: s.meta_pixel_id?.trim() || null,
        meta_capi_token: s.meta_capi_token?.trim() || null,
      })
      .eq("id", s.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Settings saved");
  };

  if (loading || !s) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Business Info */}
      <Section title="Business Info" description="Used on receipts, exports, and tax documents.">
        <Field label="Studio legal name">
          <input className={inputClass} value={s.business_legal_name ?? ""} onChange={(e) => set("business_legal_name", e.target.value)} />
        </Field>
        <Field label="DBA (Doing Business As)">
          <input className={inputClass} value={s.business_dba ?? ""} onChange={(e) => set("business_dba", e.target.value)} />
        </Field>
        <Field label="EIN / Tax ID">
          <input className={inputClass} value={s.business_tax_id ?? ""} onChange={(e) => set("business_tax_id", e.target.value)} />
        </Field>
        <Field label="Time zone" hint="IANA name, e.g. America/Los_Angeles">
          <input className={inputClass} value={s.business_timezone ?? ""} onChange={(e) => set("business_timezone", e.target.value)} />
        </Field>
        <Field label="Locale" hint="e.g. en-US">
          <input className={inputClass} value={s.business_locale ?? ""} onChange={(e) => set("business_locale", e.target.value)} />
        </Field>
      </Section>

      {/* Branding */}
      <Section title="Branding" description="Logo + favicon used across the customer site.">
        {(["logo_light_url", "logo_dark_url", "favicon_url"] as const).map((k) => {
          const labelMap = { logo_light_url: "Logo (light variant)", logo_dark_url: "Logo (dark variant)", favicon_url: "Favicon" };
          return (
            <Field key={k} label={labelMap[k]}>
              <div className="flex items-center gap-3">
                {s[k] ? (
                  <img src={s[k] as string} alt="" className="w-12 h-12 rounded bg-card border border-border/30 object-contain p-1" />
                ) : (
                  <div className="w-12 h-12 rounded bg-card border border-border/30 flex items-center justify-center text-[9px] text-muted-foreground">none</div>
                )}
                <label className="flex-1 cursor-pointer flex items-center gap-2 bg-secondary border border-border rounded-md px-3 py-2 text-xs font-body text-foreground">
                  <Upload className="w-3.5 h-3.5" />
                  <span className="truncate">Upload image</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(k, e.target.files?.[0] || null)} />
                </label>
                {s[k] && (
                  <button onClick={() => set(k, null)} className="p-2 rounded-md text-muted-foreground hover:text-destructive" aria-label="Remove">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </Field>
          );
        })}
      </Section>

      {/* Communications */}
      <Section title="Communications" description="From-name, reply-to, SMS sender, and admin notification recipients.">
        <div className="md:col-span-2 space-y-3">
          <p className="text-xs font-display uppercase tracking-wider text-muted-foreground">Email senders by type</p>
          <div className="space-y-2">
            {EMAIL_TYPES.map((t) => (
              <div key={t.key} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center bg-card border border-border/30 rounded-md p-2.5">
                <div className="text-xs font-display font-bold text-foreground">{t.label}</div>
                <input
                  className={inputClass}
                  placeholder='From name (e.g. "Replay Club")'
                  value={s.email_senders[t.key]?.from_name ?? ""}
                  onChange={(e) => setEmailSender(t.key, "from_name", e.target.value)}
                />
                <input
                  className={inputClass}
                  placeholder="reply-to@yourdomain.com"
                  value={s.email_senders[t.key]?.reply_to ?? ""}
                  onChange={(e) => setEmailSender(t.key, "reply_to", e.target.value)}
                />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/70 font-body">
            "Default" is used when a specific email type has no override. Email body content is unchanged.
          </p>
        </div>

        <Field label="SMS sender number (Twilio)" hint="E.164, e.g. +13105551212">
          <input className={inputClass} value={s.sms_sender_number ?? ""} onChange={(e) => set("sms_sender_number", e.target.value)} />
        </Field>

        <Field label="Emergency contact phone" hint="Shown to staff in admin tools.">
          <input className={inputClass} value={s.emergency_contact_phone ?? ""} onChange={(e) => set("emergency_contact_phone", e.target.value)} />
        </Field>

        <div className="md:col-span-2 space-y-2">
          <p className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">Admin notification recipients</p>
          <div className="flex flex-wrap gap-2">
            {s.admin_notification_recipients.map((email) => (
              <span key={email} className="inline-flex items-center gap-1.5 bg-card border border-border/30 rounded-full pl-3 pr-1.5 py-1 text-xs font-body text-foreground">
                {email}
                <button onClick={() => removeRecipient(email)} className="text-muted-foreground hover:text-destructive" aria-label="Remove">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className={inputClass}
              placeholder="add@email.com"
              value={newRecipient}
              onChange={(e) => setNewRecipient(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRecipient(); } }}
            />
            <button onClick={addRecipient} className="chrome-btn font-display font-semibold text-xs uppercase tracking-wider px-3 py-2 rounded-md flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
        </div>
      </Section>

      {/* Integrations */}
      <Section title="Integrations" description="External account handles and embeds.">
        <Field label="Twitch channel" hint="Used by the live banner. Default: REPLAYCLUB_">
          <input className={inputClass} value={s.twitch_channel ?? ""} onChange={(e) => set("twitch_channel", e.target.value)} />
        </Field>
        <Field label="YouTube channel handle" hint="e.g. @ReplayClubRecords">
          <input className={inputClass} value={s.youtube_channel_handle ?? ""} onChange={(e) => set("youtube_channel_handle", e.target.value)} />
        </Field>
        <Field label="SoundCloud ambient embed URL" hint="Full embed iframe src URL.">
          <input className={inputClass} value={s.soundcloud_embed_url ?? ""} onChange={(e) => set("soundcloud_embed_url", e.target.value)} />
        </Field>
      </Section>

      {/* Operations & Safety */}
      <Section title="Operations & Safety" description="Maintenance mode and per-service booking pause.">
        <div className="md:col-span-2 space-y-2 bg-card border border-border/30 rounded-md p-3">
          <label className="flex items-center gap-2 text-sm font-display font-semibold text-foreground">
            <input type="checkbox" checked={s.maintenance_mode} onChange={(e) => set("maintenance_mode", e.target.checked)} />
            Maintenance mode (site-wide banner)
          </label>
          <textarea
            className={inputClass}
            placeholder="Banner message shown to visitors when maintenance mode is on."
            value={s.maintenance_message ?? ""}
            onChange={(e) => set("maintenance_message", e.target.value)}
            rows={2}
          />
        </div>

        <div className="md:col-span-2 space-y-2">
          <p className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">Pause bookings per service</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PAUSABLE_SERVICES.map((svc) => (
              <label key={svc.key} className="flex items-center gap-2 bg-card border border-border/30 rounded-md px-3 py-2 text-xs font-body text-foreground">
                <input type="checkbox" checked={!!s.booking_pauses[svc.key]} onChange={(e) => togglePause(svc.key, e.target.checked)} />
                {svc.label}
              </label>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/70 font-body">
            When paused, that service shows a "Bookings temporarily paused" message and the booking flow is disabled.
          </p>
        </div>
      </Section>

      {/* Meta Pixel surfaced here */}
      <Section title="Meta Pixel" description="Browser pixel + server-side Conversions API token. Stored in the same row as other site settings.">
        <Field label="Meta Pixel ID">
          <input className={inputClass} value={s.meta_pixel_id ?? ""} onChange={(e) => set("meta_pixel_id", e.target.value)} placeholder="e.g. 123456789012345" />
        </Field>
        <Field label="Conversions API Access Token">
          <input className={inputClass} type="password" value={s.meta_capi_token ?? ""} onChange={(e) => set("meta_capi_token", e.target.value)} placeholder="EAA…" />
        </Field>
      </Section>

      <div className="sticky bottom-4 flex justify-end pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="chrome-btn font-display font-semibold text-xs uppercase tracking-[0.1em] px-5 py-2.5 rounded-md flex items-center gap-2 disabled:opacity-50 shadow-lg"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save All Settings
        </button>
      </div>
    </div>
  );
}
