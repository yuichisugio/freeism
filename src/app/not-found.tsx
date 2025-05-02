"use cache";

import { unstable_cacheLife as cacheLife } from "next/cache";
import Link from "next/link";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";

/**
 * 404エラーページコンポーネント
 * - ページが見つからない場合に表示
 * - エラーメッセージと説明文を表示
 * - トップページへの戻るボタンを配置
 * - 装飾的な背景エフェクトを含む
 * - レスポンシブ対応（画面サイズに応じてサイズを調整）
 */
export default async function NotFound() {
  cacheLife("max");
  return (
    <div className="flex min-h-screen flex-col">
      {/* ヘッダー */}
      <Header userId={null} buttonDisplay={false} />

      {/* メインコンテンツ */}
      <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-gradient-to-b from-blue-50 via-white to-white">
        {/* 装飾的な背景要素（円形のブラーエフェクト） */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-100/50 blur-3xl sm:h-[600px] sm:w-[600px] lg:h-[800px] lg:w-[800px]" />
        </div>

        {/* エラーメッセージコンテンツ */}
        <div className="relative px-4 py-16 text-center sm:py-24 lg:py-32">
          {/* 404表示 */}
          <h1 className="mb-2 text-6xl font-bold text-blue-600 sm:text-7xl lg:text-9xl">404</h1>
          {/* エラータイトル */}
          <h2 className="mb-3 text-xl font-bold text-neutral-900 sm:mb-4 sm:text-2xl lg:text-3xl">ページが見つかりません</h2>
          {/* エラー説明 */}
          <p className="mb-6 text-sm text-neutral-600 sm:mb-8 sm:text-base lg:text-lg">
            お探しのページは削除されたか、URLが間違っている可能性があります。
          </p>
          {/* トップページへの戻るボタン */}
          <Button
            variant="outline"
            size="lg"
            className="w-full border-blue-200 bg-white text-blue-700 hover:bg-blue-50 sm:w-auto sm:min-w-[200px]"
            asChild
          >
            <Link href="/">トップページに戻る</Link>
          </Button>
        </div>
      </main>

      {/* フッター */}
      <Footer />
    </div>
  );
}
