// ─────────────────────────────────────────────────────────────────────────────
// Homepage "Deck" artifact — a STATIC SNAPSHOT of one real, approved mix row.
//
// Source row: public.mixes id b8b95726-d131-4f1d-8169-cb36a75a671e
//   account fumix.mgmt@gmail.com · title "REPLAY CLUB-FUMIX 001"
//   status = approved · snapshotted 2026-06-10.
//
// Every field below is copied verbatim from that row's real data — nothing here
// is fabricated. The excerpt is two verbatim clauses selected from the real
// mix_analysis.summary (mix-level language only: no scores, no identity claims,
// no artist comparisons — the bottom of the EXPERIENCE-SPEC pronoun ladder).
//
// `waveformPeaks` is the real `peak` channel of the row's waveform_data (120
// points, 0–1). No public listen URL exists for this set yet, so the artifact
// omits the "listen" affordance rather than invent one.
// ─────────────────────────────────────────────────────────────────────────────

export interface ExampleMix {
  title: string;
  dateLabel: string;
  genres: string[];
  /** Two verbatim, mix-level clauses from the real analysis summary. */
  excerpt: string;
  /** Real peak envelope (0–1), 120 points, from the row's waveform_data. */
  waveformPeaks: number[];
}

export const exampleMix: ExampleMix = {
  title: "REPLAY CLUB-FUMIX 001",
  dateLabel: "June 2026",
  genres: ["Raw Techno", "Minimal House"],
  excerpt:
    "A stark, heads-down groove for a small, dark room. Less a journey, more a state of mind.",
  waveformPeaks: [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.667, 0.688, 0.711, 0.69, 0.736, 0.743,
    0.715, 0.755, 0.774, 0.705, 0.72, 0.758, 0.752, 0.755, 0.74, 0.743, 0.668,
    0.634, 0.666, 0.682, 0.778, 0.789, 0.782, 0.794, 0.796, 0.657, 0.643, 0.626,
    0.614, 0.659, 0.776, 0.736, 0.747, 0.757, 0.734, 0.728, 0.664, 0.622, 0.689,
    0.7, 0.744, 0.755, 0.733, 0.751, 0.764, 0.764, 0.771, 0.769, 0.738, 0.728,
    0.752, 0.726, 0.702, 0.721, 0.728, 0.735, 0.741, 0.683, 0.616, 0.609, 0.738,
    0.701, 0.725, 0.737, 0.747, 0.749, 0.737, 0.662, 0.65, 0.635, 0.67, 0.735,
    0.737, 0.727, 0.736, 0.739, 0.744, 0.74, 0.734, 0.673, 0.723, 0.757, 0.792,
    0.724, 0.727, 0.747, 0.728, 0.751, 0.775, 0.697, 0.68, 0.657, 0.686, 0.69,
    0.749, 0.729, 0.702, 0.722, 0.728, 0.722, 0.765, 0.766, 0.758, 0.746, 0.747,
    0.701, 0.737, 0.766, 0.744, 0.754,
  ],
};
