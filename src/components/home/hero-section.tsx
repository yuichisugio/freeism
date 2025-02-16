import Link from "next/link";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-white py-16 sm:py-24 lg:py-32">
      {/* 装飾的な背景要素 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 -left-4 h-[300px] w-[300px] -translate-y-1/2 rounded-full bg-blue-100/50 blur-3xl sm:h-[500px] sm:w-[500px]" />
        <div className="absolute top-1/2 -right-4 h-[300px] w-[300px] -translate-y-1/2 rounded-full bg-blue-100/50 blur-3xl sm:h-[500px] sm:w-[500px]" />
      </div>

      <div className="relative container mx-auto px-4">
        <div className="mx-auto max-w-[280px] text-center sm:max-w-lg md:max-w-2xl lg:max-w-3xl">
          <h1 className="mb-4 bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:mb-6 sm:text-4xl md:text-5xl lg:text-6xl">
            新しい経済の仕組みを提案
          </h1>
          <p className="mb-6 text-base leading-relaxed text-neutral-600 sm:mb-8 sm:text-lg md:text-xl">
            Freeism-Appは、資本主義に変わる経済の仕組みを提案し、体験できるWebサービスです。
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Button
              variant="outline"
              size="lg"
              className="w-full border-blue-200 bg-white text-blue-700 hover:bg-blue-50 sm:w-auto sm:min-w-[200px]"
              asChild
            >
              <Link
                href="https://docs.google.com/document/d/1ksGHN6jWdwoMZ59-EX3g_CFXY3J3D7Qes4-TluqX7qU/edit?tab=t.0"
                target="_blank"
                rel="noopener noreferrer"
              >
                詳しく見る
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
