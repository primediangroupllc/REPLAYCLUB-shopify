// READ-ONLY: which of the user's mixes have recognition data (i.e. are worth
// opening in Mix Lab). A mix is "recognized" if it has any confirmed_tracklist
// rows (owner-RLS read). SELECT only — no writes. Called ONCE in Profile; the
// result is the single source of truth shared by MixLabSection (the lab tab) and
// the Mixes-tab "Open in Mix Lab" per-mix action. `enabled` gates the query off
// for non-Mix-Lab users so a normal profile never hits confirmed_tracklist.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProfileMix {
  id: string;
  title: string | null;
  created_at?: string;
}

export function useRecognizedMixes(
  mixes: ProfileMix[],
  userId: string | null,
  enabled = true,
) {
  const [recognizedIds, setRecognizedIds] = useState<Set<string> | null>(null);
  const idsKey = mixes.map((m) => m.id).join(",");

  useEffect(() => {
    let cancelled = false;
    const ids = idsKey ? idsKey.split(",") : [];
    if (!enabled || !userId || ids.length === 0) {
      setRecognizedIds(new Set());
      return;
    }
    setRecognizedIds(null); // loading
    (async () => {
      // recognition tables aren't in the generated types yet (same as the room).
      const sb = supabase as any;
      const { data, error } = await sb
        .from("confirmed_tracklist")
        .select("mix_id")
        .in("mix_id", ids);
      if (cancelled) return;
      if (error) {
        setRecognizedIds(new Set());
        return;
      }
      setRecognizedIds(
        new Set<string>(((data ?? []) as { mix_id: string }[]).map((r) => r.mix_id)),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [idsKey, userId, enabled]);

  const loading = recognizedIds === null;
  // Preserve the caller's order (Profile loads mixes newest-first).
  const recognized = recognizedIds
    ? mixes.filter((m) => recognizedIds.has(m.id))
    : [];

  // recognizedIds (the Set, or null while loading) lets the Mixes tab gate the
  // per-mix "Open in Mix Lab" action with an O(1) lookup off the same fetch.
  return { recognized, recognizedIds, loading };
}
