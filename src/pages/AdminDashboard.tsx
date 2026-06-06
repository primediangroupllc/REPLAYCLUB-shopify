import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
// Heavy admin sub-tabs — lazy-load so each tab only downloads when opened
const AdminTalentManager = lazy(() => import("@/components/AdminTalentManager"));
const AdminCalendarView = lazy(() => import("@/components/AdminCalendarView"));
const AdminBlockedDates = lazy(() => import("@/components/AdminBlockedDates"));
const AdminAnalytics = lazy(() => import("@/components/AdminAnalytics"));
const AdminEquipmentInventory = lazy(() => import("@/components/AdminEquipmentInventory"));
const AdminRentalOrders = lazy(() => import("@/components/AdminRentalOrders"));
const AdminCheckIn = lazy(() => import("@/components/AdminCheckIn"));
const AdminCheckInHistory = lazy(() => import("@/components/AdminCheckInHistory"));
const AdminStudioConfig = lazy(() => import("@/components/AdminStudioConfig"));
const AdminConsentViewer = lazy(() => import("@/components/AdminConsentViewer"));
const AdminGuestConsentList = lazy(() => import("@/components/AdminGuestConsentList"));
const AdminEventsManager = lazy(() => import("@/components/AdminEventsManager"));
const AdminSlotLocks = lazy(() => import("@/components/AdminSlotLocks"));
const AdminWebhookEvents = lazy(() => import("@/components/AdminWebhookEvents"));
const AdminWebhookDiagnostics = lazy(() => import("@/components/AdminWebhookDiagnostics"));
const AdminImpersonate = lazy(() => import("@/components/AdminImpersonate"));
const AdminRefundRequests = lazy(() => import("@/components/AdminRefundRequests").then((m) => ({ default: m.AdminRefundRequests })));
const AdminDisputes = lazy(() => import("@/components/AdminDisputes").then((m) => ({ default: m.AdminDisputes })));
const AdminErrorBudget = lazy(() => import("@/components/AdminErrorBudget").then((m) => ({ default: m.AdminErrorBudget })));
const AdminSlowQueries = lazy(() => import("@/components/AdminSlowQueries").then((m) => ({ default: m.AdminSlowQueries })));
const AdminAuditLogViewer = lazy(() => import("@/components/AdminAuditLogViewer").then((m) => ({ default: m.AdminAuditLogViewer })));
const AdminBounces = lazy(() => import("@/components/AdminBounces").then((m) => ({ default: m.AdminBounces })));
const AdminScreeningQueue = lazy(() => import("@/components/AdminScreeningQueue").then((m) => ({ default: m.AdminScreeningQueue })));
const BookingDensitySettingsPanel = lazy(() => import("@/components/admin/BookingDensitySettingsPanel"));
const AdminVisionModePanel = lazy(() => import("@/components/admin/AdminVisionModePanel"));
const AdminGeneralSettingsPanel = lazy(() => import("@/components/admin/AdminGeneralSettingsPanel"));
const AdminBookingPoliciesPanel = lazy(() => import("@/components/admin/AdminBookingPoliciesPanel"));
const AdminServicesPanel = lazy(() => import("@/pages/AdminServices").then((m) => ({ default: m.AdminServicesPanel })));
const AdminBookingTabImagesPanel = lazy(() => import("@/pages/AdminBookingTabImages").then((m) => ({ default: m.AdminBookingTabImagesPanel })));
const AdminHomepageEditPanel = lazy(() => import("@/pages/AdminHomepageEdit").then((m) => ({ default: m.AdminHomepageEditPanel })));

