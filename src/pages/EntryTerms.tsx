import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import SiteFooter from "@/components/SiteFooter";
import SeoHead from "@/components/SeoHead";

const policyLink = "underline underline-offset-4 hover:text-foreground transition-colors";

const sections: { label: string; body: ReactNode }[] = [
  {
    label: "Application and Approval",
    body: (
      <>
        Sessions at Replay Club are by application. Submitting an application doesn't confirm a booking — we review every request personally and respond within 24 hours. Your payment method is collected at the time of application but is not charged unless we approve your session. If we're unable to accommodate your request, your card is not charged.
      </>
    ),
  },
  {
    label: "Time",
    body: <>Sessions start and end at the times confirmed in your approval email. We recommend a 2-hour minimum booking to make the most of your session.</>,
  },
  {
    label: "Cancellation",
    body: (
      <>
        Plans change. Full details are in our <Link to="/cancellation" className={policyLink}>Cancellation Policy</Link>, but the short version: cancellations 48+ hours in advance receive a full refund minus a processing fee, cancellations 24-48 hours in advance receive a 50% refund, and cancellations under 24 hours or no-shows are non-refundable.
      </>
    ),
  },
  {
    label: "Arrival",
    body: <>Once approved, you'll receive an email with the meeting point, arrival time, and host contact. Your host meets you at the meeting point and walks you in. The physical studio address is private — please do not share, post, or disclose location details about the space.</>,
  },
  {
    label: "Respect the Space",
    body: (
      <>
        Replay Club is a curated, private environment. Treat the studio, the gear, the host, and everyone in the space with professional respect. Damage caused during your session is your financial responsibility. Full expectations are in our <Link to="/conduct" className={policyLink}>Code of Conduct</Link>.
      </>
    ),
  },
  {
    label: "Guests",
    body: <>Your booking covers you and the guests you listed during your application. Additional guests must be approved in advance. You are responsible for your guests' conduct.</>,
  },
  {
    label: "Your Content, Your Rights",
    body: <>What you create at Replay Club is yours. We don't claim rights to your recordings, sessions, or creative work. We may, with your explicit written permission, share content from your session on our channels — but only if you opt in.</>,
  },
  {
    label: "Liability",
    body: (
      <>
        You are responsible for yourself and your guests on premises. Replay Club is not liable for lost personal items, injuries, or external technical issues outside our control. Full liability terms are in our <Link to="/policies" className={policyLink}>Studio Policies</Link>.
      </>
    ),
  },
  {
    label: "Questions",
    body: (
      <>
        For any questions before or after your application, reach us at{" "}
        <a href="mailto:replayclubrecords@gmail.com" className={policyLink}>replayclubrecords@gmail.com</a>.
      </>
    ),
  },
];

const EntryTerms = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SeoHead
        title="Entry Terms — Replay Club"
        description="A summary of the terms that apply when you apply for a session at Replay Club."
        path="/entry-terms"
      />
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-h1 mb-2">
          Entry Terms
        </h1>
        <p className="text-muted-foreground mb-12">Last Updated: April 24, 2026</p>

        <div className="space-y-8 text-secondary-foreground leading-relaxed">
          <p className="text-muted-foreground">
            Welcome to Replay Club. This is a quick summary of what you're agreeing to when you apply for a session. For the full terms, see our <Link to="/policies" className={policyLink}>Studio Policies</Link>, <Link to="/cancellation" className={policyLink}>Cancellation Policy</Link>, and <Link to="/conduct" className={policyLink}>Code of Conduct</Link>.
          </p>

          <div className="space-y-6">
            {sections.map((section) => (
              <div key={section.label}>
                <h2 className="font-semibold text-foreground mb-1">{section.label}</h2>
                <p className="text-muted-foreground">{section.body}</p>
              </div>
            ))}
          </div>

          <p className="text-muted-foreground pt-2">
            By applying for a session, you agree to these terms, the <Link to="/policies" className={policyLink}>Studio Policies</Link>, the <Link to="/cancellation" className={policyLink}>Cancellation Policy</Link>, and the <Link to="/conduct" className={policyLink}>Code of Conduct</Link>.
          </p>

          <p className="text-lg font-medium text-foreground pt-2">
            Welcome to the Club.
          </p>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
};

export default EntryTerms;
