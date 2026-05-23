import { ReactNode } from "react";
import SiteFooter from "@/components/SiteFooter";

interface PolicyPageLayoutProps {
  title: string;
  lastUpdated?: string;
  children: ReactNode;
}

/**
 * Shared layout for /policies, /cancellation, /conduct, /how-it-works.
 * Comfortable reading width (max 720px), clear typography, semantic tokens
 * only — no hard-coded colors. Mirrors the existing PrivacyPolicy chrome
 * (back link + footer) so the new pages feel native to the rest of the site.
 */
const PolicyPageLayout = ({ title, lastUpdated, children }: PolicyPageLayoutProps) => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-[720px] mx-auto px-6 py-16">
        <h1 className="text-h1 mb-2">
          {title}
        </h1>
        {lastUpdated && (
          <p className="text-muted-foreground text-sm font-body mb-12">
            Last updated: {lastUpdated}
          </p>
        )}
        {!lastUpdated && <div className="mb-8" />}

        <div className="space-y-5 text-secondary-foreground leading-relaxed font-body text-[15px]">
          {children}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
};

export default PolicyPageLayout;