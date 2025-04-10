"use client";

import { useCallback, useEffect, useState } from "react";
import { getUnreadNotificationsCount } from "@/lib/actions/notification/notification-utilities";
import { useSession } from "next-auth/react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知ボタン用のカスタムフック
 * - 未読通知の状態管理
 * - 定期的な通知チェック
 * - モーダル開閉状態管理
 * @returns {isOpen: boolean, setIsOpen: (isOpen: boolean) => void, hasUnreadNotifications: boolean, handleUnreadStatusChange: (hasUnread: boolean) => void, status: string}
 */
export function useNotificationButton(): {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  hasUnreadNotifications: boolean;
  handleUnreadStatusChange: (hasUnread: boolean) => void;
  status: string;
} {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // モーダルの開閉状態を管理
  const [isOpen, setIsOpen] = useState(false);

  // 未読通知の有無
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // セッション情報を取得
  const { status } = useSession();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 通知リストからの未読状態更新を処理する関数
   */
  const handleUnreadStatusChange = useCallback((hasUnread: boolean) => {
    setHasUnreadNotifications(hasUnread);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 未読通知をチェックする関数
   */
  const checkNotifications = useCallback(async () => {
    try {
      // セッションがある場合のみ通知取得処理を実行
      if (status === "authenticated") {
        // 未読通知を取得
        const unreadCount = await getUnreadNotificationsCount();
        setHasUnreadNotifications(unreadCount > 0);
      }
    } catch (error) {
      console.error("通知取得エラー:", error);
    }
  }, [status]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 初期ロード時と定期的に未読通知をチェック
   */
  useEffect(() => {
    console.log("src/hooks/notification/use-notification-button.ts_useEffect_checkNotifications_start");
    console.log("src/hooks/notification/use-notification-button.ts_useEffect_checkNotifications_status", status);
    // セッションがある場合のみ通知取得処理を実行
    if (status === "authenticated") {
      // 初回実行
      void checkNotifications();
      console.log("src/hooks/notification/use-notification-button.ts_useEffect_checkNotifications_start");

      // 定期実行の設定
      const intervalId = setInterval(() => void checkNotifications(), 30 * 60 * 1000); // 30分ごと

      // クリーンアップ
      return () => clearInterval(intervalId);
    }
  }, [status, checkNotifications]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * モーダーが開かれたときに最新の通知を取得
   */
  useEffect(() => {
    // モーダーが開かれている場合、最新の通知を取得
    if (isOpen) {
      // 最新の通知を取得
      void checkNotifications();
    }
  }, [isOpen, checkNotifications]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    isOpen,
    setIsOpen,
    hasUnreadNotifications,
    handleUnreadStatusChange,
    status,
  };
}
