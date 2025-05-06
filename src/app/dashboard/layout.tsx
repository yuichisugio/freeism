import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { getAuthenticatedSessionUserId } from "@/lib/utils";

/**
 * ダッシュボードレイアウト
 * @param children 子コンポーネント
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * セッション情報を取得
   */
  const userId = await getAuthenticatedSessionUserId();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーが存在しない場合はリダイレクト
   */
  if (!userId) {
    redirect("/auth/signin");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Fixed header */}
      <Header userId={userId} buttonDisplay={true} />

      {/* Main content area with fixed sidebar and scrollable children */}
      <div className="flex flex-1 overflow-hidden">
        {/* Fixed sidebar */}
        <Sidebar />
        {/* Main content area - fully scrollable except header and sidebar */}
        <main className="flex-1 overflow-auto">
          {/* "xl:max-w-none"で、ブラウザの幅が1280px以上の場合は、幅を100%にする */}
          <div className="container h-full overflow-auto px-8 py-5 sm:space-y-0 xl:max-w-none">
            {/* Title/description and component section - now scrollable */}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
