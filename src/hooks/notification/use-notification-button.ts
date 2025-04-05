"use client";

import { useCallback, useEffect, useState } from "react";
import { getUnreadNotificationsCount } from "@/lib/actions/notification/notification-utilities";
import { useSession } from "next-auth/react";

/**
 * 通知ボタン用のカスタムフック
 * - 未読通知の状態管理
 * - 定期的な通知チェック
 * - モーダル開閉状態管理
 */
export function useNotificationButton() {
  // モーダルの開閉状態を管理
  const [isOpen, setIsOpen] = useState(false);

  // セッション情報を取得
  const { data: session, status } = useSession();

  // 未読通知の有無
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  /**
   * 通知リストからの未読状態更新を処理する関数
   */
  const handleUnreadStatusChange = useCallback((hasUnread: boolean) => {
    setHasUnreadNotifications(hasUnread);
  }, []);

  /**
   * 未読通知をチェックする関数
   */
  const checkNotifications = useCallback(async () => {
    try {
      if (status === "authenticated" && session?.user?.id) {
        const unreadCount = await getUnreadNotificationsCount();
        setHasUnreadNotifications(unreadCount > 0);
      }
    } catch (error) {
      console.error("通知取得エラー:", error);
    }
  }, [status, session]);

  // 初期ロード時と定期的に未読通知をチェック
  useEffect(() => {
    // セッションがある場合のみ通知取得処理を実行
    if (status === "authenticated" && session?.user?.id) {
      // 初回実行
      void checkNotifications();

      // 定期実行の設定
      const intervalId = setInterval(() => void checkNotifications(), 30 * 60 * 1000); // 30分ごと

      return () => clearInterval(intervalId);
    }
  }, [status, session, checkNotifications]);

  // モーダルが開かれたときに最新の通知を取得
  useEffect(() => {
    if (isOpen && status === "authenticated") {
      void checkNotifications();
    }
  }, [isOpen, status, checkNotifications]);

  return {
    isOpen,
    setIsOpen,
    hasUnreadNotifications,
    handleUnreadStatusChange,
    status,
  };
}
