import { memo } from "react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 説明セクションコンポーネント
 * - サービスの特徴を説明するセクション
 * - Googleドキュメントを埋め込んで詳細な説明を表示
 * - 装飾的な背景エフェクトを含む
 * - レスポンシブ対応（画面サイズに応じて高さと幅を調整）
 */
export const DescriptionSection = memo(function DescriptionSection() {
  return (
    <section
      className="relative overflow-hidden border-t border-blue-100 bg-gradient-to-b from-white via-blue-50 to-white py-16 sm:py-20 lg:py-24 dark:border-blue-900 dark:from-gray-950 dark:via-blue-950 dark:to-gray-950"
      id="features"
    >
      {/* 装飾的な背景要素（大きな円形のブラーエフェクト） */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-blue-100/30 blur-3xl sm:h-[800px] sm:w-[800px] lg:h-[1000px] lg:w-[1000px] dark:bg-blue-900/30" />
      </div>

      {/* メインコンテンツ */}
      <div className="relative container mx-auto px-4">
        <div className="mx-auto max-w-sm sm:max-w-2xl md:max-w-3xl lg:max-w-5xl">
          {/* セクションタイトル */}
          <div className="mb-8 text-center sm:mb-12">
            <h2 className="mb-3 text-2xl font-bold text-blue-900 sm:mb-4 sm:text-3xl lg:text-4xl dark:text-blue-100">サービスの特徴</h2>
            <p className="text-base text-neutral-600 sm:text-lg dark:text-neutral-400">Freeism-Appが提供する主な機能と特徴をご紹介します</p>
          </div>

          {/* Googleドキュメントの埋め込み */}
          <iframe
            src="https://docs.google.com/document/d/e/2PACX-1vSv2DzoMvPnYK4EQQn2q8jwSch9-YV3LrNUC42CcFxJoM4lWWfw_C6BbCtLxwHVTiw-FITAF1U1rl0u/pub?embedded=true"
            className="h-[500px] w-full rounded-xl border border-blue-100 bg-white/80 shadow-lg shadow-blue-100 backdrop-blur-sm sm:h-[600px] md:h-[700px] lg:h-[800px] dark:border-blue-900 dark:bg-gray-950/80 dark:shadow-blue-900/20"
            title="サービス説明"
          />
        </div>
      </div>
    </section>
  );
});
