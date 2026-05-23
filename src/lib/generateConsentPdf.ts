import jsPDF from "jspdf";
import logoPng from "@/assets/logo.png";

export interface ConsentPdfData {
  bookingId: string;
  customerName: string;
  customerEmail: string;
  roomTitle: string;
  bookingDate: string;
  bookingTime: string;
  consentSignedAt: string | null;
  consentSignerName: string | null;
  guestSignatureDataUrl: string | null; // base64 PNG of the guest signature
}

const AGREEMENT_SECTIONS: Array<{ title: string; body: string }> = [
  { title: "1. Assumption of Risk & Liability Waiver", body: "I voluntarily participate in activities at Replay Club and assume all risk of injury, loss, or damage to person or property. I release Replay Club, its owners, staff, and affiliates from any and all claims arising from my use of the studio." },
  { title: "2. Right to Refuse Service", body: "Replay Club reserves the right to refuse entry, terminate a session without refund, and remove any guest who violates studio policy, behaves unsafely, or is impaired." },
  { title: "3. Surveillance Consent", body: "The premises are continuously monitored by audio/video recording for safety and security. By entering, I consent to being recorded." },
  { title: "4. Promotional Media Release", body: "I grant Replay Club a perpetual, royalty-free license to use photos, video, and audio captured on premises for promotional purposes, unless I opt out in writing before the session." },
  { title: "5. Address Confidentiality", body: "The studio's physical address, entry code, and access details are confidential. I will not publish, post, tag, or share them on social media or any public platform." },
  { title: "6. Conduct & Damages", body: "I am financially responsible for any damage I or my guests cause to equipment, furnishings, or the premises. No smoking, illegal substances, or unauthorized commercial activity." },
  { title: "7. Intellectual Property", body: "Original creative work I produce during the session remains my property. Replay Club retains rights to its branding, environment, and equipment imagery." },
  { title: "8. Guest Responsibility", body: "I am responsible for the conduct of any guests I bring. All attendees must comply with this agreement." },
  { title: "9. Cancellation", body: "Reschedule or cancel ≥24 hours in advance. Late cancellations and no-shows are non-refundable." },
  { title: "10. Governing Law", body: "This agreement is governed by the laws of the State of California. Any disputes will be resolved in Los Angeles County." },
];

