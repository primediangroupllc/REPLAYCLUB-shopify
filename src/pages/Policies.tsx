import SeoHead from "@/components/SeoHead";
import PolicyPageLayout from "@/components/PolicyPageLayout";

const LAST_UPDATED = "April 24, 2026";

const Section = ({ heading, children }: { heading: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h2 className="font-display font-semibold text-foreground text-base mt-6">{heading}</h2>
    <div className="space-y-3">{children}</div>
  </section>
);

const Policies = () => {
  return (
    <>
      <SeoHead
        title="Studio Policies — Replay Club"
        description="The policies governing sessions at Replay Club."
        path="/policies"
      />
      <PolicyPageLayout title="Studio Policies" lastUpdated={LAST_UPDATED}>
        <p>
          By booking a session at Replay Club, you agree to the following. These policies exist to
          protect the space, the equipment, your session, and every other artist who works here.
        </p>

        <Section heading="Session Hours & Arrival">
          <p>
            Sessions begin and end at the times confirmed in your booking. Please arrive at the
            meeting point at your scheduled start time. If you arrive more than 15 minutes late
            without notice, your session may be shortened or forfeited at our discretion. If you
            need to extend your session and the studio is available, arrangements can be made
            on-site at the standard hourly rate, subject to payment before the extension begins.
          </p>
        </Section>

        <Section heading="Who's Allowed in the Space">
          <p>
            Your booking covers you and any guests you listed during the application process.
            Additional guests not named in your application must be approved in advance. The
            maximum guest count depends on the studio you book and will be confirmed at approval.
            Guests are your responsibility — you are accountable for their conduct, their
            belongings, and any damage they cause.
          </p>
        </Section>

        <Section heading="Equipment & Gear">
          <p>
            The studio is equipped with professional recording, production, and DJ gear, including
            signature items like the Focusrite Scarlett 18i8, Fireface UCX II, Ableton Push 3, and
            the AlphaTheta XDJ-AZ system. You are welcome to use anything set up for your booked
            studio. You are not permitted to move, disassemble, or connect your own equipment to
            studio systems without explicit approval from your host. Any damage caused by misuse,
            liquid, mishandling, or negligence is the client's financial responsibility at
            replacement cost. Do not unplug, reroute, or reconfigure any connections without
            permission.
          </p>
        </Section>

        <Section heading="Personal Gear">
          <p>
            You may bring your own laptop, instruments, microphones, controllers, drives, and
            session files. Replay Club is not responsible for damage to or loss of personal
            equipment brought onto the premises.
          </p>
        </Section>

        <Section heading="Food & Drink">
          <p>
            Sealed bottled water is permitted throughout the space. Other beverages, food, and
            snacks are permitted only in designated areas. No open containers, no red wine, no hot
            coffee, and no food of any kind near the gear, desks, or control surfaces. If you spill
            on equipment, you are responsible for professional cleaning or replacement cost.
          </p>
        </Section>

        <Section heading="Smoking, Vaping & Substances">
          <p>
            Replay Club is a non-smoking, non-vaping space. This includes tobacco, cannabis, and
            all other substances. Smoking or vaping anywhere inside the studio results in immediate
            session termination without refund and a cleaning fee charged to your card on file.
          </p>
        </Section>

        <Section heading="Noise & Neighbors">
          <p>
            We operate out of a professional building that respects surrounding tenants and
            residences. Monitor levels, playback, and performance volume may be managed by your
            host to stay within building limits. Late-night sessions may have additional volume
            restrictions.
          </p>
        </Section>

        <Section heading="Photography, Video & Social Media">
          <p>
            You are welcome to capture your session for personal and promotional use. Please do not
            publish, post, or share any content that reveals the physical location of the studio,
            the surrounding street, the building exterior, or any identifying details that could
            disclose our address. Violation of this is grounds for removal from our client list and
            may result in additional remedies.
          </p>
        </Section>

        <Section heading="Session Files & Storage">
          <p>
            You are responsible for backing up your own session files during and after your
            booking. We recommend bringing your own external drive. Replay Club does not store or
            back up client sessions, and we are not responsible for data loss.
          </p>
        </Section>

        <Section heading="Damage, Theft & Liability">
          <p>
            Any damage to the space, furniture, fixtures, or equipment during your session is your
            financial responsibility. Theft of equipment or property from the studio is grounds for
            immediate removal, blocklisting, and legal action.
          </p>
        </Section>

        <Section heading="Session Termination">
          <p>
            We reserve the right to end any session at any time, without refund, if the client or
            any guest violates these policies, behaves unsafely, damages property, or creates a
            hostile environment for staff or other clients.
          </p>
        </Section>

        <Section heading="Updates to These Policies">
          <p>
            We may update these policies from time to time. The version in effect at the time of
            your booking is the version that applies to your session.
          </p>
        </Section>

        <Section heading="Questions">
          <p>
            For any questions about these policies before or during your booking, contact us at{" "}
            <a
              href="mailto:replayclubrecords@gmail.com"
              className="text-foreground underline hover:text-primary transition-colors"
            >
              replayclubrecords@gmail.com
            </a>
            .
          </p>
        </Section>
      </PolicyPageLayout>
    </>
  );
};

export default Policies;