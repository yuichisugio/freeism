"use server";

import type { NotificationData } from "@/lib/actions/notification/cache-notification-utilities";
import { cache } from "react";
import { revalidatePath } from "next/cache";
import {
  cachedApiUpdateNotificationStatus,
  cachedGetNotificationsAndUnreadCount,
  cachedGetUnreadNotificationsCount,
  cachedMarkAllNotificationsAsRead,
} from "@/lib/actions/notification/cache-notification-utilities";
import { getAuthenticatedSessionUserId } from "@/lib/utils";

/**
 * 未読通知の数を取得する - JSONB最適化版
 * @returns 未読通知の数
 */
export const getUnreadNotificationsCount = cache(async (userId: string): Promise<string[]> => {
  console.log("src/lib/actions/notification/notification-utilities.ts_getUnreadNotificationsCount_start");

  const unreadNotificationIds = await cachedGetUnreadNotificationsCount(userId);
  console.log("src/lib/actions/notification/notification-utilities.ts_getUnreadNotificationsCount_unreadNotificationIds", unreadNotificationIds);

  return unreadNotificationIds;
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知とその未読数を取得する - ページング改善版
 * @param page ページ番号
 * @param limit 1ページあたりの表示件数
 * @returns 通知リストと未読数
 */
export const getNotificationsAndUnreadCount = cache(
  async (
    page = 1,
    limit = 20,
  ): Promise<{
    notifications: NotificationData[];
    totalCount: number;
    unreadCount: number;
  }> => {
    try {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 認証済みユーザーのIDを取得
      const userId = await getAuthenticatedSessionUserId();

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      const { notifications, totalCount, unreadCount } = await cachedGetNotificationsAndUnreadCount(page, limit, userId);

      return {
        notifications,
        totalCount,
        unreadCount,
      };

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
    } catch (error) {
      console.error("通知取得エラー:", error);
      return {
        notifications: [],
        totalCount: 0,
        unreadCount: 0,
      };
    }
  },
);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 指定された通知の既読状態を更新する - JSONB最適化版
 * @param notificationId 通知ID
 * @param isRead 既読状態
 * @returns 成功したかどうか
 */
export const apiUpdateNotificationStatus = cache(async (notificationId: string, isRead: boolean): Promise<{ success: boolean }> => {
  try {
    const userId = await getAuthenticatedSessionUserId();

    const result = await cachedApiUpdateNotificationStatus(notificationId, isRead, userId);

    revalidatePath("/dashboard/notifications");
    return result;
  } catch (error) {
    console.error("通知状態更新エラー:", error);
    return {
      success: false,
    };
  }
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 全ての通知を既読にする関数
 * @returns 処理結果
 */
export const markAllNotificationsAsRead = cache(async (): Promise<{ success: boolean }> => {
  try {
    const userId = await getAuthenticatedSessionUserId();

    await cachedMarkAllNotificationsAsRead(userId);

    // キャッシュを更新
    revalidatePath("/dashboard/notifications");

    return { success: true };
  } catch (error) {
    console.error("全通知既読マークエラー:", error);
    return { success: false };
  }
});
