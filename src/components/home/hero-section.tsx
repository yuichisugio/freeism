import Link from "next/link";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-white py-32">
      {/* 装飾的な背景要素 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-4 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-blue-100/50 blur-3xl" />
        <div className="absolute -right-4 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-blue-100/50 blur-3xl" />
      </div>

      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="mb-6 bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-6xl">
            旅行の新しいカタチを
            <br />
            <span className="text-blue-600">発見</span>
            しよう
          </h1>
          <p className="mb-8 text-lg leading-relaxed text-neutral-600">
            Freeism-Appは、あなたの旅行をより豊かに、より便利にする
            <br />
            新しい旅行プラットフォームです。
            <br />
            世界中の魅力的な目的地を発見し、最高の旅行体験を手に入れましょう。
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              className="min-w-[200px] bg-blue-600 text-white hover:bg-blue-700"
              asChild
            >
              <Link href="/auth/signin">無料で始める</Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="min-w-[200px] border-blue-200 bg-white text-blue-700 hover:bg-blue-50"
              asChild
            >
              <Link href="#features">詳しく見る</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
