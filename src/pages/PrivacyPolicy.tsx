import SiteFooter from "@/components/SiteFooter";
import SeoHead from "@/components/SeoHead";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SeoHead
        title="Privacy Policy | Replay Club"
        description="How Replay Club collects, uses, and safeguards your personal information when you book sessions or visit our Los Angeles studio."
        path="/privacy-policy"
      />
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-h1 mb-2">
          Privacy Policy
        </h1>
        <p className="text-muted-foreground mb-12">Last Updated: March 25, 2026</p>

        <div className="space-y-10 text-secondary-foreground leading-relaxed">
          <p>
            Replay Club ("Replay Club," "we," "us," or "our") respects your privacy and is committed to protecting your personal information. This Privacy Policy describes how we collect, use, disclose, and safeguard your information when you visit our website, book services, or interact with us.
          </p>
          <p>
            This policy is designed to comply with applicable U.S. laws, including the California Consumer Privacy Act (CCPA) as amended by the CPRA.
          </p>

          <Section title="1. Information We Collect">
            <p>We may collect the following categories of personal information:</p>
            <SubSection title="A. Identifiers">
              <ul className="list-disc pl-6 space-y-1">
                <li>Name</li>
                <li>Email address</li>
                <li>Phone number</li>
                <li>IP address</li>
              </ul>
            </SubSection>
            <SubSection title="B. Commercial Information">
              <ul className="list-disc pl-6 space-y-1">
                <li>Booking history</li>
                <li>Services purchased</li>
                <li>Payment transaction details (processed via third parties)</li>
              </ul>
            </SubSection>
            <SubSection title="C. Internet / Usage Data">
              <ul className="list-disc pl-6 space-y-1">
                <li>Browser type</li>
                <li>Device information</li>
                <li>Pages visited and interaction data</li>
              </ul>
            </SubSection>
            <SubSection title="D. Audio, Visual, or Media Content">
              <ul className="list-disc pl-6 space-y-1">
                <li>Photos, videos, or recordings created within Replay Club facilities (if applicable)</li>
              </ul>
            </SubSection>
            <SubSection title="E. Inferences">
              <ul className="list-disc pl-6 space-y-1">
                <li>Preferences based on bookings or usage behavior</li>
              </ul>
            </SubSection>
          </Section>

          <Section title="2. How We Use Your Information">
            <ul className="list-disc pl-6 space-y-1">
              <li>To provide and manage bookings and services</li>
              <li>To communicate confirmations, updates, and support</li>
              <li>To improve website functionality and user experience</li>
              <li>To maintain security and prevent fraud</li>
              <li>To comply with legal obligations</li>
              <li>To send marketing communications (where permitted)</li>
            </ul>
          </Section>

          <Section title="3. Legal Bases for Processing">
            <p>Where applicable, we process your information based on:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Performance of a contract (booking services)</li>
              <li>Legitimate business interests</li>
              <li>Consent (for marketing or media usage where required)</li>
              <li>Compliance with legal obligations</li>
            </ul>
          </Section>

          <Section title="4. Sharing of Information">
            <p className="font-semibold text-foreground">We do not sell personal information.</p>
            <p>We may disclose your information to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Service Providers</strong> (payment processors, booking platforms, hosting providers)</li>
              <li><strong>Professional Advisors</strong> (legal, accounting)</li>
              <li><strong>Authorities</strong> when required by law</li>
            </ul>
            <p>All third parties are contractually obligated to use your information only as necessary.</p>
          </Section>

          <Section title="5. Cookies & Tracking Technologies">
            <p>We use cookies and similar technologies to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Analyze website traffic</li>
              <li>Improve performance</li>
              <li>Enhance user experience</li>
            </ul>
            <p>You may adjust cookie settings through your browser. Some features may not function properly if disabled.</p>
          </Section>

          <Section title="6. Data Retention & Sensitive Document Handling">
            <p>We retain personal information only as long as necessary to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Fulfill the purposes outlined in this policy</li>
              <li>Comply with legal and accounting obligations</li>
              <li>Resolve disputes and enforce agreements</li>
            </ul>
            <p className="mt-3">
              <strong>Government-issued ID photos and consent signatures</strong> uploaded during booking
              are stored in encrypted, access-controlled storage and are automatically deleted{" "}
              <strong>30 days after your session date</strong>. We use Google Gemini (an AI service) to
              automatically verify ID validity, estimate age (18+), and confirm name match — no human
              reviews your ID image unless flagged for fraud. Verification results (pass/fail and
              metadata) are retained for legal compliance, but the photo itself is purged.
            </p>
          </Section>

          <Section title="7. Data Security">
            <p>We implement reasonable administrative, technical, and physical safeguards to protect your information. However, no system can guarantee absolute security.</p>
          </Section>

          <Section title="8. Your Privacy Rights (California Residents)">
            <p>If you are a California resident, you have the following rights under the CCPA/CPRA:</p>
            <SubSection title="Right to Know">
              <p>You may request details about:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Categories of personal data collected</li>
                <li>Sources of data</li>
                <li>Purpose of collection</li>
                <li>Third parties with whom data is shared</li>
              </ul>
            </SubSection>
            <SubSection title="Right to Access">
              <p>You may request a copy of the personal data we hold about you.</p>
            </SubSection>
            <SubSection title="Right to Delete">
              <p>You may request deletion of your personal information, subject to legal exceptions.</p>
            </SubSection>
            <SubSection title="Right to Correct">
              <p>You may request correction of inaccurate personal information.</p>
            </SubSection>
            <SubSection title="Right to Opt-Out of Sale/Sharing">
              <p>Replay Club does not sell or share personal data as defined under California law.</p>
            </SubSection>
            <SubSection title="Right to Non-Discrimination">
              <p>You will not be discriminated against for exercising your rights.</p>
            </SubSection>
          </Section>

          <Section title="9. How to Exercise Your Rights">
            <p>To submit a request, contact:</p>
            <p>
              Email:{" "}
              <a href="mailto:replayclubrecords@gmail.com" className="text-foreground underline hover:text-primary transition-colors">
                replayclubrecords@gmail.com
              </a>
            </p>
            <p>We may need to verify your identity before processing your request.</p>
          </Section>

          <Section title="10. Minors">
            <p>Replay Club does not knowingly collect personal information from individuals under the age of 13. If such data is identified, it will be deleted.</p>
          </Section>

          <Section title="11. Third-Party Links">
            <p>Our website may contain links to third-party services (e.g., booking platforms, social media). We are not responsible for their privacy practices.</p>
          </Section>

          <Section title="12. Media & Content Release">
            <p>By entering Replay Club premises, you acknowledge that photography, video, or audio recording may occur for promotional purposes.</p>
            <p>You may opt out by submitting a written request prior to your session.</p>
          </Section>

          <Section title="13. Changes to This Policy">
            <p>We reserve the right to update this Privacy Policy at any time. Updates will be posted with a revised "Last Updated" date.</p>
          </Section>

          <Section title="14. Contact Information">
            <p>Replay Club</p>
            <p>
              <a href="mailto:replayclubrecords@gmail.com" className="text-foreground underline hover:text-primary transition-colors">
                replayclubrecords@gmail.com
              </a>
            </p>
          </Section>

          <Section title="15. Acknowledgment">
            <p>By using our website or services, you acknowledge that you have read and understood this Privacy Policy.</p>
          </Section>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-4">
    <h2 className="text-xl font-semibold text-foreground font-['Space_Grotesk']">{title}</h2>
    {children}
  </section>
);

const SubSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-2 mt-3">
    <h3 className="text-base font-medium text-foreground">{title}</h3>
    {children}
  </div>
);

export default PrivacyPolicy;
