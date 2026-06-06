import { useRef, useState } from "react";
import { Upload, Loader2, Music, FileAudio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
const ACCEPTED_EXTS = ["mp3", "wav", "aiff", "aif", "m4a"];
const ACCEPT_ATTR = ".mp3,.wav,.aiff,.aif,.m4a,audio/*";

// We send an EXPLICIT Content-Type by extension. Browsers report file.type
// inconsistently for AIFF/M4A (often empty), which Storage would treat as
// application/octet-stream and reject against the bucket's MIME allowlist.
const MIME_BY_EXT: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  aiff: "audio/aiff",
  aif: "audio/aiff",
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
}: {
  userId: string;
  onUploaded?: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

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
        description: "Please upload an MP3, WAV, AIFF, or M4A file.",
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

  // Mirrors the admin uploader: raw XHR PUT/POST to Storage so we get progress.
  const uploadWithProgress = (path: string, f: File): Promise<void> =>
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
        const ext = (f.name.split(".").pop() || "").toLowerCase();
        const contentType = MIME_BY_EXT[ext] || f.type || "application/octet-stream";
        xhr.open("POST", url);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.setRequestHeader("x-upsert", "false");
        // Explicit Content-Type wins over the Blob's type per the XHR spec, so
        // this guarantees an allowlisted MIME even when file.type is empty.
        xhr.setRequestHeader("Content-Type", contentType);
        xhr.send(f);
      });
    });

  const handleSubmit = async () => {
    if (!file || !title.trim()) {
      toast({ title: "Add a title and a file", variant: "destructive" });
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const ext = (file.name.split(".").pop() || "dat").toLowerCase();
      const storagePath = `${userId}/${Date.now()}.${ext}`;
      await uploadWithProgress(storagePath, file);

      // Owner = user_id (self). Provenance + pending status are also pinned by the
      // enforce_mix_write_rules trigger; we set them explicitly so the insert
      // satisfies the "Users can upload own mixes" RLS check directly.
      const { error } = await supabase.from("mixes").insert({
        user_id: userId,
        uploaded_by_user_id: userId,
        uploaded_by_role: "user",
        status: "pending_review",
        title: title.trim(),
        description: description.trim() || null,
        file_url: storagePath,
        recorded_at: new Date().toISOString(),
      });
      if (error) throw error;

      toast({
        title: "Mix uploaded",
        description: "It's in the review queue — your report card will appear here once it's ready.",
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
              <p className="text-[11px] text-muted-foreground font-body text-right">{progress}%</p>
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
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
