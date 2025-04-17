import { memo } from "react";
import { DescriptionSection } from "@/components/home/description-section";
import { HeroSection } from "@/components/home/hero-section";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

export default memo(function Home() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />

      <div className="flex-1 overflow-auto">
        <HeroSection />
        <DescriptionSection />
        <Footer />
      </div>
    </div>
  );
});
