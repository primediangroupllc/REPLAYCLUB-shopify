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
