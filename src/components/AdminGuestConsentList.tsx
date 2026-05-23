import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Download, Loader2, Users, FileSignature, ShieldCheck } from "lucide-react";
import StudioRepSignature from "@/components/StudioRepSignature";
import { toast } from "sonner";

interface AdminGuestConsentListProps {
  bookingId: string;
  roomTitle: string;
  bookingDate: string;
  bookingTime: string;
}

interface IdAnalysis {
  is_valid_id?: boolean | null;
  is_expired?: boolean | null;
  is_over_18?: boolean | null;
  name_match?: boolean | null;
  extracted_name?: string | null;
  confidence?: "high" | "medium" | "low" | null;
  reason?: string | null;
  analyzed_at?: string | null;
  parsed?: boolean;
}

interface GuestRow {
  id: string;
  guest_name: string;
  consent_signature_path: string | null;
  consent_signed_at: string | null;
  consent_signer_name: string | null;
  id_verified: string;
  id_photo_path: string | null;
  id_analysis: IdAnalysis | null;
}

const AdminGuestConsentList = ({
  bookingId,
  roomTitle,
  bookingDate,
  bookingTime,
}: AdminGuestConsentListProps) => {
  const [loading, setLoading] = useState(true);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [signatureUrls, setSignatureUrls] = useState<Record<string, string>>({});
  const [idPhotoUrls, setIdPhotoUrls] = useState<Record<string, string>>({});
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: inv } = await supabase
        .from("session_invites")
        .select("id")
        .eq("booking_id", bookingId)
        .maybeSingle();

      if (!inv) {
        setGuests([]);
        setLoading(false);
        return;
      }

      const { data: g } = await supabase
        .from("session_guests")
        .select("*")
        .eq("session_invite_id", inv.id)
        .order("created_at", { ascending: true });

      const list = ((g || []) as unknown) as GuestRow[];
      setGuests(list);

      // Sign signature URLs and ID photo URLs in parallel
      const [sigEntries, idEntries] = await Promise.all([
        Promise.all(
          list
            .filter((x) => x.consent_signature_path)
            .map(async (x) => {
              const { data } = await supabase.storage
                .from("consent-signatures")
                .createSignedUrl(x.consent_signature_path as string, 600);
              return [x.id, data?.signedUrl || ""] as const;
            })
        ),
        Promise.all(
          list
            .filter((x) => x.id_photo_path)
            .map(async (x) => {
              const { data } = await supabase.storage
                .from("id-verification")
                .createSignedUrl(x.id_photo_path as string, 600);
              return [x.id, data?.signedUrl || ""] as const;
            })
        ),
      ]);
      setSignatureUrls(Object.fromEntries(sigEntries.filter(([, u]) => u)));
      setIdPhotoUrls(Object.fromEntries(idEntries.filter(([, u]) => u)));
      setLoading(false);
    };
    load();
  }, [bookingId]);

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

  const handleDownload = async (guest: GuestRow) => {
    setDownloadingId(guest.id);
    try {
      const url = signatureUrls[guest.id];
      const sigData = url ? await fetchSignatureAsDataUrl(url) : null;
      // Lazy-load jspdf only when admin clicks Download
      const { generateConsentPdf } = await import("@/lib/generateConsentPdf");
      await generateConsentPdf({
        bookingId: `${bookingId.slice(0, 8)}-G-${guest.id.slice(0, 4)}`,
        customerName: guest.guest_name,
        customerEmail: "—",
        roomTitle,
        bookingDate,
        bookingTime,
        consentSignedAt: guest.consent_signed_at,
        consentSignerName: guest.consent_signer_name,
        guestSignatureDataUrl: sigData,
      });
      toast.success(`Consent PDF downloaded for ${guest.guest_name}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleVerify = async (guest: GuestRow, status: "approved" | "rejected") => {
    setUpdatingId(guest.id);
    const { error } = await (supabase as any).rpc("admin_set_guest_id_verification", {
      p_guest_id: guest.id,
      p_decision: status,
    });
    if (error) {
      toast.error(error.message);
    } else {
      setGuests((prev) => prev.map((x) => (x.id === guest.id ? { ...x, id_verified: status } : x)));
      toast.success(
        status === "approved"
          ? `${guest.guest_name}'s ID approved`
          : `${guest.guest_name}'s ID rejected`
      );
    }
    setUpdatingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-body">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading invited guests…
      </div>
    );
  }

  if (guests.length === 0) {
    return (
      <p className="text-[10px] text-muted-foreground italic font-body">
        No invited guests on file for this booking.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
        <Users className="w-3 h-3" /> Invited Guest Consents ({guests.length})
      </p>

      <div className="space-y-2">
        {guests.map((guest) => {
          const sigUrl = signatureUrls[guest.id];
          const idUrl = idPhotoUrls[guest.id];
          const hasSig = !!guest.consent_signature_path;
          const hasId = !!guest.id_photo_path;
          const status = guest.id_verified || "pending";
          const statusColor =
            status === "approved"
              ? "text-primary"
              : status === "rejected"
              ? "text-destructive"
              : "text-muted-foreground";

          return (
            <div
              key={guest.id}
              className="rounded-md border border-border bg-secondary/40 p-2 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-display font-semibold text-foreground truncate flex items-center gap-1.5">
                    <FileSignature className="w-3 h-3 text-muted-foreground" />
                    {guest.guest_name}
                    <span className={`text-[9px] uppercase tracking-wider ${statusColor}`}>· {status}</span>
                  </p>
                  {hasSig && guest.consent_signed_at && (
                    <p className="text-[9px] text-muted-foreground font-body">
                      Signed {new Date(guest.consent_signed_at).toLocaleString()}
                      {guest.consent_signer_name && guest.consent_signer_name !== guest.guest_name && (
                        <> by <span className="text-foreground">{guest.consent_signer_name}</span></>
                      )}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDownload(guest)}
                  disabled={downloadingId === guest.id}
                  className="flex items-center gap-1 text-[10px] font-display font-semibold uppercase tracking-wider px-2 py-1 rounded-md bg-accent text-accent-foreground hover:bg-accent/80 transition-colors disabled:opacity-50 shrink-0"
                >
                  {downloadingId === guest.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Download className="w-3 h-3" />
                  )}
                  PDF
                </button>
              </div>

              {/* ID Verification */}
              {hasId && (
                <div className="rounded-md border border-border/60 bg-card p-1.5 space-y-1.5">
                  <p className="text-[9px] font-display uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Government ID
                  </p>
                  {idUrl ? (
                    <a href={idUrl} target="_blank" rel="noopener noreferrer">
                      <img
                        src={idUrl}
                        alt={`ID of ${guest.guest_name}`}
                        className="w-full max-h-32 object-contain bg-background rounded"
                      />
                    </a>
                  ) : (
                    <div className="h-20 bg-muted animate-pulse rounded" />
                  )}
                  {guest.id_analysis && (
                    <div className="rounded border border-border/40 bg-background/40 p-1.5 space-y-1">
                      <p className="text-[9px] font-display uppercase tracking-wider text-muted-foreground">
                        AI Analysis
                      </p>
                      {guest.id_analysis.parsed === false ? (
                        <p className="text-[9px] font-body text-muted-foreground italic">
                          AI could not parse this ID — manual review required.
                        </p>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-1">
                            {(["is_valid_id", "is_over_18", "name_match"] as const).map((key) => {
                              const val = guest.id_analysis?.[key];
                              if (val === null || val === undefined) return null;
                              const label =
                                key === "is_valid_id"
                                  ? "Valid ID"
                                  : key === "is_over_18"
                                  ? "18+"
                                  : "Name match";
                              return (
                                <span
                                  key={key}
                                  className={`text-[9px] font-body px-1.5 py-0.5 rounded ${
                                    val
                                      ? "bg-primary/15 text-primary"
                                      : "bg-destructive/15 text-destructive"
                                  }`}
                                >
                                  {val ? "✓" : "✗"} {label}
                                </span>
                              );
                            })}
                            {guest.id_analysis.is_expired === true && (
                              <span className="text-[9px] font-body px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">
                                ✗ Expired
                              </span>
                            )}
                            {guest.id_analysis.confidence && (
                              <span
                                className={`text-[9px] font-body px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                  guest.id_analysis.confidence === "high"
                                    ? "bg-primary/15 text-primary"
                                    : guest.id_analysis.confidence === "medium"
                                    ? "bg-accent text-accent-foreground"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {guest.id_analysis.confidence} confidence
                              </span>
                            )}
                          </div>
                          {guest.id_analysis.extracted_name && (
                            <p className="text-[9px] font-body text-muted-foreground">
                              Extracted name:{" "}
                              <span className="text-foreground">{guest.id_analysis.extracted_name}</span>
                            </p>
                          )}
                          {guest.id_analysis.reason && (
                            <p className="text-[9px] font-body text-muted-foreground italic">
                              "{guest.id_analysis.reason}"
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleVerify(guest, "approved")}
                      disabled={status === "approved" || updatingId === guest.id}
                      className="flex-1 py-1 rounded-md text-[10px] font-display font-semibold uppercase tracking-wider bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                    >
                      {updatingId === guest.id ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Approve"}
                    </button>
                    <button
                      onClick={() => handleVerify(guest, "rejected")}
                      disabled={status === "rejected" || updatingId === guest.id}
                      className="flex-1 py-1 rounded-md text-[10px] font-display font-semibold uppercase tracking-wider bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}
              {!hasId && (
                <p className="text-[9px] text-muted-foreground italic font-body">
                  No ID photo uploaded by this guest.
                </p>
              )}

              {/* Consent Signatures */}
              {!hasSig ? (
                <p className="text-[10px] text-muted-foreground italic font-body">
                  No consent signature on file for this guest.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-border/60 bg-card p-1.5">
                    <p className="text-[9px] font-display uppercase tracking-wider text-muted-foreground mb-1">
                      Guest
                    </p>
                    {sigUrl ? (
                      <img
                        src={sigUrl}
                        alt={`Signature of ${guest.guest_name}`}
                        className="w-full h-14 object-contain bg-card rounded"
                      />
                    ) : (
                      <div className="h-14 bg-muted animate-pulse rounded" />
                    )}
                  </div>
                  <div className="rounded-md border border-border/60 bg-card p-1.5">
                    <p className="text-[9px] font-display uppercase tracking-wider text-muted-foreground mb-1">
                      Studio Rep
                    </p>
                    <StudioRepSignature className="w-full h-12" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

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
    </div>
  );
};

export default AdminGuestConsentList;
