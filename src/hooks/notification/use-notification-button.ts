"use client";

import type { NotificationData } from "@/lib/actions/cache/cache-notification-utilities";
import type { QueryFnReturnType } from "@/types/notifications-types";
import { useEffect, useState } from "react";
import { redirect } from "next/navigation";
import { getNotificationsAndUnreadCount, getUnreadNotificationsCount } from "@/lib/actions/notification/notification-utilities";
import { NOTIFICATION_CONSTANTS } from "@/lib/constants";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

  /**
   * 通知の内容をprefetchする
   * useInfiniteQuery の prefetch と同じ型になるように、returnする
   */
  const queryClient = useQueryClient();
  useEffect(() => {
    void queryClient.prefetchQuery({
      queryKey: queryCacheKeys.Notification.userAllNotifications(userId),
      queryFn: async () => {
        const result = await getNotificationsAndUnreadCount(userId, 1, NOTIFICATION_CONSTANTS.ITEMS_PER_PAGE);

        const processedNotifications: NotificationData[] = result.notifications.map((notification) => ({
          ...notification,
          sentAt: notification.sentAt ? new Date(notification.sentAt as unknown as string) : null,
          readAt: notification.readAt ? new Date(notification.readAt as unknown as string) : null,
          expiresAt: notification.expiresAt ? new Date(notification.expiresAt as unknown as string) : null,
        }));

        const pageData: QueryFnReturnType = {
          notifications: processedNotifications,
          totalCount: result.totalCount,
          unreadCount: result.unreadCount,
          readCount: result.readCount,
        };
        return {
          pages: [pageData],
          pageParams: [1],
        };
      },
    });
  }, [hasUnreadNotifications, queryClient, userId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    // state
    isOpen,
    hasUnreadNotifications: hasUnreadNotifications ?? false,

    // function
    setIsOpen,
  };
}
