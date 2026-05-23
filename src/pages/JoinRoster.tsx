import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Music, User, MapPin, Instagram, Globe, Link as LinkIcon, FileText, Image, Loader2, Mail } from "lucide-react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeText, sanitizeUrl } from "@/lib/sanitize";
import HCaptchaWidget from "@/components/HCaptchaWidget";
import SeoHead from "@/components/SeoHead";

const JoinRoster = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [pressPhoto, setPressPhoto] = useState<File | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const pressPhotoRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const captchaRef = useRef<HCaptcha>(null);

  const [form, setForm] = useState({
    djName: "",
    email: "",
    genre: "",
    city: "",
    instagram: "",
    soundcloud: "",
    spotify: "",
    mixLink: "",
    bio: "",
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const uploadFile = async (file: File, folder: string) => {
    const ext = file.name.split(".").pop();
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("roster-submissions")
      .upload(path, file);
    if (error) throw error;
    // Audit #13: return the storage PATH, not a signed URL. Admins re-sign a
    // short-lived (600s) URL on view in AdminDashboard — same pattern as ID
    // photos and consent signatures. Persisting a long-lived signed URL in the
    // DB row baked a 24h leak window into every submission.
    return path;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.djName.trim()) {
      toast.error("DJ name is required");
      return;
    }
    if (!form.mixLink.trim()) {
      toast.error("A mix link is required");
      return;
    }
    if (!captchaToken) {
      toast.error("Please complete the captcha challenge");
      return;
    }

    setSubmitting(true);
    try {
      // Verify captcha server-side first
      const { data: captchaResult, error: captchaError } = await supabase.functions.invoke("verify-captcha", {
        body: { token: captchaToken },
      });
      if (captchaError || !captchaResult?.success) {
        toast.error("Captcha verification failed. Please try again.");
        setCaptchaToken(null);
        captchaRef.current?.resetCaptcha();
        setSubmitting(false);
        return;
      }

      let pressPhotoPath = "";
      let logoPath = "";

      if (pressPhoto) {
        pressPhotoPath = await uploadFile(pressPhoto, "photos");
      }
      if (logo) {
        logoPath = await uploadFile(logo, "logos");
      }

      const submissionId = crypto.randomUUID();

      // Save submission to database
      await supabase.from("roster_submissions").insert({
        id: submissionId,
        dj_name: sanitizeText(form.djName),
        email: form.email.trim(),
        genre: sanitizeText(form.genre) || null,
        city: sanitizeText(form.city) || null,
        instagram: sanitizeText(form.instagram) || null,
        soundcloud: sanitizeUrl(form.soundcloud) || null,
        spotify: sanitizeUrl(form.spotify) || null,
        mix_link: sanitizeUrl(form.mixLink) || form.mixLink.trim(),
        bio: sanitizeText(form.bio) || null,
        // Stores the storage path now (audit #13) — admin re-signs on view.
        press_photo_url: pressPhotoPath || null,
        logo_url: logoPath || null,
      });

      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "roster-submission-admin",
          recipientEmail: "replayclubrecords@gmail.com",
          idempotencyKey: `roster-${submissionId}`,
          templateData: {
            djName: form.djName,
            genre: form.genre,
            city: form.city,
            instagram: form.instagram,
            soundcloud: form.soundcloud,
            spotify: form.spotify,
            mixLink: form.mixLink,
            bio: form.bio,
            hasPressPhoto: !!pressPhotoPath,
            hasLogo: !!logoPath,
          },
        },
      });

      // Send confirmation email to the DJ
      if (form.email.trim()) {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "roster-confirmation",
            recipientEmail: form.email,
            idempotencyKey: `roster-confirm-${submissionId}`,
            templateData: { djName: form.djName },
          },
        });
      }

      toast.success("Submission received! We'll be in touch.");
      setForm({ djName: "", email: "", genre: "", city: "", instagram: "", soundcloud: "", spotify: "", mixLink: "", bio: "" });
      setPressPhoto(null);
      setLogo(null);
      setCaptchaToken(null);
      captchaRef.current?.resetCaptcha();
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SeoHead
        title="Join the Replay Club Roster — DJ Submissions"
        description="Submit your mix, press photo, and bio to join the Replay Club DJ roster in Los Angeles. We're booking new talent for sessions, events, and label nights."
        path="/join-roster"
      />
      <div className="max-w-xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold chrome-text tracking-tight mb-3" style={{ fontFamily: "var(--font-display)" }}>
            JOIN THE ROSTER
          </h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            We're always looking for talented DJs to join Replay Club. Submit your info below and we'll be in touch.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* DJ Name */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-foreground">
              <User className="w-4 h-4 text-muted-foreground" /> DJ Name / Alias *
            </Label>
            <Input
              value={form.djName}
              onChange={(e) => update("djName", e.target.value)}
              placeholder="Your artist name"
              className="bg-secondary border-border"
              required
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-foreground">
              <Mail className="w-4 h-4 text-muted-foreground" /> Email *
            </Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="you@email.com"
              className="bg-secondary border-border"
              required
            />
          </div>

          {/* Genre & City */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-foreground">
                <Music className="w-4 h-4 text-muted-foreground" /> Genre(s)
              </Label>
              <Input
                value={form.genre}
                onChange={(e) => update("genre", e.target.value)}
                placeholder="House, Techno, etc."
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-foreground">
                <MapPin className="w-4 h-4 text-muted-foreground" /> City
              </Label>
              <Input
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
                placeholder="Your city"
                className="bg-secondary border-border"
              />
            </div>
          </div>

          {/* Socials */}
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Socials</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Instagram className="w-4 h-4 text-muted-foreground shrink-0" />
                <Input
                  value={form.instagram}
                  onChange={(e) => update("instagram", e.target.value)}
                  placeholder="@handle"
                  className="bg-secondary border-border"
                />
              </div>
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                <Input
                  value={form.soundcloud}
                  onChange={(e) => update("soundcloud", e.target.value)}
                  placeholder="SoundCloud URL"
                  className="bg-secondary border-border"
                />
              </div>
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                <Input
                  value={form.spotify}
                  onChange={(e) => update("spotify", e.target.value)}
                  placeholder="Spotify URL"
                  className="bg-secondary border-border"
                />
              </div>
            </div>
          </div>

          {/* Mix Link */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-foreground">
              <LinkIcon className="w-4 h-4 text-muted-foreground" /> Mix Link *
            </Label>
            <Input
              value={form.mixLink}
              onChange={(e) => update("mixLink", e.target.value)}
              placeholder="Link to your mix (SoundCloud, Mixcloud, etc.)"
              className="bg-secondary border-border"
              required
            />
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-foreground">
              <FileText className="w-4 h-4 text-muted-foreground" /> Short Bio
            </Label>
            <Textarea
              value={form.bio}
              onChange={(e) => update("bio", e.target.value)}
              placeholder="Tell us about yourself and your sound..."
              className="bg-secondary border-border min-h-[100px]"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">{form.bio.length}/500</p>
          </div>

          {/* File Uploads */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Press Photo */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-foreground">
                <Image className="w-4 h-4 text-muted-foreground" /> Press Photo
              </Label>
              <input
                ref={pressPhotoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setPressPhoto(e.target.files?.[0] || null)}
              />
              <button
                type="button"
                onClick={() => pressPhotoRef.current?.click()}
                className="w-full h-24 rounded-lg border border-dashed border-border bg-secondary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors"
              >
                <Upload className="w-5 h-5" />
                <span className="text-xs">{pressPhoto ? pressPhoto.name : "Upload photo"}</span>
              </button>
            </div>

            {/* Logo */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-foreground">
                <Image className="w-4 h-4 text-muted-foreground" /> Logo
              </Label>
              <input
                ref={logoRef}
                type="file"
                accept="image/*,.svg"
                className="hidden"
                onChange={(e) => setLogo(e.target.files?.[0] || null)}
              />
              <button
                type="button"
                onClick={() => logoRef.current?.click()}
                className="w-full h-24 rounded-lg border border-dashed border-border bg-secondary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors"
              >
                <Upload className="w-5 h-5" />
                <span className="text-xs">{logo ? logo.name : "Upload logo"}</span>
              </button>
            </div>
          </div>

          {/* hCaptcha */}
          <HCaptchaWidget
            ref={captchaRef}
            onVerify={(token) => setCaptchaToken(token)}
            onExpire={() => setCaptchaToken(null)}
          />

          {/* Submit */}
          <Button
            type="submit"
            disabled={submitting || !captchaToken}
            className="w-full chrome-btn text-base font-semibold py-6"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
              </span>
            ) : (
              "Submit Application"
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By submitting, you agree to let Replay Club review your materials.
          </p>
        </form>
      </div>
    </div>
  );
};

export default JoinRoster;
