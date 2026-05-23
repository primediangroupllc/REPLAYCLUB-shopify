import { HelpCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getFaqsFor, type FaqTopic } from "@/lib/faqContent";

interface FAQSectionProps {
  /**
   * Which FAQ set to render. Defaults to the sitewide "general" list.
   * On the homepage this is driven by the active orbit tab; on service
   * landing pages it's set explicitly.
   */
  topic?: FaqTopic | string;
  /** Optional heading override (e.g. "DJ Session FAQ"). */
  heading?: string;
}

const FAQSection = ({ topic, heading }: FAQSectionProps = {}) => {
  const faqs = getFaqsFor(topic);
  if (faqs.length === 0) return null;
  return (
    <section className="py-16 px-4 border-t border-border">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <HelpCircle className="w-6 h-6 text-chrome mx-auto" />
          <h2 className="text-h2 text-foreground">
            {heading ?? "Frequently Asked Questions"}
          </h2>
          <p className="text-muted-foreground text-body">
            Everything you need to know before your session.
          </p>
        </div>
        <Accordion type="single" collapsible className="space-y-2">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={`${topic ?? "general"}-${i}`}
              value={`faq-${i}`}
              className="border border-border/50 rounded-lg px-4 bg-card/30 backdrop-blur-sm"
            >
              <AccordionTrigger className="text-sm font-display font-semibold text-foreground hover:no-underline py-4">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground font-body text-sm pb-4 leading-relaxed">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default FAQSection;
