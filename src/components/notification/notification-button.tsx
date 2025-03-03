"use client";

import { useEffect, useState } from "react";
import { getUnreadNotificationsCount } from "@/app/actions/notification";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bell } from "lucide-react";
import { useSession } from "next-auth/react";

import { NotificationList } from "./notification-list";

/**
 * 通知ボタンコンポーネント
 * - レスポンシブ対応: 画面サイズに応じてモーダルのスタイルを変更
 * - クリック時に通知モーダルを表示
 * - 未読通知がある場合はバッジを表示（通知リストと連動）
 */
export function NotificationButton() {
  // モーダルの開閉状態を管理
  const [isOpen, setIsOpen] = useState(false);

  const { data: session, status } = useSession();

  // 未読通知の有無。Actionを名前につけないと、CLからサーバーに渡せないらしい。普通は、JSONに変換して渡すが、Actionの場合は、そのまま渡せる。
  const [hasUnreadNotifications, setHasUnreadNotificationsAction] = useState(false);

  // 初期ロード時に未読通知を確認
  // すべてのレンダリングパスで同じ順序でフックを呼び出す
  useEffect(() => {
    // セッションがある場合のみ通知取得処理を実行
    if (status === "authenticated" && session?.user?.id) {
      function checkNotifications() {
        try {
          // useEffectの中では、非同期関数を使用できないので、promiseを返さないthenを記載する
          getUnreadNotificationsCount().then((unreadCount) => {
            setHasUnreadNotificationsAction(unreadCount > 0);
          });
        } catch (error) {
          console.error("通知取得エラー:", error);
        }
      }

      // 初回実行
      checkNotifications();

      // 定期実行の設定
      const intervalId = setInterval(checkNotifications, 30 * 60 * 1000); // 30分ごと

      return () => clearInterval(intervalId);
    }
  }, [status, session]); // statusとsessionを依存配列に追加

  // 未認証の場合は何も表示しない
  if (status === "unauthenticated" || status === "loading") {
    return null;
  }

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)} className="relative" aria-label="通知">
        <Bell className="h-5 w-5" />
        {/* 未読通知がある場合は赤いドットを表示 */}
        {hasUnreadNotifications && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />}
      </Button>

      {/* 通知モーダル */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>通知</DialogTitle>
          </DialogHeader>
          <NotificationList onUnreadStatusChangeAction={setHasUnreadNotificationsAction} />
        </DialogContent>
      </Dialog>
    </>
  );
}
