import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import SeoHead from "@/components/SeoHead";
import PolicyPageLayout from "@/components/PolicyPageLayout";

const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h2 className="font-display font-semibold text-foreground text-base mt-6">
      {n}. {title}
    </h2>
    <div className="space-y-3">{children}</div>
  </section>
);

const Faq = ({ q, children }: { q: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <h3 className="font-display font-semibold text-foreground text-sm">{q}</h3>
    <div className="space-y-2">{children}</div>
  </div>
);

const HowItWorks = () => {
  return (
    <>
      <SeoHead
        title="How It Works — Replay Club"
        description="Private by appointment. Here's how booking a session at Replay Club works."
        path="/how-it-works"
      />
      <PolicyPageLayout title="How Replay Club Works">
        <p className="text-lg">Replay Club is private by appointment.</p>

        <p>
          We're a recording, podcast, and DJ studio in the San Fernando Valley — built for artists
          who want a professional space without the chaos of open booking platforms. Every session
          is by application, every client is vetted, and every booking is handled directly with us,
          not through a third-party marketplace.
        </p>

        <p>Here's what booking a session looks like:</p>

        <Step n={1} title="Submit your application.">
          <p>
            Pick the studio you want, the date, and the time. Fill out a short form so we know
            who's coming in and what you're working on.
          </p>
        </Step>

        <Step n={2} title="Verify your contact info.">
          <p>
            We'll send a quick code to your phone and email. This takes a minute. It keeps the
            space safe and the process professional.
          </p>
        </Step>

        <Step n={3} title="Hear back within 24 hours.">
          <p>
            We review every application personally. You'll get a confirmation email, a follow-up
            question, or a note letting you know we weren't able to accommodate this time. No
            surprises, no chargeback after the fact.
          </p>
        </Step>

        <Step n={4} title="Meet your host at the arrival point.">
          <p>
            Once you're approved, we'll send you everything you need: the arrival address, arrival
            time, what to bring, and how to reach your host. Your host meets you at the arrival
            point and walks you in.
          </p>
        </Step>

        <Step n={5} title="Work.">
          <p>
            The gear is ready. The space is yours for the time you booked. No co-working, no
            overlapping sessions, no random walk-ins. Just you and your work.
          </p>
        </Step>

        <hr className="border-border/40 my-8" />

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-foreground text-base">
            Why we do it this way
          </h2>
          <p>
            Because the artists who book here deserve a space that's private, professional, and
            actually theirs for the hour — and because we'd rather have 100 clients we know and
            respect than 10,000 we've never vetted.
          </p>
        </section>

        <hr className="border-border/40 my-8" />

        <section className="space-y-5">
          <h2 className="font-display font-semibold text-foreground text-lg">
            Frequently Asked Questions
          </h2>

          <Faq q="Why do I need to submit an ID?">
            <p>
              Because we operate as a private studio, we ask for a valid form of identification
              during your first application — the same way a hotel, a co-working space, or any
              professional venue handling high-value equipment would. It's stored securely, visible
              only to the owner, and handled under our Privacy Policy.
            </p>
          </Faq>

          <Faq q="How long do you keep my information?">
            <p>
              Your ID is retained for 30 days after your session completes, then automatically
              deleted. Basic account info (name, verified contact) stays with your client file so
              returning clients don't have to re-verify every time. You can request full deletion
              of your data at any time by emailing us.
            </p>
          </Faq>

          <Faq q="Is my information shared with anyone?">
            <p>
              No. We don't sell data, share it with marketing partners, or expose it to third
              parties. The only people who see your application are the owner and, where necessary,
              the host assigned to your session. Full details are in our Privacy Policy.
            </p>
          </Faq>

          <Faq q="What happens if I need to cancel?">
            <p>
              Reschedules and cancellations more than 48 hours in advance are refunded in full,
              minus a small processing fee. Details are in our{" "}
              <Link to="/cancellation" className="text-foreground underline hover:text-primary transition-colors">
                Cancellation Policy
              </Link>{" "}
              — read it before you book.
            </p>
          </Faq>

          <Faq q="Can I bring guests?">
            <p>
              Yes — list them during your application so we know who's coming. Depending on the
              studio you book, we have a guest maximum and we'll confirm it at approval. Unapproved
              guests cannot enter the space.
            </p>
          </Faq>

          <Faq q="How fast do you respond to applications?">
            <p>
              Within 24 hours, usually faster. If we don't get back to you within 24 hours, your
              application auto-releases and your card is not charged. You'll also get a small
              discount for your next attempt, because we don't want you waiting on us.
            </p>
          </Faq>

          <Faq q="What if I've never booked a private studio before?">
            <p>
              Then welcome. The process is simpler than it sounds — it's a short application, a
              verification step, and a confirmation email. If something is unclear, email us before
              you apply. We'll walk you through it.
            </p>
          </Faq>

          <Faq q="Can I tour the space before I book?">
            <p>
              Not typically. Because we're private and by-appointment, we don't offer open tours.
              What you'll see is on the site — high-quality photos, a detailed gear list, and real
              testimonials from clients who've worked here. If you need something specific before
              you commit, email us.
            </p>
          </Faq>

          <Faq q="Who runs Replay Club?">
            <p>
              Replay Club is a privately owned, independently operated studio. We're not a
              franchise, we're not a chain, and we're not a marketplace. When you work with us,
              you're working with the owner directly.
            </p>
          </Faq>
        </section>

        <hr className="border-border/40 my-8" />

        <section className="space-y-4 pt-2">
          <p className="font-display text-foreground text-lg">Ready when you are.</p>
          <Link
            to="/?selector=1"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground text-background px-6 py-3 font-display font-semibold text-sm uppercase tracking-[0.15em] hover:bg-foreground/90 transition-all chrome-text-inverse shadow-lg"
          >
            Apply for a Session
            <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      </PolicyPageLayout>
    </>
  );
};

export default HowItWorks;