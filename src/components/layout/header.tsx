import { memo } from "react";
import Link from "next/link";
import { LoginButton } from "@/components/auth/login-button";
import { LogoutButton } from "@/components/auth/logout-button";
import { NotificationButton } from "@/components/notification/notification-button";
import { Button } from "@/components/ui/button";
import { AppLogoSvg } from "@/components/ui/svg";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getAuthSession } from "@/lib/utils";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ヘッダーコンポーネント
 * - スティッキーヘッダーとして画面上部に固定
 * - ロゴとナビゲーションを表示
 * - ログイン状態に応じてボタンを切り替え
 * - レスポンシブ対応
 *   - スマホ: ハンバーガーメニュー(左) + ロゴ(中央) + 通知(右)
 *   - タブレット/PC: ロゴ(左) + ナビゲーション要素(右)
 */
export const Header = memo(async function Header() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 認証状態を取得
  const session = await getAuthSession();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <header className="sticky top-0 z-50 w-full transform-gpu border-b border-blue-100 bg-white/80 backdrop-blur-lg transition-colors duration-200 dark:border-blue-900 dark:bg-gray-950/80">
      {/* ヘッダーコンテンツのコンテナ */}
      <div className="h-16 w-full px-4">
        {/* スマホ表示用レイアウト (sm未満) */}
        <div className="flex h-full items-center justify-between sm:hidden">
          {/* 左: ハンバーガーメニュー */}
          <div className="flex w-16 items-center justify-start"></div>

          {/* 中央: ロゴ (固定幅で中央配置) */}
          <div className="flex flex-1 items-center justify-center">
            <Link href="/" className="flex items-center gap-2 overscroll-none text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
              <AppLogoSvg />
              <span className="text-xl font-bold tracking-tight">Freeism-App</span>
            </Link>
          </div>

          {/* 右: 通知ボタン */}
          <div className="mr-5 flex w-16 items-center justify-end">
            <NotificationButton />
          </div>
        </div>

        {/* タブレット/PC表示用レイアウト (sm以上) */}
        <div className="hidden h-full items-center justify-between sm:flex">
          {/* 左: ロゴ */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center gap-3 overscroll-none text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
              <AppLogoSvg />
              <span className="text-2xl font-bold tracking-tight">Freeism-App</span>
            </Link>
          </div>

          {/* 右: ナビゲーション要素をまとめる */}
          <nav className="flex items-center gap-6 pr-4">
            {/* ログインしている場合のみ通知ボタンを表示 */}
            {session && <NotificationButton />}
            <ThemeToggle />

            {/* ログイン状態に応じてボタンを切り替え */}
            {session ? (
              <>
                <Button variant="outline" asChild className="button-outline-custom">
                  <Link href="/dashboard/grouplist">Dashboard</Link>
                </Button>
                <LogoutButton />
              </>
            ) : (
              <LoginButton />
            )}
          </nav>
        </div>
      </div>
    </header>
  );
});
