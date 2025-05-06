"use cache";

import { type Metadata } from "next";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { MainTemplate } from "@/components/layout/maintemplate";
import { NotificationList } from "@/components/notification/notification-list";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * メタデータ
 */
export const metadata: Metadata = {
  title: "通知一覧 - Freeism App",
  description: "すべての通知を確認できます。",
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知一覧ページ
 * - すべての通知を一覧表示する専用ページ
 * - フルページサイズで通知リストを表示
 * - 通知状態をグローバルに反映
 */
export default async function NotificationsPage() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  cacheLife("max");
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 通知一覧ページ
   */
  return (
    <MainTemplate title="通知一覧" description="すべての通知を確認できます。">
      <div className="overflow-hidden rounded-lg border px-6 py-3 shadow-sm">
        <NotificationList />
      </div>
    </MainTemplate>
  );
}
