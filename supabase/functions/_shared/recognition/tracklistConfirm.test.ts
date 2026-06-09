// Tests for the pure confirm helpers that confirm-tracklist relies on.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildJobConfirmFields, toDisplayTracklist } from "./tracklistConfirm.ts";
import type { ConfirmedTrackRow } from "./trackSegmentMerge.ts";

const NOW = "2026-06-08T00:00:00.000Z";

Deno.test("buildJobConfirmFields — admin (V1) and AI (V2) reviewer shapes", () => {
  assertEquals(buildJobConfirmFields({ source: "admin", reviewedBy: "u1" }, NOW), {
    status: "confirmed",
    review_source: "admin",
    reviewed_by: "u1",
    review_confidence: null,
    reviewed_at: NOW,
  });
  assertEquals(buildJobConfirmFields({ source: "ai", confidence: 0.93 }, NOW), {
    status: "confirmed",
    review_source: "ai",
    reviewed_by: null,
    review_confidence: 0.93,
    reviewed_at: NOW,
  });
});

Deno.test("toDisplayTracklist maps {title,artist} + drops title-less rows", () => {
  const mk = (over: Partial<ConfirmedTrackRow>): ConfirmedTrackRow => ({
    mix_id: "m", position: 1, title: null, artist: null,
    start_seconds: null, end_seconds: null, bpm: null, musical_key: null,
    genre: null, energy_level: null, vocal_density: null, popularity_score: null,
    source: "auto", confidence: null, metadata: null, ...over,
  });
  const rows = [
    mk({ position: 1, title: "A", artist: "X" }),
    mk({ position: 2, title: null, artist: null }), // dropped
    mk({ position: 3, title: "C", artist: null }),
  ];
  assertEquals(toDisplayTracklist(rows), [
    { title: "A", artist: "X" },
    { title: "C", artist: "" },
  ]);
});
