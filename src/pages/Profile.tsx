import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom"; 
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Camera, LogOut, Music, Calendar, User, Download, X, Gift, MapPin, Clock, ChevronDown, ChevronUp, ExternalLink, Info, Mail, BarChart3, CalendarClock, AlertTriangle, Bell, Trash2, Award, FileText, Trophy, Star, Target, Play, Pause, SkipBack, SkipForward, Volume2, Maximize2, Minimize2, Loader2, Ticket as TicketIcon } from "lucide-react";
import { ListMusic, Plus, Check } from "lucide-react";
import { Sparkles } from "lucide-react";
import logo from "@/assets/logo.png";
import { usePublicSiteSettings, BOOKING_POLICY_DEFAULTS } from "@/hooks/useSiteSettings";


import BookingCountdownBanner from "@/components/BookingCountdownBanner";
// ReferralProgram intentionally not imported — referral UI hidden for launch
// (redemption engine not built; see system/TODO.md). Re-add when redemption ships.
import MixReportCard from "@/components/MixReportCard";
import SoundDNA from "@/components/SoundDNA";
import MixLineageTree from "@/components/MixLineageTree";
import UploadMixDialog from "@/components/UploadMixDialog";
import MixStatusBadge from "@/components/MixStatusBadge";
import TrackRecognitionPanel from "@/components/TrackRecognitionPanel";
import TicketPass, { type TicketPassData } from "@/components/TicketPass";
import SessionRecordBadge from "@/components/SessionRecordBadge";
import ReminderPreferences from "@/components/ReminderPreferences";
import { computeTier } from "@/hooks/useUserTier";
import { RefundRequestDialog } from "@/components/RefundRequestDialog";
import { AddToCalendarButton } from "@/components/AddToCalendarButton";
import { AccountDeletionPanel } from "@/components/AccountDeletionPanel";

const NotificationBell = lazy(() => import("@/components/NotificationBell"));

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

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
  layout: string | null;
  sound: string | null;
  lighting: string | null;
  equipment: any;
  created_at: string;
}

type WaveformPoint = {
  peak: number;
  bass: number;
  mid: number;
  high: number;
};

interface Mix {
  id: string;
  title: string;
  description: string | null;
  file_url: string | null;
  cover_art_url: string | null;
  streaming_url: string | null;
  waveform_data: WaveformPoint[] | null;
  duration_seconds: number | null;
  recorded_at: string | null;
  expires_at: string | null;
  created_at: string;
  mix_analysis: any | null;
  tracklist: { title: string; artist: string }[] | null;
  status?: string | null;
  user_notes?: string | null;
  admin_notes?: string | null;
  uploaded_by_role?: string | null;
  uploaded_by_user_id?: string | null;
  updated_at?: string | null;
}

interface WaitlistEntry {
  id: string;
  room_title: string;
  booking_date: string;
  booking_time: string;
  notified: boolean;
  created_at: string;
}

const waveformMemoryCache = new Map<string, WaveformPoint[]>();
const waveformJobs = new Map<string, Promise<WaveformPoint[]>>();
const waveformPersistedMixes = new Set<string>();
const waveformServerRequests = new Set<string>();
const waveformProgressStore = new Map<string, { progress: number; label: string }>();
const waveformProgressListeners = new Map<
  string,
  Set<(state: { progress: number; label: string }) => void>
>();

// Cache signed URLs in-memory so re-renders / re-opening cards is instant.
// Signed URLs are valid 2h; cache for 110 min to leave a safety margin.
type SignedBundle = {
  streamingUrl: string | null;
  downloadUrl: string | null;
  coverUrl: string | null;
  hasStreaming: boolean;
  expiresAt: number;
};
const signedUrlCache = new Map<string, SignedBundle>();
const signedUrlJobs = new Map<string, Promise<SignedBundle | null>>();
const SIGNED_URL_TTL_MS = 110 * 60 * 1000;

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const getAudioMimeType = (path: string | null) => {
  const normalizedPath = path?.split("?")[0].toLowerCase() ?? "";

  if (normalizedPath.endsWith(".wav") || normalizedPath.endsWith(".wave")) return "audio/wav";
  if (normalizedPath.endsWith(".mp3")) return "audio/mpeg";
  if (normalizedPath.endsWith(".m4a")) return "audio/mp4";
  if (normalizedPath.endsWith(".aac")) return "audio/aac";
  if (normalizedPath.endsWith(".ogg")) return "audio/ogg";

  return undefined;
};

const getWaveformCacheKey = (mixId: string, audioSrc: string) => `${mixId}:${audioSrc}`;

const publishWaveformProgress = (cacheKey: string, state: { progress: number; label: string }) => {
  waveformProgressStore.set(cacheKey, state);
  waveformProgressListeners.get(cacheKey)?.forEach((listener) => listener(state));
};

const subscribeToWaveformProgress = (
  cacheKey: string,
  listener: (state: { progress: number; label: string }) => void,
) => {
  const listeners = waveformProgressListeners.get(cacheKey) ?? new Set();
  listeners.add(listener);
  waveformProgressListeners.set(cacheKey, listeners);

  const currentState = waveformProgressStore.get(cacheKey);
  if (currentState) {
    listener(currentState);
  }

  return () => {
    const activeListeners = waveformProgressListeners.get(cacheKey);
    if (!activeListeners) return;
    activeListeners.delete(listener);
    if (activeListeners.size === 0) {
      waveformProgressListeners.delete(cacheKey);
    }
  };
};

const analyzeWaveform = (decoded: AudioBuffer) => {
  const raw = decoded.getChannelData(0);
  const bars = 120;
  const blockSize = Math.max(1, Math.floor(raw.length / bars));
  const spectrumData: WaveformPoint[] = [];

  for (let i = 0; i < bars; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, raw.length);
    const len = Math.max(1, end - start);

    let bassEnergy = 0;
    let midEnergy = 0;
    let highEnergy = 0;
    let totalEnergy = 0;

    for (let j = 0; j < len; j++) {
      totalEnergy += Math.abs(raw[start + j] || 0);
    }

    let prevSample = raw[start] || 0;
    let diffSum = 0;
    for (let j = 1; j < len; j++) {
      const sample = raw[start + j] || 0;
      diffSum += Math.abs(sample - prevSample);
      prevSample = sample;
    }
    const avgDiff = len > 1 ? diffSum / (len - 1) : 0;

    for (let j = 2; j < len; j++) {
      const sample = Math.abs(raw[start + j] || 0);
      const localDiff = Math.abs((raw[start + j] || 0) - (raw[start + j - 1] || 0));
      const localDiff2 = Math.abs((raw[start + j - 1] || 0) - (raw[start + j - 2] || 0));
      const changeRate = (localDiff + localDiff2) / 2;

      if (changeRate < avgDiff * 0.6) {
        bassEnergy += sample;
      } else if (changeRate < avgDiff * 1.4) {
        midEnergy += sample;
      } else {
        highEnergy += sample;
      }
    }

    spectrumData.push({
      bass: bassEnergy / len,
      mid: midEnergy / len,
      high: highEnergy / len,
      peak: totalEnergy / len,
    });
  }

  const maxPeak = Math.max(...spectrumData.map((d) => d.peak), 0.001);
  const maxBass = Math.max(...spectrumData.map((d) => d.bass), 0.001);
  const maxMid = Math.max(...spectrumData.map((d) => d.mid), 0.001);
  const maxHigh = Math.max(...spectrumData.map((d) => d.high), 0.001);

  return spectrumData.map((d) => ({
    peak: Math.round((d.peak / maxPeak) * 1000) / 1000,
    bass: Math.round((d.bass / maxBass) * 1000) / 1000,
    mid: Math.round((d.mid / maxMid) * 1000) / 1000,
    high: Math.round((d.high / maxHigh) * 1000) / 1000,
  }));
};

const loadWaveformData = async (cacheKey: string, audioSrc: string) => {
  const cachedWaveform = waveformMemoryCache.get(cacheKey);
  if (cachedWaveform) {
    publishWaveformProgress(cacheKey, { progress: 100, label: "Ready" });
    return cachedWaveform;
  }

  const activeJob = waveformJobs.get(cacheKey);
  if (activeJob) {
    return activeJob;
  }

  const waveformJob = (async () => {
    const actx = new (window.AudioContext || (window as any).webkitAudioContext)();

    try {
      publishWaveformProgress(cacheKey, { progress: 0, label: "Downloading…" });
      const response = await fetch(audioSrc);
      if (!response.ok) throw new Error("Failed to load audio for waveform");

      const contentLength = Number(response.headers.get("content-length") || 0);
      let buffer: ArrayBuffer;

      if (!contentLength || !response.body) {
        buffer = await response.arrayBuffer();
        publishWaveformProgress(cacheKey, { progress: 70, label: "Downloading…" });
      } else {
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          publishWaveformProgress(cacheKey, {
            progress: Math.round((received / contentLength) * 70),
            label: "Downloading…",
          });
        }

        const merged = new Uint8Array(received);
        let position = 0;
        for (const chunk of chunks) {
          merged.set(chunk, position);
          position += chunk.length;
        }
        buffer = merged.buffer;
      }

      publishWaveformProgress(cacheKey, { progress: 75, label: "Decoding…" });
      const decoded = await actx.decodeAudioData(buffer);

      publishWaveformProgress(cacheKey, { progress: 80, label: "Analyzing…" });
      const normalized = analyzeWaveform(decoded);
      waveformMemoryCache.set(cacheKey, normalized);
      publishWaveformProgress(cacheKey, { progress: 100, label: "Ready" });

      return normalized;
    } finally {
      waveformJobs.delete(cacheKey);
      void actx.close().catch(() => undefined);
    }
  })();

  waveformJobs.set(cacheKey, waveformJob);
  return waveformJob;
};

