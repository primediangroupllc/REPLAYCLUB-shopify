// Mix Lab content (READ-ONLY) — shared by the Admin dialog (MixLab.tsx) and the
// Profile inline experience (MixLabSection.tsx). Renders entirely from
// confirmed_tracklist via useMixIntelligence. No writes, no Confirm Tracklist, no
// Gemini/mix_analysis. Authoring/edit/Confirm lives in TrackRecognitionPanel (Admin).
//
// `variant`: "dialog" (Admin — header supplied by the Dialog wrapper) or "inline"
// (Profile — full-width, renders its own compact header). `active` gates the fetch.
import { FlaskConical, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMixIntelligence } from "@/hooks/useMixIntelligence";
import RecognitionSummaryStats from "@/components/RecognitionSummaryStats";
import RecognitionTimeline from "@/components/RecognitionTimeline";
import DjDnaPanel from "./DjDnaPanel";
import TrackHistoryPanel from "./TrackHistoryPanel";
import AvatarPanel from "./AvatarPanel";
import ProgressionPanel from "./ProgressionPanel";

export default function MixLabContent({
  mix,
  active,
  variant = "inline",
}: {
  mix: { id: string; title: string };
  active: boolean;
  variant?: "dialog" | "inline";
}) {
  const { job, intel, dna, traits, milestones, loading, error } = useMixIntelligence(
    mix.id,
    active,
  );

  return (
    <div className={variant === "inline" ? "w-full" : undefined}>
      {variant === "inline" && (
        <div className="mb-3 flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-foreground">Mix Lab</p>
            <p className="truncate font-body text-[11px] text-muted-foreground">
              {mix.title} · recognition-first · read-only
            </p>
          </div>
        </div>
      )}

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
              {/* Identity (Profile) vs authoring (Admin) stay separate: the Profile
                  view never points at the edit/Confirm workflow. */}
              <p className="font-body text-[10px] text-muted-foreground/80">
                {variant === "dialog"
                  ? "Read-only view. Full review, edit and confirm live in the “Recognize Tracks” panel."
                  : "Your recognized set — the tracks identified in this mix."}
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
    </div>
  );
}
