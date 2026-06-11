// Pure orchestration logic for the ACRCloud File-Scanning transport (Stage B
// pt2). NO network, NO Deno APIs — the thin start-mix-recognition /
// poll-mix-recognition edge fns call these alongside the (network) acrCloudClient.
// Unit-testable in isolation, mirroring recognitionNormalize / trackSegmentMerge.
//
// ⚠️ The ACRCloud file-scan STATE codes + result envelope are from RECOGNITION-SPEC
// §1 + ACRCloud docs — reconcile against a REAL response once the container exists.

import {
  type AcrFileScanResult,
  normalizeAcrResult,
  type SegmentRow,
} from "./recognitionNormalize.ts";
import {
  type ConfirmedTrackRow,
  mergeSegmentsToTracklist,
} from "./trackSegmentMerge.ts";

export type JobStatus =
  | "queued"
  | "processing"
  | "recognition_complete"
  | "needs_review"
  | "ai_review"
  | "confirmed"
  | "failed";

// ACRCloud File-Scanning `state`: 0 processing · 1 ready · -1 no result ·
// -2/-3 error. Map each to the next job status + how the poller should act.
export interface ScanOutcome {
  status: JobStatus; // next mix_recognition_jobs.status
  terminal: boolean; // stop polling this job
  parseResult: boolean; // state === 1 → normalize + persist segments
  errorMessage: string | null;
}

export function outcomeForState(state: number): ScanOutcome {
  switch (state) {
    case 1:
      // Ready. Lands as recognition_complete — NEVER auto-'confirmed' (that
      // status belongs to the human/AI review step, confirm-tracklist).
      return {
        status: "recognition_complete",
        terminal: true,
        parseResult: true,
        errorMessage: null,
      };
    case 0:
      return {
        status: "processing",
        terminal: false,
        parseResult: false,
        errorMessage: null,
      };
    case -1:
      // Scan ran, nothing matched — legitimate (deep-crate / unreleased), NOT a
      // failure. Route to review/paste, never auto-fail.
      return {
        status: "needs_review",
        terminal: true,
        parseResult: false,
        errorMessage: "no_result",
      };
    default:
      // -2 / -3 (and any unknown negative) → provider/processing error.
      return {
        status: "failed",
        terminal: true,
        parseResult: false,
        errorMessage: `acrcloud_state_${state}`,
      };
  }
}

// Defensive timeline extraction — the file-scan result envelope nesting varies
// (bare [...] timeline | {data:[...timeline]} | {data:[{state,results:[...]}]} |
// {results:[...]}). normalizeAcrResult already tolerates {data:[...]} | [...];
// this widens that for the live envelope. ⚠️ reconcile against a real response.
export function extractTimeline(raw: unknown): AcrFileScanResult {
  if (Array.isArray(raw)) return { data: raw };
  const r = raw as Record<string, any> | null | undefined;
  if (!r || typeof r !== "object") return { data: [] };
  if (Array.isArray(r.data)) {
    const first = r.data[0];
    // A single {state, results:{...}} envelope wraps the timeline in data[0];
    // a bare timeline puts {offset,...} items directly in data[].
    if (
      first && typeof first === "object" && !("offset" in first) &&
      (first.results || first.result)
    ) {
      const inner = first.results ?? first.result;
      if (Array.isArray(inner)) return { data: inner };
      if (inner && typeof inner === "object") {
        // REAL File-Scanning: the timeline lives at data[0].results.music[].
        if (Array.isArray(inner.music)) return { data: inner.music };
        if (Array.isArray(inner.data)) return { data: inner.data };
      }
    }
    return { data: r.data };
  }
  if (
    r.results && typeof r.results === "object" && Array.isArray(r.results.music)
  ) {
    return { data: r.results.music };
  }
  if (Array.isArray(r.results)) return { data: r.results };
  return { data: [] };
}

export interface AppliedResult {
  segments: SegmentRow[];
  tracklist: ConfirmedTrackRow[];
}

// Pure: a ready raw payload → the rows to persist (raw segments + auto tracklist).
export function buildPersistFromResult(
  raw: unknown,
  ctx: { jobId: string; mixId: string },
): AppliedResult {
  const segments = normalizeAcrResult(extractTimeline(raw), ctx);
  const tracklist = mergeSegmentsToTracklist(segments);
  return { segments, tracklist };
}

// Poll bookkeeping: a transient fetch error leaves the job processing and bumps
// retry_count; only after MAX_POLL_RETRIES do we give up and mark it failed.
export const MAX_POLL_RETRIES = 10;
export function failAfterTransientError(retryCount: number): boolean {
  return retryCount + 1 >= MAX_POLL_RETRIES;
}
