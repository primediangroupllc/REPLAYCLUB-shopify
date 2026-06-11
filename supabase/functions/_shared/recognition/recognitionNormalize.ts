// Pure ACRCloud File Scanning → recognized_track_segments normalizer.
// NO network, NO Deno APIs — a deterministic transform, unit-testable with the
// mock payload. (Stage B-core; the live client + edge fns come later.)
//
// ⚠️ SHAPE NOTE: the ACRCloud File Scanning result structure here is reconstructed
// from RECOGNITION-SPEC §1 + ACRCloud docs. Reconcile the exact field paths
// against a REAL response once the container exists — the structure + tests stay,
// only the extraction paths may need small tweaks. Parsing is defensive throughout.

export type SegmentStatus =
  | "confirmed"
  | "likely"
  | "possible"
  | "unknown"
  | "user_corrected";

// confidence (0–100) → status. Mirrors src/types/recognition.ts + spec thresholds
// (confirmed ≥90 / likely ≥70 / possible ≥40 / unknown <40 or null).
export function statusFromConfidence(
  confidence: number | null | undefined,
): SegmentStatus {
  if (confidence == null || Number.isNaN(confidence)) return "unknown";
  if (confidence >= 90) return "confirmed";
  if (confidence >= 70) return "likely";
  if (confidence >= 40) return "possible";
  return "unknown";
}

// One recognized_track_segments row (server-written; mirrors the table columns).
export interface SegmentRow {
  job_id: string;
  mix_id: string;
  sample_start_seconds: number | null;
  sample_end_seconds: number | null;
  detected_start_seconds: number | null;
  detected_end_seconds: number | null;
  title: string | null;
  artist: string | null;
  album: string | null;
  isrc: string | null;
  source: "acrcloud" | "audd" | "manual" | "unknown";
  source_confidence: number | null;
  normalized_confidence: number | null;
  status: SegmentStatus;
  platform_ids: Record<string, unknown> | null;
  raw_response: unknown;
}

// Permissive shapes for the provider payload (provider-defined; loose on purpose).
interface AcrMusic {
  title?: string;
  artists?: { name?: string }[];
  album?: { name?: string };
  score?: number; // 0–100
  external_ids?: { isrc?: string; upc?: string };
  genres?: { name?: string }[];
  release_date?: string;
  label?: string;
  duration_ms?: number;
  external_metadata?: Record<string, unknown>;
  // REAL File-Scanning nests the sampled-window times inside the matched result.
  sample_begin_time_offset_ms?: number;
  sample_end_time_offset_ms?: number;
  // Spec/mock shape wraps candidate matches under result.music[].
  music?: AcrMusic[];
}
interface AcrTimelineItem {
  offset?: number; // seconds into the mix
  played_duration?: number; // seconds
  sample_begin_time_offset_ms?: number;
  sample_end_time_offset_ms?: number;
  // REAL File-Scanning: a SINGLE matched track at item.result. Spec/mock shape:
  // an object carrying candidate matches under result.music[].
  result?: AcrMusic;
  music?: AcrMusic[]; // some shapes put candidates directly on the item
}
export interface AcrFileScanResult {
  data?: AcrTimelineItem[];
}

const sec = (ms?: number): number | null =>
  typeof ms === "number" ? ms / 1000 : null;
const clamp100 = (n?: number): number | null =>
  typeof n === "number" ? Math.max(0, Math.min(100, n)) : null;

// Pull platform track-ids out of external_metadata, defensively (nesting varies:
// {track:{id}} | {id} | scalar).
export function extractPlatformIds(
  meta?: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!meta || typeof meta !== "object") return null;
  const out: Record<string, unknown> = {};
  for (const k of ["spotify", "apple_music", "deezer", "youtube"]) {
    const v = (meta as Record<string, any>)[k];
    if (v == null) continue;
    out[k] = v?.track?.id ?? v?.id ?? v;
  }
  return Object.keys(out).length ? out : null;
}

export function normalizeAcrResult(
  payload: AcrFileScanResult | AcrTimelineItem[],
  ctx: { jobId: string; mixId: string },
): SegmentRow[] {
  const items: AcrTimelineItem[] = Array.isArray(payload)
    ? payload
    : payload?.data ?? [];
  const rows: SegmentRow[] = [];

  for (const item of items) {
    const start = typeof item.offset === "number" ? item.offset : null;
    const end = start != null && typeof item.played_duration === "number"
      ? start + item.played_duration
      : null;
    // Candidate matches. REAL File-Scanning puts a SINGLE matched track at
    // item.result; the spec/mock shape wraps candidates under item.result.music[]
    // (or item.music[]). Support all three.
    const resultObj = item.result;
    const candidates: AcrMusic[] = Array.isArray(resultObj?.music)
      ? resultObj!.music!
      : Array.isArray(item.music)
      ? item.music
      : resultObj &&
          (resultObj.title != null || resultObj.score != null ||
            resultObj.artists != null)
      ? [resultObj]
      : [];

    if (!candidates.length) {
      // No-match window → an "unknown" segment (the UI fills in the copy).
      rows.push({
        job_id: ctx.jobId,
        mix_id: ctx.mixId,
        sample_start_seconds: sec(item.sample_begin_time_offset_ms),
        sample_end_seconds: sec(item.sample_end_time_offset_ms),
        detected_start_seconds: start,
        detected_end_seconds: end,
        title: null,
        artist: null,
        album: null,
        isrc: null,
        source: "unknown",
        source_confidence: null,
        normalized_confidence: null,
        status: "unknown",
        platform_ids: null,
        raw_response: item,
      });
      continue;
    }

    // Best match = highest score in the window.
    const best = [...candidates].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
    const conf = clamp100(best.score);
    // REAL shape carries the sampled-window times inside the matched result; the
    // mock/spec shape carries them on the item. Prefer item, fall back to result.
    const sampleBeginMs = item.sample_begin_time_offset_ms ??
      best.sample_begin_time_offset_ms;
    const sampleEndMs = item.sample_end_time_offset_ms ??
      best.sample_end_time_offset_ms;
    rows.push({
      job_id: ctx.jobId,
      mix_id: ctx.mixId,
      sample_start_seconds: sec(sampleBeginMs),
      sample_end_seconds: sec(sampleEndMs),
      detected_start_seconds: start,
      detected_end_seconds: end,
      title: best.title ?? null,
      artist: best.artists?.[0]?.name ?? null,
      album: best.album?.name ?? null,
      isrc: best.external_ids?.isrc ?? null,
      source: "acrcloud",
      source_confidence: conf,
      normalized_confidence: conf,
      status: statusFromConfidence(conf),
      platform_ids: extractPlatformIds(best.external_metadata),
      raw_response: best,
    });
  }
  return rows;
}
