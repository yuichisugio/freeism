import Link from "next/link";
import { googleSignIn } from "@/app/actions";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";

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
    <header className="sticky top-0 z-50 w-full border-b border-blue-100 bg-white/80 backdrop-blur-lg transition-all duration-300">
      {/* ヘッダーコンテンツのコンテナ */}
      <div className="container mx-auto flex h-16 flex-col items-center justify-between gap-4 px-4 py-2 sm:h-20 sm:flex-row sm:gap-0 sm:py-0">
        {/* ロゴ部分 */}
        <Link
          href="/"
          className="flex items-center gap-2 text-blue-600 transition-colors hover:text-blue-700 sm:gap-3"
        >
          {/* ロゴアイコン */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-6 w-6 sm:h-8 sm:w-8"
          >
            <path d="M15.75 8.25a.75.75 0 01.75.75c0 1.12-.492 2.126-1.27 2.812a.75.75 0 11-.992-1.124A2.243 2.243 0 0015 9a.75.75 0 01.75-.75z" />
            <path
              fillRule="evenodd"
              d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM4.575 15.6a8.25 8.25 0 009.348 4.425 1.966 1.966 0 00-1.84-1.275.983.983 0 01-.97-.822l-.073-.437c-.094-.565.25-1.11.8-1.267l.99-.282c.427-.123.783-.418.982-.816l.036-.073a1.453 1.453 0 012.328-.377L16.5 15h.628a2.25 2.25 0 011.983 1.186 8.25 8.25 0 00-6.345-12.4c.044.262.18.503.389.676l1.068.89c.442.369.535 1.01.216 1.49l-.51.766a2.25 2.25 0 01-1.161.886l-.143.048a1.107 1.107 0 00-.57 1.664c.369.555.169 1.307-.427 1.605L9 13.125l.423 1.059a.956.956 0 01-1.652.928l-.679-.906a1.125 1.125 0 00-1.906.172L4.575 15.6z"
            />
          </svg>
          {/* サイト名 */}
          <span className="text-xl font-bold tracking-tight sm:text-2xl">
            Freeism-App
          </span>
        </Link>

        {/* ナビゲーション */}
        <nav className="flex items-center gap-4 sm:gap-6">
          {/* ログイン状態に応じてボタンを切り替え */}
          {session ? (
            // ログイン済みの場合はダッシュボードへのリンクを表示
            <Button
              variant="outline"
              className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
              asChild
            >
              <Link href="/protected/dashboard">Dashboard</Link>
            </Button>
          ) : (
            // 未ログインの場合はサインインボタンを表示
            <form action={googleSignIn}>
              <Button
                type="submit"
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                サインイン
              </Button>
            </form>
          )}
        </nav>
      </div>
    </header>
  );
}
