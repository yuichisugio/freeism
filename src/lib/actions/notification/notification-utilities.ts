"use server";

import type { NotificationData } from "@/lib/actions/cache/cache-notification-utilities";
import type { NotificationTargetType } from "@prisma/client";
import { cache } from "react";
import { revalidatePath, revalidateTag } from "next/cache";
import { cachedGetNotificationsAndUnreadCount, cachedGetUnreadNotificationsCount } from "@/lib/actions/cache/cache-notification-utilities";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { Prisma } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 未読通知の数を取得する - JSONB最適化版
 * @returns 未読通知の数
 */
export const getUnreadNotificationsCount = cache(async (userId: string): Promise<boolean> => {
  console.log("src/lib/actions/notification/notification-utilities.ts_getUnreadNotificationsCount_start");

  const hasUnreadNotifications = await cachedGetUnreadNotificationsCount(userId);
  console.log("src/lib/actions/notification/notification-utilities.ts_getUnreadNotificationsCount_hasUnreadNotifications", hasUnreadNotifications);

  return hasUnreadNotifications;
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
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{
    notifications: NotificationData[];
    totalCount: number;
    unreadCount: number;
    readCount: number;
  }> => {
    try {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 引数で渡された userId を使用
      const { notifications, totalCount, unreadCount, readCount } = await cachedGetNotificationsAndUnreadCount(userId, page, limit);

      console.log("src/lib/actions/notification/notification-utilities.ts_getNotificationsAndUnreadCount_totalCount", totalCount);
      console.log("src/lib/actions/notification/notification-utilities.ts_getNotificationsAndUnreadCount_unreadCount", unreadCount);
      console.log("src/lib/actions/notification/notification-utilities.ts_getNotificationsAndUnreadCount_readCount", readCount);

      return {
        notifications,
        totalCount,
        unreadCount,
        readCount,
      };

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
    } catch (error) {
      console.error("通知取得エラー:", error);
      return {
        notifications: [],
        totalCount: 0,
        unreadCount: 0,
        readCount: 0,
      };
    }
  },
);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 指定された通知の既読状態を更新する - JSONB最適化版
 * @param updates 更新する通知IDと既読状態のペアの配列
 * @returns 成功したかどうか
 */
export const updateNotificationStatus = cache(async (updates: Array<{ notificationId: string; isRead: boolean }>): Promise<{ success: boolean }> => {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    const userId = await getAuthenticatedSessionUserId();

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // Prismaの$transactionを使用して、すべての更新をアトミックに実行
    await prisma.$transaction(async (tx) => {
      for (const update of updates) {
        const { notificationId, isRead } = update;
        // 未読の場合はreadAtをnullではなく明示的にNULLとして扱うために条件分岐
        if (isRead) {
          // 既読にする場合
          const readAt = new Date().toISOString();
          await tx.$executeRaw`
            UPDATE "Notification"
            SET "is_read" = COALESCE("is_read", '{}'::jsonb) || jsonb_build_object(${userId}, jsonb_build_object('isRead', true, 'readAt', ${readAt}))
            WHERE id = ${notificationId}
          `;
        } else {
          // 未読にする場合 - readAtはnullではなくプロパティそのものを設定しない
          await tx.$executeRaw`
            UPDATE "Notification"
            SET "is_read" = COALESCE("is_read", '{}'::jsonb) || jsonb_build_object(${userId}, jsonb_build_object('isRead', false))
            WHERE id = ${notificationId}
          `;
        }
      }
    });

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

    /**
     * 認証済みユーザーのIDを取得
     */
    const userId = await getAuthenticatedSessionUserId();

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 共通のWHERE句を取得 (タスク条件は不要なので false を指定)
     */
    const whereClause = await buildCommonNotificationWhereClause(userId, false);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 全ての通知を一括で既読に設定
     */
    const readAt = new Date().toISOString();

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 全ての通知を一括で既読に設定
     */
    await prisma.$executeRaw`
      UPDATE "Notification" n -- エイリアス n を追加
      SET "is_read" =
        COALESCE(n."is_read", '{}'::jsonb) || jsonb_build_object(${userId}, jsonb_build_object('isRead', true, 'readAt', ${readAt}))
      WHERE ${whereClause}
    `;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * キャッシュを更新
     */
    revalidateTag("notification");
    revalidatePath("/dashboard/notifications");

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 処理結果を返す
     */
    return { success: true };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("全通知既読マークエラー:", error);
    return { success: false };
  }
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知クエリの共通WHERE条件を生成する関数
 * @param userId ユーザーID
 * @param includeTaskCondition タスク条件を含めるかどうか (デフォルト: true)
 * @returns Prisma.sqlでラップされたWHERE条件文
 */
export const buildCommonNotificationWhereClause = cache(async (userId: string, includeTaskCondition = true): Promise<Prisma.Sql> => {
  // ユーザーがアクセスできるグループID一覧を取得
  const groupIds = await getUserAccessibleGroupIds(userId);

  let taskIds: string[] | undefined;
  if (includeTaskCondition) {
    // グループに関連するタスクID一覧を取得 (必要な場合のみ)
    taskIds = await getTaskIdsByGroupIds(groupIds);
  }

  // 対象条件を構築
  const targetCondition = await buildNotificationTargetCondition(userId, groupIds, taskIds);
  // タイミング条件を構築
  const timingCondition = Prisma.sql`((n."send_timing_type" = 'NOW') OR (n."send_timing_type" = 'SCHEDULED' AND n."send_scheduled_date" < NOW()))`;

  // 共通のWHERE句を結合して返す
  return Prisma.sql`${targetCondition} AND ${timingCondition}`;
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーがアクセス可能なグループIDを取得する共通関数
 * @param userId ユーザーID
 * @returns グループIDの配列
 */
export const getUserAccessibleGroupIds = cache(async (userId: string): Promise<string[]> => {
  // アクセス可能なグループIDを取得
  const userGroupList = await prisma.groupMembership.findMany({
    where: { userId },
    select: { groupId: true },
  });

  // グループIDを配列に格納
  const groupIds = userGroupList.map((g) => g.groupId).filter(Boolean);

  // 空のグループリストの場合の処理
  if (groupIds.length === 0) {
    groupIds.push("00000000-0000-0000-0000-000000000000"); // 存在しないダミーID
  }

  return groupIds;
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループIDに紐づくタスクIDを取得する共通関数
 * @param groupIds グループIDの配列
 * @returns タスクIDの配列
 */
export const getTaskIdsByGroupIds = cache(async (groupIds: string[]): Promise<string[]> => {
  const taskList = await prisma.task.findMany({
    where: {
      groupId: { in: groupIds },
    },
    select: { id: true },
  });

  return taskList.map((t) => t.id).filter(Boolean);
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知クエリの対象条件（ユーザー、グループ、タスク）を生成する関数
 * @param userId ユーザーID
 * @param groupIds グループIDの配列
 * @param taskIds タスクIDの配列 (オプション)
 * @returns Prisma.sqlでラップされたSQL条件文
 */
export const buildNotificationTargetCondition = cache(async (userId: string, groupIds: string[], taskIds?: string[]): Promise<Prisma.Sql> => {
  const taskCondition = taskIds && taskIds.length > 0 ? Prisma.sql`OR (n."target_type" = 'TASK' AND n."task_id" = ANY(${taskIds}))` : Prisma.empty;

  // 対象タイプに関する条件のみを返す (タイミング条件は呼び出し元で追加)
  // 全体を括弧で囲む
  return Prisma.sql`(
    (n."target_type" = 'SYSTEM') OR
    (n."target_type" = 'USER' AND n."sender_user_id" = ${userId}) OR
    (n."target_type" = 'GROUP' AND n."group_id" = ANY(${groupIds}))
    ${taskCondition}
  )`;
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 日付またはnullをISOString形式に変換する関数
 * @param date 日付オブジェクトか文字列かnull
 * @param defaultNow デフォルト値として現在時刻を使うかどうか
 * @returns ISO文字列またはnull
 */
export const formatDateToISOString = cache(async (date: string | Date | null, defaultNow = false): Promise<string | null> => {
  if (!date && !defaultNow) return null;
  return date ? new Date(date).toISOString() : defaultNow ? new Date().toISOString() : null;
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知対象のユーザーIDを取得する関数
 * @param {NotificationTargetType} targetType 通知対象タイプ
 * @param {Object} params パラメータ
 * @param {string[]} params.userIds 対象ユーザーID
 * @param {string} params.groupId 対象グループID
 * @param {string} params.taskId 対象タスクID
 * @returns {string[]} 通知対象のユーザーID配列
 */
export const getNotificationTargetUserIds = cache(
  async (
    targetType: NotificationTargetType,
    params: {
      userIds?: string[];
      groupId?: string;
      taskId?: string;
    },
  ): Promise<string[]> => {
    let targetUserIds: string[] = [];

    switch (targetType) {
      case "SYSTEM":
        // システム全体の通知の場合は全ユーザーを対象
        const allUsers = await prisma.user.findMany({
          select: { id: true },
        });
        targetUserIds = allUsers.map((user) => user.id);
        break;

      case "USER":
        // ユーザー向け通知の場合
        if (!params.userIds) {
          throw new Error("ユーザーIDが指定されていません");
        }
        targetUserIds = [...params.userIds];
        break;

      case "GROUP":
        // グループ向け通知の場合
        if (!params.groupId) {
          throw new Error("グループIDが指定されていません");
        }

        // グループメンバー全員を対象に
        const groupMembers = await prisma.groupMembership.findMany({
          where: { groupId: params.groupId },
          select: { userId: true },
        });
        targetUserIds = groupMembers.map((member) => member.userId);
        break;

      case "TASK":
        // タスク向け通知の場合
        if (!params.taskId) {
          throw new Error("タスクIDが指定されていません");
        }

        // タスクの作成者と報告者、実行者を対象に
        const task = await prisma.task.findUnique({
          where: { id: params.taskId },
          select: {
            creatorId: true,
            groupId: true,
            reporters: {
              select: {
                userId: true,
              },
            },
            executors: {
              select: {
                userId: true,
              },
            },
          },
        });

        if (task) {
          // タスク作成者を追加
          targetUserIds.push(task.creatorId);

          // タスク報告者を追加 (登録ユーザーのみ)
          const reporterUserIds = task.reporters.filter((reporter) => reporter.userId).map((reporter) => reporter.userId!);
          targetUserIds.push(...reporterUserIds);

          // タスク実行者を追加 (登録ユーザーのみ)
          const executorUserIds = task.executors.filter((executor) => executor.userId).map((executor) => executor.userId!);
          targetUserIds.push(...executorUserIds);

          // タスクが属するグループのメンバーも追加
          const groupMembers = await prisma.groupMembership.findMany({
            where: { groupId: task.groupId },
            select: { userId: true },
          });
          targetUserIds.push(...groupMembers.map((member) => member.userId));
        }
        break;
    }

    // 重複を除去して返す
    return [...new Set(targetUserIds)];
  },
);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