async function loadImageAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Studio rep signature mark as a PNG dataURL — rasterizes the same SVG used on screen
async function renderStudioRepMark(): Promise<string> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 90" width="560" height="180">
    <defs>
      <linearGradient id="ink" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#222"/>
        <stop offset="50%" stop-color="#444"/>
        <stop offset="100%" stop-color="#666"/>
      </linearGradient>
    </defs>
    <path d="M10,55 C20,30 40,25 50,40 C55,52 40,58 35,50 C45,40 65,55 75,45 C82,38 78,55 90,50 C100,45 105,30 115,42 C120,50 110,58 105,52 C115,42 130,55 140,48 C150,40 160,55 170,48 C178,42 180,55 195,50"
      fill="none" stroke="url(#ink)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M8,68 C60,72 130,66 200,70" fill="none" stroke="#555" stroke-width="1" stroke-linecap="round" opacity="0.6"/>
    <path d="M195,50 C205,55 210,40 200,38" fill="none" stroke="url(#ink)" stroke-width="1.6" stroke-linecap="round"/>
    <g transform="translate(232, 45)">
      <circle r="28" fill="none" stroke="#333" stroke-width="1.2"/>
      <circle r="24" fill="none" stroke="#666" stroke-width="0.6" opacity="0.5"/>
      <text x="0" y="3" text-anchor="middle" font-size="14" font-family="Georgia, serif" font-weight="700" fill="#222" letter-spacing="1">RC</text>
      <text x="0" y="16" text-anchor="middle" font-size="4" font-family="Helvetica, sans-serif" fill="#444" letter-spacing="2">REPLAY · CLUB</text>
    </g>
  </svg>`;
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 560;
    canvas.height = 180;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function generateConsentPdf(data: ConsentPdfData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  let y = margin;

  // Logo
  try {
    const logoB64 = await loadImageAsBase64(logoPng);
    const w = 38;
    const h = 14;
    doc.addImage(logoB64, "PNG", (pageW - w) / 2, y, w, h);
    y += h + 3;
  } catch {
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("REPLAY CLUB", pageW / 2, y + 6, { align: "center" });
    y += 12;
  }
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110, 110, 110);
  doc.text("Private studio · Los Angeles, CA · replayclubrecords@gmail.com", pageW / 2, y, { align: "center" });
  y += 6;

  // Divider
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text("STUDIO CONSENT, LIABILITY WAIVER & RELEASE", pageW / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110, 110, 110);
  doc.text(`Booking #${data.bookingId.slice(0, 8).toUpperCase()}`, pageW / 2, y, { align: "center" });
  y += 7;

  // Booking summary
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, y, pageW - margin * 2, 22, 1.5, 1.5, "F");
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "bold");
  doc.text("GUEST", margin + 3, y + 5);
  doc.text("ROOM", margin + 3, y + 11);
  doc.text("DATE / TIME", margin + 3, y + 17);
  doc.setFont("helvetica", "normal");
  doc.text(data.customerName, margin + 28, y + 5);
  doc.text(data.roomTitle, margin + 28, y + 11);
  doc.text(`${data.bookingDate} · ${data.bookingTime}`, margin + 28, y + 17);
  doc.setFont("helvetica", "bold");
  doc.text("EMAIL", pageW / 2 + 5, y + 5);
  doc.setFont("helvetica", "normal");
  doc.text(data.customerEmail, pageW / 2 + 28, y + 5);
  y += 28;

  // Agreement sections
  doc.setFontSize(8);
  for (const s of AGREEMENT_SECTIONS) {
    if (y > pageH - 70) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(25, 25, 25);
    doc.text(s.title, margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(s.body, pageW - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 3.6 + 2;
  }

  // Signature block on a new page if needed
  if (y > pageH - 80) {
    doc.addPage();
    y = margin;
  }

  y += 4;
  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text("SIGNATURES", margin, y);
  y += 6;

  const colW = (pageW - margin * 2 - 8) / 2;
  const sigBoxH = 32;
  const guestX = margin;
  const repX = margin + colW + 8;

  // Signature boxes
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.rect(guestX, y, colW, sigBoxH);
  doc.rect(repX, y, colW, sigBoxH);

  // Guest signature image
  if (data.guestSignatureDataUrl) {
    try {
      doc.addImage(data.guestSignatureDataUrl, "PNG", guestX + 2, y + 2, colW - 4, sigBoxH - 8);
    } catch {
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("[signature on file]", guestX + 4, y + sigBoxH / 2);
    }
  } else {
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("[no signature on file]", guestX + 4, y + sigBoxH / 2);
  }

  // Studio rep mark
  try {
    const repMark = await renderStudioRepMark();
    doc.addImage(repMark, "PNG", repX + 2, y + 2, colW - 4, sigBoxH - 8);
  } catch {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    doc.text("Replay Club", repX + 4, y + sigBoxH / 2);
  }

  // Captions
  const capY = y + sigBoxH + 4;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(25, 25, 25);
  doc.text("GUEST", guestX, capY);
  doc.text("STUDIO REPRESENTATIVE", repX, capY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(data.consentSignerName || data.customerName, guestX, capY + 4);
  doc.text("Replay Club · Authorized Representative", repX, capY + 4);

  const signedDate = data.consentSignedAt
    ? new Date(data.consentSignedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
    : "—";
  doc.setTextColor(110, 110, 110);
  doc.text(`Signed: ${signedDate}`, guestX, capY + 8);
  doc.text(`Auto-signed: ${signedDate}`, repX, capY + 8);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    "This document is auto-generated and constitutes a binding agreement.",
    pageW / 2,
    pageH - 10,
    { align: "center" }
  );

  doc.save(`replay-club-consent-${data.bookingId.slice(0, 8)}.pdf`);
}
