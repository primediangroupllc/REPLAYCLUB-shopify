// Mix Intelligence V2 (Tier-0) — read-only aggregate hook for a SINGLE mix.
//
// Loads the mix's confirmed_tracklist via useRecognitionJob (no extra query, no
// writes), then derives DJ DNA / traits / milestones deterministically. NO LLM,
// NO mixes.mix_analysis, NO arbitrary scores. fumix.mgmt-gated at the mount.
import { useMemo } from "react";
import { useRecognitionJob } from "@/hooks/useRecognitionJob";
import {
  buildIntelTracks,
  computeDjDna,
  deriveMilestones,
  deriveTraits,
} from "@/lib/mixDna";

export function useMixIntelligence(mixId: string | null, open: boolean) {
  const { job, rowsById, loading, error, refetch } = useRecognitionJob(mixId, open);

  const intel = useMemo(
    () => (job ? buildIntelTracks(job.tracks, rowsById) : []),
    [job, rowsById],
  );
  const dna = useMemo(() => computeDjDna(intel), [intel]);
  const traits = useMemo(() => deriveTraits(intel), [intel]);
  const milestones = useMemo(() => deriveMilestones(intel), [intel]);

  return { job, intel, dna, traits, milestones, loading, error, refetch };
}
