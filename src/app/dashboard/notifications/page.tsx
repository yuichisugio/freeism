import { type Metadata } from "next";
import { MainTemplate } from "@/components/layout/maintemplate";
import { NotificationList } from "@/components/notification/notification-list";

export const metadata: Metadata = {
  title: "通知一覧 - Freeism App",
  description: "すべての通知を確認できます。",
};

/**
 * 通知一覧ページ
 * - すべての通知を一覧表示する専用ページ
 * - フルページサイズで通知リストを表示
 * - 通知状態をグローバルに反映
 */
export default function NotificationsPage() {
  return (
    <MainTemplate title="通知一覧" description="すべての通知を確認できます。">
      <div className="overflow-hidden rounded-lg border px-6 py-4 shadow-sm">
        <NotificationList />
      </div>
    </MainTemplate>
  );
}
