// Side panel for editing one detected track. Stage A: edits are local/preview
// (saved for real once the pipeline is live).
import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { RecognizedTrack } from "@/types/recognition";

const numOrNull = (v: string): number | null => (v.trim() === "" ? null : Number(v));

export default function TrackEditDrawer({
  track,
  open,
  onOpenChange,
  onSave,
}: {
  track: RecognizedTrack | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave?: (t: RecognizedTrack) => void;
}) {
  const [draft, setDraft] = useState<RecognizedTrack | null>(track);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setDraft(track);
    setNotes("");
  }, [track]);

  if (!draft) return null;
  const update = (patch: Partial<RecognizedTrack>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto bg-background sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display">Edit Track</SheetTitle>
          <SheetDescription className="font-body text-xs">
            Position {String(draft.position).padStart(2, "0")} — adjust anything recognition got wrong.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 py-4">
          <div className="space-y-1.5">
            <Label className="font-body text-xs">Title</Label>
            <Input value={draft.title ?? ""} onChange={(e) => update({ title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="font-body text-xs">Artist</Label>
            <Input value={draft.artist ?? ""} onChange={(e) => update({ artist: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-body text-xs">Start (s)</Label>
              <Input
                type="number"
                value={draft.startSeconds ?? ""}
                onChange={(e) => update({ startSeconds: numOrNull(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-xs">End (s)</Label>
              <Input
                type="number"
                value={draft.endSeconds ?? ""}
                onChange={(e) => update({ endSeconds: numOrNull(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-body text-xs">BPM</Label>
              <Input
                type="number"
                value={draft.bpm ?? ""}
                onChange={(e) => update({ bpm: numOrNull(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-xs">Key</Label>
              <Input value={draft.musicalKey ?? ""} onChange={(e) => update({ musicalKey: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-body text-xs">Genre</Label>
              <Input value={draft.genre ?? ""} onChange={(e) => update({ genre: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-xs">Energy (0–10)</Label>
              <Input
                type="number"
                value={draft.energyLevel ?? ""}
                onChange={(e) => update({ energyLevel: numOrNull(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="font-body text-xs">Notes</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Edit, bootleg, unreleased ID…"
            />
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => draft && onSave?.(draft)}>Save changes</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
