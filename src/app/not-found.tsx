import Link from "next/link";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="from-blue-20 relative flex flex-1 items-center justify-center overflow-hidden bg-gradient-to-b via-white to-white">
        {/* 装飾的な背景要素 */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-100/50 blur-3xl" />
        </div>

        <div className="relative px-4 py-32 text-center">
          <h1 className="mb-2 text-9xl font-bold text-blue-600">404</h1>
          <h2 className="mb-4 text-3xl font-bold text-neutral-900">
            ページが見つかりません
          </h2>
          <p className="mb-8 text-lg text-neutral-600">
            お探しのページは削除されたか、URLが間違っている可能性があります。
          </p>
          <Button
            variant="outline"
            size="lg"
            className="border-blue-200 bg-white text-blue-700 hover:bg-blue-50"
            asChild
          >
            <Link href="/">トップページに戻る</Link>
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
}
