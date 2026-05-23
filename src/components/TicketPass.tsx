import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import QRCode from "qrcode";
import { Calendar, MapPin, Ticket as TicketIcon, Wallet, Loader2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";

export interface TicketPassData {
  id: string;
  ticket_code: string;
  user_name: string;
  payment_status: string;
  status: string;
  amount_paid_cents: number;
  event: {
    title: string;
    event_date: string;
    start_time: string;
    end_time: string | null;
    location: string | null;
    cover_image_url: string | null;
  };
}

interface Props {
  ticket: TicketPassData;
  showWalletSave?: boolean;
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const generatePassImage = async (ticket: TicketPassData): Promise<Blob> => {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // Background — black abyss with chrome gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0a0a0a");
  bg.addColorStop(0.5, "#1a1a1a");
  bg.addColorStop(1, "#0a0a0a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Radial chrome accent
  const radial = ctx.createRadialGradient(W / 2, H * 0.3, 50, W / 2, H * 0.3, 800);
  radial.addColorStop(0, "rgba(180,180,200,0.08)");
  radial.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, W, H);

  // Grid pattern
  ctx.strokeStyle = "rgba(255,255,255,0.025)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Outer card frame
  const cardX = 80;
  const cardY = 120;
  const cardW = W - 160;
  const cardH = H - 240;
  const r = 32;
  ctx.fillStyle = "rgba(20,20,22,0.85)";
  ctx.beginPath();
  ctx.moveTo(cardX + r, cardY);
  ctx.lineTo(cardX + cardW - r, cardY);
  ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + r);
  ctx.lineTo(cardX + cardW, cardY + cardH - r);
  ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - r, cardY + cardH);
  ctx.lineTo(cardX + r, cardY + cardH);
  ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - r);
  ctx.lineTo(cardX, cardY + r);
  ctx.quadraticCurveTo(cardX, cardY, cardX + r, cardY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(180,180,200,0.25)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Header label
  ctx.fillStyle = "rgba(180,180,200,0.55)";
  ctx.font = "600 26px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.letterSpacing = "8px" as any;
  ctx.fillText("REPLAY  CLUB  PASS", W / 2, cardY + 80);

  // Event title — chrome
  const titleGrad = ctx.createLinearGradient(0, cardY + 120, 0, cardY + 200);
  titleGrad.addColorStop(0, "#ffffff");
  titleGrad.addColorStop(0.5, "#c0c0c8");
  titleGrad.addColorStop(1, "#888892");
  ctx.fillStyle = titleGrad;
  ctx.font = "bold 56px 'Helvetica Neue', system-ui, sans-serif";
  const title = ticket.event.title.length > 24 ? ticket.event.title.slice(0, 24) + "…" : ticket.event.title;
  ctx.fillText(title.toUpperCase(), W / 2, cardY + 175);

  // QR code with logo
  const qrSize = 640;
  const qrX = (W - qrSize) / 2;
  const qrY = cardY + 240;

  // White rounded backing for QR
  const qrPad = 36;
  ctx.fillStyle = "#ffffff";
  const qrR = 24;
  const bx = qrX - qrPad;
  const by = qrY - qrPad;
  const bw = qrSize + qrPad * 2;
  const bh = qrSize + qrPad * 2;
  ctx.beginPath();
  ctx.moveTo(bx + qrR, by);
  ctx.lineTo(bx + bw - qrR, by);
  ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + qrR);
  ctx.lineTo(bx + bw, by + bh - qrR);
  ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - qrR, by + bh);
  ctx.lineTo(bx + qrR, by + bh);
  ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - qrR);
  ctx.lineTo(bx, by + qrR);
  ctx.quadraticCurveTo(bx, by, bx + qrR, by);
  ctx.closePath();
  ctx.fill();

  // Render QR onto temp canvas
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, ticket.ticket_code, {
    width: qrSize,
    margin: 0,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#ffffff" },
  });
  ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

  // Logo overlay in QR center
  try {
    const logoImg = await loadImage(logo);
    const logoSize = 140;
    const lx = qrX + (qrSize - logoSize) / 2;
    const ly = qrY + (qrSize - logoSize) / 2;
    // White circle backing
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(W / 2, qrY + qrSize / 2, logoSize / 2 + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(logoImg, lx, ly, logoSize, logoSize);
  } catch {
    // logo failed, QR still scans
  }

  // Ticket code text
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 48px 'SF Mono', 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillText(ticket.ticket_code, W / 2, qrY + qrSize + 110);

  ctx.fillStyle = "rgba(180,180,200,0.55)";
  ctx.font = "500 22px system-ui, sans-serif";
  ctx.fillText("SCAN  AT  THE  DOOR", W / 2, qrY + qrSize + 150);

  // Perforated divider
  const divY = qrY + qrSize + 210;
  ctx.strokeStyle = "rgba(180,180,200,0.3)";
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(cardX + 60, divY);
  ctx.lineTo(cardX + cardW - 60, divY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Details
  let dy = divY + 70;
  const detailX = cardX + 80;
  ctx.textAlign = "left";

  const drawRow = (label: string, value: string) => {
    ctx.fillStyle = "rgba(180,180,200,0.55)";
    ctx.font = "500 22px system-ui, sans-serif";
    ctx.fillText(label.toUpperCase(), detailX, dy);
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 32px system-ui, sans-serif";
    ctx.fillText(value, detailX, dy + 40);
    dy += 100;
  };

  drawRow("Guest", ticket.user_name);
  drawRow(
    "When",
    `${ticket.event.event_date} • ${ticket.event.start_time}${ticket.event.end_time ? ` – ${ticket.event.end_time}` : ""}`,
  );
  if (ticket.event.location) {
    drawRow("Where", ticket.event.location.length > 32 ? ticket.event.location.slice(0, 32) + "…" : ticket.event.location);
  }

  // Footer
  ctx.fillStyle = "rgba(180,180,200,0.4)";
  ctx.font = "500 22px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("REPLAYCLUB.IO", W / 2, H - 80);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png", 0.95);
  });
};

