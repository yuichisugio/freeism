"use client";

import { useState } from "react";
import { redirect } from "next/navigation";
import { getUnreadNotificationsCount } from "@/lib/actions/notification/notification-utilities";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知ボタン用のカスタムフックの戻り値の型
 */
type NotificationButtonReturn = {
  isOpen: boolean;
  hasUnreadNotifications: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知ボタン用のカスタムフック
 * - 未読通知の状態管理
 * - 定期的な通知チェック
 * - モーダー開閉状態管理
 * @returns {isOpen: boolean, setIsOpen: (isOpen: boolean) => void, hasUnreadNotifications: boolean}
 */
export function useNotificationButton(): NotificationButtonReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * state
   */
  // モーダーの開閉状態を管理
  const [isOpen, setIsOpen] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * セッションのチェック
   */
  const { data: session } = useSession();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/auth/signin");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 初期ロード時と定期的に未読通知をチェック
   */
  const { data: hasUnreadNotifications } = useQuery({
    queryKey: queryCacheKeys.Notification.hasUnreadNotifications(userId),
    queryFn: () => getUnreadNotificationsCount(userId),
    staleTime: 30 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    enabled: !!userId,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    // state
    isOpen,
    hasUnreadNotifications: hasUnreadNotifications ?? false,

    // function
    setIsOpen,
  };
}
