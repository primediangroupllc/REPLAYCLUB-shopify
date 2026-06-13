// Loads a mix's REAL recognition review state for the Track Recognition Room
// (Slice 1) — replaces the buildPreviewJob() mock with live confirmed_tracklist
// rows. confirmed_tracklist / mix_recognition_jobs aren't in the generated
// Database types yet, so the client is cast (same pattern as analytics_events);
// drop the cast once types are regenerated. Read-only: this hook never writes.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  type RecognitionJobView,
  type RecognizedTrack,
  type SegmentStatus,
  segmentStatusFromConfidence,
  type TrackSource,
} from "@/types/recognition";

// The confirmed_tracklist columns we read (kept raw so writes can merge metadata).
export interface ConfirmedRow {
  id: string;
  mix_id: string;
  position: number | null;
  title: string | null;
  artist: string | null;
  start_seconds: number | null;
  end_seconds: number | null;
  bpm: number | null;
  musical_key: string | null;
  genre: string | null;
  energy_level: number | null;
  confidence: number | null;
  source: string | null;
  metadata: Record<string, any> | null;
}

const SOURCE_MAP: Record<string, TrackSource> = {
  auto: "acrcloud",
  user_edit: "manual",
  admin_edit: "manual",
  manual: "manual",
  unknown: "unknown",
};

// confirmed_tracklist row → the RecognizedTrack the Room renders.
export function rowToTrack(row: ConfirmedRow): RecognizedTrack {
  const meta = row.metadata ?? {};
  const edited = row.source === "user_edit" || row.source === "admin_edit";
  const status: SegmentStatus = edited
    ? "user_corrected"
    : ((meta.segment_status as SegmentStatus | undefined) ??
      segmentStatusFromConfidence(row.confidence ?? null));
  return {
    id: row.id,
    position: row.position ?? 0,
    title: row.title ?? null,
    artist: row.artist ?? null,
    album: (meta.album as string | undefined) ?? null,
    startSeconds: row.start_seconds ?? null,
    endSeconds: row.end_seconds ?? null,
    confidence: row.confidence ?? null,
    status,
    source: SOURCE_MAP[row.source ?? ""] ?? "unknown",
    bpm: row.bpm ?? null,
    musicalKey: row.musical_key ?? null,
    genre: row.genre ?? null,
    energyLevel: row.energy_level ?? null,
  };
}

export interface UseRecognitionJob {
  job: RecognitionJobView | null;
  rowsById: Record<string, ConfirmedRow>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useRecognitionJob(
  mixId: string | null,
  open: boolean,
): UseRecognitionJob {
  const [job, setJob] = useState<RecognitionJobView | null>(null);
  const [rowsById, setRowsById] = useState<Record<string, ConfirmedRow>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!mixId) return;
    setLoading(true);
    setError(null);
    try {
      const sb = supabase as any; // recognition tables not in generated types yet
      const [jobRes, rowsRes, mixRes] = await Promise.all([
        sb
          .from("mix_recognition_jobs")
          .select("id, status, requested_by_role, retry_count, review_source")
          .eq("mix_id", mixId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        sb
          .from("confirmed_tracklist")
          .select("*")
          .eq("mix_id", mixId)
          .order("position", { ascending: true }),
        supabase
          .from("mixes")
          .select("duration_seconds")
          .eq("id", mixId)
          .maybeSingle(),
      ]);
      if (rowsRes.error) throw rowsRes.error;
      const rows = (rowsRes.data ?? []) as ConfirmedRow[];
      const byId: Record<string, ConfirmedRow> = {};
      rows.forEach((r) => (byId[r.id] = r));
      setRowsById(byId);
      const jobRow = jobRes.data;
      setJob({
        id: jobRow?.id ?? "none",
        mixId,
        status: jobRow?.status ?? "needs_review",
        requestedByRole: jobRow?.requested_by_role ?? "admin",
        retryCount: jobRow?.retry_count ?? 0,
        reviewSource: jobRow?.review_source ?? null,
        durationSeconds: (mixRes.data as any)?.duration_seconds ?? 0,
        tracks: rows.map(rowToTrack),
        isPreview: false,
      });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [mixId]);

  useEffect(() => {
    if (open && mixId) void load();
  }, [open, mixId, load]);

  return { job, rowsById, loading, error, refetch: load };
}
