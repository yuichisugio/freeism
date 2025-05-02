"use cache";

import { memo } from "react";
import { cacheLife } from "next/dist/server/use-cache/cache-life";
import { DescriptionSection } from "@/components/home/description-section";
import { HeroSection } from "@/components/home/hero-section";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

export default memo(function Home() {
  cacheLife("weeks");
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header userId={null} buttonDisplay={true} />

      <div className="flex-1 overflow-auto">
        <HeroSection />
        <DescriptionSection />
        <Footer />
      </div>
    </div>
  );
});
