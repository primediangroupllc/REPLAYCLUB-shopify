// Stage B-core synthetic tests — pure data engine, NO ACRCloud, NO secrets.
// Run: deno test --allow-net --allow-env --allow-read supabase/functions/
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { acrCloudConfigured } from "./acrCloudConfig.ts";
import {
  extractPlatformIds,
  normalizeAcrResult,
  statusFromConfidence,
} from "./recognitionNormalize.ts";
import { mergeSegmentsToTracklist } from "./trackSegmentMerge.ts";
import {
  renumberPositions,
  validateTracklistForConfirm,
} from "./tracklistConfirm.ts";
import { extractTimeline } from "./scanOrchestration.ts";
import {
  MOCK_ACR_FILE_SCAN_ENVELOPE,
  MOCK_ACR_RESULT,
} from "./mockAcrCloudPayload.ts";

const ACR_ENV = [
  "ACRCLOUD_CONSOLE_API_TOKEN",
  "ACRCLOUD_FS_CONTAINER_ID",
  "ACRCLOUD_FS_REGION",
];
const clearAcrEnv = () => ACR_ENV.forEach((k) => Deno.env.delete(k));

Deno.test("acrCloudConfigured() is false without env, true only when all 3 set", () => {
  clearAcrEnv();
  assertEquals(acrCloudConfigured(), false);
  Deno.env.set("ACRCLOUD_CONSOLE_API_TOKEN", "t");
  Deno.env.set("ACRCLOUD_FS_CONTAINER_ID", "c");
  assertEquals(acrCloudConfigured(), false); // partial → still false
  Deno.env.set("ACRCLOUD_FS_REGION", "us-west-2");
  assertEquals(acrCloudConfigured(), true);
  clearAcrEnv();
});

Deno.test("statusFromConfidence threshold mapping", () => {
  assertEquals(statusFromConfidence(96), "confirmed");
  assertEquals(statusFromConfidence(90), "confirmed");
  assertEquals(statusFromConfidence(89), "likely");
  assertEquals(statusFromConfidence(70), "likely");
  assertEquals(statusFromConfidence(69), "possible");
  assertEquals(statusFromConfidence(40), "possible");
  assertEquals(statusFromConfidence(39), "unknown");
  assertEquals(statusFromConfidence(null), "unknown");
  assertEquals(statusFromConfidence(undefined), "unknown");
});

Deno.test("normalize: mock payload → segments with correct field mapping + status", () => {
  const segs = normalizeAcrResult(MOCK_ACR_RESULT, { jobId: "j1", mixId: "m1" });
  assertEquals(segs.length, 6);

  const first = segs[0];
  assertEquals(first.title, "Too Cool To Be Careless");
  assertEquals(first.artist, "PAWSA");
  assertEquals(first.album, "SOLA");
  assertEquals(first.isrc, "GB1234567890");
  assertEquals(first.detected_start_seconds, 0);
  assertEquals(first.detected_end_seconds, 296); // offset + played_duration
  assertEquals(first.sample_start_seconds, 0);
  assertEquals(first.sample_end_seconds, 12); // ms → seconds
  assertEquals(first.source, "acrcloud");
  assertEquals(first.source_confidence, 96);
  assertEquals(first.status, "confirmed");

  assertEquals(segs.map((s) => s.status), [
    "confirmed",
    "confirmed",
    "likely",
    "possible",
    "unknown",
    "unknown",
  ]);

  // last window had no music → an unknown segment
  assertEquals(segs[5].source, "unknown");
  assertEquals(segs[5].title, null);
});

Deno.test("platform_ids mapping handles {track:{id}} and {id} nestings; null when absent", () => {
  const segs = normalizeAcrResult(MOCK_ACR_RESULT, { jobId: "j1", mixId: "m1" });
  assertEquals((segs[0].platform_ids as Record<string, unknown>)?.spotify, "spfy_pawsa");
  assertEquals((segs[0].platform_ids as Record<string, unknown>)?.apple_music, "am_pawsa");
  assertEquals((segs[2].platform_ids as Record<string, unknown>)?.spotify, "spfy_toman");
  assertEquals(segs[3].platform_ids, null); // no external_metadata

  // direct helper checks
  assertEquals(extractPlatformIds(null), null);
  assertEquals(extractPlatformIds({}), null);
  assertEquals(extractPlatformIds({ deezer: { id: "dz1" } })?.deezer, "dz1");
});

