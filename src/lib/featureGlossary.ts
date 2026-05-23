/**
 * Tier feature glossary. When a tier-feature string from
 * studio_configurations.tiers contains one of these keys (case-insensitive),
 * the inline booking form renders an info icon with the matching
 * explanation on hover/tap.
 *
 * Add new entries here when admin starts using new gear names or terms.
 * Match is "feature string contains key" — keep keys distinctive.
 */
export const FEATURE_GLOSSARY: Array<{ key: string; explanation: string }> = [
  {
    key: "FX3",
    explanation:
      "Sony FX3 — full-frame cinema camera. 4K 120fps recording, S-Log3 color, broadcast-grade footage.",
  },
  {
    key: "XDJ-AZ",
    explanation:
      "AlphaTheta XDJ-AZ — flagship all-in-one DJ controller. 4 decks, 10\" jog wheels, twin USB.",
  },
  {
    key: "DT 990",
    explanation:
      "Beyerdynamic DT 990 Pro — open-back monitoring headphones. Industry-standard for mixing.",
  },
  {
    key: "DT 770",
    explanation:
      "Beyerdynamic DT 770 — closed-back tracking headphones. Used in nearly every studio.",
  },
  {
    key: "JBL 305P",
    explanation:
      "JBL 305P MKii — 5\" near-field studio monitors. Flat-response reference speakers.",
  },
  {
    key: "4K dashcam",
    explanation:
      "Sony FDR-X3000 mounted overhead — captures an alternate 4K angle of your session (great for DJ hands shots).",
  },
  {
    key: "Greenscreen",
    explanation:
      "Pro chroma-key backdrop. Pair with virtual backgrounds for streams or post-production keying.",
  },
  {
    key: "Rode shotgun",
    explanation:
      "Rode NTG shotgun mic — directional microphone for clean dialog without picking up room noise.",
  },
  {
    key: "DJI Wireless",
    explanation:
      "DJI wireless lavalier mic. Move freely during recording or stream segments.",
  },
  {
    key: "Ronin",
    explanation:
      "DJI Ronin RS3 Mini gimbal — for handheld stabilized camera moves during livestreams.",
  },
  {
    key: "Same-day rough mix",
    explanation:
      "Engineer prints a quick rough mix to MP3 before you leave so you can vibe-check the session same day.",
  },
  {
    key: "Same-day stems",
    explanation:
      "All individual tracks (vocals, instruments) bounced and delivered before you leave.",
  },
  {
    key: "Vintage Mic Locker",
    explanation:
      "Access to vintage mic collection — U87, RE20, classic ribbon mics. Ask the engineer for recommendations per source.",
  },
  {
    key: "GVM",
    explanation:
      "GVM PRO-SD300B bi-color LED key light — adjustable color temperature, soft + powerful enough for video.",
  },
];

/** Find the matching glossary entry for a feature string, or null. */
export function findGlossaryEntry(feature: string): string | null {
  const hay = feature.toLowerCase();
  const hit = FEATURE_GLOSSARY.find((g) => hay.includes(g.key.toLowerCase()));
  return hit?.explanation ?? null;
}
