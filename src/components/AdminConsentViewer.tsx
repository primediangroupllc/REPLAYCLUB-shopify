import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Download, FileSignature, Loader2 } from "lucide-react";
import StudioRepSignature from "@/components/StudioRepSignature";
import { toast } from "sonner";

interface AdminConsentViewerProps {
  bookingId: string;
  customerName: string;
  customerEmail: string;
  roomTitle: string;
  bookingDate: string;
  bookingTime: string;
  consentSignaturePath: string | null;
  consentSignedAt: string | null;
  consentSignerName: string | null;
}

const AdminConsentViewer = ({
  bookingId,
  customerName,
  customerEmail,
  roomTitle,
  bookingDate,
  bookingTime,
  consentSignaturePath,
  consentSignedAt,
  consentSignerName,
}: AdminConsentViewerProps) => {
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!consentSignaturePath) {
      setLoading(false);
      return;
    }
    const load = async () => {
      const { data } = await supabase.storage
        .from("consent-signatures")
        .createSignedUrl(consentSignaturePath, 600);
      if (data?.signedUrl) setSignatureUrl(data.signedUrl);
      setLoading(false);
    };
    load();
  }, [consentSignaturePath]);

  const fetchSignatureAsDataUrl = async (url: string): Promise<string | null> => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const sigData = signatureUrl ? await fetchSignatureAsDataUrl(signatureUrl) : null;
      // Lazy-load jspdf only when user actually clicks Download
      const { generateConsentPdf } = await import("@/lib/generateConsentPdf");
      await generateConsentPdf({
        bookingId,
        customerName,
        customerEmail,
        roomTitle,
        bookingDate,
        bookingTime,
        consentSignedAt,
        consentSignerName,
        guestSignatureDataUrl: sigData,
      });
      toast.success("Consent PDF downloaded");
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
          <FileSignature className="w-3 h-3" /> Signed Consent Agreement
        </p>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-1 text-[10px] font-display font-semibold uppercase tracking-wider px-2 py-1 rounded-md bg-accent text-accent-foreground hover:bg-accent/80 transition-colors disabled:opacity-50"
        >
          {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
          PDF
        </button>
      </div>

      {!consentSignaturePath ? (
        <p className="text-[10px] text-muted-foreground italic font-body">
          No consent signature on file for this booking.
        </p>
      ) : (
        <>
          {/* Summary line */}
          <p className="text-[10px] text-muted-foreground font-body">
            Signed by <span className="text-foreground">{consentSignerName || customerName}</span>
            {consentSignedAt && (
              <> on <span className="text-foreground">{new Date(consentSignedAt).toLocaleString()}</span></>
            )}
          </p>

          {/* Signature pair */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border border-border bg-secondary/40 p-2">
              <p className="text-[9px] font-display uppercase tracking-wider text-muted-foreground mb-1">Guest</p>
              {loading ? (
                <div className="h-16 bg-muted animate-pulse rounded" />
              ) : signatureUrl ? (
                <img
                  src={signatureUrl}
                  alt={`Signature of ${customerName}`}
                  className="w-full h-16 object-contain bg-card rounded"
                />
              ) : (
                <p className="text-[9px] text-destructive">Failed to load</p>
              )}
              <p className="text-[9px] text-foreground font-body mt-1 truncate">{consentSignerName || customerName}</p>
            </div>

            <div className="rounded-md border border-border bg-secondary/40 p-2">
              <p className="text-[9px] font-display uppercase tracking-wider text-muted-foreground mb-1">Studio Rep</p>
              <div className="bg-card rounded p-1">
                <StudioRepSignature className="w-full h-14" />
              </div>
              <p className="text-[9px] text-foreground font-body mt-1 truncate">Replay Club · Authorized</p>
            </div>
          </div>

          {/* Collapsible agreement preview */}
          <details className="rounded-md border border-border/50 bg-secondary/20">
            <summary className="cursor-pointer px-2 py-1.5 text-[10px] font-display uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
              View agreement text
            </summary>
            <div className="px-2 pb-2 text-[10px] font-body text-muted-foreground space-y-1.5 max-h-48 overflow-y-auto">
              <p><span className="text-foreground font-semibold">1. Assumption of Risk & Liability Waiver.</span> Guest assumes all risk and releases Replay Club from claims arising from studio use.</p>
              <p><span className="text-foreground font-semibold">2. Right to Refuse Service.</span> Replay Club may refuse entry or terminate a session for policy violations or unsafe behavior.</p>
              <p><span className="text-foreground font-semibold">3. Surveillance Consent.</span> Premises are continuously recorded; entry constitutes consent.</p>
              <p><span className="text-foreground font-semibold">4. Promotional Media Release.</span> Replay Club may use captured photos/video/audio promotionally unless opted out.</p>
              <p><span className="text-foreground font-semibold">5. Address Confidentiality.</span> Studio address and access codes must not be shared publicly.</p>
              <p><span className="text-foreground font-semibold">6. Conduct & Damages.</span> Guest is liable for damage; no smoking, illegal substances, or unauthorized commerce.</p>
              <p><span className="text-foreground font-semibold">7. Intellectual Property.</span> Guest retains creative work; Replay retains brand/environment IP.</p>
              <p><span className="text-foreground font-semibold">8. Guest Responsibility.</span> Booker is responsible for all attendees they bring.</p>
              <p><span className="text-foreground font-semibold">9. Cancellation.</span> ≥24h notice required; late cancellations non-refundable.</p>
              <p><span className="text-foreground font-semibold">10. Governing Law.</span> California law; Los Angeles County jurisdiction.</p>
            </div>
          </details>
        </>
      )}
    </div>
  );
};

export default AdminConsentViewer;
