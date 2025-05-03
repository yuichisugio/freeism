"use client";

import { useCallback, useEffect, useState } from "react";
import { getUnreadNotificationsCount } from "@/lib/actions/notification/notification-utilities";
import { useSession } from "next-auth/react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知ボタン用のカスタムフックの戻り値の型
 */
type NotificationButtonReturn = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  hasUnreadNotifications: boolean;
  status: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知ボタン用のカスタムフック
 * - 未読通知の状態管理
 * - 定期的な通知チェック
 * - モーダー開閉状態管理
 * @returns {isOpen: boolean, setIsOpen: (isOpen: boolean) => void, hasUnreadNotifications: boolean, status: string}
 */
export function useNotificationButton(): NotificationButtonReturn {
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
   * セッション情報を取得
   */
  const { data: session, status } = useSession();
  const userId = session?.user?.id;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 未読通知をチェックする関数
   */
  const checkNotifications = useCallback(async () => {
    if (!userId) {
      console.log("src/hooks/notification/use-notification-button.ts_checkNotifications_noUserId");
      return;
    }
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
    console.log("src/hooks/notification/use-notification-button.ts_useEffect_checkNotifications_status", status);
    let intervalId: NodeJS.Timeout | undefined;
    // セッションがある場合のみ通知取得処理を実行
    if (status === "authenticated") {
      // 初回実行
      void checkNotifications();

      // 定期実行の設定
      intervalId = setInterval(() => void checkNotifications(), 30 * 60 * 1000); // 30分ごと
    }
    // クリーンアップ
    return () => {
      console.log("src/hooks/notification/use-notification-button.ts_useEffect_checkNotifications_cleanup");
      if (intervalId) {
        console.log("src/hooks/notification/use-notification-button.ts_useEffect_checkNotifications_cleanup_clearInterval");
        clearInterval(intervalId);
      }
    };
  }, [status, checkNotifications]);

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
    status,

    // function
    setIsOpen,
  };
}
