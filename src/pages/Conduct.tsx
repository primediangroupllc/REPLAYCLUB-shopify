import SeoHead from "@/components/SeoHead";
import PolicyPageLayout from "@/components/PolicyPageLayout";

const LAST_UPDATED = "April 24, 2026";

const Section = ({ heading, children }: { heading: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h2 className="font-display font-semibold text-foreground text-base mt-6">{heading}</h2>
    <div className="space-y-3">{children}</div>
  </section>
);

const Conduct = () => {
  return (
    <>
      <SeoHead
        title="Code of Conduct — Replay Club"
        description="The standards every client, guest, and host follows at Replay Club."
        path="/conduct"
      />
      <PolicyPageLayout title="Code of Conduct" lastUpdated={LAST_UPDATED}>
        <p>
          Replay Club is a private, professional space. Every client, host, and guest is entitled
          to a safe, respectful, and focused environment. This Code of Conduct applies to every
          person on premises during a session — clients, guests, collaborators, and anyone they
          bring.
        </p>

        <Section heading="What We Expect">
          <ul className="list-disc pl-6 space-y-2">
            <li>Treat the host, the space, the equipment, and everyone in it with professional respect.</li>
            <li>Arrive ready to work. Arrive sober enough to operate professional equipment safely.</li>
            <li>Communicate clearly, honestly, and on time with your host regarding session needs, timing, and logistics.</li>
            <li>Keep the space clean during and after your session. Clean up after yourself — food wrappers, empty bottles, cables, papers.</li>
            <li>Respect the privacy of the studio, its location, other clients whose work you may hear or see, and any information shared with you during your time here.</li>
            <li>Follow all instructions from the host regarding safety, equipment use, and space management.</li>
          </ul>
        </Section>

        <Section heading="What Is Not Tolerated">
          <ul className="list-disc pl-6 space-y-2">
            <li>Harassment, discrimination, intimidation, or aggressive behavior toward staff or other clients in any form, including but not limited to based on race, gender, sexual orientation, religion, age, or any other protected characteristic.</li>
            <li>Verbal abuse, threats, or physical violence of any kind.</li>
            <li>Sexual harassment, unwelcome advances, or any inappropriate conduct toward staff or guests.</li>
            <li>Theft, vandalism, or intentional damage to the space or equipment.</li>
            <li>Bringing weapons of any kind onto the premises.</li>
            <li>Using the space for any illegal activity.</li>
            <li>Disclosing the physical location of the studio, our address, or any identifying details about the space in public posts, social media, reviews, or to people outside your session.</li>
            <li>Bringing unapproved guests.</li>
            <li>Exceeding approved guest counts.</li>
            <li>Recording or photographing staff or other clients without explicit consent.</li>
          </ul>
        </Section>

        <Section heading="Consequences">
          <p>
            Depending on the severity of the violation, consequences may include any or all of the
            following:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>A verbal or written warning.</li>
            <li>Immediate termination of your current session without refund.</li>
            <li>Financial liability for damages, cleaning, or replacement costs.</li>
            <li>Permanent addition to our do-not-book list, meaning you will not be able to book Replay Club again.</li>
            <li>Reporting to law enforcement.</li>
            <li>Civil legal action.</li>
          </ul>
          <p>
            We make these decisions at our sole discretion. We do not owe an explanation for
            declining future bookings.
          </p>
        </Section>

        <Section heading="Reporting a Concern">
          <p>
            If you experience or witness something during your session that violates this Code of
            Conduct — whether it involves a host, another client, or a guest — please contact us
            directly at{" "}
            <a
              href="mailto:replayclubrecords@gmail.com"
              className="text-foreground underline hover:text-primary transition-colors"
            >
              replayclubrecords@gmail.com
            </a>
            . We take every report seriously and handle them with discretion.
          </p>
        </Section>

        <Section heading="For the Host's Protection">
          <p>
            Our hosts are trained professionals working independently, often during non-business
            hours. We treat their safety and dignity as non-negotiable. Any behavior that makes a
            host feel unsafe, disrespected, or harassed is immediate grounds for session
            termination and permanent blocklisting.
          </p>
        </Section>
      </PolicyPageLayout>
    </>
  );
};

export default Conduct;