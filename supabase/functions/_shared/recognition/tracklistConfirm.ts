// Pure confirm helpers (NOT an edge function). The confirm-tracklist edge fn
// (built later) will call these; keeping the logic pure makes it unit-testable
// and keeps the reviewer abstraction (admin V1 / AI V2) in one place.
// NO network, NO Deno APIs. (Stage B-core.)

import type { ConfirmedTrackRow } from "./trackSegmentMerge.ts";

export type ReviewSource = "admin" | "ai" | "user";

export interface JobConfirmFields {
  status: "confirmed";
  review_source: ReviewSource;
  reviewed_by: string | null;
  review_confidence: number | null;
  reviewed_at: string;
}

// The mix_recognition_jobs fields to set when a reviewer confirms. Reviewer-
// agnostic: admin in V1 (reviewed_by = uid); AI in V2 writes review_source='ai'
// with reviewed_by=null — no schema change needed. `now` is passed in to keep
// this pure/deterministic.
export function buildJobConfirmFields(
  reviewer: {
    source: ReviewSource;
    reviewedBy?: string | null;
    confidence?: number | null;
  },
  now: string,
): JobConfirmFields {
  return {
    status: "confirmed",
    review_source: reviewer.source,
    reviewed_by: reviewer.reviewedBy ?? null,
    review_confidence: reviewer.confidence ?? null,
    reviewed_at: now,
  };
}

// Decision A: renumber positions 1..n in current (position) order, before
// validation — deletes/adds during review can leave gaps. Preserves every other
// field (incl. id at runtime via spread), so callers can persist the new order.
export function renumberPositions<T extends ConfirmedTrackRow>(rows: T[]): T[] {
  return [...rows]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((r, i) => ({ ...r, position: i + 1 }));
}

// Validate a tracklist before confirming. Decision B: unknown / title-less rows
// ARE allowed — they're private structural review records, and toDisplayTracklist
// filters them out of the public mixes.tracklist. We only require a non-empty
// list with sequential positions (renumberPositions guarantees the latter when
// run first). Returns errors ([] = ok).
export function validateTracklistForConfirm(rows: ConfirmedTrackRow[]): string[] {
  const errors: string[] = [];
  if (!rows.length) errors.push("tracklist is empty");
  rows.forEach((r, i) => {
    if (r.position !== i + 1) {
      errors.push(`position ${r.position} out of sequence at index ${i}`);
    }
  });
  return errors;
}

// Simple {title,artist}[] mirror for mixes.tracklist (display compat — Profile /
// MixLineageTree keep rendering off mixes.tracklist).
export function toDisplayTracklist(
  rows: ConfirmedTrackRow[],
): { title: string; artist: string }[] {
  return rows
    .filter((r) => r.title || r.artist)
    .map((r) => ({ title: r.title ?? "", artist: r.artist ?? "" }));
}
