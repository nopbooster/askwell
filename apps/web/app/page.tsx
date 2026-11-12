// Verification build only (PR #9 never merges).
import { Demo } from "../components/landing/demo";
import { LandingFooter } from "../components/landing/footer";
import { LandingHeader } from "../components/landing/header";
import { Hero } from "../components/landing/hero";
import { HowItWorks } from "../components/landing/how-it-works";
import { InstallSnippet } from "../components/landing/install";
import { PricingSection } from "../components/landing/pricing-section";

export default function HomePage() {
  return (
    <div className="dark min-h-screen overflow-x-clip bg-canvas text-fg">
      <LandingHeader />
      <main>
        <Hero />
        <HowItWorks />
        <Demo />
        <PricingSection />
        <InstallSnippet />
      </main>
      <LandingFooter />
    </div>
  );
}
