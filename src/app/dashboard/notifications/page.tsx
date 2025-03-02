import { Suspense } from "react";
import { type Metadata } from "next";
import { getUnreadNotificationsCount } from "@/app/actions/notification";
import { MainTemplate } from "@/components/layout/maintemplate";
import { NotificationList } from "@/components/notification/notification-list";

export const metadata: Metadata = {
  title: "通知一覧 - Freeism App",
  description: "すべての通知を確認できます。",
};

/**
 * 通知カウントコンポーネント
 * サーバーから未読通知の数を取得して表示
 */
async function NotificationCount() {
  try {
    // ユーザーの未読通知の数を取得
    const unreadCount = await getUnreadNotificationsCount();

    return <div className="mb-4 text-sm text-gray-500">{unreadCount > 0 ? `${unreadCount}件の未読通知があります` : "未読通知はありません"}</div>;
  } catch (error) {
    console.error("通知カウント取得エラー:", error);
    return null;
  }
}

/**
 * 通知一覧ページ
 * - すべての通知を一覧表示する専用ページ
 * - フルページサイズで通知リストを表示
 * - 通知状態をグローバルに反映
 */
export default function NotificationsPage() {
  return (
    <MainTemplate title="通知一覧" description="すべての通知を確認できます。">
      <div className="rounded-lg border p-6 shadow-sm">
        <Suspense fallback={<div className="mb-4 text-sm text-gray-500">通知を確認中...</div>}>
          <NotificationCount />
        </Suspense>
        <NotificationList />
      </div>
    </MainTemplate>
  );
}