const Waveform = ({
  audioRef,
  audioSrc,
  mixId,
  cachedData,
  duration,
  currentTime,
  onSeek,
  hue = 0,
}: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  audioSrc: string | null;
  mixId: string;
  cachedData: WaveformPoint[] | null;
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  hue?: number;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformData = useRef<WaveformPoint[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const shouldSkipClientDecode = /\.wav($|\?)/i.test(audioSrc ?? "");

  useEffect(() => {
    if (!audioSrc) {
      waveformData.current = [];
      setLoaded(false);
      setProgress(0);
      setProgressLabel("");
      return;
    }

    const cacheKey = getWaveformCacheKey(mixId, audioSrc);

    if (cachedData && cachedData.length > 0) {
      waveformMemoryCache.set(cacheKey, cachedData);
      waveformPersistedMixes.add(mixId);
      waveformData.current = cachedData;
      setProgress(100);
      setProgressLabel("Ready");
      setLoaded(true);
      return;
    }

    let cancelled = false;
    setLoaded(false);
    setProgress(0);
    setProgressLabel("Processing waveform…");

    if (!waveformServerRequests.has(mixId)) {
      waveformServerRequests.add(mixId);
      void supabase.functions.invoke("generate-waveform", { body: { mix_id: mixId } })
        .then(({ error }) => {
          if (error) {
            waveformServerRequests.delete(mixId);
          }
        })
        .catch(() => {
          waveformServerRequests.delete(mixId);
        });
    }

    // Poll the database for server-generated waveform data before falling back to client-side decode
    const pollForWaveform = async (): Promise<WaveformPoint[] | null> => {
      for (let attempt = 0; attempt < 8; attempt++) {
        if (cancelled) return null;
        setProgress(Math.min(10 + attempt * 8, 60));
        setProgressLabel("Processing waveform…");
        await new Promise((r) => setTimeout(r, 2000));
        if (cancelled) return null;
        const { data } = await supabase
          .from("mixes")
          .select("waveform_data")
          .eq("id", mixId)
          .single();
        if (data?.waveform_data && Array.isArray(data.waveform_data) && data.waveform_data.length > 0) {
          return data.waveform_data as WaveformPoint[];
        }
      }
      return null;
    };

    const unsubscribe = subscribeToWaveformProgress(cacheKey, ({ progress, label }) => {
      if (cancelled) return;
      setProgress(progress);
      setProgressLabel(label);
    });

    // Try server-generated waveform first, then avoid expensive client decoding for large WAV files
    pollForWaveform()
      .then((serverData) => {
        if (cancelled) return null;
        if (serverData) {
          waveformMemoryCache.set(cacheKey, serverData);
          waveformPersistedMixes.add(mixId);
          waveformData.current = serverData;
          setProgress(100);
          setProgressLabel("Ready");
          setLoaded(true);
          return null;
        }
        if (shouldSkipClientDecode) {
          const placeholderWaveform = Array.from({ length: 120 }, () => ({
            peak: 0.12,
            bass: 0.1,
            mid: 0.08,
            high: 0.06,
          }));
          waveformData.current = placeholderWaveform;
          setProgress(100);
          setProgressLabel("Ready to play");
          setLoaded(true);
          return null;
        }
        // Fall back to client-side decode
        setProgressLabel("Downloading…");
        return loadWaveformData(cacheKey, audioSrc);
      })
      .then((normalized) => {
        if (cancelled || !normalized) return;
        waveformData.current = normalized;
        setProgress(100);
        setProgressLabel("Ready");
        setLoaded(true);

        if (!waveformPersistedMixes.has(mixId)) {
          waveformPersistedMixes.add(mixId);
          void supabase
            .from("mixes")
            .update({ waveform_data: normalized as any })
            .eq("id", mixId)
            .then(({ error }) => {
              if (error) {
                waveformPersistedMixes.delete(mixId);
              }
            });
        }
      })
      .catch(() => {
        if (cancelled) return;
        waveformData.current = [];
        setLoaded(false);
        setProgress(0);
        setProgressLabel("Waveform unavailable");
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [audioSrc, cachedData, mixId, shouldSkipClientDecode]);

  // Draw frequency spectrum waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loaded) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const data = waveformData.current;
    const barCount = data.length;
    const gap = 1;
    const barW = (w - gap * (barCount - 1)) / barCount;
    const progress = duration > 0 ? currentTime / duration : 0;

    const DIM_OPACITY = 0.25;

    ctx.clearRect(0, 0, w, h);

    // Pulse glow intensity using a sine wave synced to playback time
    const pulsePhase = currentTime * 2.5;
    const pulseGlow = 4 + Math.sin(pulsePhase * Math.PI * 2) * 3;

    ctx.shadowColor = `hsla(${hue}, 90%, 55%, 0.5)`;
    ctx.shadowBlur = 0;

    for (let i = 0; i < barCount; i++) {
      const d = data[i];
      const x = i * (barW + gap);
      const totalH = Math.max(3, d.peak * (h * 0.9));
      const barProgress = (i + 0.5) / barCount;
      const played = barProgress <= progress;
      const alpha = played ? 1 : DIM_OPACITY;

      const yStart = (h - totalH) / 2;

      if (played) {
        const proximity = 1 - Math.abs(barProgress - progress) * 3;
        const nearGlow = Math.max(0, proximity);
        ctx.shadowBlur = pulseGlow * (0.5 + nearGlow * 0.5);
        const glowHue = hue + Math.round(nearGlow * 25);
        ctx.shadowColor = `hsla(${glowHue}, 95%, 55%, ${0.4 + nearGlow * 0.3})`;
      } else {
        ctx.shadowBlur = 0;
      }

      const proximity = played ? Math.max(0, 1 - Math.abs(barProgress - progress) * 4) : 0;
      const hueShift = hue + proximity * 20;
      const grad = ctx.createLinearGradient(x, yStart, x, yStart + totalH);
      grad.addColorStop(0, `hsla(${hueShift}, 95%, 65%, ${alpha})`);
      grad.addColorStop(0.5, `hsla(${hueShift * 0.5 + hue * 0.5}, 90%, 55%, ${alpha})`);
      grad.addColorStop(1, `hsla(${hue}, 85%, 40%, ${alpha})`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, yStart, Math.max(1, barW), totalH, 1);
      ctx.fill();
    }

    // Reset shadow
    ctx.shadowBlur = 0;

    // Playhead line with glow
    if (progress > 0 && progress < 1) {
      const px = progress * w;
      ctx.strokeStyle = "hsl(0, 0%, 100%)";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "hsl(0, 0%, 100%)";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }, [currentTime, duration, loaded, hue]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !duration) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    onSeek(ratio * duration);
  };

  if (!loaded) {
    const stageIcon = progressLabel?.includes("Download") ? (
      <Download className="w-3.5 h-3.5 text-primary/70 animate-pulse" />
    ) : progressLabel?.includes("Decod") || progressLabel?.includes("Analyz") ? (
      <BarChart3 className="w-3.5 h-3.5 text-primary/70 animate-pulse" />
    ) : (
      <Music className="w-3.5 h-3.5 text-primary/70 animate-pulse" />
    );

    return (
      <div className="w-full h-16 rounded-md bg-muted/20 border border-border/30 flex flex-col items-center justify-center gap-2 px-4">
        <div className="flex items-center gap-2">
          {stageIcon}
          <span className="text-[11px] text-muted-foreground font-medium tracking-wide">
            {progressLabel || "Preparing your mix…"}
          </span>
          {progress > 0 && progress < 100 && (
            <span className="text-[10px] text-muted-foreground/50 tabular-nums">{progress}%</span>
          )}
        </div>
        <div className="w-full max-w-[200px] h-1.5 rounded-full bg-muted/40 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary"
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(progress, 2)}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className="w-full h-16 cursor-pointer rounded-md"
      style={{ touchAction: "none" }}
    />
  );
};

const MixCard = ({ mix }: { mix: Mix }) => {
  return <MixCardInner mix={mix} />;
};

// Tracklist sub-component
const MixTracklist = ({ mixId, initialTracklist, mixTitle, mixDescription, mixAnalysis }: {
  mixId: string;
  initialTracklist: { title: string; artist: string }[];
  mixTitle: string;
  mixDescription: string | null;
  mixAnalysis: any | null;
}) => {
  const { toast } = useToast();
  const [tracks, setTracks] = useState<{ title: string; artist: string }[]>(initialTracklist);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newArtist, setNewArtist] = useState("");
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const addTrack = () => {
    const t = newTitle.trim();
    const a = newArtist.trim();
    if (!t) return;
    setTracks((prev) => [...prev, { title: t, artist: a }]);
    setNewTitle("");
    setNewArtist("");
  };

  const removeTrack = (idx: number) => setTracks((prev) => prev.filter((_, i) => i !== idx));

  const aiDetectTracklist = async () => {
    setDetecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-mix", {
        body: { mix_id: mixId, mode: "tracklist" },
      });
      if (error) throw error;
      let resolved = data;
      if (data instanceof Blob) {
        const text = await data.text();
        try { resolved = JSON.parse(text); } catch { resolved = null; }
      }
      if (resolved?.tracklist && Array.isArray(resolved.tracklist)) {
        setTracks(resolved.tracklist);
        setEditing(true);
      } else {
        toast({ title: "AI couldn't detect tracks", description: "Try adding them manually.", variant: "destructive" });
      }
    } catch (err: any) {
      console.error("AI tracklist error:", err);
      toast({ title: "Detection failed", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setDetecting(false);
    }
  };

  const saveTracklist = async () => {
    setSaving(true);
    const { data, error } = await supabase
      .from("mixes")
      .update({ tracklist: tracks as any })
      .eq("id", mixId)
      .select("tracklist")
      .maybeSingle();
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save tracklist", description: error.message, variant: "destructive" });
      return; // keep the editor open so the edit isn't lost
    }
    // The DB trigger silently reverts tracklist edits once a mix is finalized
    // (report_ready / approved / rejected). Verify the write actually persisted.
    if (!data || JSON.stringify((data as any).tracklist ?? []) !== JSON.stringify(tracks)) {
      toast({
        title: "Tracklist can't be edited",
        description: "This mix is already finalized.",
        variant: "destructive",
      });
      return; // keep the editor open
    }
    toast({ title: "Tracklist saved" });
    setEditing(false);
  };

  return (
    <div className="mt-3 rounded-md border border-border bg-secondary/20 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-1.5">
          <ListMusic className="w-3.5 h-3.5 text-chrome" />
          <span className="text-[10px] font-display uppercase tracking-widest text-muted-foreground">
            Tracklist
          </span>
          {tracks.length > 0 && (
            <span className="text-[9px] text-muted-foreground/60 ml-1">({tracks.length})</span>
          )}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2">
              {tracks.length === 0 && !editing && (
                <div className="flex flex-col items-center gap-2 py-2">
                  <p className="text-muted-foreground/60 text-[10px] font-body text-center">
                    No tracks logged yet
                  </p>
                  <button
                    onClick={aiDetectTracklist}
                    disabled={detecting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-chrome/10 border border-chrome/20 text-chrome text-[10px] font-display uppercase tracking-widest hover:bg-chrome/20 transition-colors disabled:opacity-50"
                  >
                    {detecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {detecting ? "Detecting..." : "AI Detect Tracks"}
                  </button>
                </div>
              )}

              {tracks.map((track, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <span className="text-muted-foreground/40 text-[10px] font-mono w-4 text-right shrink-0">
                    {i + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-foreground/80 text-[11px] font-body truncate block">
                      {track.artist ? `${track.artist} — ${track.title}` : track.title}
                    </span>
                  </div>
                  {editing && (
                    <button
                      onClick={() => removeTrack(i)}
                      className="text-destructive/60 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}

              {editing && (
                <div className="flex items-end gap-1.5 pt-1">
                  <div className="flex-1 space-y-1">
                    <input
                      type="text"
                      placeholder="Track title"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addTrack()}
                      className="w-full bg-background border border-border rounded px-2 py-1 text-[11px] text-foreground font-body placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                    <input
                      type="text"
                      placeholder="Artist (optional)"
                      value={newArtist}
                      onChange={(e) => setNewArtist(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addTrack()}
                      className="w-full bg-background border border-border rounded px-2 py-1 text-[11px] text-foreground font-body placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  </div>
                  <button
                    onClick={addTrack}
                    disabled={!newTitle.trim()}
                    className="p-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-30"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                {!editing ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={aiDetectTracklist}
                      disabled={detecting}
                      className="text-[10px] font-display uppercase tracking-widest text-chrome hover:text-chrome/80 transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      {detecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      AI Detect
                    </button>
                    <button
                      onClick={() => setEditing(true)}
                      className="text-[10px] font-display uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      {tracks.length > 0 ? "Edit" : "Add Tracks"}
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => { setEditing(false); setTracks(initialTracklist); }}
                      className="text-[10px] font-display uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveTracklist}
                      disabled={saving}
                      className="text-[10px] font-display uppercase tracking-widest text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                    >
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Save
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Generate a deterministic hue (0-360) from a UUID string
const hueFromId = (id: string): number => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return ((hash % 360) + 360) % 360;
};

const MixCardInner = ({ mix }: { mix: Mix }) => {
  const mixHue = hueFromId(mix.id);
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCleanupRef = useRef<(() => void) | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [fullView, setFullView] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [signedCoverUrl, setSignedCoverUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState(false);
  const [urlVersion, setUrlVersion] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [loadingUrl, setLoadingUrl] = useState(!!mix.file_url);
  const [mixAnalysis, setMixAnalysis] = useState(mix.mix_analysis || null);
  const [signedDownloadUrl, setSignedDownloadUrl] = useState<string | null>(null);
  const seekingRef = useRef(false);
  const signedUrlRef = useRef<string | null>(null);
  const signedDownloadUrlRef = useRef<string | null>(null);
  const urlVersionRef = useRef(0);

  useEffect(() => {
    seekingRef.current = seeking;
  }, [seeking]);

  useEffect(() => {
    signedUrlRef.current = signedUrl;
  }, [signedUrl]);

  useEffect(() => {
    signedDownloadUrlRef.current = signedDownloadUrl;
  }, [signedDownloadUrl]);

  useEffect(() => {
    urlVersionRef.current = urlVersion;
  }, [urlVersion]);

  const cleanupAudio = useCallback((resetSource = true) => {
    audioCleanupRef.current?.();
    audioCleanupRef.current = null;

    const currentAudio = audioRef.current;
    if (!currentAudio) return;

    currentAudio.pause();
    if (resetSource) {
      currentAudio.removeAttribute("src");
      try {
        currentAudio.load();
      } catch {
        // noop
      }
    }
    audioRef.current = null;
  }, []);

  // Resolve signed URLs for private bucket — single bundled call + in-memory cache
  useEffect(() => {
    let cancelled = false;
    setAudioError(false);

    if (!mix.file_url) {
      setLoadingUrl(false);
      return;
    }

    // Cache hit → instant load, no network round-trip
    const cached = signedUrlCache.get(mix.id);
    if (cached && cached.expiresAt > Date.now() && urlVersion === 0) {
      setSignedUrl(cached.streamingUrl);
      setSignedDownloadUrl(cached.downloadUrl ?? cached.streamingUrl);
      setSignedCoverUrl(cached.coverUrl);
      setLoadingUrl(false);
      return;
    }

    setLoadingUrl(true);

    const fetchBundle = async (isRetry = false): Promise<SignedBundle | null> => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (!isRetry) {
            const { data: refreshData } = await supabase.auth.refreshSession();
            if (refreshData?.session) return fetchBundle(true);
          }
          console.error("[MixPlayer] No valid session");
          return null;
        }

        const { data, error } = await supabase.functions.invoke("get-mix-signed-url", {
          body: { mix_id: mix.id, type: "all" },
        });

        let resolved: any = data;
        if (data instanceof Blob) {
          const text = await data.text();
          try { resolved = JSON.parse(text); } catch { resolved = text; }
        }

        if (error) {
          const errorMsg = typeof error === "object" ? JSON.stringify(error) : String(error);
          if (!isRetry && (errorMsg.includes("401") || errorMsg.includes("Unauthorized"))) {
            await supabase.auth.refreshSession();
            return fetchBundle(true);
          }
          console.error("[MixPlayer] bundle error:", error);
          return null;
        }

        if (!resolved || typeof resolved !== "object" || !resolved.streaming_url) {
          console.error("[MixPlayer] invalid bundle response:", resolved);
          return null;
        }

        return {
          streamingUrl: resolved.streaming_url ?? null,
          downloadUrl: resolved.download_url ?? resolved.streaming_url ?? null,
          coverUrl: resolved.cover_url ?? null,
          hasStreaming: !!resolved.has_streaming,
          expiresAt: Date.now() + SIGNED_URL_TTL_MS,
        };
      } catch (err) {
        console.error("[MixPlayer] fetch threw:", err);
        return null;
      }
    };

    // De-dupe concurrent fetches for the same mix across remounts
    let job = signedUrlJobs.get(mix.id);
    if (!job || urlVersion > 0) {
      job = fetchBundle();
      signedUrlJobs.set(mix.id, job);
      job.finally(() => {
        if (signedUrlJobs.get(mix.id) === job) signedUrlJobs.delete(mix.id);
      });
    }

    const wasError = urlVersion > 0;
    job.then((bundle) => {
      if (cancelled) return;
      if (!bundle) {
        setLoadingUrl(false);
        setAudioError(true);
        return;
      }
      signedUrlCache.set(mix.id, bundle);
      setSignedUrl(bundle.streamingUrl);
      setSignedDownloadUrl(bundle.downloadUrl ?? bundle.streamingUrl);
      setSignedCoverUrl(bundle.coverUrl);
      setLoadingUrl(false);
      if (wasError) {
        toast({ title: "Mix loaded successfully", description: "Your mix is ready to play." });
      }
    });

    return () => { cancelled = true; };
  }, [mix.id, mix.file_url, mix.cover_art_url, toast, urlVersion]);

  const retryAudio = useCallback(async () => {
    await supabase.auth.refreshSession();
    cleanupAudio();
    signedUrlCache.delete(mix.id);
    signedUrlJobs.delete(mix.id);
    setSignedUrl(null);
    setSignedCoverUrl(null);
    setSignedDownloadUrl(null);
    setAudioError(false);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setUrlVersion((v) => v + 1);
  }, [cleanupAudio, mix.id]);

  const ensureAudioInstance = useCallback((src: string) => {
    const currentAudio = audioRef.current;
    if (currentAudio && currentAudio.src === src) {
      return currentAudio;
    }

    if (currentAudio) {
      cleanupAudio();
    }

    const nextAudio = new Audio();
    nextAudio.preload = "metadata";
    nextAudio.autoplay = false;
    nextAudio.setAttribute("playsinline", "");
    nextAudio.setAttribute("webkit-playsinline", "");
    nextAudio.src = src;

    const handleLoadedMetadata = () => {
      if (Number.isFinite(nextAudio.duration)) {
        setDuration(nextAudio.duration);
      }
    };

    const handleTimeUpdate = () => {
      if (!seekingRef.current) {
        setCurrentTime(nextAudio.currentTime);
      }
    };

    const handleCanPlay = () => setAudioError(false);
    const handlePlay = () => {
      setAudioError(false);
      setPlaying(true);
    };
    const handlePause = () => setPlaying(false);
    const handleEnded = () => setPlaying(false);
    const handleWaiting = () => console.log("[MixPlayer] Buffering...");
    const handleStalled = () => console.log("[MixPlayer] Stalled — mobile network may be slow");
    const handleError = () => {
      const code = nextAudio.error?.code;
      const msg = nextAudio.error?.message;
      const activeSrc = signedUrlRef.current;
      const fallbackSrc = signedDownloadUrlRef.current;

      console.error("[MixPlayer] Audio load error:", {
        code,
        msg,
        src: activeSrc?.substring(0, 80),
      });

      if (fallbackSrc && activeSrc && fallbackSrc !== activeSrc) {
        console.log("[MixPlayer] Streaming source failed, falling back to original file");
        cleanupAudio();
        setSignedUrl(fallbackSrc);
        setAudioError(false);
        setPlaying(false);
        return;
      }

      if ((code === 2 || code === 4) && urlVersionRef.current < 3) {
        console.log("[MixPlayer] Audio error (code", code, "), auto-retrying...");
        void retryAudio();
        return;
      }

      setAudioError(true);
      setPlaying(false);
    };

    nextAudio.addEventListener("loadedmetadata", handleLoadedMetadata);
    nextAudio.addEventListener("timeupdate", handleTimeUpdate);
    nextAudio.addEventListener("canplay", handleCanPlay);
    nextAudio.addEventListener("play", handlePlay);
    nextAudio.addEventListener("pause", handlePause);
    nextAudio.addEventListener("ended", handleEnded);
    nextAudio.addEventListener("waiting", handleWaiting);
    nextAudio.addEventListener("stalled", handleStalled);
    nextAudio.addEventListener("error", handleError);

    audioCleanupRef.current = () => {
      nextAudio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      nextAudio.removeEventListener("timeupdate", handleTimeUpdate);
      nextAudio.removeEventListener("canplay", handleCanPlay);
      nextAudio.removeEventListener("play", handlePlay);
      nextAudio.removeEventListener("pause", handlePause);
      nextAudio.removeEventListener("ended", handleEnded);
      nextAudio.removeEventListener("waiting", handleWaiting);
      nextAudio.removeEventListener("stalled", handleStalled);
      nextAudio.removeEventListener("error", handleError);
    };

    audioRef.current = nextAudio;
    return nextAudio;
  }, [cleanupAudio, retryAudio]);

  const audioSrc = signedUrl;

  useEffect(() => {
    if (!audioSrc) {
      cleanupAudio();
      setPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    setAudioError(false);

    const currentAudio = audioRef.current;
    if (currentAudio && currentAudio.src !== audioSrc) {
      cleanupAudio();
      setPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [audioSrc, cleanupAudio]);

  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

  const audioMimeType = getAudioMimeType(audioSrc);
  const streamingMime = audioMimeType;

  const handleDownload = useCallback(async () => {
    const downloadUrl = signedDownloadUrl;
    if (!downloadUrl || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const filename = `${mix.title.replace(/[^a-zA-Z0-9_\- ]/g, '')}.wav`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Download failed", description: "Please try again or contact support.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  }, [signedDownloadUrl, downloading, mix.title, toast]);

  const togglePlay = useCallback(() => {
    if (!audioSrc) return;

    const audio = ensureAudioInstance(audioSrc);
    if (playing) {
      audio.pause();
      return;
    }

    setAudioError(false);

    if (!audio.currentSrc || audio.readyState === 0) {
      audio.load();
    }

    const playPromise = audio.play();
    if (playPromise) {
      playPromise.catch((err) => {
        console.error("[MixPlayer] play() failed:", err.message);
        if (err.name === "NotAllowedError") {
          console.warn("[MixPlayer] Autoplay blocked — user interaction required");
          return;
        }
        if (audio.error || audio.networkState === 3) {
          void retryAudio();
          return;
        }
        setAudioError(true);
        setPlaying(false);
      });
    }
  }, [audioSrc, ensureAudioInstance, playing, retryAudio]);

  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
    if (!audioSrc) return;
    const audio = ensureAudioInstance(audioSrc);
    audio.currentTime = time;
  }, [audioSrc, ensureAudioInstance]);

  const skip = useCallback((delta: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + delta));
  }, [duration]);

  // Media Session API for lock screen controls (iOS / Android)
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    if (playing) {
      const artworkSrc = signedCoverUrl || logo;
      const artworkType = signedCoverUrl
        ? (mix.cover_art_url?.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg")
        : "image/jpeg";

      navigator.mediaSession.metadata = new MediaMetadata({
        title: mix.title,
        artist: mix.description || "Mix",
        album: "Replay Club",
        artwork: [
          { src: artworkSrc, sizes: "96x96", type: artworkType },
          { src: artworkSrc, sizes: "128x128", type: artworkType },
          { src: artworkSrc, sizes: "192x192", type: artworkType },
          { src: artworkSrc, sizes: "256x256", type: artworkType },
          { src: artworkSrc, sizes: "384x384", type: artworkType },
          { src: artworkSrc, sizes: "512x512", type: artworkType },
        ],
      });

      navigator.mediaSession.setActionHandler("play", () => {
        audioRef.current?.play();
        setPlaying(true);
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        audioRef.current?.pause();
        setPlaying(false);
      });
      navigator.mediaSession.setActionHandler("seekbackward", () => skip(-15));
      navigator.mediaSession.setActionHandler("seekforward", () => skip(15));
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime != null) handleSeek(details.seekTime);
      });
    }
  }, [playing, mix.title, mix.description, signedCoverUrl, mix.cover_art_url, skip, handleSeek]);

  // Keep-alive: refresh auth token every 10 min while audio is playing
  useEffect(() => {
    if (!playing) return;
    const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
    const id = setInterval(() => {
      supabase.auth.refreshSession().then(({ error }) => {
        if (error) console.warn("[MixPlayer] Keep-alive refresh failed:", error.message);
        else console.log("[MixPlayer] Session kept alive");
      });
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [playing]);

  // Update media session position state
  useEffect(() => {
    if (!("mediaSession" in navigator) || !playing || !duration) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(currentTime, duration),
      });
    } catch {}
  }, [currentTime, duration, playing]);

  // Lock body scroll when full view is open
  useEffect(() => {
    if (fullView) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [fullView]);

  const isExpired = mix.expires_at ? new Date(mix.expires_at) < new Date() : false;
  const daysLeft = mix.expires_at
    ? Math.max(0, Math.ceil((new Date(mix.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const openFullView = () => {
    if (audioSrc && !isExpired) setFullView(true);
  };

  // Compact card view
  const cardContent = (
    <div className={`bg-card border rounded-lg p-4 space-y-3 ${isExpired ? 'border-destructive/30 opacity-70' : 'border-border'}`}>
      <div className="flex justify-between items-start gap-3">
        <div
          className={`w-10 h-10 rounded-md overflow-hidden shrink-0 border border-border/30 ${isExpired ? 'grayscale' : 'cursor-pointer'}`}
          onClick={openFullView}
        >
          <img src={signedCoverUrl || logo} alt={mix.title} className="w-full h-full object-cover" />
        </div>
        <div className={`min-w-0 flex-1 ${isExpired ? '' : 'cursor-pointer'}`} onClick={openFullView}>
          <h3 className="font-display text-sm font-semibold text-foreground truncate">
            {mix.title}
          </h3>
          {mix.description && (
            <p className="text-muted-foreground text-xs font-body truncate">{mix.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {!isExpired && audioSrc && (
            <button
              onClick={openFullView}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              title="Full view"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
          {!isExpired && audioSrc && (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 text-primary hover:text-foreground text-xs font-display uppercase tracking-wider transition-colors px-2.5 py-1 rounded-full border border-border/50 hover:border-border disabled:opacity-50"
            >
              <Download className={`w-3 h-3 ${downloading ? 'animate-pulse' : ''}`} />
              {downloading ? '...' : 'WAV'}
              {!downloading && <span className="text-[9px] opacity-60 ml-0.5">HQ</span>}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4 text-muted-foreground text-[10px] font-body flex-wrap">
        {mix.recorded_at && <span>{new Date(mix.recorded_at).toLocaleDateString()}</span>}
        {duration > 0 && !isExpired && <span>{formatTime(duration)}</span>}
        {isExpired ? (
          <span className="text-destructive font-semibold">Expired — contact Replay Club to request access</span>
        ) : daysLeft !== null && daysLeft <= 2 ? (
          <span className="text-amber-500 font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {daysLeft === 0 ? 'Expires today' : daysLeft === 1 ? 'Expires tomorrow' : `${daysLeft} days left`}
          </span>
        ) : daysLeft !== null ? (
          <span>{daysLeft} days left to download</span>
        ) : null}
      </div>

      {!isExpired && loadingUrl && (
        <div className="flex items-center gap-2 py-3 justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground font-body">Loading your mix…</span>
        </div>
      )}

      {!isExpired && audioSrc && !audioError && (
        <>
          {/* CDJ-style waveform */}
          <div className="bg-background/50 rounded-md p-1.5 border border-border/30">
            <Waveform
              audioRef={audioRef}
              audioSrc={audioSrc}
              mixId={mix.id}
              cachedData={mix.waveform_data}
              duration={duration}
              currentTime={currentTime}
              onSeek={handleSeek}
              hue={mixHue}
            />
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-muted-foreground w-10">
              {formatTime(currentTime)}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => skip(-15)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Back 15s"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={togglePlay}
                className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/80 transition-colors"
              >
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <button
                onClick={() => skip(15)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Forward 15s"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">
              {formatTime(duration)}
            </span>
          </div>
        </>
      )}

      {!isExpired && audioError && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-display font-semibold">Failed to load audio</span>
          </div>
          <p className="text-[10px] text-muted-foreground font-body text-center">
            Your session may have expired. Try clicking Retry to refresh your connection.
          </p>
          <button
            onClick={retryAudio}
            className="mt-1 px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-display uppercase tracking-wider hover:bg-primary/80 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* AI Mix Report Card */}
      <MixReportCard
        mixId={mix.id}
        analysis={mixAnalysis}
        hasWaveform={!!mix.waveform_data && mix.waveform_data.length > 0}
        onAnalysisComplete={(a) => setMixAnalysis(a)}
      />
    </div>
  );

  return (
    <>
      {cardContent}

      {/* Full-view overlay */}
      <AnimatePresence>
        {fullView && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 bg-background flex flex-col"
          >
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-3 safe-area-top">
              <button
                onClick={() => setFullView(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
              <span className="text-[10px] font-display uppercase tracking-widest text-muted-foreground">
                Now Playing
              </span>
              {audioSrc && (
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors p-1 disabled:opacity-50"
                  title="Download high-quality WAV"
                >
                  <Download className={`w-5 h-5 ${downloading ? 'animate-pulse' : ''}`} />
                  <span className="text-[10px] font-display uppercase tracking-wider opacity-70">WAV</span>
                </button>
              )}
            </div>

            {/* Center content */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
              {/* Album art / icon area */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="w-48 h-48 md:w-64 md:h-64 rounded-2xl bg-card border border-border flex items-center justify-center shadow-lg overflow-hidden"
              >
                <img
                  src={signedCoverUrl || logo}
                  alt={mix.title}
                  className="w-full h-full object-cover"
                />
              </motion.div>

              {/* Title / description */}
              <div className="text-center max-w-sm space-y-1">
                <h2 className="font-display text-lg md:text-xl font-bold text-foreground">
                  {mix.title}
                </h2>
                {mix.description && (
                  <p className="text-muted-foreground text-sm font-body">{mix.description}</p>
                )}
                {mix.recorded_at && (
                  <p className="text-muted-foreground/60 text-xs font-body">
                    {new Date(mix.recorded_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            {/* Bottom player area */}
            <div className="px-4 sm:px-6 pb-6 sm:pb-8 space-y-3 sm:space-y-4 safe-area-bottom">
              {/* Full-width waveform */}
              <div className="bg-card/50 rounded-lg p-2 border border-border/30">
                <Waveform
                  audioRef={audioRef}
                  audioSrc={audioSrc}
                  mixId={mix.id}
                  cachedData={mix.waveform_data}
                  duration={duration}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                  hue={mixHue}
                />
              </div>

              {/* Time row */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground">
                  {formatTime(currentTime)}
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  {formatTime(duration)}
                </span>
              </div>

              {/* Large controls */}
              <div className="flex items-center justify-center gap-8">
                <button
                  onClick={() => skip(-15)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Back 15s"
                >
                  <SkipBack className="w-7 h-7" />
                </button>
                <button
                  onClick={togglePlay}
                  className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/80 transition-colors shadow-lg"
                >
                  {playing ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
                </button>
                <button
                  onClick={() => skip(15)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Forward 15s"
                >
                  <SkipForward className="w-7 h-7" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const Profile = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const { settings: publicSettings } = usePublicSiteSettings();
  const cancelCutoffHours =
    publicSettings.cancellation_cutoff_hours ?? BOOKING_POLICY_DEFAULTS.cancelCutoffHours;
  const [mixes, setMixes] = useState<Mix[]>([]);
  const [recognizeMix, setRecognizeMix] = useState<Mix | null>(null);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [tickets, setTickets] = useState<TicketPassData[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = ((): "bookings" | "mixes" | "waitlist" | "tickets" | "profile" => {
    const t = searchParams.get("tab");
    if (t === "bookings" || t === "mixes" || t === "waitlist" || t === "tickets" || t === "profile") return t;
    return "mixes";
  })();
  const [activeTab, setActiveTab] = useState<"bookings" | "mixes" | "waitlist" | "tickets" | "profile">(initialTab);

  // PR — Mirror the active tab into ?tab=<id> so browser back/forward
  // navigates between tabs and direct links land users on the right tab.
  // Uses pushState (not replace) so each tab change is a back-button stop.
  const lastSyncedTabRef = useRef<string | null>(initialTab);
  useEffect(() => {
    const current = searchParams.get("tab");
    if (current === activeTab) {
      lastSyncedTabRef.current = activeTab;
      return;
    }
    // Skip the very first sync if the URL already matched.
    if (lastSyncedTabRef.current === null) {
      lastSyncedTabRef.current = activeTab;
      return;
    }
    lastSyncedTabRef.current = activeTab;
    const next = new URLSearchParams(searchParams);
    next.set("tab", activeTab);
    setSearchParams(next, { replace: false });
  }, [activeTab, searchParams, setSearchParams]);

  // React to browser back/forward changing ?tab=
  useEffect(() => {
    const t = searchParams.get("tab");
    if (
      (t === "bookings" || t === "mixes" || t === "waitlist" || t === "tickets" || t === "profile") &&
      t !== activeTab
    ) {
      setActiveTab(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const tierCardRef = useRef<HTMLDivElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [reschedulingBooking, setReschedulingBooking] = useState<Booking | null>(null);
  const [refundingBooking, setRefundingBooking] = useState<Booking | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [loyaltyInfo, setLoyaltyInfo] = useState<{ bookingCount: number; tier: string; discountPercent: number; nextTier: string; sessionsToNext: number } | null>(null);
  const [giftCards, setGiftCards] = useState<{ code: string; balance_cents: number; amount_cents: number }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) navigate("/auth");
    });
    loadData();
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Honor ?scrollTo=tier from the SiteMenu badge — once data loads and
  // the profile tab is active, scroll the tier card into view and pulse
  // it briefly so the user knows where they landed.
  useEffect(() => {
    if (loading) return;
    if (searchParams.get("scrollTo") !== "tier") return;
    if (activeTab !== "profile") return;
    const el = tierCardRef.current;
    if (!el) return;
    const t = setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("ring-2", "ring-primary/60");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary/60"), 2400);
      // Strip the param so a refresh doesn't re-fire.
      const next = new URLSearchParams(searchParams);
      next.delete("scrollTo");
      setSearchParams(next, { replace: true });
    }, 120);
    return () => clearTimeout(t);
  }, [loading, activeTab, searchParams, setSearchParams]);

  // Poll for waveform data on mixes that are missing it (generated async by trigger)
  useEffect(() => {
    const mixesMissingWaveform = mixes.filter(m => m.file_url && (!m.waveform_data || (Array.isArray(m.waveform_data) && m.waveform_data.length === 0)));
    if (mixesMissingWaveform.length === 0) return;

    const interval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from("mixes")
        .select("id, waveform_data")
        .eq("user_id", session.user.id)
        .in("id", mixesMissingWaveform.map(m => m.id));

      if (data) {
        const updated = data.filter(d => d.waveform_data && (Array.isArray(d.waveform_data) ? d.waveform_data.length > 0 : true));
        if (updated.length > 0) {
          setMixes(prev => prev.map(m => {
            const match = updated.find(u => u.id === m.id);
            return match ? { ...m, waveform_data: match.waveform_data as WaveformPoint[] } : m;
          }));
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [mixes]);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/auth"); return; }

    setUserEmail(session.user.email || "");
    setUserId(session.user.id);

    const [profileRes, bookingsRes, mixesRes, waitlistRes, giftCardsRes, ticketsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", session.user.id).single(),
      supabase.from("bookings").select("*").order("booking_date", { ascending: false }),
      supabase.from("mixes").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false }),
      supabase.from("waitlist").select("*").order("booking_date", { ascending: true }),
      supabase.from("gift_cards").select("code, balance_cents, amount_cents").eq("payment_status", "paid").gt("balance_cents", 0),
      supabase
        .from("event_rsvps")
        .select("id, ticket_code, user_name, payment_status, status, amount_paid_cents, events(title, event_date, start_time, end_time, location, cover_image_url)")
        .eq("user_email", session.user.email!)
        .eq("status", "confirmed")
        .not("ticket_code", "is", null)
        .order("created_at", { ascending: false }),
    ]);

    if (profileRes.data) {
      setProfile(profileRes.data as Profile);
      setDisplayName(profileRes.data.display_name || "");
    }
    if (bookingsRes.data) setBookings(bookingsRes.data as Booking[]);
    if (mixesRes.data) setMixes(mixesRes.data as unknown as Mix[]);
    if (waitlistRes.data) setWaitlist(waitlistRes.data as WaitlistEntry[]);
    if (giftCardsRes.data) setGiftCards(giftCardsRes.data as { code: string; balance_cents: number; amount_cents: number }[]);
    if (ticketsRes.data) {
      const mapped = (ticketsRes.data as any[])
        .filter((r) => r.events && r.ticket_code)
        .map((r) => ({
          id: r.id,
          ticket_code: r.ticket_code,
          user_name: r.user_name,
          payment_status: r.payment_status,
          status: r.status,
          amount_paid_cents: r.amount_paid_cents,
          event: r.events,
        })) as TicketPassData[];
      setTickets(mapped);
    }

    // Calculate loyalty info
    const paidCount = bookingsRes.data
      ? (bookingsRes.data as Booking[]).filter(b => b.payment_status === "paid" || b.payment_status === "promo").length
      : 0;
    const tInfo = computeTier(paidCount);
    setLoyaltyInfo({
      bookingCount: tInfo.bookingCount,
      tier: tInfo.tier,
      discountPercent: tInfo.discountPercent,
      nextTier: tInfo.nextTier,
      sessionsToNext: tInfo.sessionsToNext,
    });

    // Check admin role
    const { data: adminCheck } = await supabase.rpc("has_role", {
      _user_id: session.user.id,
      _role: "admin" as const,
    });
    setIsAdmin(!!adminCheck);

    setLoading(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${profile.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", profile.id);

    if (updateError) {
      toast({ title: "Update failed", description: updateError.message, variant: "destructive" });
    } else {
      setProfile({ ...profile, avatar_url: publicUrl });
      toast({ title: "Avatar updated!" });
    }
    setUploading(false);
  };

  const handleUpdateProfile = async () => {
    if (!profile) return;
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, updated_at: new Date().toISOString() })
      .eq("id", profile.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setProfile({ ...profile, display_name: displayName });
      toast({ title: "Profile updated!" });
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    setCancellingId(null);
    const { data, error } = await supabase.functions.invoke("cancel-booking", {
      body: { booking_id: bookingId },
    });

    if (error || (data && data.error)) {
      const msg = data?.error || "Please contact us directly to cancel.";
      toast({ title: "Cancel failed", description: msg, variant: "destructive" });
    } else {
      setBookings(bookings.map(b => b.id === bookingId ? { ...b, payment_status: "cancelled" } : b));
      toast({ title: "Booking cancelled", description: "A confirmation email has been sent." });
    }
  };

  const handleReschedule = async () => {
    if (!reschedulingBooking || !rescheduleDate || !rescheduleTime) return;
    setRescheduleLoading(true);

    const { data, error } = await supabase.functions.invoke("reschedule-booking", {
      body: {
        booking_id: reschedulingBooking.id,
        new_date: rescheduleDate,
        new_time: rescheduleTime,
      },
    });

    if (error || (data && data.error)) {
      const msg = data?.error || "Please contact us directly to reschedule.";
      toast({ title: "Reschedule failed", description: msg, variant: "destructive" });
    } else {
      setBookings(bookings.map(b =>
        b.id === reschedulingBooking.id
          ? { ...b, booking_date: rescheduleDate, booking_time: rescheduleTime }
          : b
      ));
      toast({ title: "Booking rescheduled", description: "A confirmation email has been sent." });
    }

    setReschedulingBooking(null);
    setRescheduleDate("");
    setRescheduleTime("");
    setRescheduleLoading(false);
  };

  const openReschedule = (booking: Booking) => {
    setReschedulingBooking(booking);
    setRescheduleDate(booking.booking_date);
    setRescheduleTime(booking.booking_time);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground font-body">Loading...</div>
      </div>
    );
  }

  const initials = (displayName || userEmail || "U").slice(0, 2).toUpperCase();

  const tabs = [
    { id: "mixes" as const, label: "Mixes", icon: Music },
    { id: "tickets" as const, label: "Tickets", icon: TicketIcon },
    { id: "bookings" as const, label: "Bookings", icon: Calendar },
    { id: "waitlist" as const, label: "Waitlist", icon: Bell },
    { id: "profile" as const, label: "Profile", icon: User },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/30">
        <div className="container mx-auto px-4 py-3 grid grid-cols-3 items-center">
          {/* Left spacer keeps center balanced */}
          <div aria-hidden />
          {/* Centered logo */}
          <div className="flex justify-center">
            <img
              src={logo}
              alt="Replay Club"
              className="w-28 sm:w-32 mix-blend-screen cursor-pointer"
              onClick={() => navigate("/")}
            />
          </div>
          {/* Right-side actions */}
          <div className="flex items-center justify-end gap-3 sm:gap-4 overflow-x-auto">
            <Suspense fallback={null}>
              <NotificationBell />
            </Suspense>
            {isAdmin && (
              <button
                onClick={() => navigate("/admin/dashboard")}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm sm:text-sm font-body uppercase tracking-wider transition-colors shrink-0"
                title="Dashboard"
              >
                <BarChart3 className="w-5 h-5 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Dashboard</span>
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => navigate("/admin/promos")}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm sm:text-sm font-body uppercase tracking-wider transition-colors shrink-0"
                title="Promos"
              >
                <Gift className="w-5 h-5 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Promos</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {(() => {
        const now = Date.now();
        const upcoming = bookings
          .filter(b => b.payment_status === "paid" || b.payment_status === "promo")
          .filter(b => b.booking_time && b.booking_time !== "TBD - Free Session")
          .map(b => ({
            ...b,
            ts: new Date(`${b.booking_date}T${b.booking_time || "00:00"}`).getTime(),
          }))
          .filter(b => b.ts - now <= 24 * 60 * 60 * 1000 && b.ts - now > -2 * 60 * 60 * 1000)
          .sort((a, b) => a.ts - b.ts)[0];
        return upcoming ? <BookingCountdownBanner booking={upcoming} /> : null;
      })()}

      <div className="container mx-auto max-w-lg px-4 py-8 space-y-6">
        {/* Avatar + Name */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3"
        >
          <div className="relative inline-block">
            <Avatar className="w-20 h-20 border-2 border-border">
              <AvatarImage src={profile?.avatar_url || logo} />
              <AvatarFallback className="bg-background">
                <img src={logo} alt="Replay Club" className="w-full h-full object-cover mix-blend-screen" />
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/80 transition-colors"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-foreground">
              {profile?.display_name || "Member"}
            </h1>
            <p className="text-muted-foreground text-xs font-body">{userEmail}</p>
          </div>
        </motion.div>

        {/* Section Tabs */}
        <div className="grid grid-cols-5 gap-1 bg-card rounded-lg p-1 sm:flex sm:justify-center">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-2 rounded-md text-[10px] sm:text-xs font-display uppercase tracking-wider transition-all min-w-0 ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "tickets" && (
            <div className="space-y-4">
              {tickets.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-lg border border-border/30">
                  <TicketIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-sm font-body text-muted-foreground mb-1">No tickets yet</p>
                  <p className="text-xs font-body text-muted-foreground/70">
                    Your event passes will appear here after purchase.
                  </p>
                  <button
                    onClick={() => navigate("/events")}
                    className="mt-4 text-xs font-display uppercase tracking-wider text-primary hover:underline"
                  >
                    Browse Events →
                  </button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {tickets.map((t) => (
                    <TicketPass key={t.id} ticket={t} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "bookings" && (
            <div className="space-y-3">
              {/* Free Disk Jockey Sessions */}
              {bookings.filter(b => b.payment_status === "promo").length > 0 && (
                <div className="space-y-3">
                  {bookings.filter(b => b.payment_status === "promo").map((booking) => {
                    const isScheduled = booking.booking_time !== "TBD - Free Session";
                    const isExpanded = expandedBooking === booking.id;
                    return (
                      <div
                        key={booking.id}
                        className="card-premium card-premium-accent overflow-hidden"
                      >
                        <button
                          onClick={() => setExpandedBooking(isExpanded ? null : booking.id)}
                          className="w-full p-4 text-left space-y-3"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <Gift className="w-4 h-4 text-primary" />
                                <h3 className="font-display text-sm font-semibold text-foreground">
                                 Free Disk Jockey Session
                                </h3>
                              </div>
                              <p className="text-muted-foreground text-xs font-body mt-0.5">{booking.room_title}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-display uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                isScheduled ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"
                              }`}>
                                {isScheduled ? "Scheduled" : "Pending"}
                              </span>
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                            </div>
                          </div>
                          {isScheduled ? (
                            <div className="flex gap-4 text-muted-foreground text-xs font-body">
                              <span>{booking.booking_date}</span>
                              <span>{booking.booking_time}</span>
                              <span>1.5 hr session</span>
                            </div>
                          ) : (
                            <p className="text-muted-foreground text-xs font-body">
                              Session not yet scheduled — check your email for the booking link.
                            </p>
                          )}
                        </button>

                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            transition={{ duration: 0.2 }}
                            className="border-t border-border/30 px-4 pb-4 pt-3 space-y-4"
                          >
                            {/* Booking Details */}
                            <div className="space-y-2">
                              <h4 className="text-xs font-display uppercase tracking-wider text-foreground flex items-center gap-1.5">
                                <Info className="w-3 h-3" /> Session Details
                              </h4>
                              <div className="grid grid-cols-2 gap-2 text-xs font-body">
                                <div className="text-muted-foreground">Name</div>
                                <div className="text-foreground">{booking.customer_name}</div>
                                <div className="text-muted-foreground">Room</div>
                                <div className="text-foreground">{booking.room_title}</div>
                                {booking.tier && (
                                  <>
                                    <div className="text-muted-foreground">Tier</div>
                                    <div className="text-foreground">{booking.tier}</div>
                                  </>
                                )}
                                {booking.layout && (
                                  <>
                                    <div className="text-muted-foreground">Layout</div>
                                    <div className="text-foreground">{booking.layout}</div>
                                  </>
                                )}
                                {booking.sound && (
                                  <>
                                    <div className="text-muted-foreground">Sound</div>
                                    <div className="text-foreground">{booking.sound}</div>
                                  </>
                                )}
                                {booking.lighting && (
                                  <>
                                    <div className="text-muted-foreground">Lighting</div>
                                    <div className="text-foreground">{booking.lighting}</div>
                                  </>
                                )}
                                {booking.equipment && Array.isArray(booking.equipment) && booking.equipment.length > 0 && (
                                  <>
                                    <div className="text-muted-foreground">Equipment</div>
                                    <div className="text-foreground">{booking.equipment.join(", ")}</div>
                                  </>
                                )}
                                <div className="text-muted-foreground">Price</div>
                                <div className="text-foreground font-semibold text-primary">FREE</div>
                                <div className="text-muted-foreground">Booked on</div>
                                <div className="text-foreground">{new Date(booking.created_at).toLocaleDateString()}</div>
                              </div>
                            </div>

                            {/* Venue Info — pickup details only revealed in confirmation email */}
                            <div className="space-y-2">
                              <h4 className="text-xs font-display uppercase tracking-wider text-foreground flex items-center gap-1.5">
                                <MapPin className="w-3 h-3" /> Venue
                              </h4>
                              <p className="text-xs font-body text-muted-foreground">
                                Private studio in Los Angeles. Check your confirmation email for the pickup point and escort instructions.
                              </p>
                            </div>

                            {/* Instructions */}
                            <div className="space-y-2">
                              <h4 className="text-xs font-display uppercase tracking-wider text-foreground flex items-center gap-1.5">
                                <Clock className="w-3 h-3" /> Arrival Instructions
                              </h4>
                              <ul className="text-xs font-body text-muted-foreground space-y-1.5">
                                <li className="flex items-start gap-2">
                                  <span className="text-primary mt-0.5">•</span>
                                  Arrive 5–10 minutes early
                                </li>
                                <li className="flex items-start gap-2">
                                  <span className="text-primary mt-0.5">•</span>
                                  Street parking only
                                </li>
                                <li className="flex items-start gap-2">
                                  <span className="text-primary mt-0.5">•</span>
                                  Valid photo ID required for entry
                                </li>
                              </ul>
                            </div>

                            <a
                              href="mailto:replayclubrecords@gmail.com?subject=Question about my DJ session"
                              className="flex items-center justify-center gap-2 w-full text-xs font-display uppercase tracking-wider px-4 py-2.5 rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              Contact Us
                            </a>
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Paid Bookings */}
              {bookings.filter(b => b.payment_status !== "promo").length > 0 && (
                bookings.filter(b => b.payment_status !== "promo").map((booking) => {
                  const bookingDate = new Date(booking.booking_date + "T" + (booking.booking_time || "00:00"));
                  const isUpcoming = bookingDate > new Date();
                  const hoursUntil = (bookingDate.getTime() - Date.now()) / (1000 * 60 * 60);
                  const withinCutoff = hoursUntil < cancelCutoffHours && hoursUntil > 0;
                  const canCancel = isUpcoming && booking.payment_status === "paid" && !withinCutoff;
                  const isExpanded = expandedBooking === booking.id;

                  return (
                    <div
                      key={booking.id}
                      className="card-premium overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedBooking(isExpanded ? null : booking.id)}
                        className="w-full p-4 text-left space-y-3"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-display text-sm font-semibold text-foreground">
                              {booking.room_title}
                            </h3>
                            {booking.tier && (
                              <p className="text-muted-foreground text-xs font-body">{booking.tier}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-display uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                booking.payment_status === "paid"
                                  ? "bg-green-500/10 text-green-400"
                                  : booking.payment_status === "cancelled"
                                  ? "bg-red-500/10 text-red-400"
                                  : "bg-yellow-500/10 text-yellow-400"
                              }`}
                            >
                              {booking.payment_status}
                            </span>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </div>
                        </div>
                        <div className="flex gap-4 text-muted-foreground text-xs font-body">
                          <span>{booking.booking_date}</span>
                          <span>{booking.booking_time}</span>
                          <span>${(booking.amount_cents / 100).toFixed(2)}</span>
                        </div>
                      </button>

                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          transition={{ duration: 0.2 }}
                          className="border-t border-border/30 px-4 pb-4 pt-3 space-y-4"
                        >
                          <div className="space-y-2">
                            <h4 className="text-xs font-display uppercase tracking-wider text-foreground flex items-center gap-1.5">
                              <Info className="w-3 h-3" /> Booking Details
                            </h4>
                            <div className="grid grid-cols-2 gap-2 text-xs font-body">
                              <div className="text-muted-foreground">Name</div>
                              <div className="text-foreground">{booking.customer_name}</div>
                              <div className="text-muted-foreground">Room</div>
                              <div className="text-foreground">{booking.room_title}</div>
                              {booking.tier && (
                                <>
                                  <div className="text-muted-foreground">Tier</div>
                                  <div className="text-foreground">{booking.tier}</div>
                                </>
                              )}
                              {booking.layout && (
                                <>
                                  <div className="text-muted-foreground">Layout</div>
                                  <div className="text-foreground">{booking.layout}</div>
                                </>
                              )}
                              {booking.sound && (
                                <>
                                  <div className="text-muted-foreground">Sound</div>
                                  <div className="text-foreground">{booking.sound}</div>
                                </>
                              )}
                              {booking.lighting && (
                                <>
                                  <div className="text-muted-foreground">Lighting</div>
                                  <div className="text-foreground">{booking.lighting}</div>
                                </>
                              )}
                              {booking.equipment && Array.isArray(booking.equipment) && booking.equipment.length > 0 && (
                                <>
                                  <div className="text-muted-foreground">Equipment</div>
                                  <div className="text-foreground">{booking.equipment.join(", ")}</div>
                                </>
                              )}
                              <div className="text-muted-foreground">Price</div>
                              <div className="text-foreground">${(booking.amount_cents / 100).toFixed(2)}</div>
                              <div className="text-muted-foreground">Booked on</div>
                              <div className="text-foreground">{new Date(booking.created_at).toLocaleDateString()}</div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="text-xs font-display uppercase tracking-wider text-foreground flex items-center gap-1.5">
                              <MapPin className="w-3 h-3" /> Venue
                            </h4>
                            <p className="text-xs font-body text-muted-foreground">
                              Private studio in Los Angeles. Check your confirmation email for the pickup point and escort instructions.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <h4 className="text-xs font-display uppercase tracking-wider text-foreground flex items-center gap-1.5">
                              <Clock className="w-3 h-3" /> Arrival Instructions
                            </h4>
                            <ul className="text-xs font-body text-muted-foreground space-y-1.5">
                              <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5">•</span>
                                Arrive 5–10 minutes early
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5">•</span>
                                Street parking only
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5">•</span>
                                Valid photo ID required for entry
                              </li>
                            </ul>
                          </div>

                          <div className="flex gap-2">
                            <a
                              href="mailto:replayclubrecords@gmail.com?subject=Question about my booking"
                              className="flex-1 flex items-center justify-center gap-2 text-xs font-display uppercase tracking-wider px-4 py-2.5 rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              Contact Us
                            </a>
                            {booking.payment_status === "paid" && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  // Lazy-load jspdf only when user clicks Download
                                  const { generateReceipt } = await import("@/lib/generateReceipt");
                                  await generateReceipt({
                                    bookingId: booking.id,
                                    customerName: booking.customer_name,
                                    customerEmail: booking.customer_email,
                                    roomTitle: booking.room_title,
                                    bookingDate: booking.booking_date,
                                    bookingTime: booking.booking_time,
                                    tier: booking.tier,
                                    layout: booking.layout,
                                    sound: booking.sound,
                                    lighting: booking.lighting,
                                    equipment: Array.isArray(booking.equipment) ? booking.equipment : [],
                                    amountCents: booking.amount_cents,
                                    createdAt: booking.created_at,
                                    paymentStatus: booking.payment_status,
                                  });
                                }}
                                className="flex items-center justify-center gap-2 text-xs font-display uppercase tracking-wider px-4 py-2.5 rounded-md border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Receipt
                              </button>
                            )}
                          </div>

                          {booking.payment_status === "paid" && isUpcoming && (
                            <div className="flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                              <AddToCalendarButton
                                event={{
                                  title: `Replay Club — ${booking.room_title}`,
                                  description: `Confirmation: ${booking.id.slice(0, 8)}`,
                                  location: "Replay Club — pickup details in confirmation email",
                                  start: new Date(`${booking.booking_date}T${booking.booking_time || "10:00"}`),
                                  end: new Date(new Date(`${booking.booking_date}T${booking.booking_time || "10:00"}`).getTime() + 2 * 60 * 60 * 1000),
                                }}
                              />
                              <button
                                onClick={() => setRefundingBooking(booking)}
                                className="text-xs font-display uppercase tracking-wider px-4 py-2 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
                              >
                                Request refund
                              </button>
                            </div>
                          )}

                          {canCancel && (
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); openReschedule(booking); }}
                                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-display uppercase tracking-wider px-4 py-2.5 rounded-md border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                              >
                                <CalendarClock className="w-3.5 h-3.5" />
                                Reschedule
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setCancellingId(booking.id); }}
                                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-display uppercase tracking-wider px-4 py-2.5 rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                                Cancel
                              </button>
                            </div>
                          )}
                          {withinCutoff && isUpcoming && booking.payment_status === "paid" && (
                            <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 border border-border/50">
                              <Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-muted-foreground font-body leading-relaxed">
                                Reschedule and Cancel are unavailable because your session is within {cancelCutoffHours} hours.
                                <a href="mailto:replayclubrecords@gmail.com" className="text-primary hover:underline ml-1">
                                  Contact us for changes.
                                </a>
                              </p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>
                  );
                })
              )}

              {bookings.length === 0 && (
                <div className="text-center py-12 text-muted-foreground font-body text-sm">
                  <Calendar className="w-8 h-8 mx-auto mb-3 opacity-40" />
                  No bookings yet
                </div>
              )}
            </div>
          )}

          {activeTab === "mixes" && (
            <div className="space-y-4">
              {/* Upload your own mix */}
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">Your mixes</h3>
                  <p className="text-[11px] text-muted-foreground font-body">Upload a set to get an AI report card after review.</p>
                </div>
                {userId && (
                  <UploadMixDialog
                    userId={userId}
                    onUploaded={async () => {
                      const { data } = await supabase
                        .from("mixes")
                        .select("*")
                        .eq("user_id", userId)
                        .order("created_at", { ascending: false });
                      if (data) setMixes(data as unknown as Mix[]);
                    }}
                  />
                )}
              </div>

              {/* Sound DNA */}
              <SoundDNA analyses={mixes.filter((m) => m.mix_analysis).map((m) => m.mix_analysis)} />

              {/* Mix Lineage Tree */}
              <MixLineageTree mixes={mixes} />

              <div className="space-y-3">
                {mixes.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground font-body text-sm">
                    <Music className="w-8 h-8 mx-auto mb-3 opacity-40" />
                    No mixes yet
                    <p className="text-xs mt-1 opacity-60">
                      Upload your own set above — your Replay Club session recordings show up here too.
                    </p>
                  </div>
                ) : (
                  mixes.map((mix) => (
                    <div key={mix.id} className="space-y-1">
                      {mix.status && mix.status !== "approved" && (
                        <div className="flex justify-end">
                          <MixStatusBadge status={mix.status} />
                        </div>
                      )}
                      <MixCard mix={mix} />
                      <div className="flex justify-end pt-0.5">
                        <button
                          onClick={() => setRecognizeMix(mix)}
                          className="text-[11px] font-display uppercase tracking-wider px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors"
                        >
                          Recognize Tracks
                        </button>
                      </div>
                      {recognizeMix?.id === mix.id && (
                        <TrackRecognitionPanel
                          mix={{ id: mix.id, title: mix.title }}
                          mode="user"
                          open
                          onOpenChange={(o) => !o && setRecognizeMix(null)}
                        />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "waitlist" && (
            <div className="space-y-3">
              {waitlist.filter(w => !w.notified && new Date(w.booking_date) >= new Date()).length > 0 ? (
                waitlist
                  .filter(w => !w.notified && new Date(w.booking_date) >= new Date())
                  .map((entry) => (
                    <div
                      key={entry.id}
                      className="card-premium p-4 flex justify-between items-center"
                    >
                      <div className="space-y-1">
                        <h3 className="font-display text-sm font-semibold text-foreground">
                          {entry.room_title}
                        </h3>
                        <div className="flex gap-3 text-muted-foreground text-xs font-body">
                          <span>{entry.booking_date}</span>
                          <span>{entry.booking_time}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-body">
                          Added {new Date(entry.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          await supabase.from("waitlist").delete().eq("id", entry.id);
                          setWaitlist(waitlist.filter(w => w.id !== entry.id));
                          toast({ title: "Removed from waitlist" });
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors p-2"
                        title="Remove from waitlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
              ) : (
                <div className="text-center py-12 text-muted-foreground font-body text-sm">
                  <Bell className="w-8 h-8 mx-auto mb-3 opacity-40" />
                  No active waitlist entries
                  <p className="text-xs mt-1 opacity-60">
                    Join a waitlist when a time slot is fully booked
                  </p>
                </div>
              )}

              {waitlist.filter(w => w.notified).length > 0 && (
                <>
                  <p className="text-[10px] font-display uppercase tracking-wider text-muted-foreground pt-2">Notified</p>
                  {waitlist.filter(w => w.notified).map((entry) => (
                    <div
                      key={entry.id}
                      className="bg-card border border-primary/20 rounded-lg p-4 opacity-60"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-display text-sm font-semibold text-foreground">
                            {entry.room_title}
                          </h3>
                          <span className="text-[10px] font-display uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                            Notified
                          </span>
                        </div>
                        <div className="flex gap-3 text-muted-foreground text-xs font-body">
                          <span>{entry.booking_date}</span>
                          <span>{entry.booking_time}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {activeTab === "profile" && (
            <div className="space-y-4">
              {/* Loyalty Badge — Enhanced */}
              {loyaltyInfo && (
                <div ref={tierCardRef} className="card-premium p-4 space-y-4 transition-shadow rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <SessionRecordBadge
                        tier={loyaltyInfo.tier}
                        bookingCount={loyaltyInfo.bookingCount}
                        sessionsToNext={loyaltyInfo.sessionsToNext}
                        nextTier={loyaltyInfo.nextTier}
                        size={64}
                      />
                      <div>
                        <p className="font-display text-sm font-semibold text-foreground">{loyaltyInfo.tier}</p>
                        <p className="text-muted-foreground text-[10px] font-body">
                          {loyaltyInfo.bookingCount} session{loyaltyInfo.bookingCount !== 1 ? "s" : ""} completed
                        </p>
                        <p className="text-muted-foreground/70 text-[9px] font-body italic mt-0.5">
                          Tap the record for tier details
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {loyaltyInfo.discountPercent > 0 && (
                        <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-display font-semibold uppercase tracking-wider">
                          {loyaltyInfo.discountPercent}% off
                        </div>
                      )}
                      {loyaltyInfo.sessionsToNext > 0 && (
                        <p className="text-muted-foreground text-[10px] font-body">
                          {loyaltyInfo.sessionsToNext} more to {loyaltyInfo.nextTier}
                        </p>
                      )}
                    </div>
                  </div>

                  {loyaltyInfo.sessionsToNext > 0 && (
                    <div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, ((loyaltyInfo.bookingCount % (loyaltyInfo.bookingCount + loyaltyInfo.sessionsToNext)) / (loyaltyInfo.bookingCount + loyaltyInfo.sessionsToNext)) * 100 || 0)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      { min: 3, label: "Bronze", icon: Star, color: "text-orange-400 bg-orange-500/10" },
                      { min: 5, label: "Silver", icon: Star, color: "text-gray-400 bg-gray-400/10" },
                      { min: 10, label: "Gold", icon: Trophy, color: "text-yellow-400 bg-yellow-500/10" },
                      { min: 20, label: "Platinum", icon: Target, color: "text-purple-400 bg-purple-500/10" },
                      { min: 50, label: "Diamond", icon: Target, color: "text-cyan-300 bg-cyan-400/10" },
                      { min: 100, label: "Obsidian", icon: Target, color: "text-white bg-white/10" },
                    ].map((badge) => {
                      const earned = loyaltyInfo.bookingCount >= badge.min;
                      return (
                        <div
                          key={badge.label}
                          className={`flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-display uppercase tracking-wider ${
                            earned ? badge.color : "text-muted-foreground/40 bg-muted/30"
                          }`}
                          title={earned ? `${badge.label} — Earned!` : `${badge.label} — ${badge.min} sessions`}
                        >
                          <badge.icon className="w-2.5 h-2.5" />
                          {badge.label}
                        </div>
                      );
                    })}
                  </div>

                  {loyaltyInfo.discountPercent > 0 && (
                    <div className="bg-primary/5 border border-primary/20 rounded-md p-2.5">
                      <p className="text-xs font-body text-foreground">
                        💰 You save <span className="font-display font-bold text-primary">{loyaltyInfo.discountPercent}%</span> on every booking
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Gift Card Balance */}
              {giftCards.length > 0 && (
                <div className="card-premium p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Gift className="w-4 h-4 text-primary" />
                    <h3 className="font-display text-sm font-semibold text-foreground">Gift Card Balance</h3>
                  </div>
                  <div className="space-y-2">
                    {giftCards.map((gc) => (
                      <div key={gc.code} className="flex items-center justify-between bg-secondary/50 rounded-md px-3 py-2">
                        <div>
                          <p className="font-mono text-xs text-foreground tracking-wider">{gc.code}</p>
                          <p className="text-[10px] text-muted-foreground font-body">
                            Original: ${(gc.amount_cents / 100).toFixed(0)}
                          </p>
                        </div>
                        <p className="font-display text-sm font-bold text-primary">
                          ${(gc.balance_cents / 100).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-body">
                    Apply during checkout to use your balance.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-foreground font-body text-xs uppercase tracking-wider">
                  Display Name
                </Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="bg-card border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground font-body text-xs uppercase tracking-wider">
                  Email
                </Label>
                <Input value={userEmail} disabled className="bg-card border-border text-muted-foreground" />
              </div>
              <button
                onClick={handleUpdateProfile}
                className="w-full chrome-btn font-display font-semibold text-sm uppercase tracking-[0.15em] px-6 py-3 rounded-md transition-all"
              >
                Save Changes
              </button>

              {/* Reminder Preferences */}
              <ReminderPreferences userEmail={userEmail} userId={userId} />

              {/* Referral Program — HIDDEN FOR LAUNCH (2026-06-08): the redemption
                  engine isn't built (no ?ref capture, no referrals-row write, no
                  credit granted/applied), so the "we both get $10" card promised
                  what the backend can't deliver. Schema + auto-generated codes
                  remain intact; re-mount ReferralProgram when redemption ships +
                  is verified end-to-end. */}

              {/* Account deletion (GDPR) */}
              <AccountDeletionPanel />
            </div>
          )}
        </motion.div>
      </div>

      {/* Refund Request Dialog */}
      {refundingBooking && (
        <RefundRequestDialog
          open={!!refundingBooking}
          onOpenChange={(v) => !v && setRefundingBooking(null)}
          bookingId={refundingBooking.id}
          bookingDate={refundingBooking.booking_date}
          bookingTime={refundingBooking.booking_time}
          amountCents={refundingBooking.amount_cents}
          onComplete={() => {
            setRefundingBooking(null);
            // Refresh bookings list
            window.location.reload();
          }}
        />
      )}

      {/* Cancel Confirmation Dialog */}
      <AnimatePresence>
        {cancellingId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setCancellingId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="card-premium p-6 max-w-sm w-full space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <h3 className="font-display text-base font-semibold text-foreground">Cancel Booking?</h3>
              </div>
              <p className="text-muted-foreground text-sm font-body">
                This action cannot be undone. Cancellations must be made at least {cancelCutoffHours} hours before your session. For refund inquiries, contact <strong>replayclubrecords@gmail.com</strong>.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCancellingId(null)}
                  className="flex-1 text-xs font-display uppercase tracking-wider px-4 py-2.5 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  Keep Booking
                </button>
                <button
                  onClick={() => handleCancelBooking(cancellingId)}
                  className="flex-1 text-xs font-display uppercase tracking-wider px-4 py-2.5 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                >
                  Yes, Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reschedule Modal */}
      <AnimatePresence>
        {reschedulingBooking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => { setReschedulingBooking(null); setRescheduleDate(""); setRescheduleTime(""); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="card-premium p-6 max-w-sm w-full space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <CalendarClock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold text-foreground">Reschedule Session</h3>
                  <p className="text-muted-foreground text-xs font-body">{reschedulingBooking.room_title}</p>
                </div>
              </div>

              <div className="bg-muted/50 rounded-md p-3 text-xs font-body text-muted-foreground">
                <span className="text-foreground font-semibold">Current:</span> {reschedulingBooking.booking_date} at {reschedulingBooking.booking_time}
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-foreground font-body text-xs uppercase tracking-wider">New Date</Label>
                  <Input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    min={new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                    className="bg-background border-border text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground font-body text-xs uppercase tracking-wider">New Time</Label>
                  <Input
                    type="time"
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    className="bg-background border-border text-foreground"
                  />
                </div>
              </div>

              <p className="text-muted-foreground text-xs font-body">
                Rescheduling requires at least {cancelCutoffHours} hours notice before your current session.
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => { setReschedulingBooking(null); setRescheduleDate(""); setRescheduleTime(""); }}
                  className="flex-1 text-xs font-display uppercase tracking-wider px-4 py-2.5 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReschedule}
                  disabled={!rescheduleDate || !rescheduleTime || rescheduleLoading}
                  className="flex-1 text-xs font-display uppercase tracking-wider px-4 py-2.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {rescheduleLoading ? "Saving..." : "Confirm"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Profile;
