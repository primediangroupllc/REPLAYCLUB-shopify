// Representative ACRCloud File Scanning getResults payload for synthetic tests —
// NO real API, NO secrets. Exercises: confirmed / likely / possible / unknown
// statuses, platform_ids (two nesting forms), a REPEATED track (merge), and a
// no-match window.
//
// ⚠️ SHAPE is reconstructed from RECOGNITION-SPEC §1 — reconcile against a real
// ACRCloud response when the container exists.

import type { AcrFileScanResult } from "./recognitionNormalize.ts";

export const MOCK_ACR_RESULT: AcrFileScanResult = {
  data: [
    {
      offset: 0,
      played_duration: 296,
      sample_begin_time_offset_ms: 0,
      sample_end_time_offset_ms: 12000,
      result: {
        music: [
          {
            title: "Too Cool To Be Careless",
            artists: [{ name: "PAWSA" }],
            album: { name: "SOLA" },
            score: 96,
            external_ids: { isrc: "GB1234567890" },
            genres: [{ name: "Tech House" }],
            external_metadata: {
              spotify: { track: { id: "spfy_pawsa" } },
              apple_music: { track: { id: "am_pawsa" } },
            },
          },
        ],
      },
    },
    // SAME track detected again in the next window → must MERGE into one entry.
    {
      offset: 296,
      played_duration: 60,
      result: {
        music: [
          { title: "Too Cool To Be Careless", artists: [{ name: "PAWSA" }], score: 94 },
        ],
      },
    },
    {
      offset: 356,
      played_duration: 256,
      result: {
        music: [
          {
            title: "Selecta",
            artists: [{ name: "Toman" }],
            score: 81, // likely
            external_metadata: { spotify: { id: "spfy_toman" } },
          },
        ],
      },
    },
    {
      offset: 612,
      played_duration: 293,
      result: {
        music: [{ title: "Lose Control", artists: [{ name: "Mochakk" }], score: 58 }], // possible
      },
    },
    {
      offset: 905,
      played_duration: 235,
      result: {
        music: [{ title: "Obscure ID", artists: [{ name: "Unknown" }], score: 31 }], // unknown (low)
      },
    },
    {
      offset: 1140,
      played_duration: 200,
      result: { music: [] }, // no-match window → unknown segment
    },
  ],
};

// ── REAL ACRCloud File-Scanning envelope (observed 2026-06-11, job cb7264f4) ──
// Locks the parser to the LIVE getResults shape: raw = { data: [ fileObject ] },
// where fileObject.results.music[] is the timeline and each item is
//   { offset, played_duration, result: <a SINGLE matched track with the
//     sample_* offsets nested inside result> }.
// The 24 track values are the real matches from the first prod scan; a few
// result sub-fields (album/isrc/external_metadata) are synthesized where the
// live response didn't retain them. This is intentionally the RAW pre-
// extractTimeline envelope (the bug lived in extractTimeline + normalizeAcrResult).
const REAL_MATCHES: Array<[number, number, string, string, number]> = [
  // offset(s), played_duration(s), title, artist, score(0–100)
  [30, 140, "No Hesitating (Max Dean Remix)", "Joe Rolét", 60],
  [170, 180, "Closer (Extended)", "FIRZA", 97],
  [344, 120, "Llamada", "Kofla", 100],
  [470, 120, "Into My Life (feat. Joyce Sims)", "Cam Stockman", 96],
  [590, 120, "I Remember (Tommy Phillips Remix)", "deadmau5/Kaskade", 100],
  [860, 100, "The Bag", "Stef Davidse", 100],
  [960, 140, "No Joke", "Josh Butler", 99],
  [1100, 140, "Make It Hot", "Rob Stillekens", 95],
  [1240, 180, "Don't Stop", "Dani (RO)", 100],
  [1420, 170, "Some More", "Analogroove", 49],
  [1590, 300, "Yes Baby", "Max Dean", 100],
  [1890, 200, "Last Day (Original Mix)", "Josh Butler", 95],
  [2400, 250, "Now You Do (Original Mix)", "David Lowe", 97],
  [2650, 130, "Reason", "Pablo Aristimuño", 93],
  [2780, 150, "The Fix", "Funk Cartel", 96],
  [2930, 150, "Enclosure", "Abel Budding", 95],
  [3080, 200, "Times Lost", "Julian Fijma", 100],
  [3280, 150, "Versatile", "L.P. Rhythm", 100],
  [3430, 185, "Don't Stop", "Alan Fitzpatrick", 96],
  [3615, 305, "Midnight Flame", "Rooléh", 98],
  [3920, 90, "What You Wanna Do (Original Mix)", "Sosa UK", 79],
  [4010, 181, "Can You Dig It", "Obskür", 96],
  [4191, 99, "Make Believe", "Luke Dean", 100],
  [4290, 120, "909", "Riordan", 97],
];

export const MOCK_ACR_FILE_SCAN_ENVELOPE = {
  data: [
    {
      id: "filescan_test_0b6ace92",
      cid: "test-container",
      state: 1,
      count: 1, // file count, NOT match count
      total: 1,
      data_type: "audio_url",
      duration: 4704,
      results: {
        music: REAL_MATCHES.map(([offset, played, title, artist, score]) => ({
          type: "traverse",
          offset,
          played_duration: played,
          result: {
            title,
            artists: [{ name: artist }],
            album: { name: title },
            score,
            external_ids: { isrc: `TEST${offset}` },
            // One real-style external_metadata entry to exercise platform_ids.
            external_metadata: offset === 170
              ? { spotify: { track: { id: "spfy_firza" } } }
              : {},
            sample_begin_time_offset_ms: offset * 1000,
            sample_end_time_offset_ms: (offset + played) * 1000,
          },
        })),
      },
    },
  ],
};