const AdminFallback = () => (
  <div className="flex items-center justify-center py-12">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  CalendarDays,
  Ban,
  DollarSign,
  Users,
  TrendingUp,
  Gift,
  ChevronDown,
  ChevronUp,
  Search,
  Music,
  Mic,
  Upload,
  Trash2,
  UserPlus,
  Check,
  X as XIcon,
  ExternalLink,
  Package,
  Download,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Pencil,
  Save,
  ScanLine,
  Link2,
  Copy,
  Youtube,
  Twitch,
  Headphones,
  Video,
  CreditCard,
  Lock,
  Webhook,
  UserSearch,
  RefreshCw,
  ShieldAlert as ShieldAlertIcon,
  Activity,
  FileSearch,
  MailWarning,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import logo from "@/assets/logo.png";
import { transcodeWavToMp3 } from "@/lib/transcodeWav";
import { compressAudioToMp3 } from "@/lib/compressAudio";
import { logAdminAction } from "@/lib/auditLog";
import MixStatusBadge, { MIX_STATUSES } from "@/components/MixStatusBadge";
import { findPhotographerPackage } from "@/lib/bookingConstants";
import { AdminShell } from "@/components/admin/AdminShell";
import { ADMIN_DASHBOARD_TABS } from "@/lib/adminDashboardTabs";
import AdminMasterLinks from "@/components/AdminMasterLinks";
import AdminTodaysBookings from "@/components/AdminTodaysBookings";

interface Booking {
  id: string;
  room_title: string;
  booking_date: string;
  booking_time: string;
  payment_status: string;
  amount_cents: number;
  tier: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  created_at: string;
  equipment: unknown;
  id_photo_url: string | null;
  id_verified: string | null;
  verification_status: string | null;
  layout: string | null;
  sound: string | null;
  lighting: string | null;
  checked_in_at: string | null;
  consent_signature_path: string | null;
  consent_signed_at: string | null;
  consent_signer_name: string | null;
}

const PIE_COLORS = [
  "hsl(0 0% 85%)",
  "hsl(0 0% 65%)",
  "hsl(0 0% 50%)",
  "hsl(0 0% 38%)",
  "hsl(0 0% 28%)",
];

interface MasterLink {
  label: string;
  description: string;
  url: string;
  icon: typeof Link2;
}

const COMP_ROOMS = ["Disk Jockey", "Podcast", "Livestream"] as const;

const SITE_CONTENT_SUBTABS = [
  { id: "services", label: "Services & Tiers" },
  { id: "images", label: "Tab Images & Cards" },
  { id: "config", label: "Studio Config" },
  { id: "homepage", label: "Homepage" },
] as const;

type SiteContentSubtabId = (typeof SITE_CONTENT_SUBTABS)[number]["id"];

/** Sub-tabbed hub that pulls /admin/services, /admin/booking-tab-images,
 * /admin/homepage, and the existing AdminStudioConfig into one place. */
const SiteContentHub = () => {
  const [sub, setSub] = useState<SiteContentSubtabId>("services");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5 border-b border-border/40 pb-2">
        {SITE_CONTENT_SUBTABS.map((t) => {
          const active = t.id === sub;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSub(t.id)}
              className={`text-[11px] font-display uppercase tracking-wider px-3 py-1.5 rounded-md transition-colors ${
                active
                  ? "bg-primary/15 text-foreground border border-primary/40"
                  : "text-muted-foreground border border-transparent hover:text-foreground hover:bg-muted/30"
              }`}
              aria-pressed={active}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <Suspense fallback={<AdminFallback />}>
        {sub === "services" && <AdminServicesPanel embedded />}
        {sub === "images" && <AdminBookingTabImagesPanel />}
        {sub === "config" && <AdminStudioConfig />}
        {sub === "homepage" && <AdminHomepageEditPanel embedded />}
      </Suspense>
    </div>
  );
};

const LinksTabContent = () => {
  const { toast } = useToast();
  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.replayclub.io";

  const [compRoom, setCompRoom] = useState<typeof COMP_ROOMS[number]>("Disk Jockey");
  const [generating, setGenerating] = useState(false);
  const [latestCompLink, setLatestCompLink] = useState<{ url: string; code: string; room: string } | null>(null);

  const generateCompLink = async () => {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const code = Math.floor(1000000 + Math.random() * 9000000).toString();
      const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

      const { error } = await supabase.from("promo_codes").insert({
        token,
        code,
        room_title: compRoom,
        created_by: session.user.id,
      });
      if (error) throw error;

      const url = `${origin}/promo/${token}`;
      setLatestCompLink({ url, code, room: compRoom });

      try {
        await navigator.clipboard.writeText(url);
        toast({ title: "Comp link generated & copied!", description: `Code: ${code}` });
      } catch {
        toast({ title: "Comp link generated!", description: "Copy it from below." });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const links: MasterLink[] = [
    {
      label: "Apply for DJ Roster",
      description: "Public landing page introducing the roster + apply CTA.",
      url: `${origin}/roster-info`,
      icon: UserPlus,
    },
    {
      label: "Disk Jockey Booking",
      description: "Service landing page for DJ sessions.",
      url: `${origin}/dj-studio`,
      icon: Headphones,
    },
    {
      label: "Podcast Studio Booking",
      description: "Service landing page for podcast recording.",
      url: `${origin}/podcast-studio`,
      icon: Mic,
    },
    {
      label: "Livestream Studio",
      description: "Service landing page for livestreaming.",
      url: `${origin}/livestream-studio`,
      icon: Video,
    },
    {
      label: "Equipment Rental",
      description: "Browse and rent studio equipment.",
      url: `${origin}/equipment-rental`,
      icon: Package,
    },
    {
      label: "Gift Cards",
      description: "Purchase Replay Club gift cards.",
      url: `${origin}/gift-cards`,
      icon: CreditCard,
    },
    {
      label: "Talent Roster",
      description: "Public talent roster page (homepage anchor).",
      url: `${origin}/#talent`,
      icon: Music,
    },
    {
      label: "YouTube Channel",
      description: "Replay Club on YouTube.",
      url: "https://www.youtube.com/@replayclub",
      icon: Youtube,
    },
    {
      label: "Twitch Channel",
      description: "Live streams on Twitch.",
      url: "https://www.twitch.tv/replayclub_",
      icon: Twitch,
    },
  ];

  const copyLink = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: label });
    } catch {
      toast({ title: "Copy failed", description: "Please copy manually.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      <div className="card-premium p-4">
        <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider mb-1">
          Master Links
        </h3>
        <p className="text-[11px] text-muted-foreground font-body">
          Quick access to shareable URLs across Replay Club.
        </p>
      </div>

      {/* Complimentary Studio Sesh — one-click generator */}
      <div className="card-premium card-premium-accent p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-md bg-card border border-border/30 flex items-center justify-center">
            <Gift className="w-4 h-4 text-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-display text-sm font-bold text-foreground">Complimentary Studio Sesh</h4>
            <p className="text-[11px] text-muted-foreground font-body">
              Generate a fresh single-use comp link. Recipient picks a date 2+ days out, 1.5 hr session, up to 2 ID-verified guests.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={compRoom}
            onChange={(e) => setCompRoom(e.target.value as typeof COMP_ROOMS[number])}
            className="flex-1 bg-card border border-border text-foreground rounded-md px-3 py-2 text-xs font-body focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {COMP_ROOMS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <button
            onClick={generateCompLink}
            disabled={generating}
            className="chrome-btn font-display font-semibold text-xs uppercase tracking-wider px-4 py-2 rounded-md disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate & Copy Link"}
          </button>
        </div>

        {latestCompLink && (
          <div className="space-y-1.5 pt-2 border-t border-border/30">
            <p className="text-[10px] text-muted-foreground font-body uppercase tracking-wider">
              Latest comp · {latestCompLink.room} · code {latestCompLink.code}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[10px] font-mono text-muted-foreground bg-card border border-border/30 rounded px-2 py-1.5 truncate">
                {latestCompLink.url}
              </code>
              <button
                onClick={() => copyLink(latestCompLink.url, "Comp link")}
                className="shrink-0 px-2 py-1.5 rounded-md bg-card border border-border/30 text-foreground"
                title="Copy"
                aria-label="Copy comp link"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <a
          href={`${origin}/admin/promos`}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Manage all promos
        </a>
      </div>

      <div className="space-y-2">
        {links.map((link) => (
          <div
            key={link.url}
            className="card-premium p-4 flex items-start gap-3"
          >
            <div className="shrink-0 w-9 h-9 rounded-md bg-card border border-border/30 flex items-center justify-center">
              <link.icon className="w-4 h-4 text-foreground" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div>
                <h4 className="font-display text-sm font-bold text-foreground">{link.label}</h4>
                <p className="text-[11px] text-muted-foreground font-body">{link.description}</p>
              </div>
              <p className="text-[11px] font-mono text-muted-foreground truncate bg-card border border-border/30 rounded px-2 py-1">
                {link.url}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                onClick={() => copyLink(link.url, link.label)}
                className="p-2 rounded-md bg-card border border-border/30 text-muted-foreground hover:text-foreground transition-colors"
                title="Copy link"
                aria-label={`Copy ${link.label} link`}
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-md bg-card border border-border/30 text-muted-foreground hover:text-foreground transition-colors"
                title="Open link"
                aria-label={`Open ${link.label}`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  // Honor ?tab=<id> for navigation from standalone admin pages back into a
  // specific dashboard tab. Falls back to overview when the param is missing
  // or doesn't match a known tab id.
  const initialTab = (() => {
    if (typeof window === "undefined") return "overview" as const;
    const param = new URLSearchParams(window.location.search).get("tab");
    if (!param) return "overview" as const;
    const valid = ADMIN_DASHBOARD_TABS.some((t) => t.id === param);
    return (valid ? param : "overview") as
      | "overview" | "screening" | "bookings" | "checkin" | "calendar" | "blocked"
      | "equipment" | "rentals" | "giftcards" | "mixes" | "talent" | "roster"
      | "links" | "events" | "locks" | "webhooks" | "users" | "refunds"
      | "disputes" | "bounces" | "errors" | "audit" | "settings" | "studios";
  })();
  const [activeTab, setActiveTab] = useState<"overview" | "screening" | "bookings" | "checkin" | "calendar" | "blocked" | "equipment" | "rentals" | "giftcards" | "mixes" | "talent" | "roster" | "links" | "events" | "locks" | "webhooks" | "users" | "refunds" | "disputes" | "bounces" | "errors" | "audit" | "settings" | "studios">(initialTab);
  const [pendingCheckinBookingId, setPendingCheckinBookingId] = useState<string | null>(null);
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Booking>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [giftCards, setGiftCards] = useState<any[]>([]);
  const [gcAmount, setGcAmount] = useState(2500);
  const [gcRecipientEmail, setGcRecipientEmail] = useState("");
  const [gcRecipientName, setGcRecipientName] = useState("");
  const [gcMessage, setGcMessage] = useState("");
  const [gcIssuing, setGcIssuing] = useState(false);
  // Mixes state
  const [mixes, setMixes] = useState<any[]>([]);
  const [allProfiles, setAllProfiles] = useState<{ id: string; display_name: string | null }[]>([]);
  const [mixUserId, setMixUserId] = useState("");
  const [mixTitle, setMixTitle] = useState("");
  const [mixDescription, setMixDescription] = useState("");
  const [mixFile, setMixFile] = useState<File | null>(null);
  const [mixCoverArt, setMixCoverArt] = useState<File | null>(null);
  const [coverArtDragOver, setCoverArtDragOver] = useState(false);
  const [audioDragOver, setAudioDragOver] = useState(false);
  const [mixUploading, setMixUploading] = useState(false);
  const [audioUploadProgress, setAudioUploadProgress] = useState(0);
  const [coverArtUploadProgress, setCoverArtUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<"idle" | "audio" | "cover" | "saving">("idle");
  const [mixSearchQuery, setMixSearchQuery] = useState("");
  const [mixRecipientEmail, setMixRecipientEmail] = useState("");
  // Roster state
  const [mixStreamingFile, setMixStreamingFile] = useState<File | null>(null);
  const [streamingDragOver, setStreamingDragOver] = useState(false);
  const [streamingUploadProgress, setStreamingUploadProgress] = useState(0);
  const mixStreamingFileRef = useRef<HTMLInputElement>(null);
  const [transcodedMp3, setTranscodedMp3] = useState<Blob | null>(null);
  const [transcodeProgress, setTranscodeProgress] = useState(0);
  const [isTranscoding, setIsTranscoding] = useState(false);
  const [transcodeError, setTranscodeError] = useState<string | null>(null);
  const [rosterSubmissions, setRosterSubmissions] = useState<any[]>([]);
  const [rosterFilter, setRosterFilter] = useState<string>("all");
  const [blockedDates, setBlockedDates] = useState<any[]>([]);
  const mixFileRef = useRef<HTMLInputElement>(null);
  const mixCoverArtRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  // Auto-compress any audio file to a streaming-quality MP3
  useEffect(() => {
    if (!mixFile) {
      setTranscodedMp3(null);
      setTranscodeProgress(0);
      setIsTranscoding(false);
      setTranscodeError(null);
      return;
    }

    let cancelled = false;
    setIsTranscoding(true);
    setTranscodeProgress(0);
    setTranscodeError(null);
    setTranscodedMp3(null);

    const isWav = mixFile.name.toLowerCase().endsWith(".wav");

    // WAV: use the memory-efficient slice-based transcoder
    // MP3/other: use Web Audio API decode → re-encode at 128kbps
    const compressPromise = isWav
      ? transcodeWavToMp3(mixFile, 128, (pct) => {
          if (!cancelled) setTranscodeProgress(pct);
        })
      : compressAudioToMp3(mixFile, (pct) => {
          if (!cancelled) setTranscodeProgress(pct);
        });

    compressPromise
      .then((blob) => {
        if (!cancelled) {
          // Only use compressed version if it's meaningfully smaller
          const ratio = blob.size / mixFile.size;
          if (ratio >= 0.9) {
            console.warn(
              `[Compress] Result is ${Math.round(ratio * 100)}% of original — skipping`,
            );
            setTranscodedMp3(null);
            setTranscodeError(null);
          } else {
            console.log(
              `[Compress] ${(mixFile.size / 1024 / 1024).toFixed(0)} MB → ` +
                `${(blob.size / 1024 / 1024).toFixed(1)} MB (${Math.round(ratio * 100)}%)`,
            );
            setTranscodedMp3(blob);
          }
          setIsTranscoding(false);
          setTranscodeProgress(100);
        }
      })
      .catch((err) => {
        console.error("[Compress] Error:", err);
        if (!cancelled) {
          setIsTranscoding(false);
          setTranscodeError(err.message || "Compression failed");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mixFile]);

  const checkAdminAndLoad = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    const { data } = await supabase.rpc("has_role", {
      _user_id: session.user.id,
      _role: "admin" as const,
    });
    if (!data) {
      navigate("/");
      return;
    }
    setIsAdmin(true);
    loadBookings();
    loadGiftCards();
    loadMixes();
    loadRosterSubmissions();
    loadBlockedDates();
  };

  const loadGiftCards = async () => {
    const { data } = await supabase
      .from("gift_cards")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setGiftCards(data);
  };

  const issueGiftCard = async () => {
    setGcIssuing(true);
    try {
      // Mint through the audited, admin-gated RPC — the server generates the
      // code, enforces the allowed denominations, and writes an audit_log row.
      const { data, error } = await (supabase as any).rpc("admin_issue_gift_card", {
        p_amount_cents: gcAmount,
        p_recipient_email: gcRecipientEmail || null,
        p_recipient_name: gcRecipientName || null,
        p_personal_message: gcMessage || null,
      });
      if (error) throw error;
      toast({ title: "Gift card issued!", description: `Code: ${data.code} — $${(data.amount_cents / 100).toFixed(0)}` });
      setGcRecipientEmail("");
      setGcRecipientName("");
      setGcMessage("");
      loadGiftCards();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGcIssuing(false);
    }
  };

  const loadMixes = async () => {
    const [mixesRes, profilesRes] = await Promise.all([
      supabase.from("mixes").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, display_name"),
    ]);
    if (mixesRes.data) setMixes(mixesRes.data);
    if (profilesRes.data) setAllProfiles(profilesRes.data);
  };

  const handleUploadMix = async () => {
    if (!mixUserId || !mixTitle || !mixFile) {
      toast({ title: "Missing fields", description: "User ID, title, and file are required.", variant: "destructive" });
      return;
    }
    setMixUploading(true);
    setAudioUploadProgress(0);
    setCoverArtUploadProgress(0);
    setUploadStage("audio");
    try {
      const uploadWithProgress = (bucket: string, path: string, file: File, onProgress: (pct: number) => void): Promise<void> => {
        return new Promise(async (resolve, reject) => {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;
          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
          });
          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload failed: ${xhr.statusText}`));
          });
          xhr.addEventListener("error", () => reject(new Error("Upload network error")));
          xhr.open("POST", url);
          xhr.setRequestHeader("Authorization", `Bearer ${token}`);
          xhr.setRequestHeader("x-upsert", "false");
          xhr.send(file);
        });
      };

      const ext = mixFile.name.split(".").pop();
      const storagePath = `${mixUserId}/${Date.now()}.${ext}`;
      await uploadWithProgress("mixes", storagePath, mixFile, setAudioUploadProgress);

      // Upload cover art if provided
      let coverArtPath: string | null = null;
      if (mixCoverArt) {
        setUploadStage("cover");
        const artExt = mixCoverArt.name.split(".").pop();
        coverArtPath = `${mixUserId}/covers/${Date.now()}.${artExt}`;
        await uploadWithProgress("mixes", coverArtPath, mixCoverArt, setCoverArtUploadProgress);
      }
      setUploadStage("saving");

      // Upload streaming file: use manual override OR auto-compressed MP3
      let streamingPath: string | null = null;
      const streamingBlob = mixStreamingFile || transcodedMp3;
      if (streamingBlob) {
        setUploadStage("streaming" as any);
        const streamExt = mixStreamingFile
          ? mixStreamingFile.name.split(".").pop()
          : "mp3";
        streamingPath = `${mixUserId}/streaming/${Date.now()}.${streamExt}`;
        const streamFile =
          streamingBlob instanceof File
            ? streamingBlob
            : new File([streamingBlob], `streaming.${streamExt}`, {
                type: "audio/mpeg",
              });
        const streamingSize = streamFile.size;
        console.log(
          `[MixUpload] Streaming file: ${(streamingSize / 1024 / 1024).toFixed(1)} MB ` +
          `(${Math.round((streamingSize / mixFile.size) * 100)}% of original)`
        );
        await uploadWithProgress(
          "mixes",
          streamingPath,
          streamFile,
          setStreamingUploadProgress,
        );
      }
      setUploadStage("saving");

      const { data: { session: adminSession } } = await supabase.auth.getSession();
      const { error: insertError } = await supabase.from("mixes").insert({
        user_id: mixUserId,
        title: mixTitle,
        description: mixDescription || null,
        file_url: storagePath,
        cover_art_url: coverArtPath,
        streaming_url: streamingPath,
        recorded_at: new Date().toISOString(),
        // Admin-assigned mixes are live immediately (unchanged behaviour); the
        // status/provenance columns just record that explicitly.
        status: "approved",
        uploaded_by_role: "admin",
        uploaded_by_user_id: adminSession?.user.id ?? null,
      } as any);
      if (insertError) throw insertError;

      // Send email notification if recipient email provided
      if (mixRecipientEmail) {
        const selectedProfile = allProfiles.find(p => p.id === mixUserId);
        const mixId = crypto.randomUUID();
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "mix-uploaded",
            recipientEmail: mixRecipientEmail,
            idempotencyKey: `mix-uploaded-${mixUserId}-${Date.now()}`,
            templateData: {
              displayName: selectedProfile?.display_name || undefined,
              mixTitle,
              mixDescription: mixDescription || undefined,
              profileUrl: `${window.location.origin}/profile`,
            },
          },
        });
      }

      toast({ title: "Mix uploaded!", description: `"${mixTitle}" assigned successfully.${mixRecipientEmail ? " Notification sent." : ""}` });
      setMixUserId("");
      setMixTitle("");
      setMixDescription("");
      setMixRecipientEmail("");
      setMixFile(null);
      setMixCoverArt(null);
      setMixStreamingFile(null);
      setTranscodedMp3(null);
      setTranscodeProgress(0);
      if (mixFileRef.current) mixFileRef.current.value = "";
      if (mixCoverArtRef.current) mixCoverArtRef.current.value = "";
      if (mixStreamingFileRef.current) mixStreamingFileRef.current.value = "";
      loadMixes();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setMixUploading(false);
      setUploadStage("idle");
      setAudioUploadProgress(0);
      setCoverArtUploadProgress(0);
      setStreamingUploadProgress(0);
    }
  };

  const handleDeleteMix = async (mixId: string) => {
    const { error } = await supabase.from("mixes").delete().eq("id", mixId);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      setMixes(mixes.filter(m => m.id !== mixId));
      logAdminAction("delete", "mix", mixId);
      toast({ title: "Mix deleted" });
    }
  };

  const handleSetMixStatus = async (mixId: string, status: string) => {
    const { error } = await supabase.from("mixes").update({ status }).eq("id", mixId);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    setMixes(prev => prev.map(m => (m.id === mixId ? { ...m, status } : m)));
    logAdminAction("update", "mix", mixId, { status });
    toast({ title: `Marked ${status.replace(/_/g, " ")}` });
  };

  const handleSaveMixAdminNotes = async (mixId: string, notes: string) => {
    const { error } = await supabase.from("mixes").update({ admin_notes: notes || null }).eq("id", mixId);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    setMixes(prev => prev.map(m => (m.id === mixId ? { ...m, admin_notes: notes || null } : m)));
    toast({ title: "Notes saved" });
  };

  // Manual analysis (Brian: AI stays manual for now). analyze-mix needs
  // waveform_data; if it isn't generated yet the function errors and we surface
  // it. Status is left for the admin to set — analysis only writes mix_analysis.
  const handleAnalyzeMix = async (mixId: string) => {
    toast({ title: "Analyzing mix…", description: "This can take a moment." });
    const { error } = await supabase.functions.invoke("analyze-mix", { body: { mix_id: mixId } });
    if (error) {
      toast({
        title: "Analysis failed",
        description: typeof error === "object" ? JSON.stringify(error) : String(error),
        variant: "destructive",
      });
      return;
    }
    await loadMixes();
    logAdminAction("update", "mix", mixId, { action: "analyze" });
    toast({ title: "Analysis complete", description: "Report card generated. Set the status when ready." });
  };

const IdPhotoViewer = ({ photoPath }: { photoPath: string }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUrl = async () => {
      const { data } = await supabase.storage.from("id-verification").createSignedUrl(photoPath, 300);
      if (data?.signedUrl) setUrl(data.signedUrl);
      setLoading(false);
    };
    getUrl();
  }, [photoPath]);

  if (loading) return <div className="h-32 bg-muted animate-pulse rounded-md" />;
  if (!url) return <p className="text-[10px] text-destructive">Failed to load ID photo</p>;
  return (
    <img src={url} alt="ID Photo" className="w-full h-40 object-cover rounded-md border border-border" />
  );
};

// Roster press-photo / logo link. The DB column holds a storage path (audit
// #13); we re-sign a short-lived 600s URL on view. Legacy rows that still hold
// a full signed URL are passed through as-is.
const RosterPhotoLink = ({ value, label }: { value: string; label: string }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (/^https?:\/\//.test(value)) {
      setUrl(value);
      return;
    }
    supabase.storage
      .from("roster-submissions")
      .createSignedUrl(value, 600)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  const cls =
    "inline-flex items-center gap-1 text-[10px] font-display uppercase tracking-wider px-2 py-1 rounded-md bg-card border border-border/30 text-muted-foreground hover:text-foreground transition-colors";

  if (!url) return <span className={`${cls} opacity-50`}>{label}…</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={cls}>
      {label} <ExternalLink className="w-2.5 h-2.5" />
    </a>
  );
};


  const loadBookings = async () => {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .order("booking_date", { ascending: false });
    if (error) {
      toast({ title: "Error loading bookings", description: error.message, variant: "destructive" });
    }
    if (data) setBookings(data as Booking[]);
  };

  const loadRosterSubmissions = async () => {
    const { data } = await supabase
      .from("roster_submissions")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setRosterSubmissions(data);
  };

  const loadBlockedDates = async () => {
    const { data } = await supabase
      .from("blocked_dates")
      .select("*")
      .order("blocked_date", { ascending: true });
    if (data) setBlockedDates(data);
  };

  const updateSubmissionStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("roster_submissions")
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Submission ${status}` });
      loadRosterSubmissions();
    }
  };

  const downloadCsv = (filename: string, headers: string[], rows: string[][]) => {
    const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportBookingsCsv = () => {
    const headers = ["Date", "Time", "Room", "Customer", "Email", "Phone", "Status", "Amount", "Tier", "Created"];
    const rows = filteredBookings.map(b => [
      b.booking_date,
      b.booking_time,
      b.room_title,
      b.customer_name,
      b.customer_email,
      b.customer_phone,
      b.payment_status,
      `$${(b.amount_cents / 100).toFixed(2)}`,
      b.tier || "",
      new Date(b.created_at).toLocaleDateString(),
    ]);
    downloadCsv(`bookings-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    toast({ title: "Exported", description: `${rows.length} bookings downloaded.` });
  };

  const startEditBooking = (booking: Booking) => {
    setEditingBookingId(booking.id);
    setEditForm({
      customer_name: booking.customer_name,
      customer_email: booking.customer_email,
      customer_phone: booking.customer_phone,
      booking_date: booking.booking_date,
      booking_time: booking.booking_time,
      room_title: booking.room_title,
      payment_status: booking.payment_status,
      tier: booking.tier,
    });
  };

  const saveBookingEdit = async () => {
    if (!editingBookingId) return;
    const { error } = await supabase
      .from("bookings")
      .update({
        customer_name: editForm.customer_name,
        customer_email: editForm.customer_email,
        customer_phone: editForm.customer_phone,
        booking_date: editForm.booking_date,
        booking_time: editForm.booking_time,
        room_title: editForm.room_title,
        payment_status: editForm.payment_status,
        tier: editForm.tier,
      })
      .eq("id", editingBookingId);
    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
      return;
    }
    setBookings((prev) =>
      prev.map((b) => (b.id === editingBookingId ? { ...b, ...editForm } : b))
    );
    setEditingBookingId(null);
    toast({ title: "Booking updated" });
    logAdminAction("update", "booking", editingBookingId, editForm);
  };

  const exportRevenueCsv = () => {
    const headers = ["Month", "Revenue", "Bookings"];
    const rows = monthlyRevenue.map((m, i) => [
      m.month,
      `$${m.revenue.toFixed(2)}`,
      String(monthlyBookings[i]?.count ?? 0),
    ]);
    downloadCsv(`revenue-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    toast({ title: "Exported", description: "Revenue data downloaded." });
  };

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Derived analytics ──
  const paidBookings = bookings.filter((b) => b.payment_status === "paid" || b.payment_status === "promo");
  const totalRevenue = bookings
    .filter((b) => b.payment_status === "paid")
    .reduce((sum, b) => sum + b.amount_cents, 0);
  const totalBookings = bookings.length;
  const uniqueCustomers = new Set(bookings.map((b) => b.customer_email.toLowerCase())).size;

  // Revenue by month (last 6 months)
  const now = new Date();
  const monthlyRevenue = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const month = d.toLocaleString("default", { month: "short" });
    const year = d.getFullYear();
    const m = d.getMonth();
    const revenue = bookings
      .filter((b) => {
        if (b.payment_status !== "paid") return false;
        const bd = new Date(b.booking_date);
        return bd.getMonth() === m && bd.getFullYear() === year;
      })
      .reduce((s, b) => s + b.amount_cents, 0);
    return { month, revenue: revenue / 100 };
  });

  // Bookings by room
  const roomCounts: Record<string, number> = {};
  paidBookings.forEach((b) => {
    roomCounts[b.room_title] = (roomCounts[b.room_title] || 0) + 1;
  });
  const roomData = Object.entries(roomCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Bookings by month for bar chart
  const monthlyBookings = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const month = d.toLocaleString("default", { month: "short" });
    const year = d.getFullYear();
    const m = d.getMonth();
    const count = bookings.filter((b) => {
      const bd = new Date(b.booking_date);
      return bd.getMonth() === m && bd.getFullYear() === year;
    }).length;
    return { month, count };
  });

  // Filtered bookings for table
  const filteredBookings = bookings.filter((b) => {
    const matchesSearch =
      !searchQuery ||
      b.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.customer_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.room_title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || b.payment_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      paid: "bg-green-500/10 text-green-400",
      promo: "bg-primary/10 text-primary",
      pending: "bg-yellow-500/10 text-yellow-400",
      cancelled: "bg-destructive/10 text-destructive",
    };
    return styles[status] || "bg-muted text-muted-foreground";
  };

  const tabs = ADMIN_DASHBOARD_TABS;

  return (
    <AdminShell
      tabs={tabs}
      activeTabId={activeTab}
      onSelectTab={(id) => setActiveTab(id as typeof activeTab)}
    >
      <div className="container mx-auto max-w-4xl px-4 py-6 space-y-6">
        {/* Title */}
        <div className="text-center">
          <h1 className="font-display text-xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm font-body mt-1">
            Manage bookings & view analytics
          </p>
        </div>

        {/* Master Links — quick access to every editable page */}
        <AdminMasterLinks />

        {/* Tabs */}
        <div className="flex overflow-x-auto gap-1 bg-card rounded-lg p-1 scrollbar-hide -mx-1 px-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap px-3.5 sm:px-4 min-h-[44px] sm:min-h-0 sm:py-2 rounded-md text-xs font-display uppercase tracking-wider transition-all ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Today's Bookings — always visible at the top of the dashboard */}
              <AdminTodaysBookings
                bookings={bookings}
                onReload={loadBookings}
                onSelectBooking={(id) => {
                  setPendingCheckinBookingId(id);
                  setActiveTab("checkin");
                }}
              />
              {/* Upcoming photographer sessions this week */}
              {(() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const weekEnd = new Date(today);
                weekEnd.setDate(weekEnd.getDate() + 7);
                const photogSessions = bookings
                  .filter((b) => {
                    if (b.payment_status !== "paid" && b.payment_status !== "promo") return false;
                    if (!findPhotographerPackage(b.equipment)) return false;
                    const d = new Date(b.booking_date + "T00:00:00");
                    return d >= today && d < weekEnd;
                  })
                  .sort((a, b) =>
                    (a.booking_date + a.booking_time).localeCompare(b.booking_date + b.booking_time)
                  );
                return (
                  <div className="card-premium card-premium-accent p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">📸</span>
                        <h3 className="font-display text-sm font-bold text-foreground uppercase tracking-wider">
                          Photographer sessions this week
                        </h3>
                      </div>
                      <span className="font-display text-lg font-bold text-foreground">
                        {photogSessions.length}
                      </span>
                    </div>
                    {photogSessions.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground font-body">
                        No paid photographer packages booked in the next 7 days.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {photogSessions.map((b) => {
                          const pkg = findPhotographerPackage(b.equipment);
                          const dateStr = new Date(b.booking_date + "T00:00:00").toLocaleDateString(
                            "en-US",
                            { weekday: "short", month: "short", day: "numeric" }
                          );
                          return (
                            <li
                              key={b.id}
                              className="flex items-center justify-between gap-3 text-[11px] font-body bg-card border border-border/30 rounded px-2.5 py-1.5"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-foreground font-semibold truncate">
                                  {b.customer_name}
                                </p>
                                <p className="text-muted-foreground truncate">{pkg}</p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-foreground">{dateStr}</p>
                                <p className="text-muted-foreground">{b.booking_time}</p>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })()}

              {/* Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  {
                    label: "Revenue",
                    value: `$${(totalRevenue / 100).toLocaleString()}`,
                    icon: DollarSign,
                  },
                  { label: "Bookings", value: totalBookings, icon: Calendar },
                  { label: "Customers", value: uniqueCustomers, icon: Users },
                  {
                    label: "Avg / Booking",
                    value: paidBookings.length
                      ? `$${Math.round(totalRevenue / paidBookings.length / 100)}`
                      : "$0",
                    icon: TrendingUp,
                  },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="card-premium p-4 space-y-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <stat.icon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">
                        {stat.label}
                      </span>
                    </div>
                    <p className="font-display text-lg font-bold text-foreground">{stat.value}</p>
                  </motion.div>
                ))}
              </div>

              {/* Revenue Line Chart */}
              <div className="card-premium p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
                    Revenue Trend
                  </h3>
                  <button
                    onClick={exportRevenueCsv}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-display uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    CSV
                  </button>
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 16%)" />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: "hsl(0 0% 55%)", fontSize: 10 }}
                        axisLine={{ stroke: "hsl(0 0% 16%)" }}
                      />
                      <YAxis
                        tick={{ fill: "hsl(0 0% 55%)", fontSize: 10 }}
                        axisLine={{ stroke: "hsl(0 0% 16%)" }}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(0 0% 7%)",
                          border: "1px solid hsl(0 0% 16%)",
                          borderRadius: "8px",
                          fontSize: 12,
                          color: "hsl(0 0% 95%)",
                        }}
                        formatter={(value: number) => [`$${value}`, "Revenue"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="hsl(0 0% 85%)"
                        strokeWidth={2}
                        dot={{ fill: "hsl(0 0% 85%)", r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bottom row: Bar chart + Pie chart */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="card-premium p-4 space-y-3">
                  <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
                    Bookings / Month
                  </h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyBookings}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 16%)" />
                        <XAxis
                          dataKey="month"
                          tick={{ fill: "hsl(0 0% 55%)", fontSize: 10 }}
                          axisLine={{ stroke: "hsl(0 0% 16%)" }}
                        />
                        <YAxis
                          tick={{ fill: "hsl(0 0% 55%)", fontSize: 10 }}
                          axisLine={{ stroke: "hsl(0 0% 16%)" }}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(0 0% 7%)",
                            border: "1px solid hsl(0 0% 16%)",
                            borderRadius: "8px",
                            fontSize: 12,
                            color: "hsl(0 0% 95%)",
                          }}
                        />
                        <Bar dataKey="count" fill="hsl(0 0% 85%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card-premium p-4 space-y-3">
                  <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
                    By Room
                  </h3>
                  <div className="h-48">
                    {roomData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={roomData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            dataKey="value"
                            nameKey="name"
                            label={({ name, percent }) =>
                              `${name} ${(percent * 100).toFixed(0)}%`
                            }
                          >
                            {roomData.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: "hsl(0 0% 7%)",
                              border: "1px solid hsl(0 0% 16%)",
                              borderRadius: "8px",
                              fontSize: 12,
                              color: "hsl(0 0% 95%)",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground text-sm font-body">
                        No data yet
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Charts (merged from Analytics) */}
              <Suspense fallback={<AdminFallback />}>
                <AdminAnalytics bookings={bookings} />
              </Suspense>
            </div>
          )}

          {activeTab === "bookings" && (
            <div className="space-y-4">
              {/* Search & Filter */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search name, email, room..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-card border border-border text-foreground rounded-md text-xs font-body focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-card border border-border text-foreground rounded-md px-3 py-2 text-xs font-body focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="all">All</option>
                  <option value="paid">Paid</option>
                  <option value="promo">Promo</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground font-body uppercase tracking-wider">
                  {filteredBookings.length} booking{filteredBookings.length !== 1 ? "s" : ""}
                </p>
                <button
                  onClick={exportBookingsCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-display uppercase tracking-wider bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>
              </div>

              {/* Booking cards */}
              <div className="space-y-2">
                {filteredBookings.map((booking, i) => {
                  const isExpanded = expandedBooking === booking.id;
                  return (
                    <motion.div
                      key={booking.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="card-premium overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedBooking(isExpanded ? null : booking.id)}
                        className="w-full p-3 text-left flex items-center justify-between"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-display text-sm font-semibold text-foreground truncate">
                              {booking.customer_name}
                            </span>
                            <span
                              className={`text-[9px] font-display uppercase tracking-wider px-1.5 py-0.5 rounded-full ${statusBadge(
                                booking.payment_status
                              )}`}
                            >
                              {booking.payment_status}
                            </span>
                            {booking.id_photo_url && (
                              <span className={`text-[9px] font-display uppercase tracking-wider px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                                booking.id_verified === "approved" ? "bg-primary/10 text-primary" :
                                booking.id_verified === "rejected" ? "bg-destructive/10 text-destructive" :
                                "bg-accent text-accent-foreground"
                              }`}>
                                {booking.id_verified === "approved" ? <ShieldCheck className="w-2.5 h-2.5" /> :
                                 booking.id_verified === "rejected" ? <ShieldX className="w-2.5 h-2.5" /> :
                                 <ShieldAlert className="w-2.5 h-2.5" />}
                                {booking.id_verified || "pending"}
                              </span>
                            )}
                            {booking.checked_in_at && (
                              <span className="text-[9px] font-display uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-0.5">
                                <ShieldCheck className="w-2.5 h-2.5" />
                                Checked In
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground font-body mt-0.5">
                            {booking.room_title} • {booking.booking_date} • {booking.booking_time}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 ml-2">
                          <span className="font-display text-sm font-bold text-foreground">
                            {booking.payment_status === "promo"
                              ? "FREE"
                              : `$${(booking.amount_cents / 100).toFixed(0)}`}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          transition={{ duration: 0.2 }}
                          className="border-t border-border/30 px-3 pb-3 pt-2"
                        >
                          {editingBookingId === booking.id ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-2 text-xs font-body">
                                <label className="text-muted-foreground self-center">Name</label>
                                <input value={editForm.customer_name || ""} onChange={(e) => setEditForm(f => ({ ...f, customer_name: e.target.value }))} className="bg-card border border-border text-foreground rounded px-2 py-1 text-xs" />
                                <label className="text-muted-foreground self-center">Email</label>
                                <input value={editForm.customer_email || ""} onChange={(e) => setEditForm(f => ({ ...f, customer_email: e.target.value }))} className="bg-card border border-border text-foreground rounded px-2 py-1 text-xs" />
                                <label className="text-muted-foreground self-center">Phone</label>
                                <input value={editForm.customer_phone || ""} onChange={(e) => setEditForm(f => ({ ...f, customer_phone: e.target.value }))} className="bg-card border border-border text-foreground rounded px-2 py-1 text-xs" />
                                <label className="text-muted-foreground self-center">Date</label>
                                <input type="date" value={editForm.booking_date || ""} onChange={(e) => setEditForm(f => ({ ...f, booking_date: e.target.value }))} className="bg-card border border-border text-foreground rounded px-2 py-1 text-xs" />
                                <label className="text-muted-foreground self-center">Time</label>
                                <input value={editForm.booking_time || ""} onChange={(e) => setEditForm(f => ({ ...f, booking_time: e.target.value }))} className="bg-card border border-border text-foreground rounded px-2 py-1 text-xs" />
                                <label className="text-muted-foreground self-center">Room</label>
                                <select value={editForm.room_title || ""} onChange={(e) => setEditForm(f => ({ ...f, room_title: e.target.value }))} className="bg-card border border-border text-foreground rounded px-2 py-1 text-xs">
                                  <option value="DJ Studio">DJ Studio</option>
                                  <option value="Podcast Studio">Podcast Studio</option>
                                  <option value="Livestream Studio">Livestream Studio</option>
                                </select>
                                <label className="text-muted-foreground self-center">Status</label>
                                <select value={editForm.payment_status || ""} onChange={(e) => setEditForm(f => ({ ...f, payment_status: e.target.value }))} className="bg-card border border-border text-foreground rounded px-2 py-1 text-xs">
                                  <option value="paid">Paid</option>
                                  <option value="pending">Pending</option>
                                  <option value="promo">Promo</option>
                                  <option value="cancelled">Cancelled</option>
                                </select>
                                <label className="text-muted-foreground self-center">Tier</label>
                                <select value={editForm.tier || ""} onChange={(e) => setEditForm(f => ({ ...f, tier: e.target.value || null }))} className="bg-card border border-border text-foreground rounded px-2 py-1 text-xs">
                                  <option value="">None</option>
                                  <option value="Essentials">Essentials</option>
                                  <option value="Performance">Performance</option>
                                  <option value="Showtime">Showtime</option>
                                </select>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={saveBookingEdit} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-display font-semibold uppercase tracking-wider bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                                  <Save className="w-3 h-3" /> Save
                                </button>
                                <button onClick={() => setEditingBookingId(null)} className="flex-1 py-1.5 rounded-md text-[10px] font-display font-semibold uppercase tracking-wider bg-accent text-accent-foreground hover:bg-accent/80 transition-colors">
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="grid grid-cols-2 gap-1.5 text-xs font-body">
                                <span className="text-muted-foreground">Email</span>
                                <span className="text-foreground truncate">{booking.customer_email}</span>
                                <span className="text-muted-foreground">Phone</span>
                                <span className="text-foreground">{booking.customer_phone}</span>
                                {booking.tier && (
                                  <>
                                    <span className="text-muted-foreground">Tier</span>
                                    <span className="text-foreground">{booking.tier}</span>
                                  </>
                                )}
                                {(booking as any).layout && (
                                  <>
                                    <span className="text-muted-foreground">Layout</span>
                                    <span className="text-foreground capitalize">{String((booking as any).layout).replace(/[-_]/g, " ")}</span>
                                  </>
                                )}
                                {(booking as any).lighting && (
                                  <>
                                    <span className="text-muted-foreground">Lighting</span>
                                    <span className="text-foreground capitalize">{String((booking as any).lighting).replace(/[-_]/g, " ")}</span>
                                  </>
                                )}
                                <span className="text-muted-foreground">Booked on</span>
                                <span className="text-foreground">
                                  {new Date(booking.created_at).toLocaleDateString()}
                                </span>
                              </div>

                              <div className="mt-3 flex gap-2">
                                <button
                                  onClick={() => startEditBooking(booking)}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-display font-semibold uppercase tracking-wider bg-accent text-accent-foreground hover:bg-accent/80 transition-colors"
                                >
                                  <Pencil className="w-3 h-3" /> Edit
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm(`Delete booking for ${booking.customer_name}?`)) return;
                                    const { error } = await supabase.from("bookings").delete().eq("id", booking.id);
                                    if (error) {
                                      toast({ title: "Error deleting", description: error.message, variant: "destructive" });
                                      return;
                                    }
                                    setBookings(prev => prev.filter(b => b.id !== booking.id));
                                    toast({ title: "Booking deleted" });
                                    logAdminAction("delete", "booking", booking.id, { customer_name: booking.customer_name });
                                  }}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-display font-semibold uppercase tracking-wider bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                                >
                                  <Trash2 className="w-3 h-3" /> Delete
                                </button>
                              </div>

                              {/* ID Verification Review — legacy photo flow OR Stripe-Identity manual review */}
                              {(booking.id_photo_url || booking.verification_status === "pending_admin_review") && (
                                <div className="mt-3 border-t border-border/30 pt-3 space-y-2">
                                  <p className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
                                    <ShieldCheck className="w-3 h-3" /> ID Verification
                                  </p>
                                  {booking.id_photo_url ? (
                                    <IdPhotoViewer photoPath={booking.id_photo_url} />
                                  ) : (
                                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                                      Stripe Identity — flagged for{" "}
                                      <span className="text-foreground font-semibold">manual review</span>{" "}
                                      (DOB unreadable or report fetch failed). No photo on file; decide from the
                                      customer&apos;s Stripe Identity session.
                                    </p>
                                  )}
                                  <div className="flex gap-2">
                                    <button
                                      onClick={async () => {
                                        const { error } = await (supabase as any).rpc("admin_set_booking_id_verification", {
                                          p_booking_id: booking.id,
                                          p_decision: "approved",
                                        });
                                        if (error) {
                                          toast({ title: "Approval failed", description: error.message, variant: "destructive" });
                                          return;
                                        }
                                        setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, id_verified: "approved", verification_status: "approved" } : b));
                                        toast({ title: "ID Approved", description: `${booking.customer_name}'s ID has been approved.` });
                                        supabase.functions.invoke("send-transactional-email", {
                                          body: {
                                            templateName: "id-verification-result",
                                            recipientEmail: booking.customer_email,
                                            idempotencyKey: `id-verified-${booking.id}`,
                                            templateData: {
                                              customerName: booking.customer_name,
                                              roomTitle: booking.room_title,
                                              bookingDate: booking.booking_date,
                                              bookingTime: booking.booking_time,
                                              status: "approved",
                                            },
                                          },
                                        });
                                      }}
                                      disabled={booking.id_verified === "approved" || booking.verification_status === "approved"}
                                      className="flex-1 py-1.5 rounded-md text-[10px] font-display font-semibold uppercase tracking-wider bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={async () => {
                                        const { error } = await (supabase as any).rpc("admin_set_booking_id_verification", {
                                          p_booking_id: booking.id,
                                          p_decision: "rejected",
                                        });
                                        if (error) {
                                          toast({ title: "Rejection failed", description: error.message, variant: "destructive" });
                                          return;
                                        }
                                        setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, id_verified: "rejected", verification_status: "rejected" } : b));
                                        toast({ title: "ID Rejected", description: `${booking.customer_name}'s ID has been rejected.` });
                                        supabase.functions.invoke("send-transactional-email", {
                                          body: {
                                            templateName: "id-verification-result",
                                            recipientEmail: booking.customer_email,
                                            idempotencyKey: `id-rejected-${booking.id}`,
                                            templateData: {
                                              customerName: booking.customer_name,
                                              roomTitle: booking.room_title,
                                              bookingDate: booking.booking_date,
                                              bookingTime: booking.booking_time,
                                              status: "rejected",
                                              reason: "Your ID could not be verified. Please contact us for assistance.",
                                            },
                                          },
                                        });
                                      }}
                                      disabled={booking.id_verified === "rejected" || booking.verification_status === "rejected"}
                                      className="flex-1 py-1.5 rounded-md text-[10px] font-display font-semibold uppercase tracking-wider bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Consent Agreement */}
                              <div className="mt-3 border-t border-border/30 pt-3">
                                <Suspense fallback={null}>
                                <AdminConsentViewer
                                  bookingId={booking.id}
                                  customerName={booking.customer_name}
                                  customerEmail={booking.customer_email}
                                  roomTitle={booking.room_title}
                                  bookingDate={booking.booking_date}
                                  bookingTime={booking.booking_time}
                                  consentSignaturePath={(booking as any).consent_signature_path || null}
                                  consentSignedAt={(booking as any).consent_signed_at || null}
                                  consentSignerName={(booking as any).consent_signer_name || null}
                                />
                                </Suspense>
                              </div>

                              {/* Invited Guest Consents */}
                              <div className="mt-3 border-t border-border/30 pt-3">
                                <Suspense fallback={null}>
                                <AdminGuestConsentList
                                  bookingId={booking.id}
                                  roomTitle={booking.room_title}
                                  bookingDate={booking.booking_date}
                                  bookingTime={booking.booking_time}
                                />
                                </Suspense>
                              </div>
                            </>
                          )}
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}

                {filteredBookings.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm font-body py-8">
                    No bookings found.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === "calendar" && (
            <Suspense fallback={<AdminFallback />}>
              <AdminCalendarView bookings={bookings} blockedDates={blockedDates} />
            </Suspense>
          )}

          {activeTab === "blocked" && (
            <Suspense fallback={<AdminFallback />}>
              <AdminBlockedDates blockedDates={blockedDates} onRefresh={loadBlockedDates} />
            </Suspense>
          )}


          {activeTab === "equipment" && (
            <Suspense fallback={<AdminFallback />}>
              <AdminEquipmentInventory bookings={bookings} />
            </Suspense>
          )}

          {activeTab === "rentals" && (
            <Suspense fallback={<AdminFallback />}>
              <AdminRentalOrders />
            </Suspense>
          )}

          {activeTab === "checkin" && (
            <div className="space-y-6">
              <Suspense fallback={<AdminFallback />}>
                <AdminCheckIn
                  initialBookingId={pendingCheckinBookingId}
                  onInitialBookingConsumed={() => setPendingCheckinBookingId(null)}
                />
                <AdminCheckInHistory />
              </Suspense>
            </div>
          )}

          {activeTab === "mixes" && (
            <div className="space-y-6">
              {/* Upload new mix */}
              <div className="card-premium p-4 space-y-4">
                <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
                  Upload Mix for User
                </h3>

                {/* Select user */}
                <div>
                  <label className="text-[10px] font-display uppercase tracking-wider text-muted-foreground mb-1 block">
                    Assign to User
                  </label>
                  <select
                    value={mixUserId}
                    onChange={(e) => setMixUserId(e.target.value)}
                    className="w-full bg-card border border-border text-foreground rounded-md px-3 py-2 text-xs font-body focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Select a user...</option>
                    {allProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name || "Unnamed"} — {p.id.slice(0, 8)}…
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  type="text"
                  placeholder="Mix title *"
                  value={mixTitle}
                  onChange={(e) => setMixTitle(e.target.value)}
                  className="w-full bg-card border border-border text-foreground rounded-md px-3 py-2 text-xs font-body focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={mixDescription}
                  onChange={(e) => setMixDescription(e.target.value)}
                  className="w-full bg-card border border-border text-foreground rounded-md px-3 py-2 text-xs font-body focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  type="email"
                  placeholder="User's email (for notification)"
                  value={mixRecipientEmail}
                  onChange={(e) => setMixRecipientEmail(e.target.value)}
                  className="w-full bg-card border border-border text-foreground rounded-md px-3 py-2 text-xs font-body focus:outline-none focus:ring-1 focus:ring-ring"
                />

                <div>
                  <label className="text-[10px] font-display uppercase tracking-wider text-muted-foreground mb-1 block">
                    Audio File
                  </label>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setAudioDragOver(true); }}
                    onDragLeave={() => setAudioDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setAudioDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file && file.type.startsWith("audio/")) {
                        setMixFile(file);
                        if (mixFileRef.current) mixFileRef.current.value = "";
                      }
                    }}
                    onClick={() => !mixFile && mixFileRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-md p-4 text-center transition-colors cursor-pointer ${
                      audioDragOver
                        ? "border-primary bg-primary/10"
                        : mixFile
                        ? "border-border"
                        : "border-muted-foreground/30 hover:border-muted-foreground/50"
                    }`}
                  >
                    <input
                      ref={mixFileRef}
                      type="file"
                      accept="audio/*"
                      onChange={(e) => setMixFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    {mixFile ? (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md bg-primary/20 flex items-center justify-center shrink-0">
                          <Music className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-xs font-display text-foreground truncate">{mixFile.name}</p>
                          <p className="text-[10px] text-muted-foreground">{(mixFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMixFile(null);
                            if (mixFileRef.current) mixFileRef.current.value = "";
                          }}
                          className="w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs hover:opacity-80 shrink-0"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div className="py-2">
                        <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                        <p className="text-xs text-muted-foreground font-body">
                          Drag & drop or <span className="text-primary underline">browse</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Auto-compress progress */}
                {mixFile && !mixStreamingFile && (
                  <div className="rounded-md border border-border/50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-display uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Music className="w-3 h-3" />
                        Compressing to 128kbps MP3
                      </span>
                      <span className="text-[10px] font-display text-muted-foreground">
                        {isTranscoding
                          ? `${transcodeProgress}%`
                          : transcodedMp3
                            ? `✓ ${(transcodedMp3.size / 1024 / 1024).toFixed(1)} MB`
                            : transcodeError
                              ? "⚠ Failed"
                              : ""}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          transcodeError ? "bg-destructive" : "bg-primary"
                        }`}
                        style={{ width: `${transcodedMp3 ? 100 : transcodeProgress}%` }}
                      />
                    </div>
                    {transcodeError && (
                      <p className="text-[10px] text-destructive font-body">
                        {transcodeError} — you can still upload without a streaming version.
                      </p>
                    )}
                    {transcodedMp3 && (
                      <p className="text-[10px] text-muted-foreground font-body">
                        MP3 streaming version ready — will be uploaded automatically.
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-display uppercase tracking-wider text-muted-foreground mb-1 block">
                    Cover Art (optional)
                  </label>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setCoverArtDragOver(true); }}
                    onDragLeave={() => setCoverArtDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setCoverArtDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file && file.type.startsWith("image/")) {
                        setMixCoverArt(file);
                        if (mixCoverArtRef.current) mixCoverArtRef.current.value = "";
                      }
                    }}
                    onClick={() => !mixCoverArt && mixCoverArtRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-md p-4 text-center transition-colors cursor-pointer ${
                      coverArtDragOver
                        ? "border-primary bg-primary/10"
                        : mixCoverArt
                        ? "border-border"
                        : "border-muted-foreground/30 hover:border-muted-foreground/50"
                    }`}
                  >
                    <input
                      ref={mixCoverArtRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => setMixCoverArt(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    {mixCoverArt ? (
                      <div className="flex items-center gap-3">
                        <img
                          src={URL.createObjectURL(mixCoverArt)}
                          alt="Cover art preview"
                          className="w-16 h-16 rounded-md object-cover border border-border"
                        />
                        <div className="flex-1 text-left">
                          <p className="text-xs font-display text-foreground truncate">{mixCoverArt.name}</p>
                          <p className="text-[10px] text-muted-foreground">{(mixCoverArt.size / 1024).toFixed(0)} KB</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMixCoverArt(null);
                            if (mixCoverArtRef.current) mixCoverArtRef.current.value = "";
                          }}
                          className="w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs hover:opacity-80 shrink-0"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div className="py-2">
                        <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                        <p className="text-xs text-muted-foreground font-body">
                          Drag & drop or <span className="text-primary underline">browse</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-display uppercase tracking-wider text-muted-foreground mb-1 block">
                    Streaming File Override — MP3/AAC (optional, overrides auto-transcode)
                  </label>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setStreamingDragOver(true); }}
                    onDragLeave={() => setStreamingDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setStreamingDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file && file.type.startsWith("audio/")) {
                        setMixStreamingFile(file);
                        if (mixStreamingFileRef.current) mixStreamingFileRef.current.value = "";
                      }
                    }}
                    onClick={() => !mixStreamingFile && mixStreamingFileRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-md p-4 text-center transition-colors cursor-pointer ${
                      streamingDragOver
                        ? "border-primary bg-primary/10"
                        : mixStreamingFile
                        ? "border-border"
                        : "border-muted-foreground/30 hover:border-muted-foreground/50"
                    }`}
                  >
                    <input
                      ref={mixStreamingFileRef}
                      type="file"
                      accept=".mp3,.m4a,.aac,.ogg,audio/mpeg,audio/mp4,audio/aac,audio/ogg"
                      onChange={(e) => setMixStreamingFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    {mixStreamingFile ? (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md bg-green-500/20 flex items-center justify-center shrink-0">
                          <Music className="w-5 h-5 text-green-400" />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-xs font-display text-foreground truncate">{mixStreamingFile.name}</p>
                          <p className="text-[10px] text-muted-foreground">{(mixStreamingFile.size / (1024 * 1024)).toFixed(1)} MB • Streaming version</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMixStreamingFile(null);
                            if (mixStreamingFileRef.current) mixStreamingFileRef.current.value = "";
                          }}
                          className="w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs hover:opacity-80 shrink-0"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div className="py-2">
                        <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                        <p className="text-xs text-muted-foreground font-body">
                          Upload compressed MP3/AAC for <span className="text-primary">faster streaming</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {mixUploading && (
                  <div className="space-y-3 p-3 rounded-md bg-muted/50 border border-border">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="flex items-center gap-1.5">
                          <Music className="w-3 h-3" />
                          Audio file
                        </span>
                        <span className={uploadStage === "audio" ? "text-primary" : "text-muted-foreground"}>
                          {uploadStage === "audio" ? `${audioUploadProgress}%` : audioUploadProgress === 100 ? "✓ Done" : "Pending"}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-300"
                          style={{ width: `${audioUploadProgress}%` }}
                        />
                      </div>
                    </div>
                    {mixCoverArt && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className="flex items-center gap-1.5">
                            <Upload className="w-3 h-3" />
                            Cover art
                          </span>
                          <span className={uploadStage === "cover" ? "text-primary" : "text-muted-foreground"}>
                            {uploadStage === "cover" ? `${coverArtUploadProgress}%` : coverArtUploadProgress === 100 ? "✓ Done" : "Pending"}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{ width: `${coverArtUploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {mixStreamingFile && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className="flex items-center gap-1.5">
                            <Music className="w-3 h-3" />
                            Streaming file
                          </span>
                          <span className={(uploadStage as string) === "streaming" ? "text-primary" : "text-muted-foreground"}>
                            {(uploadStage as string) === "streaming" ? `${streamingUploadProgress}%` : streamingUploadProgress === 100 ? "✓ Done" : "Pending"}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{ width: `${streamingUploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {uploadStage === "saving" && (
                      <p className="text-xs text-muted-foreground text-center animate-pulse">Saving mix data…</p>
                    )}
                  </div>
                )}

                <button
                  onClick={handleUploadMix}
                  disabled={mixUploading || !mixUserId || !mixTitle || !mixFile}
                  className="w-full bg-primary text-primary-foreground font-display text-sm font-semibold uppercase tracking-wider py-2.5 rounded-md hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {mixUploading ? "Uploading..." : "Upload Mix"}
                </button>
              </div>

              {/* Mixes list */}
              <div className="card-premium p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
                    All Mixes ({mixes.length})
                  </h3>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by title or user..."
                    value={mixSearchQuery}
                    onChange={(e) => setMixSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-card border border-border text-foreground rounded-md text-xs font-body focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="space-y-2">
                  {mixes
                    .filter(m =>
                      !mixSearchQuery ||
                      m.title.toLowerCase().includes(mixSearchQuery.toLowerCase()) ||
                      m.user_id.toLowerCase().includes(mixSearchQuery.toLowerCase())
                    )
                    .map((mix) => (
                    <div
                      key={mix.id}
                      className="p-3 bg-card rounded-md border border-border/30 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Music className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="font-display text-sm font-semibold text-foreground truncate">
                              {mix.title}
                            </span>
                            <MixStatusBadge status={mix.status} />
                            {mix.uploaded_by_role === "user" && (
                              <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-display">self-upload</span>
                            )}
                            {mix.mix_analysis && (
                              <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-display">report ✓</span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground font-body mt-0.5 truncate">
                            {allProfiles.find(p => p.id === mix.user_id)?.display_name || mix.user_id.slice(0, 8) + "…"} • {new Date(mix.created_at).toLocaleDateString()}
                          </p>
                          {mix.description && (
                            <p className="text-[10px] text-muted-foreground/70 font-body truncate">{mix.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          {mix.file_url && (
                            <a
                              href={mix.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80 text-xs font-display"
                            >
                              Play
                            </a>
                          )}
                          <button
                            onClick={() => handleDeleteMix(mix.id)}
                            className="text-destructive hover:text-destructive/80 transition-colors"
                            title="Delete mix"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Admin review controls */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={mix.status || "pending_review"}
                          onChange={(e) => handleSetMixStatus(mix.id, e.target.value)}
                          className="bg-background border border-border text-foreground rounded-md text-[11px] font-body px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {MIX_STATUSES.map((s) => (
                            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleSetMixStatus(mix.id, "approved")}
                          className="text-[11px] font-display uppercase tracking-wider px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleSetMixStatus(mix.id, "rejected")}
                          className="text-[11px] font-display uppercase tracking-wider px-2 py-1 rounded-md bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25 transition-colors"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleAnalyzeMix(mix.id)}
                          className="text-[11px] font-display uppercase tracking-wider px-2 py-1 rounded-md bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors"
                        >
                          {mix.mix_analysis ? "Re-analyze" : "Analyze"}
                        </button>
                      </div>

                      <input
                        type="text"
                        defaultValue={mix.admin_notes || ""}
                        placeholder="Admin notes…"
                        onBlur={(e) => {
                          if ((e.target.value || "") !== (mix.admin_notes || "")) {
                            handleSaveMixAdminNotes(mix.id, e.target.value);
                          }
                        }}
                        className="w-full bg-background border border-border text-foreground rounded-md text-[11px] font-body px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  ))}
                  {mixes.length === 0 && (
                    <p className="text-center text-muted-foreground text-sm font-body py-6">
                      No mixes uploaded yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "talent" && (
            <Suspense fallback={<AdminFallback />}>
              <AdminTalentManager />
            </Suspense>
          )}

          {activeTab === "events" && (
            <Suspense fallback={<AdminFallback />}>
              <AdminEventsManager />
            </Suspense>
          )}

          {activeTab === "roster" && (
            <div className="space-y-4">
              {/* Filter */}
              <div className="flex gap-2">
                {["all", "pending", "approved", "rejected"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setRosterFilter(f)}
                    className={`px-3 py-1.5 rounded-md text-xs font-display uppercase tracking-wider transition-all ${
                      rosterFilter === f
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground bg-card"
                    }`}
                  >
                    {f} {f !== "all" && `(${rosterSubmissions.filter(s => s.status === f).length})`}
                    {f === "all" && `(${rosterSubmissions.length})`}
                  </button>
                ))}
              </div>

              {/* Submissions list */}
              <div className="space-y-3">
                {rosterSubmissions
                  .filter(s => rosterFilter === "all" || s.status === rosterFilter)
                  .map((sub) => (
                  <div key={sub.id} className="card-premium p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-display text-sm font-bold text-foreground">{sub.dj_name}</h4>
                          <span className={`text-[9px] font-display uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                            sub.status === "approved" ? "bg-green-500/10 text-green-400" :
                            sub.status === "rejected" ? "bg-destructive/10 text-destructive" :
                            "bg-yellow-500/10 text-yellow-400"
                          }`}>
                            {sub.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground font-body mt-0.5">
                          {sub.email} • {sub.city || "No city"} • {new Date(sub.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {sub.status === "pending" && (
                        <div className="flex gap-1.5 ml-2 shrink-0">
                          <button
                            onClick={() => updateSubmissionStatus(sub.id, "approved")}
                            className="p-1.5 rounded-md bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                            title="Approve"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => updateSubmissionStatus(sub.id, "rejected")}
                            className="p-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                            title="Reject"
                          >
                            <XIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {sub.genre && (
                      <p className="text-xs text-muted-foreground"><span className="text-foreground font-medium">Genre:</span> {sub.genre}</p>
                    )}
                    {sub.bio && (
                      <p className="text-xs text-muted-foreground italic">{sub.bio}</p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {sub.mix_link && (
                        <a href={sub.mix_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-display uppercase tracking-wider px-2 py-1 rounded-md bg-card border border-border/30 text-muted-foreground hover:text-foreground transition-colors">
                          <Music className="w-3 h-3" /> Mix
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                      {sub.instagram && (
                        <a href={sub.instagram.startsWith("http") ? sub.instagram : `https://instagram.com/${sub.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-display uppercase tracking-wider px-2 py-1 rounded-md bg-card border border-border/30 text-muted-foreground hover:text-foreground transition-colors">
                          IG <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                      {sub.soundcloud && (
                        <a href={sub.soundcloud} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-display uppercase tracking-wider px-2 py-1 rounded-md bg-card border border-border/30 text-muted-foreground hover:text-foreground transition-colors">
                          SC <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                      {sub.spotify && (
                        <a href={sub.spotify} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-display uppercase tracking-wider px-2 py-1 rounded-md bg-card border border-border/30 text-muted-foreground hover:text-foreground transition-colors">
                          Spotify <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                      {sub.press_photo_url && (
                        <RosterPhotoLink value={sub.press_photo_url} label="Photo" />
                      )}
                      {sub.logo_url && (
                        <RosterPhotoLink value={sub.logo_url} label="Logo" />
                      )}
                    </div>
                  </div>
                ))}
                {rosterSubmissions.filter(s => rosterFilter === "all" || s.status === rosterFilter).length === 0 && (
                  <p className="text-center text-muted-foreground text-sm font-body py-8">
                    No {rosterFilter === "all" ? "" : rosterFilter} submissions yet.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === "giftcards" && (
            <div className="space-y-6">
              {/* Issue new gift card */}
              <div className="card-premium p-4 space-y-4">
                <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
                  Issue Free Gift Card
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {[2500, 5000, 10000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setGcAmount(amt)}
                      className={`py-2 rounded-md text-sm font-display font-bold transition-all ${
                        gcAmount === amt
                          ? "bg-primary text-primary-foreground"
                          : "bg-card border border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      ${amt / 100}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Recipient name"
                    value={gcRecipientName}
                    onChange={(e) => setGcRecipientName(e.target.value)}
                    className="bg-card border border-border text-foreground rounded-md px-3 py-2 text-xs font-body focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="email"
                    placeholder="Recipient email"
                    value={gcRecipientEmail}
                    onChange={(e) => setGcRecipientEmail(e.target.value)}
                    className="bg-card border border-border text-foreground rounded-md px-3 py-2 text-xs font-body focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Personal message (optional)"
                  value={gcMessage}
                  onChange={(e) => setGcMessage(e.target.value)}
                  className="w-full bg-card border border-border text-foreground rounded-md px-3 py-2 text-xs font-body focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  onClick={issueGiftCard}
                  disabled={gcIssuing}
                  className="w-full bg-primary text-primary-foreground font-display text-sm font-semibold uppercase tracking-wider py-2.5 rounded-md hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  <Gift className="w-4 h-4" />
                  {gcIssuing ? "Issuing..." : `Issue $${(gcAmount / 100).toFixed(0)} Gift Card`}
                </button>
              </div>

              {/* Gift cards list */}
              <div className="card-premium p-4 space-y-3">
                <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
                  All Gift Cards ({giftCards.length})
                </h3>
                <div className="space-y-2">
                  {giftCards.map((gc) => (
                    <div
                      key={gc.id}
                      className="flex items-center justify-between p-3 bg-card rounded-md border border-border/30"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-foreground">{gc.code}</span>
                          {gc.issued_by_admin && (
                            <span className="text-[9px] font-display uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                              Admin
                            </span>
                          )}
                          <span
                            className={`text-[9px] font-display uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                              gc.payment_status === "paid"
                                ? "bg-green-500/10 text-green-400"
                                : "bg-yellow-500/10 text-yellow-400"
                            }`}
                          >
                            {gc.payment_status}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground font-body mt-0.5 truncate">
                          {gc.recipient_email || gc.recipient_name || "No recipient"} •{" "}
                          {new Date(gc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right ml-2">
                        <p className="font-display text-sm font-bold text-foreground">
                          ${(gc.amount_cents / 100).toFixed(0)}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-body">
                          bal: ${(gc.balance_cents / 100).toFixed(0)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {giftCards.length === 0 && (
                    <p className="text-center text-muted-foreground text-sm font-body py-6">
                      No gift cards yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "links" && <LinksTabContent />}

          {activeTab === "locks" && (
            <Suspense fallback={<AdminFallback />}>
              <AdminSlotLocks />
            </Suspense>
          )}

          {activeTab === "webhooks" && (
            <Suspense fallback={<AdminFallback />}>
              <div className="space-y-6">
                <AdminWebhookDiagnostics />
                <AdminWebhookEvents />
              </div>
            </Suspense>
          )}

          {activeTab === "users" && (
            <Suspense fallback={<AdminFallback />}>
              <AdminImpersonate />
            </Suspense>
          )}

          {activeTab === "refunds" && (
            <Suspense fallback={<AdminFallback />}>
              <AdminRefundRequests />
            </Suspense>
          )}

          {activeTab === "disputes" && (
            <Suspense fallback={<AdminFallback />}>
              <AdminDisputes />
            </Suspense>
          )}

          {activeTab === "bounces" && (
            <Suspense fallback={<AdminFallback />}>
              <AdminBounces />
            </Suspense>
          )}

          {activeTab === "errors" && (
            <Suspense fallback={<AdminFallback />}>
              <div className="space-y-6">
                <AdminErrorBudget />
                <AdminSlowQueries />
              </div>
            </Suspense>
          )}

          {activeTab === "audit" && (
            <Suspense fallback={<AdminFallback />}>
              <AdminAuditLogViewer />
            </Suspense>
          )}

          {activeTab === "screening" && (
            <Suspense fallback={<AdminFallback />}>
              <AdminScreeningQueue />
            </Suspense>
          )}

          {activeTab === "settings" && (
            <Suspense fallback={<AdminFallback />}>
              <div className="space-y-10">
                <section className="space-y-3">
                  <h2 className="font-display text-lg font-bold text-foreground">Analytics Display</h2>
                  <AdminVisionModePanel />
                </section>
                <AdminGeneralSettingsPanel />
                <div className="border-t border-border/30 pt-8">
                  <h2 className="font-display text-lg font-bold text-foreground mb-4">Booking Policies</h2>
                  <AdminBookingPoliciesPanel />
                </div>
                <div className="border-t border-border/30 pt-8">
                  <h2 className="font-display text-lg font-bold text-foreground mb-4">Booking Density</h2>
                  <BookingDensitySettingsPanel />
                </div>
              </div>
            </Suspense>
          )}

          {activeTab === "studios" && (
            <Suspense fallback={<AdminFallback />}>
              <SiteContentHub />
            </Suspense>
          )}
        </motion.div>
      </div>
    </AdminShell>
  );
};

export default AdminDashboard;