const TicketPass = ({ ticket, showWalletSave = false }: Props) => {
  const { event, ticket_code, user_name, amount_paid_cents, status } = ticket;
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSavePass = async () => {
    setSaving(true);
    try {
      const blob = await generatePassImage(ticket);
      const filename = `replay-club-${ticket_code}.png`;
      const file = new File([blob], filename, { type: "image/png" });

      // Try native share (iOS/Android can save to Photos / Wallet workflows)
      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
        share?: (data: { files: File[]; title?: string; text?: string }) => Promise<void>;
      };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        try {
          await nav.share({
            files: [file],
            title: `${event.title} — Replay Club`,
            text: `My ticket for ${event.title}`,
          });
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
          return;
        } catch (err) {
          // User cancelled — fall through to download
          if ((err as Error)?.name === "AbortError") {
            return;
          }
        }
      }

      // Fallback: trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast({
        title: "Pass saved",
        description: "Open it from your downloads and add to Photos / lock screen.",
      });
    } catch (err) {
      console.error("Save pass failed:", err);
      toast({
        title: "Couldn't save pass",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/40 bg-gradient-to-br from-background via-card to-background shadow-2xl">
      {/* Cover background */}
      {event.cover_image_url && (
        <div
          className="absolute inset-0 opacity-15 blur-sm"
          style={{
            backgroundImage: `url(${event.cover_image_url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/60 to-background/90" />

      <div className="relative p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground font-mono mb-1">
              Replay Club Pass
            </p>
            <h3 className="text-base sm:text-lg font-display font-bold chrome-text truncate">
              {event.title}
            </h3>
          </div>
          <div className="shrink-0 ml-3 px-2 py-1 rounded-full bg-primary/10 border border-primary/30">
            <p className="text-[9px] uppercase tracking-wider text-primary font-mono">
              {status === "confirmed" ? "Active" : status}
            </p>
          </div>
        </div>

        {/* QR with logo overlay */}
        <div className="flex justify-center my-5">
          <div className="relative bg-white p-3 rounded-lg shadow-lg">
            <QRCodeSVG
              value={ticket_code}
              size={180}
              level="H"
              bgColor="#ffffff"
              fgColor="#000000"
              imageSettings={{
                src: logo,
                height: 44,
                width: 44,
                excavate: true,
              }}
            />
          </div>
        </div>

        {/* Code */}
        <p className="text-center text-xl font-display font-bold tracking-[0.4em] text-foreground mb-1">
          {ticket_code}
        </p>
        <p className="text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono mb-5">
          Scan at the door
        </p>

        {/* Perforated divider */}
        <div className="relative my-4 border-t border-dashed border-border/50">
          <div className="absolute -left-7 -top-3 w-5 h-5 rounded-full bg-background border border-border/40" />
          <div className="absolute -right-7 -top-3 w-5 h-5 rounded-full bg-background border border-border/40" />
        </div>

        {/* Details */}
        <div className="space-y-2 text-xs font-body">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TicketIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{user_name}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>
              {event.event_date} • {event.start_time}
              {event.end_time ? ` – ${event.end_time}` : ""}
            </span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{event.location}</span>
            </div>
          )}
          {amount_paid_cents > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-border/30">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                Paid
              </span>
              <span className="text-foreground font-display font-semibold">
                ${(amount_paid_cents / 100).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Save to Wallet / Photos — only shown right after purchase */}
        {showWalletSave && (
          <>
            <button
              onClick={handleSavePass}
              disabled={saving}
              className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-b from-foreground to-foreground/85 text-background font-display text-xs uppercase tracking-[0.2em] font-bold hover:from-foreground/95 hover:to-foreground/75 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg border border-foreground/20"
              aria-label="Save pass to Apple Wallet, Google Wallet, or Photos"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating</span>
                </>
              ) : saved ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Save to Wallet</span>
                </>
              )}
            </button>
            <p className="mt-2 text-center text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70 font-mono">
              Apple Wallet · Google Wallet · Photos
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default TicketPass;
