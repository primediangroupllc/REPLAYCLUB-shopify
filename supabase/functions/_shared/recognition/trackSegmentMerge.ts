// Pure: merge a job's raw recognized_track_segments into an ordered
// confirmed_tracklist (source='auto'). Consecutive segments for the SAME track
// collapse into one (extend the time range, keep the highest confidence).
// NO network, NO Deno APIs. (Stage B-core.)

import type { SegmentRow, SegmentStatus } from "./recognitionNormalize.ts";

// One confirmed_tracklist row (mirrors the table). Enrichment columns
// (bpm/key/genre/energy/vocal/popularity) are null in V1 — filled later.
export interface ConfirmedTrackRow {
  mix_id: string;
  position: number;
  title: string | null;
  artist: string | null;
  start_seconds: number | null;
  end_seconds: number | null;
  bpm: number | null;
  musical_key: string | null;
  genre: string | null;
  energy_level: number | null;
  vocal_density: number | null;
  popularity_score: number | null;
  source: "auto" | "user_edit" | "admin_edit" | "manual";
  confidence: number | null;
  metadata: Record<string, unknown> | null;
}

const norm = (s: string | null) => (s ?? "").trim().toLowerCase();

// Two segments are the "same track" if title+artist match — and at least one is
// non-empty (so two title-less unknown windows never merge together).
function sameTrack(a: SegmentRow, b: SegmentRow): boolean {
  return (
    norm(a.title) === norm(b.title) &&
    norm(a.artist) === norm(b.artist) &&
    Boolean(a.title || a.artist)
  );
}

export function mergeSegmentsToTracklist(
  segments: SegmentRow[],
): ConfirmedTrackRow[] {
  const sorted = [...segments].sort(
    (a, b) => (a.detected_start_seconds ?? 0) - (b.detected_start_seconds ?? 0),
  );

  const merged: SegmentRow[] = [];
  for (const seg of sorted) {
    const prev = merged[merged.length - 1];
    if (prev && sameTrack(prev, seg)) {
      // extend the range; keep the higher confidence
      prev.detected_end_seconds = seg.detected_end_seconds ??
        prev.detected_end_seconds;
      const pc = prev.normalized_confidence ?? 0;
      const sc = seg.normalized_confidence ?? 0;
      if (sc > pc) prev.normalized_confidence = seg.normalized_confidence;
      continue;
    }
    merged.push({ ...seg });
  }

  return merged.map((s, i) => ({
    mix_id: s.mix_id,
    position: i + 1,
    title: s.title,
    artist: s.artist,
    start_seconds: s.detected_start_seconds,
    end_seconds: s.detected_end_seconds,
    bpm: null,
    musical_key: null,
    genre: null,
    energy_level: null,
    vocal_density: null,
    popularity_score: null,
    source: "auto",
    confidence: s.normalized_confidence,
    metadata: {
      isrc: s.isrc ?? null,
      album: s.album ?? null,
      platform_ids: s.platform_ids ?? null,
      segment_status: s.status as SegmentStatus,
    },
  }));
}
