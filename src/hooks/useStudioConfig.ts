import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  StudioConfiguration,
  StudioKey,
  StudioLayout,
  StudioTier,
  StudioAddon,
} from "@/lib/studioConfig";

/**
 * Hardcoded fallback used when:
 *  - the studio_configurations row is missing
 *  - the network request fails
 *  - the DB returns malformed JSON
 *
 * These mirror the seed migration so the customer-facing flow keeps working
 * even if the table is empty.
 */
const FALLBACK: Record<StudioKey, Pick<StudioConfiguration, "layouts" | "tiers" | "addons" | "display_name" | "description">> = {
  music: {
    display_name: "Music",
    description: "Hybrid recording studio for tracking, vocals, and full-band sessions.",
    layouts: [
      { id: "tracking-room", name: "Tracking Room", description: "Open live room with iso pads." },
      { id: "vocal-booth", name: "Vocal Booth Focus", description: "Treated booth + control room." },
      { id: "full-band", name: "Full Band Setup", description: "Drum area + multi-mic config." },
    ],
    tiers: [
      { id: "self-serve", label: "Self-Serve", price_cents_per_hour: 7500, features: ["Room + console access", "Pre-patched mic lines", "Headphone mixes", "2-hour minimum"] },
      { id: "engineered", label: "Engineered", price_cents_per_hour: 12500, features: ["Tracking engineer included", "Mic selection & setup", "Same-day rough mix", "2-hour minimum"] },
      { id: "premium", label: "Premium Production", price_cents_per_hour: 18500, features: ["Senior engineer + assistant", "Vintage mic locker access", "Same-day stems", "2-hour minimum"] },
    ],
    addons: [
      { id: "extra-engineer-hour", name: "Additional Engineer Hour", price_cents: 7500, unit: "flat" },
      { id: "mix-master", name: "Mix & Master (per song)", price_cents: 25000, unit: "flat" },
      { id: "mic-locker-addon", name: "Vintage Mic Locker Add-On", price_cents: 4500, unit: "flat" },
    ],
  },
  dj: {
    display_name: "Disk Jockey",
    description: "DJ rehearsal and recording with industry-standard equipment.",
    layouts: [
      { id: "black-abyss", name: "Black Abyss", description: "Deep black void backdrop" },
      { id: "greenscreen", name: "Greenscreen", description: "Chromakey for custom visuals" },
      { id: "office-white", name: "Office White", description: "Clean minimal white backdrop" },
      { id: "wood-grid", name: "Wood Grid", description: "Warm textured wood panel wall" },
    ],
    tiers: [
      { id: "self-service", label: "Self-Service", price_cents_per_hour: 5500, features: ["XDJ-AZ access", "Headphones", "Self-setup", "2-hour minimum"] },
      { id: "lighting-setup", label: "Lighting + Setup", price_cents_per_hour: 8000, features: ["Full gear setup", "Custom lighting rig", "Background choice", "2-hour minimum"] },
      { id: "with-fx3", label: "With FX3 Recording", price_cents_per_hour: 11500, features: ["Sony FX3 recording", "4K dashcam angle", "Custom lighting", "2-hour minimum"] },
    ],
    addons: [
      { id: "essentials", name: "Essentials", description: "Everything you need for a solid set", price_cents: 0, unit: "bundle", includes: ["AlphaTheta XDJ-AZ", "DT 990 Pro Headphones"] },
      { id: "performance", name: "Performance", description: "Full setup with dashcam, lighting & backdrop", price_cents: 0, unit: "bundle", includes: ["AlphaTheta XDJ-AZ", "DT 990 Pro Headphones", "Sony 4K FDR-X3000", "Custom Lighting Setup", "Custom Background"] },
      { id: "showtime", name: "Showtime", description: "The complete experience with pro recording & visuals", price_cents: 0, unit: "bundle", includes: ["AlphaTheta XDJ-AZ", "DT 990 Pro Headphones", "Sony FX3", "Sony 4K FDR-X3000", "Custom Lighting Setup", "Custom Background", "JBL 305P MKii 5\"", "LED Light Bar x2"] },
    ],
  },
  podcast: {
    display_name: "Podcast",
    description: "Soundproofed podcast suite with pro mics and multi-camera video.",
    layouts: [],
    tiers: [
      { id: "audio-only", label: "Audio Only", price_cents_per_hour: 6000, features: ["Pro mic setup", "Acoustic-treated room"] },
      { id: "audio-video", label: "Audio + Video Recording", price_cents_per_hour: 8500, features: ["Multi-cam video", "Pro mic setup"] },
    ],
    addons: [],
  },
  livestream: {
    display_name: "Livestream",
    description: "Custom-tailored livestream and broadcast packages.",
    layouts: [],
    tiers: [{ id: "inquiry", label: "Custom Quote", price_cents_per_hour: 0, features: ["Configured per event"] }],
    addons: [],
  },
  backdrops: {
    display_name: "Backdrops",
    description: "Photo backdrops billed as hourly add-ons.",
    layouts: [],
    tiers: [],
    addons: [],
  },
};

