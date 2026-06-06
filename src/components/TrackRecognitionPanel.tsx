// The "Track Recognition Room" — premium review surface for a mix's detected
// tracklist. Stage A: renders PREVIEW data (no ACRCloud, no secrets) so the full
// admin + user experience is visible. mode="admin" can Confirm; mode="user" can
// edit but an admin/AI confirms (reviewer abstraction — see RECOGNITION-SPEC.md).
import { useEffect, useMemo, useState } from "react";
import { Sparkles, ShieldCheck, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import RecognitionSummaryStats from "./RecognitionSummaryStats";
import RecognitionTimeline from "./RecognitionTimeline";
import RecognizedTrackCard from "./RecognizedTrackCard";
import TrackEditDrawer from "./TrackEditDrawer";
import { buildPreviewJob, type RecognizedTrack } from "@/types/recognition";

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
  const job = useMemo(() => (mix ? buildPreviewJob(mix.id, mix.title) : null), [mix]);
  const [tracks, setTracks] = useState<RecognizedTrack[]>([]);
  const [editing, setEditing] = useState<RecognizedTrack | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setTracks(job ? job.tracks : []);
  }, [job]);

  if (!mix || !job) return null;

  const openEdit = (t: RecognizedTrack) => {
    setEditing(t);
    setDrawerOpen(true);
  };
  const saveEdit = (t: RecognizedTrack) => {
    setTracks((prev) => prev.map((x) => (x.id === t.id ? { ...t, status: "user_corrected" } : x)));
    setDrawerOpen(false);
    toast({ title: "Track updated", description: "Preview only — saved once the pipeline is live." });
  };
  const markUnknown = (t: RecognizedTrack) => {
    setTracks((prev) =>
      prev.map((x) =>
        x.id === t.id
          ? { ...x, status: "unknown", title: "Unknown ID", artist: null, source: "unknown" }
          : x,
      ),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto border-border bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Sparkles className="h-4 w-4 text-primary" />
            Track Recognition
          </DialogTitle>
          <DialogDescription className="font-body text-xs">{mix.title}</DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 font-body text-[11px] text-amber-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Preview — recognition runs once the ACRCloud pipeline is connected. These are sample
            results so you can feel the flow; edits here aren’t saved yet.
          </span>
        </div>

        <div className="space-y-4 py-1">
          <RecognitionSummaryStats tracks={tracks} status={job.status} />
          <RecognitionTimeline
            tracks={tracks}
            durationSeconds={job.durationSeconds}
            selectedId={editing?.id}
            onSelect={(id) => {
              const t = tracks.find((x) => x.id === id);
              if (t) openEdit(t);
            }}
          />
          <div className="space-y-2">
            {tracks.map((t) => (
              <RecognizedTrackCard key={t.id} track={t} onEdit={openEdit} onMarkUnknown={markUnknown} />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <p className="max-w-[58%] font-body text-[10px] text-muted-foreground">
            This tracklist will power song-selection, energy-flow, storytelling &amp; DJ DNA scoring.
          </p>
          {mode === "admin" ? (
            <Button
              className="gap-1.5"
              onClick={() =>
                toast({
                  title: "Confirm (preview)",
                  description: "Confirmation locks the tracklist once the pipeline is live.",
                })
              }
            >
              <ShieldCheck className="h-4 w-4" /> Confirm Tracklist
            </Button>
          ) : (
            <span className="font-body text-[10px] italic text-muted-foreground">
              Edit anything — an admin (or AI) confirms the final tracklist.
            </span>
          )}
        </div>

        <TrackEditDrawer
          track={editing}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onSave={saveEdit}
        />
      </DialogContent>
    </Dialog>
  );
}
