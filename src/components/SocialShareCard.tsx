import { useState, useRef, useCallback } from "react";
import { Share2, Twitter, Copy, Check, Instagram, Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SocialShareCardProps {
  roomTitle: string;
  bookingDate: string;
  bookingTime: string;
  customerName?: string;
}

const generateShareImage = (
  roomTitle: string,
  bookingDate: string,
  bookingTime: string,
  customerName?: string,
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const W = 1080;
    const H = 1080;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("Canvas not supported"));

    // Background gradient — dark with subtle red accent
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0a0a0a");
    bg.addColorStop(0.5, "#111111");
    bg.addColorStop(1, "#0a0a0a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle grid pattern
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Red accent glow
    const glow = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, 400);
    glow.addColorStop(0, "rgba(220, 38, 38, 0.12)");
    glow.addColorStop(1, "rgba(220, 38, 38, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Top bar accent
    const barGrad = ctx.createLinearGradient(0, 0, W, 0);
    barGrad.addColorStop(0, "rgba(220, 38, 38, 0)");
    barGrad.addColorStop(0.3, "rgba(220, 38, 38, 0.6)");
    barGrad.addColorStop(0.7, "rgba(220, 38, 38, 0.6)");
    barGrad.addColorStop(1, "rgba(220, 38, 38, 0)");
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 0, W, 3);

    // "REPLAY CLUB" branding
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "600 18px system-ui, -apple-system, sans-serif";
    ctx.letterSpacing = "8px";
    ctx.textAlign = "center";
    ctx.fillText("R E P L A Y   C L U B", W / 2, 120);

    // Divider line
    ctx.strokeStyle = "rgba(220, 38, 38, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 60, 150);
    ctx.lineTo(W / 2 + 60, 150);
    ctx.stroke();

    // "STUDIO SESSION" label
    ctx.fillStyle = "rgba(220, 38, 38, 0.8)";
    ctx.font = "700 16px system-ui, -apple-system, sans-serif";
    ctx.fillText("S T U D I O   S E S S I O N", W / 2, 200);

    // Room title
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 64px system-ui, -apple-system, sans-serif";
    ctx.fillText(roomTitle, W / 2, 380);

    // Date + time
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "500 32px system-ui, -apple-system, sans-serif";
    ctx.fillText(`${bookingDate}  •  ${bookingTime}`, W / 2, 460);

    // Customer name if provided
    if (customerName) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "400 24px system-ui, -apple-system, sans-serif";
      ctx.fillText(customerName, W / 2, 520);
    }

    // Waveform decoration
    ctx.strokeStyle = "rgba(220, 38, 38, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const waveY = 650;
    for (let x = 140; x < W - 140; x += 4) {
      const amplitude = 30 + Math.sin(x * 0.02) * 15;
      const y = waveY + Math.sin(x * 0.05 + Math.random() * 0.5) * amplitude;
      if (x === 140) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Bottom hashtag
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.font = "500 20px system-ui, -apple-system, sans-serif";
    ctx.fillText("#ReplayClub  #StudioLife", W / 2, H - 80);

    // Bottom bar
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, H - 3, W, 3);

    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to generate image"));
      },
      "image/png",
      1,
    );
  });
};

const SocialShareCard = ({ roomTitle, bookingDate, bookingTime, customerName }: SocialShareCardProps) => {
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const shareText = `🎶 Just booked a session at Replay Club! ${roomTitle} on ${bookingDate} 🔥 #ReplayClub #StudioLife`;
  const shareUrl = "https://www.replayclub.io";

  const handleTwitterShare = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, "_blank", "width=550,height=420");
  };

  const handleInstagramCopy = () => {
    navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
    toast({ title: "Copied for Instagram!", description: "Paste this in your Instagram story or post." });
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadImage = useCallback(async () => {
    setGenerating(true);
    try {
      const blob = await generateShareImage(roomTitle, bookingDate, bookingTime, customerName);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `replay-club-${bookingDate}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Share card downloaded!", description: "Post it to your socials 🔥" });
    } catch {
      toast({ title: "Failed to generate image", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }, [roomTitle, bookingDate, bookingTime, customerName, toast]);

  return (
    <div className="bg-secondary rounded-md border border-border p-4 space-y-3">
      <div className="flex items-center gap-2 text-chrome">
        <Share2 className="w-4 h-4" />
        <span className="font-display text-xs uppercase tracking-wider font-semibold">Share Your Session</span>
      </div>
      <p className="text-muted-foreground text-xs font-body">
        Let everyone know you're hitting the studio! 🎤
      </p>

      {/* Download branded share card */}
      <button
        onClick={handleDownloadImage}
        disabled={generating}
        className="w-full flex items-center justify-center gap-2 text-xs font-display uppercase tracking-wider py-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {generating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        {generating ? "Generating..." : "Download Share Card"}
      </button>

      <div className="flex gap-2">
        <button
          onClick={handleTwitterShare}
          className="flex-1 flex items-center justify-center gap-2 text-xs font-display uppercase tracking-wider py-2.5 rounded-md border border-border hover:border-chrome/50 hover:bg-accent transition-colors"
        >
          <Twitter className="w-3.5 h-3.5" />
          Twitter
        </button>
        <button
          onClick={handleInstagramCopy}
          className="flex-1 flex items-center justify-center gap-2 text-xs font-display uppercase tracking-wider py-2.5 rounded-md border border-border hover:border-chrome/50 hover:bg-accent transition-colors"
        >
          <Instagram className="w-3.5 h-3.5" />
          Instagram
        </button>
        <button
          onClick={handleCopyLink}
          className="flex-1 flex items-center justify-center gap-2 text-xs font-display uppercase tracking-wider py-2.5 rounded-md border border-border hover:border-chrome/50 hover:bg-accent transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
};

export default SocialShareCard;
