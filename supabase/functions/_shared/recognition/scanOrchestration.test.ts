// Unit tests for the Stage B pt2 orchestration — pure, no network/secrets.
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildPersistFromResult,
  failAfterTransientError,
  MAX_POLL_RETRIES,
  outcomeForState,
} from "./scanOrchestration.ts";
import { MOCK_ACR_RESULT } from "./mockAcrCloudPayload.ts";

Deno.test("outcomeForState maps ACRCloud states to the job lifecycle", () => {
  const ready = outcomeForState(1);
  assertEquals(ready.status, "recognition_complete"); // NEVER auto-'confirmed'
  assert(ready.terminal && ready.parseResult);

  const processing = outcomeForState(0);
  assertEquals(processing.status, "processing");
  assert(!processing.terminal && !processing.parseResult);

  const noResult = outcomeForState(-1);
  assertEquals(noResult.status, "needs_review"); // deep-crate ≠ failure
  assert(noResult.terminal && !noResult.parseResult);
  assertEquals(noResult.errorMessage, "no_result");

  for (const s of [-2, -3, -99]) {
    const err = outcomeForState(s);
    assertEquals(err.status, "failed");
    assert(err.terminal && !err.parseResult);
    assert(err.errorMessage != null);
  }
});

Deno.test("buildPersistFromResult: normalize + merge from a ready payload", () => {
  const { segments, tracklist } = buildPersistFromResult(MOCK_ACR_RESULT, {
    jobId: "job_1",
    mixId: "mix_1",
  });
  // 6 windows in the mock (incl. a repeat + a no-match window) → 6 raw segments.
  assertEquals(segments.length, 6);
  // The repeated PAWSA track collapses → 5 ordered tracklist rows.
  assertEquals(tracklist.length, 5);
  assertEquals(tracklist.map((t) => t.position), [1, 2, 3, 4, 5]);
  assert(tracklist.every((t) => t.source === "auto"));
  assertEquals(tracklist[0].title, "Too Cool To Be Careless");
  assertEquals(tracklist[0].mix_id, "mix_1");
  // Segments carry the job/mix context through.
  assert(segments.every((s) => s.job_id === "job_1" && s.mix_id === "mix_1"));
});

Deno.test("buildPersistFromResult tolerates a {state,results} envelope", () => {
  const enveloped = { data: [{ state: 1, results: MOCK_ACR_RESULT.data }] };
  const { tracklist } = buildPersistFromResult(enveloped, {
    jobId: "j",
    mixId: "m",
  });
  assertEquals(tracklist.length, 5);
});

Deno.test("buildPersistFromResult: empty / junk payloads → no rows (no throw)", () => {
  for (const raw of [null, {}, { data: [] }, "nope", 42]) {
    const out = buildPersistFromResult(raw, { jobId: "j", mixId: "m" });
    assertEquals(out.segments.length, 0);
    assertEquals(out.tracklist.length, 0);
  }
});

Deno.test("transient poll error fails only after MAX_POLL_RETRIES", () => {
  assert(!failAfterTransientError(0));
  assert(!failAfterTransientError(MAX_POLL_RETRIES - 2));
  assert(failAfterTransientError(MAX_POLL_RETRIES - 1));
});
