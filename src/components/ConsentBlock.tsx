import { useState } from "react";
import { format } from "date-fns";
import { FileSignature } from "lucide-react";
import SignaturePad from "@/components/SignaturePad";
import StudioRepSignature from "@/components/StudioRepSignature";

export type ConsentVariant = "guest" | "rental";

interface ConsentBlockProps {
  variant: ConsentVariant;
  signerName: string;
  onSignerNameChange: (v: string) => void;
  onSignatureChange: (dataUrl: string | null) => void;
}

const GUEST_CLAUSES: Array<[string, string]> = [
  ["1. Assumption of Risk & Liability Waiver.", "I voluntarily participate in activities at Replay Club and assume all risk of injury, loss, or damage to person or property. I release Replay Club, its owners, staff, and affiliates from any and all claims arising from my use of the studio."],
  ["2. Right to Refuse Service.", "Replay Club reserves the right to refuse entry, terminate the session without refund, and remove any guest who violates studio policy, behaves unsafely, or is impaired."],
  ["3. Surveillance Consent.", "The premises are continuously monitored by audio/video recording for safety and security. By entering, I consent to being recorded."],
  ["4. Promotional Media Release.", "I grant Replay Club a perpetual, royalty-free license to use photos, video, and audio captured on premises for promotional purposes, unless I opt out in writing before the session."],
  ["5. Address Confidentiality.", "The studio's physical address, entry code, and access details are confidential. I will not publish, post, tag, or share them on social media or any public platform."],
  ["6. Conduct & Damages.", "I am financially responsible for any damage I cause to equipment, furnishings, or the premises. No smoking, illegal substances, or unauthorized commercial activity."],
  ["7. Host Responsibility.", "I am attending as a guest of the host who invited me and agree to follow their direction and the studio's house rules."],
  ["8. Intellectual Property.", "Original creative work I produce during the session remains my property. Replay Club retains rights to its branding, environment, and equipment imagery."],
  ["9. Governing Law.", "This agreement is governed by the laws of the State of California. Any disputes will be resolved in Los Angeles County."],
];

const RENTAL_CLAUSES: Array<[string, string]> = [
  ["1. Care & Custody.", "I accept the rented equipment in good working order and agree to use it only for its intended purpose, with reasonable care, in a safe environment."],
  ["2. Damage & Loss Liability.", "I am financially responsible for any loss, theft, damage, or excessive wear to the rented equipment from pickup until return — including, where applicable, full replacement value at current retail price."],
  ["3. No Modification or Sublease.", "I will not modify, repair, disassemble, sublease, lend, or transfer the equipment to any third party without written consent from Replay Club."],
  ["4. Return Condition & Late Fees.", "Equipment must be returned by the agreed return date in the same condition as received. Late returns incur a fee equal to one additional rental day per day late."],
  ["5. Right to Refuse / Reclaim.", "Replay Club reserves the right to refuse rental, cancel an active rental without refund, and reclaim equipment if used in a manner that violates this agreement."],
  ["6. Liability Waiver.", "I assume all risk arising from my use of the equipment and release Replay Club, its owners, staff, and affiliates from any and all claims for injury, loss, or damage."],
  ["7. Promotional Use of Content.", "If pickup occurs on premises, I consent to being recorded by studio surveillance and grant Replay Club a royalty-free license to use any captured footage for promotional purposes."],
  ["8. Identity Verification.", "A valid government-issued ID matching this signature may be required at pickup. False information voids this rental."],
  ["9. Governing Law.", "This agreement is governed by the laws of the State of California. Any disputes will be resolved in Los Angeles County."],
];

const ConsentBlock = ({ variant, signerName, onSignerNameChange, onSignatureChange }: ConsentBlockProps) => {
  const [expanded, setExpanded] = useState(false);
  const clauses = variant === "guest" ? GUEST_CLAUSES : RENTAL_CLAUSES;
  const title = variant === "guest" ? "Guest Consent Agreement" : "Equipment Rental Agreement";
  const subtitle =
    variant === "guest"
      ? "Required by the studio for all guests. Your signature confirms you've read the full agreement."
      : "Required to rent gear. Your signature confirms you accept full responsibility for the equipment.";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FileSignature className="w-4 h-4 text-foreground" />
        <h3 className="font-display text-sm uppercase tracking-[0.15em] text-foreground">{title}</h3>
      </div>
      <p className="text-[11px] font-body text-muted-foreground">{subtitle}</p>

      {/* Collapsible full agreement */}
      <div className="border border-border rounded-md overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-secondary/50 transition-colors"
        >
          <span className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-foreground">
            Read Full Agreement
          </span>
          <span className="text-muted-foreground text-xs">{expanded ? "−" : "+"}</span>
        </button>
        {expanded && (
          <div className="px-3 pb-3 text-[10px] font-body text-muted-foreground space-y-2 border-t border-border pt-2 max-h-56 overflow-y-auto">
            {clauses.map(([heading, body]) => (
              <p key={heading}>
                <span className="text-foreground font-semibold">{heading}</span> {body}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Printed name */}
      <div className="space-y-1">
        <label className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Your Full Legal Name
        </label>
        <input
          value={signerName}
          onChange={(e) => onSignerNameChange(e.target.value)}
          placeholder="As it appears on your ID"
          maxLength={100}
          className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2 text-xs font-body focus:outline-none focus:border-foreground/50 transition-colors"
        />
      </div>

      {/* Guest signature */}
      <div className="space-y-1">
        <label className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {variant === "guest" ? "Guest Signature" : "Renter Signature"}
        </label>
        <SignaturePad onChange={onSignatureChange} />
      </div>

      {/* Auto studio rep signature */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-display font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Studio Representative
          </label>
          <span className="text-[9px] font-body text-foreground/70 uppercase tracking-wider">✓ Auto-signed</span>
        </div>
        <div className="rounded-md border border-border bg-secondary/40 p-2">
          <StudioRepSignature className="w-full h-16" />
          <p className="text-[9px] text-muted-foreground font-body text-center mt-1">
            Replay Club · Authorized Representative · {format(new Date(), "MMM d, yyyy")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ConsentBlock;
