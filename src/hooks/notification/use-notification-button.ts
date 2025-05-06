"use client";

import { useCallback, useEffect, useState } from "react";
import { getUnreadNotificationsCount } from "@/lib/actions/notification/notification-utilities";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知ボタン用のカスタムフックの戻り値の型
 */
type NotificationButtonReturn = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  hasUnreadNotifications: boolean;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知ボタン用のカスタムフック
 * - 未読通知の状態管理
 * - 定期的な通知チェック
 * - モーダー開閉状態管理
 * @returns {isOpen: boolean, setIsOpen: (isOpen: boolean) => void, hasUnreadNotifications: boolean}
 */
export function useNotificationButton(userId: string): NotificationButtonReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * state
   */
  // モーダーの開閉状態を管理
  const [isOpen, setIsOpen] = useState(false);

  // 未読通知の有無
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 未読通知をチェックする関数
   */
  const checkNotifications = useCallback(async () => {
    console.log("src/hooks/notification/use-notification-button.ts_checkNotifications_start");
    // 未読通知を取得
    const unreadNotificationIds = await getUnreadNotificationsCount(userId);
    setHasUnreadNotifications(unreadNotificationIds.length > 0);
  }, [userId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 初期ロード時と定期的に未読通知をチェック
   */
  useEffect(() => {
    console.log("src/hooks/notification/use-notification-button.ts_useEffect_checkNotifications_start");
    // 初回実行
    void checkNotifications();
    // 定期実行の設定。30分ごと
    const intervalId: NodeJS.Timeout = setInterval(() => void checkNotifications(), 30 * 60 * 1000);
    // クリーンアップ
    return () => {
      console.log("src/hooks/notification/use-notification-button.ts_useEffect_checkNotifications_cleanup");
      if (intervalId) {
        console.log("src/hooks/notification/use-notification-button.ts_useEffect_checkNotifications_cleanup_clearInterval");
        clearInterval(intervalId);
      }
    };
  }, [checkNotifications]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * モーダーが開かれたときに最新の通知を取得
   */
  useEffect(() => {
    // モーダーが開かれている場合、最新の通知を取得
    if (isOpen) {
      console.log("src/hooks/notification/use-notification-button.ts_useEffect_checkNotifications_isOpen", isOpen);
      // 最新の通知を取得
      void checkNotifications();
    }
  }, [isOpen, checkNotifications]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    // state
    isOpen,
    hasUnreadNotifications,

    // function
    setIsOpen,
  };
}
