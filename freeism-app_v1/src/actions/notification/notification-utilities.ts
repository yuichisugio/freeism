"use server";

import type { NotificationAndUnreadCount } from "@/actions/notification/cache-notification-list";
import { cache } from "react";
import { cachedGetNotificationsAndUnreadCount } from "@/actions/notification/cache-notification-list";
import { cachedGetUnreadNotificationsCount } from "@/actions/notification/cache-notification-unread-count";
import { prisma } from "@/library-setting/prisma";
import { type PromiseResult } from "@/types/general-types";
import { NotificationTargetType, Prisma } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 未読通知の数を取得する
 * @returns 未読通知の数
 */
export const getUnreadNotificationsCount = cache(async (userId: string): PromiseResult<boolean> => {
  return await cachedGetUnreadNotificationsCount(userId);
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知とその未読数を取得する
 * @param page ページ番号
 * @param limit 1ページあたりの表示件数
 * @returns 通知リストと未読数
 */
export const getNotificationsAndUnreadCount = cache(
  async (userId: string, page: number, limit: number): PromiseResult<NotificationAndUnreadCount> => {
    return await cachedGetNotificationsAndUnreadCount(userId, page, limit);
  },
);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 指定された通知の既読状態を更新する
 * @param updates 更新する通知IDと既読状態のペアの配列
 * @returns 成功したかどうか
 */
export const updateNotificationStatus = cache(
  async (updates: Array<{ notificationId: string; isRead: boolean }>, userId: string): PromiseResult<null> => {
    // Prismaの$transactionを使用して、すべての更新をアトミックに実行
    await prisma.$transaction(async (tx) => {
      // 更新対象の通知IDと既読状態をチェック
      for (const update of updates) {
        // 更新対象の通知IDと既読状態を取得
        const { notificationId, isRead } = update;

        // 通知IDまたは既読状態が不正な場合はエラー
        if (!notificationId || isRead === undefined || isRead === null) {
          throw new Error("通知IDまたは既読状態が不正です");
        }

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

    return { success: true, message: "通知状態を更新しました", data: null };
  },
);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知クエリの共通WHERE条件を生成する関数
 * @param userId ユーザーID
 * @param includeTaskCondition タスク条件を含めるかどうか (デフォルト: true)
 * @returns Prisma.sqlでラップされたWHERE条件文
 */
export const buildCommonNotificationWhereClause = cache(
  async (userId: string, includeTaskCondition = true): PromiseResult<Prisma.Sql> => {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ユーザーIDがない場合はエラー
     */
    if (!userId) {
      throw new Error("ユーザーIDがありません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ユーザーがアクセスできるグループID一覧を取得
     */
    const userGroupList = await prisma.groupMembership.findMany({
      where: { userId },
      select: { groupId: true },
    });

    /**
     * グループIDを配列に格納
     */
    const groupIds = userGroupList.map((g) => g.groupId).filter(Boolean);

    /**
     * 空のグループリストの場合の処理
     */
    if (groupIds.length === 0) {
      groupIds.push("00000000-0000-0000-0000-000000000000");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスク条件を含める場合はタスクID一覧を取得
     */
    let taskIds: string[] | undefined;
    if (includeTaskCondition) {
      const taskList = await prisma.task.findMany({
        where: {
          groupId: { in: groupIds },
        },
        select: { id: true },
      });
      taskIds = taskList.map((t) => t.id).filter(Boolean);
    }

    /**
     * 対象条件を構築
     */
    const taskCondition =
      taskIds && taskIds.length > 0
        ? Prisma.sql`OR (n."target_type" = 'TASK' AND n."task_id" = ANY(${taskIds}))`
        : Prisma.empty;

    /**
     * 対象タイプに関する条件のみを返す (タイミング条件は呼び出し元で追加)
     */
    const targetCondition = Prisma.sql`(
      (n."target_type" = 'SYSTEM') OR
      (n."target_type" = 'USER' AND n."sender_user_id" = ${userId}) OR
      (n."target_type" = 'GROUP' AND n."group_id" = ANY(${groupIds}))
      ${taskCondition}
    )`;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タイミング条件を構築
     */
    const timingCondition = Prisma.sql`((n."send_timing_type" = 'NOW') OR (n."send_timing_type" = 'SCHEDULED' AND n."send_scheduled_date" < NOW()))`;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 共通のWHERE句を結合して返す
     */
    return {
      success: true,
      message: "通知クエリの共通WHERE条件を生成しました",
      data: Prisma.sql`${targetCondition} AND ${timingCondition}`,
    };
  },
);

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
  ): PromiseResult<string[]> => {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 通知対象タイプが不正な場合はエラー
     */
    if (!Object.values(NotificationTargetType).includes(targetType)) {
      throw new Error("通知対象タイプが不正です");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 通知対象のユーザーIDを取得
     */
    let targetUserIds: string[] = [];

    /**
     * 通知対象タイプに応じてユーザーIDを取得
     */
    switch (targetType) {
      case NotificationTargetType.SYSTEM:
        // システム全体の通知の場合は全ユーザーを対象
        const allUsers = await prisma.user.findMany({
          select: { id: true },
        });
        targetUserIds = allUsers.map((user) => user.id);
        break;

      case NotificationTargetType.USER:
        // ユーザー向け通知の場合
        if (!params.userIds) {
          throw new Error("ユーザーIDが指定されていません");
        }
        targetUserIds = [...params.userIds];
        break;

      case NotificationTargetType.GROUP:
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

      case NotificationTargetType.TASK:
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
          const reporterUserIds = task.reporters
            .filter((reporter) => reporter.userId)
            .map((reporter) => reporter.userId!);
          targetUserIds.push(...reporterUserIds);

          // タスク実行者を追加 (登録ユーザーのみ)
          const executorUserIds = task.executors
            .filter((executor) => executor.userId)
            .map((executor) => executor.userId!);
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

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 重複を除去して返す
     */
    return {
      success: true,
      message: "通知対象のユーザーIDを取得しました",
      data: [...new Set(targetUserIds)],
    };
  },
);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
