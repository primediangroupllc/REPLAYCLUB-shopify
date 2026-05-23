import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import blackAbyssImg from "@/assets/backdrop-black-abyss.webp";
import greenscreenImg from "@/assets/backdrop-greenscreen.webp";
import officeWhiteImg from "@/assets/backdrop-office-white.webp";
import woodGridImg from "@/assets/backdrop-wood-grid.webp";
import type { Backdrop } from "@/lib/bookingConstants";

// Hardcoded fallback used when the DB is empty or unreachable so the site
// never breaks. Mirrors the seed values in the backdrops migration.
const SEED_BACKDROPS: Backdrop[] = [
  { name: "Black Abyss Backdrop",  description: "Floor-to-ceiling matte black velvet drapes for moody, cinematic shoots and DJ sets.", priceCents: 2500, image: blackAbyssImg },
  { name: "Greenscreen Backdrop",  description: "Pro chroma-key green pull-down for livestreams and post-production keying.",          priceCents: 3000, image: greenscreenImg },
  { name: "Office White Backdrop", description: "Clean neutral wall — perfect for podcasts, interviews, and product shots.",            priceCents: 1500, image: officeWhiteImg },
  { name: "Wood Grid Backdrop",    description: "Warm wood-slat acoustic panel for a textured, organic look.",                          priceCents: 2000, image: woodGridImg },
];

export interface DbBackdrop {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Bundled-asset fallback for the 4 seed backdrops. Used when DB row's
// image_url is null (admin hasn't uploaded a custom photo yet).
// Exported so the admin panel can render the same default thumbnail.
export const FALLBACK_IMAGES: Record<string, string> = {
  "Black Abyss Backdrop": blackAbyssImg,
  "Greenscreen Backdrop": greenscreenImg,
  "Office White Backdrop": officeWhiteImg,
  "Wood Grid Backdrop": woodGridImg,
};

async function fetchBackdrops(activeOnly: boolean): Promise<DbBackdrop[]> {
  let query = supabase.from("backdrops" as never).select("*").order("sort_order").order("name");
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) {
    // Table may not exist yet in some environments — fall back silently.
    if (error.code !== "42P01" && error.code !== "PGRST205") {
      console.error("[useBackdrops] fetch error:", error);
    }
    return [];
  }
  return (data as unknown as DbBackdrop[]) || [];
}

/**
 * Raw DB rows including inactive backdrops + admin-only fields (id,
 * sort_order, is_active). For the admin editor panel.
 */
export function useBackdropsAdmin() {
  const qc = useQueryClient();
  const queryKey = ["backdrops", "admin"];
  useEffect(() => {
    const channel = supabase
      .channel("backdrops-admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "backdrops" },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc]);
  return useQuery<DbBackdrop[]>({
    queryKey,
    queryFn: () => fetchBackdrops(false),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });
}

/**
 * Layout shape from studio_configurations.tiers JSON — only the fields we
 * use for the backdrop fallback. Studio_configurations DOES exist on prod
 * (unlike the backdrops table) and already has admin editing UI.
 */
interface DjLayoutFallback {
  id?: string;
  name?: string;
  description?: string;
  image_url?: string;
}

/**
 * Active backdrops in display shape (Backdrop). For BookingModal customize
 * step + the BACKDROPS landing tab.
 *
 * Resolution order (first hit wins per backdrop name):
 *   1. public.backdrops table (DB) — preferred if the table exists.
 *   2. public.studio_configurations(studio_key='dj').layouts JSON —
 *      already exists on prod, already admin-editable at /admin/dashboard
 *      → Studios tab → DJ → Layouts. Each layout has its own image_url
 *      field that admin can edit + upload to. Used as the canonical
 *      fallback while the backdrops table isn't deployed.
 *   3. Hardcoded SEED_BACKDROPS with bundled assets — final safety net.
 *
 * Subscribes to realtime on BOTH backdrops and studio_configurations so
 * admin edits in either place propagate live without a refresh.
 */
export function useEffectiveBackdrops(
  /**
   * Which studio's layouts to read as the backdrop source. BookingModal
   * passes this based on the active room — Podcast booking shows
   * podcast's layouts as backdrop options, etc. Defaults to "dj" because
   * historically backdrops have been the same 4 across services and DJ
   * is where the seed lives.
   */
  studioForLayouts: string = "dj",
): Backdrop[] {
  const qc = useQueryClient();
  const queryKey = ["backdrops", "public"];
  const studioKey = ["backdrops", "from-layouts", studioForLayouts];
  useEffect(() => {
    const ch1 = supabase
      .channel("backdrops-public")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "backdrops" },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    const ch2 = supabase
      .channel(`backdrops-from-layouts-${studioForLayouts}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "studio_configurations",
          filter: `studio_key=eq.${studioForLayouts}`,
        },
        () => qc.invalidateQueries({ queryKey: studioKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, studioForLayouts]);
  const { data: dbData } = useQuery<DbBackdrop[]>({
    queryKey,
    queryFn: () => fetchBackdrops(true),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  // Fallback: read from the requested studio's layouts.
  const { data: djLayouts } = useQuery<DjLayoutFallback[]>({
    queryKey: studioKey,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studio_configurations")
        .select("layouts")
        .eq("studio_key", studioForLayouts)
        .maybeSingle();
      if (error || !data) return [];
      const layouts = (data.layouts as DjLayoutFallback[] | null) ?? [];
      return Array.isArray(layouts) ? layouts : [];
    },
  });

  // Layer 1: live backdrops table (if it exists + has rows)
  if (dbData && dbData.length > 0) {
    const priceByName: Record<string, number> = {};
    for (const b of SEED_BACKDROPS) priceByName[b.name] = b.priceCents;
    return dbData.map((db) => ({
      name: db.name,
      description: db.description || "",
      priceCents: priceByName[db.name] ?? 0,
      image: db.image_url || FALLBACK_IMAGES[db.name] || "",
    }));
  }

  // Layer 2: DJ studio_configurations.layouts as the backdrop source.
  // Layout names like "Black Abyss" map to backdrop "Black Abyss Backdrop"
  // by appending the suffix when matching FALLBACK_IMAGES.
  if (djLayouts && djLayouts.length > 0) {
    const seedByName: Record<string, Backdrop> = {};
    for (const b of SEED_BACKDROPS) seedByName[b.name] = b;
    const result: Backdrop[] = [];
    for (const layout of djLayouts) {
      const layoutName = (layout?.name ?? "").trim();
      if (!layoutName) continue;
      // Match by exact name OR by appending " Backdrop" suffix (DJ's
      // layouts are "Black Abyss"; seed names are "Black Abyss Backdrop").
      const seedKey = seedByName[layoutName]
        ? layoutName
        : seedByName[`${layoutName} Backdrop`]
          ? `${layoutName} Backdrop`
          : layoutName;
      const seed = seedByName[seedKey];
      result.push({
        name: seed?.name ?? layoutName,
        description: layout?.description || seed?.description || "",
        priceCents: seed?.priceCents ?? 0,
        image: layout?.image_url || FALLBACK_IMAGES[seedKey] || seed?.image || "",
      });
    }
    if (result.length > 0) return result;
  }

  // Layer 3: bundled fallback so booking flow keeps working.
  return SEED_BACKDROPS;
}
