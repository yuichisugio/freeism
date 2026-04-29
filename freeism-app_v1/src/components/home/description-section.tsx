"use cache";

import { unstable_cacheLife as cacheLife } from "next/cache";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 説明セクションコンポーネント
 * Googleドキュメントを埋め込んで詳細な説明を表示
 */
export async function DescriptionSection() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュの有効期間を設定
   */
  cacheLife("max");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  return (
    <section
      className="relative overflow-hidden border-t border-blue-100 bg-gradient-to-b from-white via-blue-50 to-white py-16 sm:py-20 lg:py-24 dark:border-blue-900 dark:from-gray-950 dark:via-blue-950 dark:to-gray-950"
      id="features"
    >
      {/* メインコンテンツ */}
      <div className="relative container mx-auto px-4">
        <div className="mx-auto max-w-sm overflow-hidden sm:max-w-2xl md:max-w-3xl lg:max-w-5xl">
          {/* セクションタイトル */}
          <div className="mb-8 text-center sm:mb-12">
            <h2 className="mb-3 text-2xl font-bold text-blue-900 sm:mb-4 sm:text-3xl lg:text-4xl dark:text-blue-100">
              サービスの特徴
            </h2>
            <p className="text-base text-neutral-600 sm:text-lg dark:text-neutral-400">
              Freeism-Appが提供する主な機能と特徴をご紹介します
            </p>
          </div>

          {/* Googleドキュメントの埋め込み */}
          <iframe
            src="https://docs.google.com/document/d/e/2PACX-1vSv2DzoMvPnYK4EQQn2q8jwSch9-YV3LrNUC42CcFxJoM4lWWfw_C6BbCtLxwHVTiw-FITAF1U1rl0u/pub?embedded=true"
            className="h-[500px] w-full overflow-x-hidden overflow-y-auto rounded-xl border border-blue-100 bg-white/80 shadow-lg shadow-blue-100 backdrop-blur-sm sm:h-[600px] md:h-[700px] lg:h-[800px] dark:border-blue-900 dark:bg-gray-950/80 dark:shadow-blue-900/20"
            title="サービス説明"
          />
        </div>
      </div>
    </section>
  );
}
