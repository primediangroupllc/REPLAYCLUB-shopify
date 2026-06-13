import { useRef, useState } from "react";
import { Upload, Loader2, Music, FileAudio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";

// Accepted upload formats (requirement: mp3 / wav / aiff / m4a). Browsers report
// AIFF/M4A MIME inconsistently, so we gate on file EXTENSION here and let the
// storage bucket's MIME allowlist (widened in the migration) be the backstop.
const ACCEPTED_EXTS = ["mp3", "m4a"];
const ACCEPT_ATTR = ".mp3,.m4a,audio/mpeg,audio/mp4";

// We send an EXPLICIT Content-Type by extension. Browsers report file.type
// inconsistently for AIFF/M4A (often empty), which Storage would treat as
// application/octet-stream and reject against the bucket's MIME allowlist.
const MIME_BY_EXT: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
};

// Client-side cap (requirement #10), matched to the bucket's 1 GB server-side
// hard limit so the two agree.
const MAX_MIX_BYTES = 1024 * 1024 * 1024; // 1 GB
const MAX_MIX_LABEL = "1GB";

const fmtMb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export default function UploadMixDialog({
  userId,
  onUploaded,
  defaultOpen = false,
}: {
  userId: string;
  onUploaded?: () => void;
  defaultOpen?: boolean;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(defaultOpen);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"converting" | "uploading">("uploading");

  const reset = () => {
    setTitle("");
    setDescription("");
    setFile(null);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  const pickFile = (f: File | null) => {
    if (!f) {
      setFile(null);
      return;
    }
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    if (!ACCEPTED_EXTS.includes(ext)) {
      toast({
        title: "Unsupported format",
        description: "Please upload an MP3 or M4A file for now.",
        variant: "destructive",
      });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (f.size > MAX_MIX_BYTES) {
      toast({
        title: "File too large",
        description: `Max ${MAX_MIX_LABEL} for now — yours is ${fmtMb(f.size)}.`,
        variant: "destructive",
      });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  // Mirrors the admin uploader: raw XHR POST to Storage so we get progress.
  // Takes a Blob + explicit Content-Type — the body may be a transcoded MP3,
  // not the original File.
  const uploadWithProgress = (path: string, body: Blob, contentType: string): Promise<void> =>
    new Promise((resolve, reject) => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        const token = session?.access_token;
        const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/mixes/${path}`;
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed (${xhr.status} ${xhr.statusText})`));
        });
        xhr.addEventListener("error", () => reject(new Error("Upload network error")));
        xhr.open("POST", url);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.setRequestHeader("x-upsert", "false");
        // Explicit Content-Type wins over the Blob's type per the XHR spec.
        xhr.setRequestHeader("Content-Type", contentType);
        xhr.send(body);
      });
    });

  const handleSubmit = async () => {
    if (!file || !title.trim()) {
      toast({ title: "Add a title and a file", variant: "destructive" });
      return;
    }
    setUploading(true);
    setProgress(0);
    const fileMb = +(file.size / 1024 / 1024).toFixed(1);
    const fileExt = (file.name.split(".").pop() || "").toLowerCase();
    track("upload_started", { file_mb: fileMb, ext: fileExt });
    try {
      // Launch path: MP3/M4A are already compressed and stream-ready, so we
      // store the ORIGINAL file directly — no client-side transcoding (lamejs).
      // WAV/AIFF are rejected at pickFile with a clean message.
      const body: Blob = file;
      const ext = (file.name.split(".").pop() || "dat").toLowerCase();

      setPhase("uploading");
      setProgress(0);
      const storagePath = `${userId}/${Date.now()}.${ext}`;
      const contentType = MIME_BY_EXT[ext] || file.type || "application/octet-stream";
      await uploadWithProgress(storagePath, body, contentType);

      // Owner = user_id (self). Provenance + pending status are also pinned by the
      // enforce_mix_write_rules trigger; we set them explicitly so the insert
      // satisfies the "Users can upload own mixes" RLS check directly.
      const { data: inserted, error } = await supabase
        .from("mixes")
        .insert({
          user_id: userId,
          uploaded_by_user_id: userId,
          uploaded_by_role: "user",
          status: "pending_review",
          title: title.trim(),
          description: description.trim() || null,
          file_url: storagePath,
          recorded_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;

      // Funnel: upload_completed carries upload_index (this user's Nth upload) —
      // return_upload (>=2) / third_mix_uploaded (>=3) are DERIVED from it.
      const { count } = await supabase
        .from("mixes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      track("upload_completed", {
        mix_id: inserted?.id ?? null,
        upload_index: count ?? 1,
        file_mb: fileMb,
        ext: fileExt,
      });

      toast({
        title: "Mix uploaded",
        description: "It's in the review queue — it'll appear on your profile once approved.",
      });
      reset();
      setOpen(false);
      onUploaded?.();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!uploading) {
          setOpen(o);
          if (!o) reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2 font-display uppercase tracking-wider text-xs">
          <Upload className="w-4 h-4" />
          Upload Mix
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Music className="w-4 h-4 text-primary" />
            Upload a mix
          </DialogTitle>
          <DialogDescription className="font-body text-xs">
            MP3, WAV, AIFF, or M4A · up to {MAX_MIX_LABEL}. We'll analyze it and
            post your report card to your profile after review.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="mix-title" className="font-body text-xs">Title</Label>
            <Input
              id="mix-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Friday warm-up set"
              disabled={uploading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mix-desc" className="font-body text-xs">Description <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="mix-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Deep / melodic, recorded live…"
              rows={2}
              disabled={uploading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mix-file" className="font-body text-xs">Audio file</Label>
            <Input
              id="mix-file"
              ref={fileRef}
              type="file"
              accept={ACCEPT_ATTR}
              disabled={uploading}
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-body">
                <FileAudio className="w-3.5 h-3.5" />
                {file.name} · {fmtMb(file.size)}
              </p>
            )}
          </div>

          {uploading && (
            <div className="space-y-1">
              <Progress value={progress} />
              <p className="text-[11px] text-muted-foreground font-body text-right">
                {phase === "converting" ? "Converting…" : "Uploading…"} {progress}%
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={uploading}
            className="font-display uppercase tracking-wider text-xs"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={uploading || !file || !title.trim()}
            className="gap-2 font-display uppercase tracking-wider text-xs"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? (phase === "converting" ? "Converting…" : "Uploading…") : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
