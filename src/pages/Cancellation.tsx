import SeoHead from "@/components/SeoHead";
import PolicyPageLayout from "@/components/PolicyPageLayout";
import { usePublicSiteSettings, BOOKING_POLICY_DEFAULTS } from "@/hooks/useSiteSettings";

const LAST_UPDATED = "April 24, 2026";

const Section = ({ heading, children }: { heading: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h2 className="font-display font-semibold text-foreground text-base mt-6">{heading}</h2>
    <div className="space-y-3">{children}</div>
  </section>
);

const Cancellation = () => {
  const { settings } = usePublicSiteSettings();
  const cutoff = settings.cancellation_cutoff_hours ?? BOOKING_POLICY_DEFAULTS.cancelCutoffHours;
  const refundPolicy = settings.refund_policy_text?.trim() || null;
  return (
    <>
      <SeoHead
        title="Cancellation & Rescheduling Policy — Replay Club"
        description="How cancellations, reschedules, and refunds work at Replay Club."
        path="/cancellation"
      />
      <PolicyPageLayout title="Cancellation & Rescheduling Policy" lastUpdated={LAST_UPDATED}>
        <p>
          We hold your session time exclusively for you from the moment your booking is approved.
          Because of that, cancellations and reschedules affect our operations and other clients
          who may have wanted that time. The following terms apply to every booking.
        </p>

        {refundPolicy && (
          <Section heading="Refund Policy">
            <p className="whitespace-pre-line">{refundPolicy}</p>
          </Section>
        )}

        <Section heading="Cancellation Windows">
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <span className="text-foreground font-semibold">
                48 hours or more before your session start time:
              </span>{" "}
              Full refund of session fee, minus a $35 processing fee.
            </li>
            <li>
              <span className="text-foreground font-semibold">
                {cutoff} to 48 hours before your session start time:
              </span>{" "}
              50% refund of session fee. 50% is retained.
            </li>
            <li>
              <span className="text-foreground font-semibold">
                Less than {cutoff} hours before your session start time:
              </span>{" "}
              No refund. Session fee is retained in full.
            </li>
            <li>
              <span className="text-foreground font-semibold">
                No-show (failure to arrive at the meeting point within 30 minutes of session start
                without notice):
              </span>{" "}
              No refund. Session fee is retained in full.
            </li>
          </ul>
        </Section>

        <Section heading="How to Cancel or Reschedule">
          <p>
            To cancel or reschedule, use the link provided in your booking confirmation email or
            email us at{" "}
            <a
              href="mailto:replayclubrecords@gmail.com"
              className="text-foreground underline hover:text-primary transition-colors"
            >
              replayclubrecords@gmail.com
            </a>
            . Cancellation timestamps are based on the time your request is received by us, not
            the time you sent it.
          </p>
        </Section>

        <Section heading="Reschedule Policy">
          <p>
            You may reschedule once per booking at no additional fee, provided the request is made
            more than 48 hours before your original session start time and we have availability on
            your new preferred date. Reschedules requested within 48 hours of session start are
            treated as cancellations under the terms above, and a new booking will need to be made.
          </p>
        </Section>

        <Section heading="Studio-Initiated Cancellations">
          <p>
            If we need to cancel your session for any reason (equipment issue, emergency,
            scheduling error on our end), you will receive a full refund including any processing
            fees, plus priority rebooking at a date and time that works for you.
          </p>
        </Section>

        <Section heading="Refund Processing">
          <p>
            Refunds are processed to the original payment method and typically take 5-10 business
            days to appear, depending on your bank or card issuer.
          </p>
        </Section>

        <Section heading="Chargebacks">
          <p>
            If you dispute a charge with your bank or card issuer instead of contacting us
            directly, you authorize us to provide documentation of your booking, session, and
            communications in defense of the charge. Fraudulent chargebacks may result in
            blocklisting and legal remedies.
          </p>
        </Section>
      </PolicyPageLayout>
    </>
  );
};

export default Cancellation;