// Track Recognition — shared client types, status palette, and PREVIEW data.
//
// Stage A is UI-only: the recognition pipeline (ACRCloud File Scanning) is NOT
// wired yet. The Recognition Room renders from `buildPreviewJob()` so the full
// premium experience is visible/clickable with zero backend and no API billing.
// When Stage B lands, the panel swaps preview data for real rows from
// mix_recognition_jobs / confirmed_tracklist. Shapes here mirror that schema.

export type RecognitionJobStatus =
  | "queued"
  | "processing"
  | "recognition_complete"
  | "needs_review"
  | "ai_review"
  | "confirmed"
  | "failed";

export type SegmentStatus =
  | "confirmed"
  | "likely"
  | "possible"
  | "unknown"
  | "user_corrected";

export type ReviewSource = "admin" | "ai" | "user";
export type TrackSource = "acrcloud" | "audd" | "manual" | "unknown";

export interface RecognizedTrack {
  id: string;
  position: number;
  title: string | null;
  artist: string | null;
  album?: string | null;
  startSeconds: number | null;
  endSeconds: number | null;
  confidence: number | null; // 0–100 normalized
  status: SegmentStatus;
  source: TrackSource;
  bpm?: number | null;
  musicalKey?: string | null;
  genre?: string | null;
  energyLevel?: number | null;
  artworkUrl?: string | null;
}

export interface RecognitionJobView {
  id: string;
  mixId: string;
  status: RecognitionJobStatus;
  requestedByRole: "user" | "admin" | "service";
  retryCount: number;
  reviewSource?: ReviewSource | null;
  durationSeconds: number; // mix length, for the timeline
  tracks: RecognizedTrack[];
  isPreview?: boolean; // true while the pipeline is stubbed
}

// --- Status → label + tailwind classes (mirrors MixStatusBadge palette) ----

export const SEGMENT_STATUS_META: Record<
  SegmentStatus,
  { label: string; className: string; dot: string }
> = {
  confirmed: {
    label: "Confirmed",
    className: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  likely: {
    label: "Likely Match",
    className: "bg-teal-500/15 text-teal-400 border border-teal-500/30",
    dot: "bg-teal-400",
  },
  possible: {
    label: "Possible ID",
    className: "bg-amber-500/15 text-amber-500 border border-amber-500/30",
    dot: "bg-amber-500",
  },
  unknown: {
    label: "Unknown / Edit",
    className: "bg-muted text-muted-foreground border border-destructive/30",
    dot: "bg-destructive",
  },
  user_corrected: {
    label: "Edited",
    className: "bg-primary/15 text-primary border border-primary/30",
    dot: "bg-primary",
  },
};

export const JOB_STATUS_META: Record<
  RecognitionJobStatus,
  { label: string; className: string }
> = {
  queued: { label: "Queued", className: "bg-muted text-muted-foreground border border-border" },
  processing: { label: "Recognizing…", className: "bg-blue-500/15 text-blue-400 border border-blue-500/30" },
  recognition_complete: { label: "Scan complete", className: "bg-teal-500/15 text-teal-400 border border-teal-500/30" },
  needs_review: { label: "Needs review", className: "bg-purple-500/15 text-purple-400 border border-purple-500/30" },
  ai_review: { label: "AI review", className: "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30" },
  confirmed: { label: "Confirmed", className: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" },
  failed: { label: "Failed", className: "bg-destructive/15 text-destructive border border-destructive/30" },
};

// Normalized-confidence → segment status (thresholds from the spec).
export function segmentStatusFromConfidence(confidence: number | null): SegmentStatus {
  if (confidence == null) return "unknown";
  if (confidence >= 90) return "confirmed";
  if (confidence >= 70) return "likely";
  if (confidence >= 40) return "possible";
  return "unknown";
}

// Seconds → "m:ss" / "h:mm:ss".
export function fmtTime(seconds: number | null | undefined): string {
  if (seconds == null || isNaN(seconds)) return "—";
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

export function trackTimeRange(t: RecognizedTrack): string {
  if (t.startSeconds == null) return "—";
  return `${fmtTime(t.startSeconds)}–${fmtTime(t.endSeconds)}`;
}

// Copy shown for unrecognized regions — never leave it blank.
export const UNKNOWN_SECTION_COPY =
  "Could be an edit, bootleg, layered section, or unreleased ID. Add it manually.";

// --- PREVIEW dataset --------------------------------------------------------
// A representative scan so every status + the timeline + the edit drawer are
// visible without any backend. Replaced by real data in Stage B.
export function buildPreviewJob(mixId: string, mixTitle?: string): RecognitionJobView {
  void mixTitle;
  const tracks: RecognizedTrack[] = [
    {
      id: "preview-1", position: 1, title: "Too Cool To Be Careless", artist: "PAWSA",
      album: "SOLA", startSeconds: 0, endSeconds: 296, confidence: 96, status: "confirmed",
      source: "acrcloud", bpm: 128, musicalKey: "Gm", genre: "Tech House", energyLevel: 8.2,
    },
    {
      id: "preview-2", position: 2, title: "Selecta", artist: "Toman", album: null,
      startSeconds: 296, endSeconds: 612, confidence: 93, status: "confirmed",
      source: "acrcloud", bpm: 127, musicalKey: "Am", genre: "Tech House", energyLevel: 7.6,
    },
    {
      id: "preview-3", position: 3, title: "Body Movin'", artist: "Chris Stussy", album: null,
      startSeconds: 612, endSeconds: 905, confidence: 81, status: "likely",
      source: "acrcloud", bpm: 126, musicalKey: "Fm", genre: "House", energyLevel: 7.1,
    },
    {
      id: "preview-4", position: 4, title: "Unknown ID", artist: null, album: null,
      startSeconds: 905, endSeconds: 1140, confidence: 31, status: "unknown",
      source: "unknown", bpm: null, musicalKey: null, genre: null, energyLevel: null,
    },
    {
      id: "preview-5", position: 5, title: "Lose Control", artist: "Mochakk", album: null,
      startSeconds: 1140, endSeconds: 1460, confidence: 58, status: "possible",
      source: "acrcloud", bpm: 125, musicalKey: "Cm", genre: "House", energyLevel: 6.8,
    },
    {
      id: "preview-6", position: 6, title: "Acid Dreams", artist: "Sammy Virji", album: null,
      startSeconds: 1460, endSeconds: 1798, confidence: 91, status: "confirmed",
      source: "acrcloud", bpm: 133, musicalKey: "Dm", genre: "UK Garage", energyLevel: 8.9,
    },
  ];
  return {
    id: "preview-job",
    mixId,
    status: "needs_review",
    requestedByRole: "user",
    retryCount: 0,
    reviewSource: null,
    durationSeconds: 1798,
    tracks,
    isPreview: true,
  };
}

export function summarize(tracks: RecognizedTrack[]) {
  return {
    total: tracks.length,
    confirmed: tracks.filter((t) => t.status === "confirmed").length,
    likely: tracks.filter((t) => t.status === "likely").length,
    possible: tracks.filter((t) => t.status === "possible").length,
    unknown: tracks.filter((t) => t.status === "unknown").length,
  };
}
