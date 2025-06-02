"use cache";

import { unstable_cacheLife as cacheLife } from "next/cache";
import Link from "next/link";
import { NotificationButtonWrapper } from "@/components/notification/notification-button-wrapper";
import { ThemeToggle } from "@/components/share/theme-toggle";
import { AppLogoSvg } from "@/components/ui/svg";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ヘッダーコンポーネント
 * @param {boolean} buttonDisplay - ボタン表示有無
 * @returns {JSX.Element} - ヘッダーコンポーネント
 */
export async function Header({ buttonDisplay = true }: { buttonDisplay: boolean }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュの有効期間を設定
   */
  cacheLife("max");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ログ出力
   */
  console.log("src/components/layout/header.tsx_Header_start");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <header
      id="app-header"
      className="sticky top-0 z-50 w-full transform-gpu border-b border-blue-100 bg-white/80 backdrop-blur-lg transition-colors duration-200 dark:border-blue-900 dark:bg-gray-950/80"
    >
      {/* ヘッダーコンテンツのコンテナ */}
      <div className="h-16 w-full px-4">
        {/* スマホ表示用レイアウト (sm未満) */}
        <div className="flex h-full items-center justify-between sm:hidden">
          {/* 左: ハンバーガーメニュー */}
          <div className="flex w-16 items-center justify-start"></div>

          {/* 中央: ロゴ (固定幅で中央配置) */}
          <div className="flex flex-1 items-center justify-center">
            <Link
              href="/"
              className="flex items-center gap-2 overscroll-none text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <AppLogoSvg />
              <span className="text-xl font-bold tracking-tight">Freeism-App</span>
            </Link>
          </div>

          {/* 右: 通知ボタン */}
          {buttonDisplay && (
            <div className="mr-5 flex w-16 items-center justify-end">
              <NotificationButtonWrapper isMobile={true} />
            </div>
          )}
        </div>

        {/* タブレット/PC表示用レイアウト (sm以上) */}
        <div className="hidden h-full items-center justify-between sm:flex">
          {/* 左: ロゴ */}
          <div className="flex-shrink-0">
            <Link
              href="/"
              className="flex items-center gap-3 overscroll-none text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <AppLogoSvg />
              <span className="text-2xl font-bold tracking-tight">Freeism-App</span>
            </Link>
          </div>

          {/* 右: ナビゲーション要素をまとめる */}
          <nav className="flex items-center gap-6 pr-4">
            {/* ログインしている場合のみ通知ボタンを表示 */}
            {buttonDisplay && <NotificationButtonWrapper isMobile={false} />}
            <ThemeToggle />
          </nav>
        </div>
      </div>
    </header>
  );
}
