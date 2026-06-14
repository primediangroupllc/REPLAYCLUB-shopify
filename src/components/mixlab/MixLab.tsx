// Admin "Mix Lab" dialog — a thin wrapper around the shared, READ-ONLY MixLabContent.
// Mounted in AdminDashboard (fumix.mgmt only). Profile renders MixLabContent inline
// via MixLabSection. Authoring/edit/Confirm Tracklist lives in TrackRecognitionPanel,
// never here. No writes, no Gemini/mix_analysis.
import { FlaskConical } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MixLabContent from "./MixLabContent";

export default function MixLab({
  mix,
  open,
  onOpenChange,
}: {
  mix: { id: string; title: string } | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
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
        <MixLabContent mix={mix} active={open} variant="dialog" />
      </DialogContent>
    </Dialog>
  );
}