Deno.test("merge: collapses repeated track + builds confirmed_tracklist shape", () => {
  const segs = normalizeAcrResult(MOCK_ACR_RESULT, { jobId: "j1", mixId: "m1" });
  const tl = mergeSegmentsToTracklist(segs);

  // 6 segments → PAWSA (windows 1+2) merges → 5 tracklist entries
  assertEquals(tl.length, 5);

  // PAWSA merged: spans 0 → 356 (296 + 60), keeps the top confidence 96
  assertEquals(tl[0].title, "Too Cool To Be Careless");
  assertEquals(tl[0].start_seconds, 0);
  assertEquals(tl[0].end_seconds, 356);
  assertEquals(tl[0].confidence, 96);

  // positions sequential, source auto, enrichment null, metadata carries isrc/platform_ids
  assertEquals(tl.map((t) => t.position), [1, 2, 3, 4, 5]);
  assertEquals(tl[0].source, "auto");
  assertEquals(tl[0].bpm, null);
  assertEquals(tl[0].musical_key, null);
  assertEquals((tl[0].metadata as Record<string, unknown>)?.isrc, "GB1234567890");
  assert((tl[0].metadata as Record<string, unknown>)?.platform_ids != null);
});

Deno.test("unknown / low-confidence: <40 score AND no-match window both → unknown", () => {
  const segs = normalizeAcrResult(MOCK_ACR_RESULT, { jobId: "j1", mixId: "m1" });
  const unknowns = segs.filter((s) => s.status === "unknown");
  assertEquals(unknowns.length, 2); // the score-31 match + the empty window
});

Deno.test("validateTracklistForConfirm: empty + out-of-sequence flagged; title-less ALLOWED (Decision B)", () => {
  assertEquals(validateTracklistForConfirm([]).length, 1); // empty

  const segs = normalizeAcrResult(MOCK_ACR_RESULT, { jobId: "j1", mixId: "m1" });
  const tl = mergeSegmentsToTracklist(segs);
  // tl has a title-less unknown row but is sequential 1..n → now VALID (unknowns
  // are private review records; toDisplayTracklist filters them from public).
  assertEquals(validateTracklistForConfirm(tl), []);

  // out-of-sequence positions are still flagged
  const gapped = tl.map((r, i) => (i === 2 ? { ...r, position: 99 } : r));
  assert(validateTracklistForConfirm(gapped).length >= 1);
});

Deno.test("renumberPositions: 1..n in order; gaps/dupes normalized; fields preserved (Decision A)", () => {
  const segs = normalizeAcrResult(MOCK_ACR_RESULT, { jobId: "j1", mixId: "m1" });
  const tl = mergeSegmentsToTracklist(segs);
  // simulate a delete (drop the position-3 row) + a hand-added row at position 99
  const messy = [
    tl[0],
    tl[1],
    tl[3],
    tl[4],
    { ...tl[0], position: 99, title: "Added", artist: "Me" },
  ];
  const fixed = renumberPositions(messy);
  assertEquals(fixed.map((r) => r.position), [1, 2, 3, 4, 5]);
  assertEquals(fixed[4].title, "Added"); // the was-99 row sorts last
  assertEquals(validateTracklistForConfirm(fixed), []); // valid after renumber
});

Deno.test("REAL ACRCloud File-Scanning envelope: extractTimeline + normalize → 24/24, no null placeholder", () => {
  // extractTimeline must drill into data[0].results.music[] (the LIVE shape),
  // NOT treat the file object itself as one timeline item (the pre-patch bug,
  // which yielded a single null 'unknown' segment — 0 of 24 captured).
  const timeline = extractTimeline(MOCK_ACR_FILE_SCAN_ENVELOPE);
  assertEquals(timeline.data?.length, 24);

  const segs = normalizeAcrResult(timeline, { jobId: "j1", mixId: "m1" });
  assertEquals(segs.length, 24);
  // Every window resolved to a real match — NO null "unknown" placeholder.
  assert(segs.every((s) => s.source === "acrcloud"));
  assert(segs.every((s) => s.title !== null && s.artist !== null));

  // Offsets parse: first item offset 30, played_duration 140 → end 170.
  assertEquals(segs[0].detected_start_seconds, 30);
  assertEquals(segs[0].detected_end_seconds, 170);
  // sample offsets read from INSIDE item.result (the real-shape fallback).
  assertEquals(segs[0].sample_start_seconds, 30);
  assertEquals(segs[0].sample_end_seconds, 170);

  // Confidence maps from the ACRCloud score; platform_ids from external_metadata.
  const closer = segs.find((s) => s.title === "Closer (Extended)")!;
  assertEquals(closer.artist, "FIRZA");
  assertEquals(closer.source_confidence, 97);
  assertEquals(closer.normalized_confidence, 97);
  assertEquals(closer.status, "confirmed");
  assertEquals(
    (closer.platform_ids as Record<string, unknown>)?.spotify,
    "spfy_firza",
  );

  // merge → real rows (24 distinct title+artist → 24 rows), no null placeholders.
  const tl = mergeSegmentsToTracklist(segs);
  assertEquals(tl.length, 24);
  assert(tl.every((t) => t.title !== null && t.artist !== null));
  assert(tl.every((t) => t.source === "auto"));
});
