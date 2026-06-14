// Mix Intelligence V2 — shared types.
//
// Recognition-first: everything derives from confirmed_tracklist (real ACRCloud
// IDs), NEVER from mixes.mix_analysis / Gemini. Every stat carries its receipts
// (the exact tracks behind it) — no number is shown without its evidence.
//
// Tier-0 (read-only, fumix.mgmt only): uses only the columns ACRCloud already
// populated (title, artist, timing, confidence, metadata.platform_ids/album/isrc).
// genre/bpm/key/energy/popularity are NOT populated yet → surfaced as "forming"
// (enrichment re-parse) or "needs_dsp", never faked.
import type { SegmentStatus } from "@/types/recognition";

// Data-availability honesty — drives the forming states; never invents a number.
export type DnaState = "live" | "forming" | "needs_dsp";

// The evidence behind a stat — a pointer back to a real recognized track.
export interface TrackRef {
  position: number;
  title: string | null;
  artist: string | null;
  startSeconds: number | null;
  confidence: number | null;
}

export interface DnaStat<T = number> {
  key: string;
  label: string;
  value: T;
  display: string;
  state: DnaState;
  receipts: TrackRef[];
  note?: string;
}

export interface PlatformLinks {
  spotify?: string; // track id
  deezer?: string; // track id
  youtube?: string; // video id
}

// A recognized track, normalized for V2 (merges RecognizedTrack + raw metadata).
export interface IntelTrack {
  id: string;
  position: number;
  title: string | null;
  artist: string | null;
  album: string | null;
  isrc: string | null;
  startSeconds: number | null;
  endSeconds: number | null;
  confidence: number | null;
  status: SegmentStatus;
  platforms: PlatformLinks;
}

export interface RadarAxis {
  axis: string;
  value: number; // 0–100, all from real recognition data
  proxy?: boolean;
}

export interface DjDnaV2 {
  totalTracks: number;
  identified: number;
  unknownCount: number;
  radar: RadarAxis[];
  stats: DnaStat<unknown>[]; // ordered; mixed live / forming / needs_dsp
}

export interface Trait {
  id: string;
  label: string;
  description: string; // descriptive, never a grade
  evidence: TrackRef[];
}

export interface Milestone {
  id: string;
  label: string;
  achieved: boolean;
  detail: string;
  evidence: TrackRef[];
}