const normalize = (row: any, key: StudioKey): StudioConfiguration => ({
  studio_key: key,
  display_name: row?.display_name ?? FALLBACK[key].display_name,
  description: row?.description ?? FALLBACK[key].description,
  sort_order: row?.sort_order ?? 0,
  layouts: Array.isArray(row?.layouts) ? (row.layouts as StudioLayout[]) : FALLBACK[key].layouts,
  tiers: Array.isArray(row?.tiers) ? (row.tiers as StudioTier[]) : FALLBACK[key].tiers,
  addons: Array.isArray(row?.addons) ? (row.addons as StudioAddon[]) : FALLBACK[key].addons,
  is_active: typeof row?.is_active === "boolean" ? row.is_active : true,
  hero_image_url: row?.hero_image_url ?? null,
  card_image_url: row?.card_image_url ?? null,
  gallery_image_urls: Array.isArray(row?.gallery_image_urls) ? row.gallery_image_urls : [],
  starting_at_copy: row?.starting_at_copy ?? null,
  base_price_cents: typeof row?.base_price_cents === "number" ? row.base_price_cents : null,
});

const STUDIO_SELECT =
  "studio_key, display_name, description, sort_order, layouts, tiers, addons, is_active, hero_image_url, card_image_url, gallery_image_urls, starting_at_copy, base_price_cents";

/**
 * Fetch a single studio's configuration. DB-first, falls back to the
 * hardcoded defaults so the booking flow never breaks. Cached for 5 min
 * by React Query so revisits to a service landing page render instantly.
 * A realtime subscription invalidates the cache on any
 * studio_configurations change so admin edits propagate within seconds.
 */
export const useStudioConfig = (studioKey: StudioKey | null) => {
  const qc = useQueryClient();
  // Realtime sub — invalidates the cached entry on any DB change for this
  // studio. Coupled with refetchOnMount: false below, the page renders
  // instantly from cache and refetches only when admin actually touches
  // the row.
  useEffect(() => {
    if (!studioKey) return;
    const channel = supabase
      .channel(`studio-config-${studioKey}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "studio_configurations",
          filter: `studio_key=eq.${studioKey}`,
        },
        () => qc.invalidateQueries({ queryKey: ["studio-config", studioKey] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [studioKey, qc]);

  const { data, isLoading, error } = useQuery<StudioConfiguration | null>({
    queryKey: ["studio-config", studioKey],
    enabled: !!studioKey,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!studioKey) return null;
      const { data, error } = await supabase
        .from("studio_configurations")
        .select(STUDIO_SELECT)
        .eq("studio_key", studioKey)
        .maybeSingle();
      if (error) {
        // Fall back to hardcoded defaults rather than blowing up the page.
        return normalize(null, studioKey);
      }
      return normalize(data, studioKey);
    },
  });

  return {
    config: data ?? null,
    loading: isLoading,
    error: error ? (error as Error).message : null,
  };
};

/** Fetch ALL studio configurations for the admin editor. Cached the same
 * way as the single-studio hook; realtime invalidates on any row change. */
export const useAllStudioConfigs = (refreshKey: number = 0) => {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("studio-config-all")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "studio_configurations" },
        () => qc.invalidateQueries({ queryKey: ["studio-configs-all"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const { data, isLoading } = useQuery<StudioConfiguration[]>({
    queryKey: ["studio-configs-all", refreshKey],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await supabase
        .from("studio_configurations")
        .select(STUDIO_SELECT)
        .order("sort_order", { ascending: true });
      return (data || []).map((r: any) => normalize(r, r.studio_key as StudioKey));
    },
  });

  return { configs: data ?? [], loading: isLoading };
};
