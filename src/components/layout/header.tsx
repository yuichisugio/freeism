import Link from "next/link";
import { auth } from "@/auth";
import { LoginButton } from "@/components/auth/login-button";
import { LogoutButton } from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";
import { AppLogoSvg } from "@/components/ui/svg";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/**
 * ヘッダーコンポーネント
 * - スティッキーヘッダーとして画面上部に固定
 * - ロゴとナビゲーションを表示
 * - ログイン状態に応じてボタンを切り替え
 * - レスポンシブ対応（モバイルでは縦並び、デスクトップでは横並び）
 */
export async function Header() {
  // 認証状態を取得
  const session = await auth();

  return (
    <header className="sticky top-0 z-50 w-full transform-gpu border-b border-blue-100 bg-white/80 backdrop-blur-lg dark:border-blue-900 dark:bg-gray-950/80">
      {/* ヘッダーコンテンツのコンテナ */}
      <div className="container flex h-16 items-center justify-center pl-4 sm:justify-between">
        {/* ロゴ部分 */}
        <Link href="/" className="flex items-center gap-2 overscroll-none text-blue-600 transition-colors hover:text-blue-700 sm:gap-3 dark:text-blue-400 dark:hover:text-blue-300">
          {/* ロゴアイコン */}
          <AppLogoSvg />
          {/* サイト名 */}
          <span className="text-xl font-bold tracking-tight sm:text-2xl">Freeism-App</span>
        </Link>

        {/* ナビゲーション */}
        <nav className="hidden sm:absolute sm:right-5 sm:flex sm:items-center sm:gap-6">
          {/* テーマ切り替えボタン */}
          <ThemeToggle />
          {/* ログイン状態に応じてボタンを切り替え */}
          {session ? (
            // ログイン済みの場合はダッシュボードへのリンクを表示
            <>
              <Button variant="outline" asChild className="button-outline-custom">
                <Link href="/dashboard/grouplist">Dashboard</Link>
              </Button>
              <LogoutButton />
            </>
          ) : (
            // 未ログインの場合はサインインボタンを表示
            <LoginButton />
          )}
        </nav>
      </div>
    </header>
  );
}
