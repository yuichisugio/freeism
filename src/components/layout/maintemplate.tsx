import { memo, Suspense } from "react";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * メインテンプレート
 * @param title タイトル
 * @param description 説明
 * @param component コンポーネント
 * @param children 子コンポーネント
 */
type MainTemplateProps = {
  title: string | boolean;
  description: string | boolean;
  component?: React.ReactNode;
  children: React.ReactNode;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * メインテンプレート
 * @param title タイトル
 * @param description 説明
 * @param component コンポーネント
 * @param children 子コンポーネント
 */
export const MainTemplate = memo(async function MainTemplate({ title, description, component, children }: MainTemplateProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Fixed header */}
      <Header />

      {/* Main content area with fixed sidebar and scrollable children */}
      <div className="flex flex-1 overflow-hidden">
        {/* Fixed sidebar */}
        <Sidebar />

        {/* Main content area - fully scrollable except header and sidebar */}
        <main className="flex-1 overflow-auto">
          {/* "xl:max-w-none"で、ブラウザの幅が1280px以上の場合は、幅を100%にする */}
          <div className="container h-full overflow-auto px-8 py-5 sm:space-y-0 xl:max-w-none">
            {/* Title/description and component section - now scrollable */}
            <div className="flex flex-col justify-between sm:flex-row">
              {title && description && (
                <div>
                  <h1 className="page-title-custom">{title}</h1>
                  <p className="page-description-custom">{description}</p>
                </div>
              )}
              <Suspense fallback={<div>Loading...</div>}>{component && component}</Suspense>
            </div>

            {/* Children section */}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
});
