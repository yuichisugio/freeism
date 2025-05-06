"use cache";

import { Suspense } from "react";
import { unstable_cacheLife as cacheLife } from "next/cache";

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
export async function MainTemplate({ title, description, component, children }: MainTemplateProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュの有効期間を設定
   */
  cacheLife("weeks");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <>
      {/* Title/description and component section */}
      {/* 以前のレイアウトに合わせて flex コンテナを追加 */}
      <div className="flex flex-col justify-between sm:flex-row">
        {title && description && (
          <div>
            <h1 className="page-title-custom">{title}</h1>
            <p className="page-description-custom">{description}</p>
          </div>
        )}
        {/* Component section */}
        {component && <Suspense fallback={<div>Loading...</div>}>{component}</Suspense>}
      </div>

      {/* Children section */}
      {children}
    </>
  );
}
