import { DescriptionSection } from "@/components/home/description-section";
import { HeroSection } from "@/components/home/hero-section";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <HeroSection />
        <DescriptionSection />
      </main>

      <Footer />
    </div>
  );
}
