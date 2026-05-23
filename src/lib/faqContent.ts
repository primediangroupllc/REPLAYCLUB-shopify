/**
 * Single source of truth for FAQ copy across the site.
 *
 * Add or edit answers HERE — every page that renders an FAQ
 * (homepage, service landing pages) reads from this file so copy
 * stays consistent and you only have to change it once.
 *
 * Structure:
 *   FAQ_CONTENT[topic] -> array of { question, answer }
 *   getFaqsFor(topic)  -> safe lookup with fallback to "general"
 */

export type FaqTopic =
  | "general"
  | "dj"
  | "podcast"
  | "studio"          // Studio Sesh / music production
  | "photoshoot"
  | "livestream"
  | "equipmentRental"
  | "backdrops"
  | "events"
  | "talent"
  | "giftCards";

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ_CONTENT: Record<FaqTopic, FaqItem[]> = {
  // ───────────────────── Homepage / sitewide ─────────────────────
  general: [
    {
      question: "How do I book a session?",
      answer:
        "Pick a service from the homepage, choose your date and time, and submit an application. We review every request personally and respond within 24 hours. Your card is only charged after we approve.",
    },
    {
      question: "What's the cancellation policy?",
      answer:
        "Full refund 48+ hours in advance (minus processing fee), 50% refund 24–48 hours in advance, no refund under 24 hours or no-shows. Full details on our Cancellation page.",
    },
    {
      question: "Where is the studio located?",
      answer:
        "We're a private studio in Van Nuys, Los Angeles. The exact address is shared in your approval email — please don't share or post the location publicly.",
    },
    {
      question: "Do you offer gift cards?",
      answer:
        "Yes — $25, $50, and $100 cards, redeemable on any service. They never expire and can be sent directly to the recipient by email.",
    },
    {
      question: "Can I bring guests?",
      answer:
        "Yes, up to 2 guests per standard session. Larger groups need to be approved during application. You're responsible for your guests' conduct.",
    },
  ],

  // ─────────────────────────── Disk Jockey ────────────────────────
  dj: [
    {
      question: "What DJ gear is in the room?",
      answer:
        "AlphaTheta XDJ-AZ as the centerpiece, full LED lighting rig, monitor speakers, and a Sony FX3 camera available on higher tiers for recording.",
    },
    {
      question: "Do I need to bring anything?",
      answer:
        "Just a USB drive with your music. Headphones are provided but you're welcome to bring your own. No need to carry controllers — everything is on-site.",
    },
    {
      question: "Can I get a recording of my set?",
      answer:
        "Yes — book the $115/hr tier and you'll get a multi-cam FX3 recording plus your audio mix delivered after the session.",
    },
    {
      question: "What hours are DJ sessions available?",
      answer:
        "Sessions run from 10am to midnight. Late-night requests beyond midnight require advance approval.",
    },
    {
      question: "Is there a minimum booking?",
      answer:
        "Yes — 2 hours minimum for DJ sessions ($110 at the entry tier).",
    },
  ],

  // ─────────────────────────── Podcast ───────────────────────────
  podcast: [
    {
      question: "What microphones do you use?",
      answer:
        "Shure SM7Bs as standard, with Neumann U87 Ai or Sony C-800G available on request. Multi-mic setups for up to 4 guests are included.",
    },
    {
      question: "Can I record video too?",
      answer:
        "Yes — the $85/hr tier includes a multi-cam video setup (host + guests + wide). You receive both audio stems and video files after the session.",
    },
    {
      question: "Do you edit the episode for me?",
      answer:
        "Optional. Add the +$150 flat full edit and we'll deliver a release-ready cut within 5 business days.",
    },
    {
      question: "How many guests can I have on the podcast?",
      answer:
        "The room comfortably seats 4 (host + 3 guests). For larger panels, contact us in advance and we'll let you know what's possible.",
    },
    {
      question: "What format are the files delivered in?",
      answer:
        "Audio: 48kHz/24-bit WAV stems per mic plus a stereo mixdown. Video: 4K ProRes or H.264. Delivered via private link within 24 hours.",
    },
  ],

  // ─────────────────────── Studio Sesh / Music Prod ──────────────
  studio: [
    {
      question: "What's in the production room?",
      answer:
        "Acoustic-treated room, professional monitors, MIDI controller, audio interface, and a treated vocal booth. Bring your own laptop and we provide the rest.",
    },
    {
      question: "Is there an engineer on-site?",
      answer:
        "On the $140/hr tier, yes — a full setup, signal routing, and tracking engineer is included. Lower tiers are self-service or setup-assist only.",
    },
    {
      question: "Can I record vocals?",
      answer:
        "Yes. Premium vocal chain (Neumann U87 → Avalon 737 → interface) is included on the engineer tier. Bring your own track or build from scratch.",
    },
    {
      question: "Can I leave my session files with you?",
      answer:
        "We can transfer to your drive at the end of the session, or upload to a private cloud folder. Files aren't kept on our systems beyond 7 days unless arranged.",
    },
    {
      question: "What's the minimum booking?",
      answer:
        "2 hours minimum ($130 at the entry tier).",
    },
  ],

  // ─────────────────────────── Photoshoot ────────────────────────
  photoshoot: [
    {
      question: "What lighting setup is included?",
      answer:
        "Continuous LED panels, softboxes, and a key light setup as standard. The $165/hr tier adds full content lighting — fill, hair, backdrop wash.",
    },
    {
      question: "Are backdrops included?",
      answer:
        "Multiple backdrops are available — see the Backdrops gallery for the current rotation. Custom backdrops can be added per hour.",
    },
    {
      question: "Do you provide a camera?",
      answer:
        "Yes — the $110/hr and $165/hr tiers include a Sony FX3 with prime lenses. The base tier is lighting + space only (bring your own camera).",
    },
    {
      question: "Can I shoot video as well?",
      answer:
        "Yes — the FX3 shoots both. If you need pro video features (gimbal, follow-focus, audio recording), book the Livestream room instead.",
    },
    {
      question: "What's the minimum booking?",
      answer:
        "2 hours minimum ($140 at the entry tier).",
    },
  ],

  // ─────────────────────────── Livestream ────────────────────────
  livestream: [
    {
      question: "What platforms can I stream to?",
      answer:
        "Twitch, YouTube, Kick, X, TikTok Live, or any RTMP destination. We can multi-stream to several platforms simultaneously.",
    },
    {
      question: "What's the camera setup?",
      answer:
        "Multi-camera with switching, professional audio mixing, and a real-time encoder. Operator-assisted streams are available on request.",
    },
    {
      question: "Can I record while streaming?",
      answer:
        "Yes — local 4K recording happens in parallel with the stream. You take the master files home.",
    },
    {
      question: "Do you handle technical setup?",
      answer:
        "Yes — our engineer dials in your stream key, audio levels, and overlays before you go live. You focus on the show.",
    },
  ],

  // ──────────────────────── Equipment Rental ─────────────────────
  equipmentRental: [
    {
      question: "How does pickup work?",
      answer:
        "Once your rental is approved, you'll get a confirmation with the pickup landmark and a window. Bring ID matching your booking name.",
    },
    {
      question: "Is a deposit required?",
      answer:
        "Yes — a card hold equal to the replacement value is placed at pickup and released when gear comes back undamaged.",
    },
    {
      question: "What if equipment is damaged?",
      answer:
        "You're responsible for the repair or replacement cost. We document condition at pickup and return — disputes go through your card hold.",
    },
    {
      question: "Can I rent for multiple days?",
      answer:
        "Yes — multi-day rentals get a discount. Add the days in the cart and the price updates automatically.",
    },
    {
      question: "Do you deliver?",
      answer:
        "Local delivery within Los Angeles is available for an additional fee. Reach out before booking to arrange it.",
    },
  ],

  // ─────────────────────────── Backdrops ─────────────────────────
  backdrops: [
    {
      question: "Are backdrops billed by the hour or by the shoot?",
      answer:
        "Hourly — they're added to your room booking and priced per hour of use.",
    },
    {
      question: "Can I use backdrops for video?",
      answer:
        "Yes — every backdrop works for both photo and video. The lighting plot adjusts per backdrop.",
    },
    {
      question: "Are props or set dressing included?",
      answer:
        "The backdrop itself is included. Specific props (vintage gear, neon, custom signage) can be requested in your application notes.",
    },
    {
      question: "Can I bring my own backdrop?",
      answer:
        "Yes — there's space to hang up to a 9ft seamless. Mention it in your application so we have rigging ready.",
    },
  ],

  // ───────────────────────────── Events ──────────────────────────
  events: [
    {
      question: "How do I RSVP for an event?",
      answer:
        "Each event has its own RSVP form linked from the event card. RSVP confirms your spot — some events also have ticketed entry.",
    },
    {
      question: "Are tickets refundable?",
      answer:
        "Refunds are available up to 7 days before the event. Within 7 days, ticket value can be transferred to a future event but isn't refunded.",
    },
    {
      question: "Where do events happen?",
      answer:
        "Most events are at the Replay Club studio in Los Angeles. Off-site events are flagged on the event card with the venue.",
    },
    {
      question: "Is there a guest list or +1 policy?",
      answer:
        "RSVPs cover the named guest. +1s vary by event — check the event details page for the specific policy.",
    },
    {
      question: "What if I'm on the waitlist?",
      answer:
        "If a spot opens up, you'll get an email and have 24 hours to confirm. After that the spot rolls to the next person on the list.",
    },
  ],

  // ───────────────────────────── Talent ──────────────────────────
  talent: [
    {
      question: "How do I book a DJ from the roster?",
      answer:
        "Open any talent profile and use the booking inquiry button. We'll connect you with the artist's representative.",
    },
    {
      question: "Can I join the roster?",
      answer:
        "Yes — submit your mix, photo, and bio at /join-roster. We review monthly and reach out if it's a fit.",
    },
    {
      question: "Are roster artists exclusive to Replay Club?",
      answer:
        "Most are non-exclusive — they're Replay Club affiliates we vouch for. Exclusivity terms vary per artist.",
    },
  ],

  // ──────────────────────────── Gift Cards ───────────────────────
  giftCards: [
    {
      question: "What denominations are available?",
      answer: "$25, $50, and $100 — redeemable toward any service.",
    },
    {
      question: "Do gift cards expire?",
      answer: "No. Replay Club gift cards never expire.",
    },
    {
      question: "Can I send a gift card directly to someone?",
      answer:
        "Yes — enter the recipient's email and an optional personal message at checkout. They receive the code immediately after purchase.",
    },
    {
      question: "How do I redeem a gift card?",
      answer:
        "Apply the code at checkout during your booking — the balance is deducted from your total.",
    },
  ],
};

/** Safe lookup with general-FAQ fallback. */
export const getFaqsFor = (topic: FaqTopic | string | null | undefined): FaqItem[] => {
  if (!topic) return FAQ_CONTENT.general;
  const list = FAQ_CONTENT[topic as FaqTopic];
  return list && list.length ? list : FAQ_CONTENT.general;
};

  /** Map an Index.tsx selectedTab string to an FaqTopic. */
  export const tabToFaqTopic = (tab: string): FaqTopic => {
    const t = tab.toLowerCase();
    if (t.includes("dj") || t.includes("disk jockey")) return "dj";
  if (t.includes("podcast")) return "podcast";
  if (t.includes("studio")) return "studio";
  if (t.includes("photo")) return "photoshoot";
  if (t.includes("livestream")) return "livestream";
  if (t.includes("equipment") || t.includes("rental")) return "equipmentRental";
  if (t.includes("backdrop")) return "backdrops";
  if (t.includes("talent")) return "talent";
  return "general";
};
