import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { AppLogoSvg } from "@/components/ui/svg";

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
    <header className="sticky top-0 z-50 w-full border-b border-blue-100 bg-white/80 backdrop-blur-lg">
      {/* ヘッダーコンテンツのコンテナ */}
      <div className="container flex h-16 items-center justify-center pl-4 sm:justify-between">
        {/* ロゴ部分 */}
        <Link
          href="/"
          className="flex items-center gap-2 overscroll-none text-blue-600 transition-colors hover:text-blue-700 sm:gap-3"
        >
          {/* ロゴアイコン */}
          <AppLogoSvg />
          {/* サイト名 */}
          <span className="text-xl font-bold tracking-tight sm:text-2xl">
            Freeism-App
          </span>
        </Link>

        {/* ナビゲーション */}
        <nav className="hidden sm:absolute sm:right-5 sm:flex sm:items-center sm:gap-6">
          {/* ログイン状態に応じてボタンを切り替え */}
          {session ? (
            // ログイン済みの場合はダッシュボードへのリンクを表示
            <>
              <Button
                variant="outline"
                className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
                asChild
              >
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <form
                action={async () => {
                  "use server";
                  await signOut();
                }}
              >
                <Button
                  type="submit"
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  ログアウト
                </Button>
              </form>
            </>
          ) : (
            // 未ログインの場合はサインインボタンを表示。Server Actionを使用するため、formタグで囲み、"use server"を指定している
            <form
              action={async () => {
                "use server";
                await signIn();
              }}
            >
              <Button
                type="submit"
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                利用する
              </Button>
            </form>
          )}
        </nav>
      </div>
    </header>
  );
}
