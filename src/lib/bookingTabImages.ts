import { supabase } from "@/integrations/supabase/client";

export type BookingTabType =
  | "dj_session"
  | "podcast"
  | "studio_sesh"
  | "backdrop"
  | "equipment_rental"
  | "livestream"
  | "music";

export interface BookingTabImage {
  id: string;
  storage_path: string;
  url: string;
  display_order: number;
  is_active: boolean;
  width: number | null;
  height: number | null;
  bytes: number | null;
  mime_type: string | null;
  updated_at: string | null;
}

const BUCKET = "booking-tab-images";

export function publicUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Fetch images for a booking tab. When `activeOnly` is true (default), RLS
 * filters to active rows for the public site. Admin views pass false to see all.
 */
export async function fetchBookingTabImages(
  type: BookingTabType,
  activeOnly = true,
): Promise<BookingTabImage[]> {
  let q = supabase
    .from("booking_tab_images")
    .select("id, storage_path, display_order, is_active, width, height, bytes, mime_type, updated_at")
    .eq("booking_type", type)
    .order("display_order", { ascending: true });
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => {
    const updated = (r.updated_at as string | null) ?? null;
    // Cache-bust by updated_at so re-uploads to same path show fresh
    const v = updated ? new Date(updated).getTime() : 0;
    const base = publicUrl(r.storage_path as string);
    const url = v ? `${base}${base.includes("?") ? "&" : "?"}v=${v}` : base;
    return {
      id: r.id as string,
      storage_path: r.storage_path as string,
      url,
      display_order: r.display_order as number,
      is_active: r.is_active as boolean,
      width: (r.width as number | null) ?? null,
      height: (r.height as number | null) ?? null,
      bytes: (r.bytes as number | null) ?? null,
      mime_type: (r.mime_type as string | null) ?? null,
      updated_at: updated,
    };
  });
}

/**
 * Build a Supabase Storage render-endpoint srcset for responsive sizing.
 * Returns null for non-Supabase URLs (caller should fall back to plain src).
 */
export function buildSrcSet(
  src: string,
  widths: number[] = [480, 768, 1200, 1920],
): string | null {
  try {
    const u = new URL(src);
    if (!u.pathname.includes("/storage/v1/object/public/")) return null;
    const renderPath = u.pathname.replace(
      "/storage/v1/object/public/",
      "/storage/v1/render/image/public/",
    );
    return widths
      .map((w) => {
        const t = new URL(renderPath, u.origin);
        t.searchParams.set("width", String(w));
        t.searchParams.set("quality", "75");
        return `${t.toString()} ${w}w`;
      })
      .join(", ");
  } catch {
    return null;
  }
}

export const BOOKING_TAB_LABELS: Record<BookingTabType, string> = {
  dj_session: "Disk Jockey",
  podcast: "Podcast",
  studio_sesh: "Studio Sesh",
  backdrop: "Photoshoot",
  equipment_rental: "Equipment Rental",
  livestream: "Livestream",
  music: "Music",
};

export type BookingTabLayoutVariant = "single" | "gallery" | "collage";

export const BOOKING_TAB_LAYOUT_LABELS: Record<BookingTabLayoutVariant, string> = {
  single: "Single",
  gallery: "Gallery",
  collage: "Collage",
};

export async function fetchBookingTabLayout(
  type: BookingTabType,
): Promise<BookingTabLayoutVariant> {
  const { data, error } = await supabase
    .from("booking_tab_layout")
    .select("layout_variant")
    .eq("booking_type", type)
    .maybeSingle();
  if (error || !data?.layout_variant) return "gallery";
  return data.layout_variant as BookingTabLayoutVariant;
}

export interface BookingTabMeta {
  id: string;
  booking_type: BookingTabType;
  title: string;
  subtitle: string;
  price: string;
  description: string | null;
  coming_soon: boolean;
  is_hidden: boolean;
  display_order: number;
  updated_at: string | null;
}

export async function fetchBookingTabsMeta(): Promise<BookingTabMeta[]> {
  const { data, error } = await supabase
    .from("booking_tabs_meta")
    .select(
      "id, booking_type, title, subtitle, price, description, coming_soon, is_hidden, display_order, updated_at",
    )
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    ...r,
    is_hidden: r.is_hidden ?? false,
  })) as BookingTabMeta[];
}

export interface HomeCardCustom {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  image_url: string | null;
  route: string;
  display_order: number;
  is_hidden: boolean;
  coming_soon: boolean;
  updated_at: string | null;
}

export async function fetchHomeCardsCustom(): Promise<HomeCardCustom[]> {
  const { data, error } = await (supabase as any)
    .from("home_cards_custom")
    .select(
      "id, title, subtitle, price, image_url, route, display_order, is_hidden, coming_soon, updated_at",
    )
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as HomeCardCustom[];
}
