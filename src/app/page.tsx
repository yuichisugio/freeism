import { DescriptionSection } from "@/components/home/description-section";
import { HeroSection } from "@/components/home/hero-section";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { getAuthSession } from "@/lib/utils";

export default async function Home() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  const session = await getAuthSession();
  const userId = session?.user?.id;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header userId={userId ?? null} buttonDisplay={true} />

      <div className="flex-1 overflow-auto">
        <HeroSection userId={userId ?? null} />
        <DescriptionSection />
        <Footer />
      </div>
    </div>
  );
}
