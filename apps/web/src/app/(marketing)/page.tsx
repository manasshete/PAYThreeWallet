import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { TechStack } from "@/components/landing/TechStack";
import { FlowSection } from "@/components/landing/FlowSection";
import { StorySections } from "@/components/landing/StorySections";
import { SecuritySection, Footer } from "@/components/landing/SecuritySection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FAQ } from "@/components/landing/FAQ";

export default function Home() {
  return (
    <>
      <Header />
      <main id="main">
        <div id="top" className="sr-only" aria-hidden>
          Top
        </div>
        <Hero />
        <TechStack />
        <FlowSection />
        <StorySections />
        <SecuritySection />
        <HowItWorks />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
