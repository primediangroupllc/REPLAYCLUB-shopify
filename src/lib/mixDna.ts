// Mix Intelligence V2 — DJ DNA computation. PURE + DETERMINISTIC.
//
// Recognition-first: input is the mix's confirmed_tracklist rows (via
// useRecognitionJob). NO Gemini, NO mix_analysis, NO arbitrary 0–100 mix score,
// NO coaching. Every stat ships with the exact tracks that back it (receipts).
//
// Honesty model: signals we can compute from today's data are "live"; signals
// that need the enrichment re-parse (genre/label/popularity) are "forming";
// signals that need DSP (bpm/key/energy) are "needs_dsp". We never fabricate a
// value for a forming/needs_dsp signal.
import type { RecognizedTrack } from "@/types/recognition";
import type { ConfirmedRow } from "@/hooks/useRecognitionJob";
import type {
  DjDnaV2,
  DnaStat,
  IntelTrack,
  Milestone,
  RadarAxis,
  Trait,
  TrackRef,
} from "@/types/mixIntelligence";

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

const toRef = (t: IntelTrack): TrackRef => ({
  position: t.position,
  title: t.title,
  artist: t.artist,
  startSeconds: t.startSeconds,
  confidence: t.confidence,
});

const hasPlatform = (t: IntelTrack) =>
  !!(t.platforms.spotify || t.platforms.deezer || t.platforms.youtube);

const isNamed = (t: IntelTrack) => !!t.title && !!t.artist && t.status !== "unknown";

// Merge the RecognizedTrack view with the raw confirmed_tracklist metadata
// (platform_ids / album / isrc the RecognizedTrack mapping drops).
export function buildIntelTracks(
  tracks: RecognizedTrack[],
  rowsById: Record<string, ConfirmedRow>,
): IntelTrack[] {
  return tracks.map((t) => {
    const meta = (rowsById[t.id]?.metadata ?? {}) as Record<string, unknown>;
    const pid = (meta.platform_ids ?? {}) as Record<string, unknown>;
    const yt = pid.youtube as { vid?: string } | string | undefined;
    return {
      id: t.id,
      position: t.position,
      title: t.title,
      artist: t.artist,
      album: (meta.album as string | undefined) ?? t.album ?? null,
      isrc: (meta.isrc as string | undefined) ?? null,
      startSeconds: t.startSeconds,
      endSeconds: t.endSeconds,
      confidence: t.confidence,
      status: t.status,
      platforms: {
        spotify: typeof pid.spotify === "string" ? pid.spotify : undefined,
        deezer: typeof pid.deezer === "string" ? pid.deezer : undefined,
        youtube:
          typeof yt === "string"
            ? yt
            : yt && typeof yt.vid === "string"
              ? yt.vid
              : undefined,
      },
    };
  });
}

function groupByArtist(named: IntelTrack[]): Map<string, IntelTrack[]> {
  const byArtist = new Map<string, IntelTrack[]>();
  for (const t of named) {
    const a = (t.artist ?? "").trim();
    if (!a) continue;
    const arr = byArtist.get(a);
    if (arr) arr.push(t);
    else byArtist.set(a, [t]);
  }
  return byArtist;
}

export function computeDjDna(intel: IntelTrack[]): DjDnaV2 {
  const total = intel.length;
  const named = intel.filter(isNamed);
  const identified = named.length;
  const unknownCount = total - identified;

  const byArtist = groupByArtist(named);
  const uniqueArtists = byArtist.size;

  let topArtist = "";
  let topTracks: IntelTrack[] = [];
  for (const [artist, arr] of byArtist) {
    if (arr.length > topTracks.length) {
      topArtist = artist;
      topTracks = arr;
    }
  }

  const linked = named.filter(hasPlatform);
  const offSpotify = named.filter((t) => !t.platforms.spotify);

  const cConfirmed = intel.filter((t) => t.status === "confirmed").length;
  const cLikely = intel.filter((t) => t.status === "likely").length;
  const cPossible = intel.filter((t) => t.status === "possible").length;
  const cOpen = intel.filter((t) => t.status === "unknown").length;
  const confVals = named
    .map((t) => t.confidence)
    .filter((c): c is number => c != null);
  const avgConf = confVals.length
    ? Math.round(confVals.reduce((a, b) => a + b, 0) / confVals.length)
    : 0;
  const lowConf = named.filter((t) => (t.confidence ?? 0) < 90);

  const diversityPct = pct(uniqueArtists, identified);
  const reachPct = pct(linked.length, identified);
  const depthPct = pct(offSpotify.length, identified);
  const coveragePct = pct(identified, total);

  const radar: RadarAxis[] = [
    { axis: "Coverage", value: coveragePct },
    { axis: "Diversity", value: diversityPct },
    { axis: "Linked", value: reachPct },
    { axis: "Confidence", value: avgConf },
    { axis: "Depth", value: depthPct, proxy: true },
  ];

  const stats: DnaStat<unknown>[] = [
    {
      key: "artist_affinity",
      label: "Artist affinity",
      state: "live",
      value: topArtist,
      display:
        topTracks.length > 1
          ? `${topArtist} ×${topTracks.length}`
          : "All unique — pure selector",
      receipts: (topTracks.length > 1 ? topTracks : named.slice(0, 6)).map(toRef),
    },
    {
      key: "diversity",
      label: "Crate diversity",
      state: "live",
      value: diversityPct,
      display: `${uniqueArtists} artists across ${identified} tracks`,
      receipts: named.map(toRef),
    },
    {
      key: "platform_reach",
      label: "Platform reach",
      state: "live",
      value: reachPct,
      display: `${linked.length} of ${identified} linked (Spotify/Deezer/YouTube)`,
      receipts: linked.map(toRef),
    },
    {
      key: "confidence_quality",
      label: "Recognition quality",
      state: "live",
      value: avgConf,
      display: `${cConfirmed} locked · ${cLikely} likely · ${cPossible} possible · ${cOpen} open`,
      receipts: lowConf.map(toRef),
      note: "How crisply each pick was identified — not a grade of the mix.",
    },
    {
      key: "genres",
      label: "Genre lean",
      state: "forming",
      value: [],
      display: "Forming",
      receipts: [],
      note: "Genres are already in your scan's raw data — they light up with the enrichment re-parse.",
    },
    {
      key: "labels",
      label: "Label affinity",
      state: "forming",
      value: [],
      display: "Forming",
      receipts: [],
      note: "Record labels (the imprint behind each track) recover from the scan's raw data next.",
    },
    {
      key: "underground",
      label: "Underground lean",
      state: "forming",
      value: depthPct,
      display: `Early signal: ~${depthPct}% off Spotify`,
      receipts: offSpotify.map(toRef),
      note: "A precise underground-vs-mainstream score needs popularity enrichment; this is a proxy.",
    },
    {
      key: "bpm_energy",
      label: "Tempo & energy",
      state: "needs_dsp",
      value: 0,
      display: "Needs audio analysis",
      receipts: [],
      note: "BPM, key and energy aren't in recognition data — they arrive with the DSP layer.",
    },
  ];

  return { totalTracks: total, identified, unknownCount, radar, stats };
}

