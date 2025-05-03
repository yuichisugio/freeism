"use server";

import type { NotificationData } from "@/lib/actions/notification/cache-notification-utilities";
import { cache } from "react";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  buildCommonNotificationWhereClause,
  cachedGetNotificationsAndUnreadCount,
  cachedGetUnreadNotificationsCount,
} from "@/lib/actions/notification/cache-notification-utilities";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
export const updateNotificationStatus = cache(async (notificationId: string, isRead: boolean): Promise<{ success: boolean }> => {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    const userId = await getAuthenticatedSessionUserId();

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 未読の場合はreadAtをnullではなく明示的にNULLとして扱うために条件分岐
    if (isRead) {
      // 既読にする場合
      const readAt = new Date().toISOString();
      await prisma.$executeRaw`
      UPDATE "Notification"
      SET "is_read" = "is_read" || jsonb_build_object(${userId}, jsonb_build_object('isRead', true, 'readAt', ${readAt}))
      WHERE id = ${notificationId}
    `;
    } else {
      // 未読にする場合 - readAtはnullではなくプロパティそのものを設定しない
      await prisma.$executeRaw`
      UPDATE "Notification"
      SET "is_read" = "is_read" || jsonb_build_object(${userId}, jsonb_build_object('isRead', false))
      WHERE id = ${notificationId}
    `;
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // キャッシュを更新
    revalidateTag("notification");
    revalidatePath("/dashboard/notifications");

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    return { success: true };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
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
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    const userId = await getAuthenticatedSessionUserId();

    // 共通のWHERE句を取得 (タスク条件は不要なので false を指定)
    const whereClause = await buildCommonNotificationWhereClause(userId, false);

    const readAt = new Date().toISOString();

    // 全ての通知を一括で既読に設定
    await prisma.$executeRaw`
      UPDATE "Notification" n -- エイリアス n を追加
      SET "is_read" =
        COALESCE(n."is_read", '{}'::jsonb) || jsonb_build_object(${userId}, jsonb_build_object('isRead', true, 'readAt', ${readAt}))
      WHERE ${whereClause} -- 結合したWHERE句を使用
    `;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // キャッシュを更新
    revalidateTag("notification");
    revalidatePath("/dashboard/notifications");

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    return { success: true };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("全通知既読マークエラー:", error);
    return { success: false };
  }
});
