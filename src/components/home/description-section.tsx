export function DescriptionSection() {
  return (
    <section
      className="relative overflow-hidden bg-linear-to-b from-white via-blue-50 to-white py-24"
      id="features"
    >
      {/* 装飾的な背景要素 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 h-[1000px] w-[1000px] -translate-x-1/2 rounded-full bg-blue-100/30 blur-3xl" />
      </div>

      <div className="relative container mx-auto px-4">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-blue-900 sm:text-4xl">
              サービスの特徴
            </h2>
            <p className="text-lg text-neutral-600">
              Freeism-Appが提供する主な機能と特徴をご紹介します
            </p>
          </div>

          <iframe
            src="https://docs.google.com/document/d/e/2PACX-1vSv2DzoMvPnYK4EQQn2q8jwSch9-YV3LrNUC42CcFxJoM4lWWfw_C6BbCtLxwHVTiw-FITAF1U1rl0u/pub?embedded=true"
            className="h-[800px] w-full rounded-xl border border-blue-100 bg-white/80 shadow-lg shadow-blue-100 backdrop-blur-xs"
            title="サービス説明"
          />
        </div>
      </div>
    </section>
  );
}
