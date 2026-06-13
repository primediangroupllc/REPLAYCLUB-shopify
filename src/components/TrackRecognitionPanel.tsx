// The "Track Recognition Room" — review surface for a mix's recognized tracklist.
// Slice 1 (admin): wired to REAL data via useRecognitionJob. Edits/mark-unknown/
// add/delete write to confirmed_tracklist (RLS: admin full CRUD; owner pre-confirm
// — Slice 2). Confirm calls the confirm-tracklist edge fn, which renumbers +
// publishes named rows to mixes.tracklist (unknowns stay private). Never touches
// recognized_track_segments (the raw ACRCloud receipts).
import { useState } from "react";
import { Loader2, Plus, ShieldCheck, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import RecognitionSummaryStats from "./RecognitionSummaryStats";
import RecognitionTimeline from "./RecognitionTimeline";
import RecognizedTrackCard from "./RecognizedTrackCard";
import TrackEditDrawer from "./TrackEditDrawer";
import { useRecognitionJob } from "@/hooks/useRecognitionJob";
import type { RecognizedTrack } from "@/types/recognition";

// confirmed_tracklist isn't in the generated types yet (same as analytics_events).
const sb = supabase as any;

export default function TrackRecognitionPanel({
  mix,
  mode,
  open,
  onOpenChange,
}: {
  mix: { id: string; title: string } | null;
  mode: "admin" | "user";
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { toast } = useToast();
  const { job, rowsById, loading, error, refetch } = useRecognitionJob(
    mix?.id ?? null,
    open,
  );
  const [editing, setEditing] = useState<RecognizedTrack | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!mix) return null;
  const tracks = job?.tracks ?? [];

  const fail = (e: unknown, title = "Couldn't save") =>
    toast({
      title,
      description: String((e as Error)?.message ?? e),
      variant: "destructive",
    });

  const openEdit = (t: RecognizedTrack) => {
    setEditing(t);
    setDrawerOpen(true);
  };
  const openAdd = () => {
    setEditing({
      id: "", // empty id → INSERT on save
      position: tracks.length + 1,
      title: "",
      artist: "",
      album: null,
      startSeconds: null,
      endSeconds: null,
      confidence: null,
      status: "user_corrected",
      source: "manual",
    });
    setDrawerOpen(true);
  };

  const saveEdit = async (t: RecognizedTrack) => {
    setBusy(true);
    try {
      if (!t.id) {
        const { error: e } = await sb.from("confirmed_tracklist").insert({
          mix_id: mix.id,
          position: tracks.length + 1,
          title: t.title || null,
          artist: t.artist || null,
          start_seconds: t.startSeconds,
          end_seconds: t.endSeconds,
          bpm: t.bpm ?? null,
          musical_key: t.musicalKey ?? null,
          genre: t.genre ?? null,
          energy_level: t.energyLevel ?? null,
          source: "manual",
          confidence: null,
          metadata: { segment_status: "user_corrected" },
        });
        if (e) throw e;
      } else {
        const prevMeta = rowsById[t.id]?.metadata ?? {};
        const { error: e } = await sb
          .from("confirmed_tracklist")
          .update({
            title: t.title || null,
            artist: t.artist || null,
            start_seconds: t.startSeconds,
            end_seconds: t.endSeconds,
            bpm: t.bpm ?? null,
            musical_key: t.musicalKey ?? null,
            genre: t.genre ?? null,
            energy_level: t.energyLevel ?? null,
            source: "admin_edit",
            metadata: { ...prevMeta, segment_status: "user_corrected" },
          })
          .eq("id", t.id);
        if (e) throw e;
      }
      setDrawerOpen(false);
      await refetch();
      toast({ title: "Saved" });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const markUnknown = async (t: RecognizedTrack) => {
    if (!t.id) return;
    setBusy(true);
    try {
      const prevMeta = rowsById[t.id]?.metadata ?? {};
      const { error: e } = await sb
        .from("confirmed_tracklist")
        .update({
          title: null,
          artist: null,
          source: "admin_edit",
          metadata: { ...prevMeta, segment_status: "unknown" },
        })
        .eq("id", t.id);
      if (e) throw e;
      await refetch();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const deleteTrack = async (t: RecognizedTrack) => {
    if (!t.id) return;
    setBusy(true);
    try {
      const { error: e } = await sb
        .from("confirmed_tracklist")
        .delete()
        .eq("id", t.id);
      if (e) throw e;
      setDrawerOpen(false);
      await refetch();
      toast({ title: "Removed" });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const confirmTracklist = async () => {
    setBusy(true);
    try {
      const { data, error: e } = await supabase.functions.invoke(
        "confirm-tracklist",
        { body: { mix_id: mix.id } },
      );
      if (e) throw e;
      if ((data as any)?.error) throw new Error((data as any).error);
      await refetch();
      toast({
        title: "Tracklist confirmed",
        description: `${(data as any)?.confirmed_tracks ?? tracks.length} tracks — named tracks are now public.`,
      });
    } catch (e) {
      fail(e, "Confirm failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto border-border bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Sparkles className="h-4 w-4 text-primary" />
            Track Recognition
          </DialogTitle>
          <DialogDescription className="font-body text-xs">
            {mix.title}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 font-body text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading recognition…
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 font-body text-[11px] text-destructive">
            {error}
          </div>
        )}

        {!loading && job && (
          <>
            <div className="space-y-4 py-1">
              <RecognitionSummaryStats tracks={tracks} status={job.status} />
              {job.durationSeconds > 0 && (
                <RecognitionTimeline
                  tracks={tracks}
                  durationSeconds={job.durationSeconds}
                  selectedId={editing?.id}
                  onSelect={(id) => {
                    const t = tracks.find((x) => x.id === id);
                    if (t) openEdit(t);
                  }}
                />
              )}
              <div className="space-y-2">
                {tracks.length === 0 && (
                  <p className="py-6 text-center font-body text-xs text-muted-foreground">
                    No recognized tracks for this mix yet.
                  </p>
                )}
                {tracks.map((t) => (
                  <RecognizedTrackCard
                    key={t.id}
                    track={t}
                    onEdit={openEdit}
                    onMarkUnknown={markUnknown}
                  />
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={openAdd}
                disabled={busy}
              >
                <Plus className="h-4 w-4" /> Add track
              </Button>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
              <p className="max-w-[58%] font-body text-[10px] text-muted-foreground">
                Confirm publishes the named tracks to this mix; unknown rows stay
                private to this room.
              </p>
              {mode === "admin" ? (
                <Button
                  className="gap-1.5"
                  onClick={confirmTracklist}
                  disabled={busy || tracks.length === 0}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  Confirm Tracklist
                </Button>
              ) : (
                <span className="font-body text-[10px] italic text-muted-foreground">
                  Edit anything — an admin (or AI) confirms the final tracklist.
                </span>
              )}
            </div>
          </>
        )}

        <TrackEditDrawer
          track={editing}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onSave={saveEdit}
          onDelete={editing?.id ? deleteTrack : undefined}
        />
      </DialogContent>
    </Dialog>
  );
}
