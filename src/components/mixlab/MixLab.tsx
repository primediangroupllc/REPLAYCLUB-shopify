// Mix Lab V2 (Tier-0) — single-mix, recognition-first intelligence overlay.
//
// READ-ONLY: renders entirely from confirmed_tracklist via useMixIntelligence.
// No writes, no Confirm Tracklist, no Gemini/mix_analysis. Gated to fumix.mgmt at
// the AdminDashboard mount (canAccessMixLab). Mirrors TrackRecognitionPanel's
// Dialog container; the 5 tabs are the V2 "Mix Lab".
import { FlaskConical, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMixIntelligence } from "@/hooks/useMixIntelligence";
import RecognitionSummaryStats from "@/components/RecognitionSummaryStats";
import RecognitionTimeline from "@/components/RecognitionTimeline";
import DjDnaPanel from "./DjDnaPanel";
import TrackHistoryPanel from "./TrackHistoryPanel";
import AvatarPanel from "./AvatarPanel";
import ProgressionPanel from "./ProgressionPanel";

export default function MixLab({
  mix,
  open,
  onOpenChange,
}: {
  mix: { id: string; title: string } | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { job, intel, dna, traits, milestones, loading, error } = useMixIntelligence(
    mix?.id ?? null,
    open,
  );
  if (!mix) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-border bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <FlaskConical className="h-4 w-4 text-primary" />
            Mix Lab
          </DialogTitle>
          <DialogDescription className="font-body text-xs">
            {mix.title} · recognition-first · read-only
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 font-body text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading mix intelligence…
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 font-body text-[11px] text-destructive">
            {error}
          </div>
        )}

        {!loading && job && (
          <Tabs defaultValue="dna" className="w-full">
            <TabsList className="flex w-full justify-start gap-1 overflow-x-auto">
              <TabsTrigger value="recognition" className="text-[11px]">
                Recognition
              </TabsTrigger>
              <TabsTrigger value="dna" className="text-[11px]">
                DJ DNA
              </TabsTrigger>
              <TabsTrigger value="tracks" className="text-[11px]">
                Track History
              </TabsTrigger>
              <TabsTrigger value="avatar" className="text-[11px]">
                Avatar
              </TabsTrigger>
              <TabsTrigger value="progression" className="text-[11px]">
                Progression
              </TabsTrigger>
            </TabsList>

            <div className="pt-4">
              <TabsContent value="recognition" className="space-y-4">
                <RecognitionSummaryStats tracks={job.tracks} status={job.status} />
                {job.durationSeconds > 0 && (
                  <RecognitionTimeline
                    tracks={job.tracks}
                    durationSeconds={job.durationSeconds}
                  />
                )}
                <p className="font-body text-[10px] text-muted-foreground/80">
                  Read-only view. Full review, edit and confirm live in the “Recognize
                  Tracks” panel.
                </p>
              </TabsContent>
              <TabsContent value="dna">
                <DjDnaPanel dna={dna} />
              </TabsContent>
              <TabsContent value="tracks">
                <TrackHistoryPanel intel={intel} />
              </TabsContent>
              <TabsContent value="avatar">
                <AvatarPanel traits={traits} />
              </TabsContent>
              <TabsContent value="progression">
                <ProgressionPanel milestones={milestones} />
              </TabsContent>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
