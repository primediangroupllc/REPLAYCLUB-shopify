import jsPDF from "jspdf";
import logoPng from "@/assets/logo.png";
import { PHOTO_PACKAGES, ADDON_BUNDLES } from "./bookingConstants";

interface ReceiptData {
  bookingId: string;
  customerName: string;
  customerEmail: string;
  roomTitle: string;
  bookingDate: string;
  bookingTime: string;
  tier: string | null;
  layout: string | null;
  sound: string | null;
  lighting: string | null;
  equipment: string[];
  amountCents: number;
  createdAt: string;
  paymentStatus: string;
}

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

export async function generateReceipt(data: ReceiptData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // === BLACK BACKGROUND ===
  doc.setFillColor(8, 8, 8);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  let y = 18;

  // === LOGO ===
  try {
    const logoBase64 = await loadImageAsBase64(logoPng);
    const logoW = 50;
    const logoH = 18;
    doc.addImage(logoBase64, "PNG", (pageWidth - logoW) / 2, y, logoW, logoH);
    y += logoH + 6;
  } catch {
    // Fallback text if logo fails
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 220, 220);
    doc.text("REPLAY CLUB", pageWidth / 2, y + 10, { align: "center" });
    y += 18;
  }

  // Address line
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Private studio — Los Angeles, CA", pageWidth / 2, y, { align: "center" });
  y += 4;
  doc.text("replayclubrecords@gmail.com", pageWidth / 2, y, { align: "center" });
  y += 8;

  // === CHROME DIVIDER (gradient effect via layered lines) ===
  const drawChromeDivider = (yPos: number) => {
    doc.setDrawColor(40, 40, 40);
    doc.setLineWidth(0.5);
    doc.line(25, yPos, pageWidth - 25, yPos);
    doc.setDrawColor(65, 65, 65);
    doc.setLineWidth(0.15);
    doc.line(25, yPos - 0.25, pageWidth - 25, yPos - 0.25);
  };

  drawChromeDivider(y);
  y += 8;

  // === RECEIPT TITLE ===
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(217, 217, 217);
  doc.text("BOOKING RECEIPT", pageWidth / 2, y, { align: "center" });
  y += 4;

  // Receipt number subtitle
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`#${data.bookingId.slice(0, 8).toUpperCase()}`, pageWidth / 2, y + 3, { align: "center" });
  y += 12;

  // === ROW HELPER ===
  const addRow = (label: string, value: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(90, 90, 90);
    doc.text(label.toUpperCase(), 30, y);
    doc.setTextColor(200, 200, 200);
    doc.text(value, pageWidth - 30, y, { align: "right" });
    y += 6.5;
  };

  // === STATUS & DATE ===
  addRow("Date Issued", new Date(data.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }));
  const statusText = data.paymentStatus === "paid" ? "PAID" : data.paymentStatus.toUpperCase();
  // Status with color badge
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  doc.text("STATUS", 30, y);
  if (data.paymentStatus === "paid") {
    doc.setTextColor(72, 187, 120); // green
  } else {
    doc.setTextColor(200, 150, 50); // amber
  }
  doc.setFont("helvetica", "bold");
  doc.text(statusText, pageWidth - 30, y, { align: "right" });
  y += 10;

  // === SECTION: CUSTOMER ===
  drawChromeDivider(y);
  y += 7;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(180, 180, 180);
  doc.text("CUSTOMER", 30, y);
  y += 8;
  addRow("Name", data.customerName);
  addRow("Email", data.customerEmail);
  y += 4;

  // === SECTION: SESSION ===
  drawChromeDivider(y);
  y += 7;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(180, 180, 180);
  doc.text("SESSION DETAILS", 30, y);
  y += 8;
  addRow("Room", data.roomTitle);
  addRow("Date", new Date(data.bookingDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }));
  addRow("Time", data.bookingTime);
  if (data.tier) addRow("Tier", data.tier);
  if (data.layout) addRow("Layout", data.layout);
  if (data.sound) addRow("Sound", data.sound);
  if (data.lighting) addRow("Lighting", data.lighting);

  // Split equipment into photo packages, add-on bundles, and à-la-carte gear
  // so customers see labeled line items with flat pricing instead of a generic blob.
  if (data.equipment.length > 0) {
    const packageNames = new Set(PHOTO_PACKAGES.map((p) => p.name));
    const bundleNames = new Set(ADDON_BUNDLES.map((b) => b.name));
    const packageByName = new Map(PHOTO_PACKAGES.map((p) => [p.name, p]));
    const bundleByName = new Map(ADDON_BUNDLES.map((b) => [b.name, b]));

    const packages = data.equipment.filter((e) => packageNames.has(e));
    const bundles = data.equipment.filter((e) => bundleNames.has(e));
    const gear = data.equipment.filter(
      (e) => !packageNames.has(e) && !bundleNames.has(e)
    );

    for (const name of packages) {
      const pkg = packageByName.get(name);
      const price = pkg ? `$${(pkg.priceCents / 100).toFixed(2)} flat` : "Included";
      addRow("Package", `${name} — ${price}`);
    }
    for (const name of bundles) {
      const bundle = bundleByName.get(name);
      const price = bundle ? `$${(bundle.priceCents / 100).toFixed(2)} flat` : "Included";
      addRow("Add-on Bundle", `${name} — ${price}`);
    }
    if (gear.length > 0) {
      addRow("Equipment", gear.join(", "));
    }
  }
  y += 4;

  // === TOTAL BOX ===
  drawChromeDivider(y);
  y += 4;

  // Dark card background for total
  const boxX = 25;
  const boxW = pageWidth - 50;
  const boxH = 18;
  doc.setFillColor(18, 18, 18);
  doc.roundedRect(boxX, y, boxW, boxH, 2, 2, "F");
  // Border
  doc.setDrawColor(50, 50, 50);
  doc.setLineWidth(0.3);
  doc.roundedRect(boxX, y, boxW, boxH, 2, 2, "S");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(140, 140, 140);
  doc.text("TOTAL PAID", boxX + 8, y + boxH / 2 + 1);
  doc.setFontSize(14);
  doc.setTextColor(230, 230, 230);
  doc.text(`$${(data.amountCents / 100).toFixed(2)}`, pageWidth - boxX - 8, y + boxH / 2 + 1.5, { align: "right" });
  y += boxH + 14;

  // === FOOTER ===
  drawChromeDivider(y);
  y += 8;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(70, 70, 70);
  doc.text("Thank you for choosing Replay Club.", pageWidth / 2, y, { align: "center" });
  y += 4;
  doc.text("This receipt is auto-generated. For questions, contact replayclubrecords@gmail.com", pageWidth / 2, y, { align: "center" });

  doc.save(`replay-club-receipt-${data.bookingId.slice(0, 8)}.pdf`);
}
