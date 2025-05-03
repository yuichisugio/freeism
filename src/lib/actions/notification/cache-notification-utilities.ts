// "use cache";

import type { NotificationTargetType } from "@prisma/client";
import { cache } from "react";
import { unstable_cacheTag as cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * フロントエンド用の通知データ型定義
 */
export type NotificationData = {
  id: string;
  title: string;
  message: string;
  NotificationTargetType: NotificationTargetType;
  isRead: boolean;
  sentAt: string | null;
  readAt: string | null;
  expiresAt: string | null;
  actionUrl: string | null;
  senderUserId: string | null;
  groupId: string | null;
  taskId: string | null;
  userName: string | null;
  groupName: string | null;
  taskName: string | null;
  auctionEventType: string | null;
  auctionId: string | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーがアクセス可能なグループIDを取得する共通関数
 * @param userId ユーザーID
 * @returns グループIDの配列
 */
const getUserAccessibleGroupIds = cache(async (userId: string): Promise<string[]> => {
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
const getTaskIdsByGroupIds = cache(async (groupIds: string[]): Promise<string[]> => {
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
const buildNotificationTargetCondition = cache(async (userId: string, groupIds: string[], taskIds?: string[]): Promise<Prisma.Sql> => {
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
const formatDateToISOString = cache(async (date: string | Date | null, defaultNow = false): Promise<string | null> => {
  if (!date && !defaultNow) return null;
  return date ? new Date(date).toISOString() : defaultNow ? new Date().toISOString() : null;
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

/**
 * 未読通知の数を取得する - JSONB最適化版
 * @returns 未読通知の数
 * 未読の有無のみ知りたいので、1件のみ取得
 */
export const cachedGetUnreadNotificationsCount = cache(async (userId: string): Promise<string[]> => {
  console.log("src/lib/actions/notification/cache-notification-utilities.ts_getUnreadNotificationsCount_start");
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 共通のWHERE句を取得 (タスク条件を含む)
    const commonWhereClause = await buildCommonNotificationWhereClause(userId, true);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 未読条件を追加
    const isReadCondition = Prisma.sql`(NOT (n."is_read" ? ${userId} AND (n."is_read" -> ${userId} ->> 'isRead')::boolean = TRUE))`;
    const whereClause = Prisma.sql`${commonWhereClause} AND ${isReadCondition}`;
    console.log("src/lib/actions/notification/cache-notification-utilities.ts_getUnreadNotificationsCount_whereClause", whereClause);

    // PostgreSQLのJSONB演算子を使用した効率的なクエリ
    const countResult = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM "Notification" n
      WHERE ${whereClause} -- 結合したWHERE句を使用
      LIMIT 1
    `;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    return countResult.map((result) => result.id);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("未読通知カウントエラー:", error);
    return [];
  }
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知とその未読数を取得する - ページング改善版
 * @param page ページ番号
 * @param limit 1ページあたりの表示件数
 * @returns 通知リストと未読数
 */
export const cachedGetNotificationsAndUnreadCount = cache(
  async (
    page = 1,
    limit = 20,
    userId: string,
  ): Promise<{
    notifications: NotificationData[];
    totalCount: number;
    unreadCount: number;
  }> => {
    try {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 共通のWHERE句を取得 (タスク条件を含む)
      const commonWhereClause = await buildCommonNotificationWhereClause(userId, true);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // オフセットを計算
      const offset = (page - 1) * limit;

      // メインクエリ用のWHERE句 (共通句をそのまま使用)
      const mainWhereClause = commonWhereClause;

      // JSONB演算子を使用して直接DBレベルで既読状態を計算
      const notificationsRaw = await prisma.$queryRaw`
        SELECT
          n.id,
          n.title,
          n.message,
          n."target_type" as "NotificationTargetType",
          CASE
            WHEN n."is_read" ? ${userId} AND (n."is_read" -> ${userId} ->> 'isRead')::boolean = TRUE
            THEN true
            ELSE false
          END as "isRead",
          n."sent_at" as "sentAt",
          CASE
            WHEN n."is_read" ? ${userId} THEN (n."is_read" -> ${userId} ->> 'readAt')::timestamp
            ELSE null
          END as "readAt",
          n."expires_at" as "expiresAt",
          n."action_url" as "actionUrl",
          n."sender_user_id" as "senderUserId",
          n."group_id" as "groupId",
          n."task_id" as "taskId",
          n."auction_event_type" as "auctionEventType",
          n."auction_id" as "auctionId",
          u.name as "userName",
          g.name as "groupName",
          t.task as "taskName"
        FROM "Notification" n
        LEFT JOIN "User" u ON n."sender_user_id" = u.id
        LEFT JOIN "Group" g ON n."group_id" = g.id
        LEFT JOIN "Task" t ON n."task_id" = t.id
        WHERE ${mainWhereClause} -- メインクエリ用WHERE句
        ORDER BY n."sent_at" DESC, n.id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 通知データを変換する
      const notifications = Array.isArray(notificationsRaw)
        ? await Promise.all(
            notificationsRaw.map(
              async (n: {
                id: string;
                title: string | null;
                message: string | null;
                NotificationTargetType: "SYSTEM" | "USER" | "GROUP" | "TASK";
                isRead: boolean;
                sentAt: string | Date | null;
                readAt: string | Date | null;
                expiresAt: string | Date | null;
                actionUrl: string | null;
                senderUserId: string | null;
                groupId: string | null;
                taskId: string | null;
                auctionEventType: string | null;
                auctionId: string | null;
                userName: string | null;
                groupName: string | null;
                taskName: string | null;
              }): Promise<NotificationData> => ({
                id: n.id,
                title: n.title ?? "",
                message: n.message ?? "",
                NotificationTargetType: n.NotificationTargetType,
                isRead: n.isRead === true,
                sentAt: (await formatDateToISOString(n.sentAt, true)) ?? "",
                readAt: (await formatDateToISOString(n.readAt, false)) ?? "",
                expiresAt: (await formatDateToISOString(n.expiresAt, false)) ?? "",
                actionUrl: n.actionUrl ?? null,
                senderUserId: n.senderUserId ?? null,
                groupId: n.groupId ?? null,
                taskId: n.taskId ?? null,
                auctionEventType: n.auctionEventType ?? null,
                auctionId: n.auctionId ?? null,
                userName: n.userName ?? null,
                groupName: n.groupName ?? null,
                taskName: n.taskName ?? null,
              }),
            ),
          )
        : [];

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 未読カウント取得用のWHERE句 (共通句に未読条件を追加)
      const isReadCondition = Prisma.sql`(NOT (n."is_read" ? ${userId} AND (n."is_read" -> ${userId} ->> 'isRead')::boolean = TRUE))`;
      const unreadWhereClause = Prisma.sql`${commonWhereClause} AND ${isReadCondition}`;

      const unreadCountResult = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "Notification" n
        WHERE ${unreadWhereClause} -- 未読カウント用WHERE句
      `;
      const unreadCount = Number(unreadCountResult[0]?.count ?? 0);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 合計数取得用のWHERE句 (メインクエリと同じ = 共通句)
      const totalWhereClause = mainWhereClause; // 同じ条件なので再利用

      const totalCountResult = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "Notification" n
        WHERE ${totalWhereClause} -- 合計カウント用WHERE句
      `;
      const totalCount = Number(totalCountResult[0]?.count ?? 0);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