export function deriveTraits(intel: IntelTrack[]): Trait[] {
  const named = intel.filter(isNamed);
  const identified = named.length;
  if (!identified) return [];

  const byArtist = groupByArtist(named);
  const uniqueArtists = byArtist.size;
  const diversityPct = pct(uniqueArtists, identified);
  const repeats = named.filter(
    (t) => (byArtist.get((t.artist ?? "").trim())?.length ?? 0) > 1,
  );
  const offSpotify = named.filter((t) => !t.platforms.spotify);
  const linked = named.filter(hasPlatform);
  const confVals = named
    .map((t) => t.confidence)
    .filter((c): c is number => c != null);
  const avgConf = confVals.length
    ? confVals.reduce((a, b) => a + b, 0) / confVals.length
    : 0;

  const traits: Trait[] = [];
  if (diversityPct >= 80)
    traits.push({
      id: "selector",
      label: "Selector",
      description: "You rarely repeat an artist — breadth over rotation.",
      evidence: named.slice(0, 6).map(toRef),
    });
  if (repeats.length)
    traits.push({
      id: "loyalist",
      label: "Loyalist",
      description: "You return to artists you trust within a set.",
      evidence: repeats.map(toRef),
    });
  if (offSpotify.length / identified >= 0.4)
    traits.push({
      id: "digger",
      label: "Digger",
      description: "A real share of your crate lives off the mainstream platforms.",
      evidence: offSpotify.map(toRef),
    });
  if (linked.length / identified >= 0.7)
    traits.push({
      id: "connected",
      label: "Connected Crate",
      description: "Your picks are well-documented across streaming platforms.",
      evidence: linked.map(toRef),
    });
  if (avgConf >= 85)
    traits.push({
      id: "clean-read",
      label: "Clean Read",
      description: "Your selections are crisply identifiable.",
      evidence: named.filter((t) => (t.confidence ?? 0) >= 90).slice(0, 6).map(toRef),
    });
  if (!traits.length)
    traits.push({
      id: "forming",
      label: "Identity forming",
      description: "More scans will sharpen your DJ DNA.",
      evidence: [],
    });
  return traits;
}

export function deriveMilestones(intel: IntelTrack[]): Milestone[] {
  const total = intel.length;
  const named = intel.filter(isNamed);
  const identified = named.length;
  const uniqueArtists = new Set(
    named.map((t) => (t.artist ?? "").trim()).filter(Boolean),
  ).size;
  const linked = named.filter(hasPlatform);

  return [
    {
      id: "scanned",
      label: "First scan complete",
      achieved: total > 0,
      detail: `${total} segments recognized from your set`,
      evidence: [],
    },
    {
      id: "identified",
      label: "Tracklist recognized",
      achieved: identified > 0,
      detail: `${identified} of ${total} tracks identified`,
      evidence: named.slice(0, 8).map(toRef),
    },
    {
      id: "artists",
      label: "Artist spread",
      achieved: uniqueArtists >= 10,
      detail: `${uniqueArtists} unique artists in this set`,
      evidence: [],
    },
    {
      id: "linked",
      label: "Documented crate",
      achieved: identified > 0 && linked.length === identified,
      detail: `${linked.length} of ${identified} tracks linked to a platform`,
      evidence: linked.slice(0, 8).map(toRef),
    },
    {
      id: "deepcut",
      label: "Deep cut spotted",
      achieved: false,
      detail: "Forming — arrives with crate enrichment (track popularity).",
      evidence: [],
    },
  ];
}
