"use server";

import type { NotificationTargetType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/utils";
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
  sentAt: string;
  readAt: string | null;
  expiresAt: string | null;
  actionUrl: string | null;
  senderUserId: string | null;
  groupId: string | null;
  taskId: string | null;
  userName: string | null;
  groupName: string | null;
  taskName: string | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 認証済みユーザーのIDを取得する共通関数
 * @returns ユーザーID
 * @throws 認証されていない場合はエラー
 */
async function getAuthenticatedUserId(): Promise<string> {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new Error("認証が必要です");
  }
  return session.user.id;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーがアクセス可能なグループIDを取得する共通関数
 * @param userId ユーザーID
 * @returns グループIDの配列
 */
async function getUserAccessibleGroupIds(userId: string): Promise<string[]> {
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
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループIDに紐づくタスクIDを取得する共通関数
 * @param groupIds グループIDの配列
 * @returns タスクIDの配列
 */
async function getTaskIdsByGroupIds(groupIds: string[]): Promise<string[]> {
  const taskList = await prisma.task.findMany({
    where: {
      groupId: { in: groupIds },
    },
    select: { id: true },
  });

  return taskList.map((t) => t.id).filter(Boolean);
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知クエリの共通条件を生成する関数
 * @param userId ユーザーID
 * @param groupIds グループIDの配列
 * @param taskIds タスクIDの配列 (オプション)
 * @returns Prisma.sqlでラップされたSQL条件文
 */
function buildNotificationWhereCondition(userId: string, groupIds: string[], taskIds?: string[]): Prisma.Sql {
  const taskCondition = taskIds && taskIds.length > 0 ? Prisma.sql`OR (n."target_type" = 'TASK' AND n."task_id" = ANY(${taskIds}))` : Prisma.sql``;

  return Prisma.sql`
    (
      (n."target_type" = 'SYSTEM') OR
      (n."target_type" = 'USER' AND n."sender_user_id" = ${userId}) OR
      (n."target_type" = 'GROUP' AND n."group_id" = ANY(${groupIds}))
      ${taskCondition}
    )
    AND
    (
      (n."send_timing_type" = 'NOW') OR
      (n."send_timing_type" = 'SCHEDULED' AND n."send_scheduled_date" < NOW())
    )
  `;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 日付またはnullをISOString形式に変換する関数
 * @param date 日付オブジェクトか文字列かnull
 * @param defaultNow デフォルト値として現在時刻を使うかどうか
 * @returns ISO文字列またはnull
 */
function formatDateToISOString(date: string | Date | null, defaultNow = false): string | null {
  if (!date && !defaultNow) return null;
  return date ? new Date(date).toISOString() : defaultNow ? new Date().toISOString() : null;
}

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
export async function getNotificationTargetUserIds(
  targetType: NotificationTargetType,
  params: {
    userIds?: string[];
    groupId?: string;
    taskId?: string;
  },
): Promise<string[]> {
  "use server"; // Server Actions としてマーク

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
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 未読通知の数を取得する - JSONB最適化版
 * @returns 未読通知の数
 */
export async function getUnreadNotificationsCount(): Promise<number> {
  console.log("src/lib/actions/notification/notification-utilities.ts_getUnreadNotificationsCount_start");
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 認証済みユーザーのIDを取得
    const userId = await getAuthenticatedUserId();

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // ユーザーがアクセスできるグループID一覧を取得
    const groupIds = await getUserAccessibleGroupIds(userId);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // グループに関連するタスクID一覧を取得
    const taskIds = await getTaskIdsByGroupIds(groupIds);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // PostgreSQLのJSONB演算子を使用した効率的なクエリ
    const countResult = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM "Notification" n
      WHERE (
        ${buildNotificationWhereCondition(userId, groupIds, taskIds)}
      )
      AND
      (
        n."is_read" IS NULL
        OR
        NOT (n."is_read" ? ${userId})
        OR
        (n."is_read" -> ${userId} ->> 'isRead')::boolean IS NOT TRUE
      )
    `;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    return Number(countResult[0].count);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("未読通知カウントエラー:", error);
    return 0;
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知とその未読数を取得する - ページング改善版
 * @param page ページ番号
 * @param limit 1ページあたりの表示件数
 * @returns 通知リストと未読数
 */
export async function getNotificationsAndUnreadCount(
  page = 1,
  limit = 20,
): Promise<{
  notifications: NotificationData[];
  totalCount: number;
  unreadCount: number;
}> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 認証済みユーザーのIDを取得
    const userId = await getAuthenticatedUserId();

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // ユーザーがアクセスできるグループID一覧を取得
    const groupIds = await getUserAccessibleGroupIds(userId);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // グループに関連するタスクID一覧を取得
    const taskIds = await getTaskIdsByGroupIds(groupIds);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // オフセットを計算
    const offset = (page - 1) * limit;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
        u.name as "userName",
        g.name as "groupName",
        t.task as "taskName"
      FROM "Notification" n
      LEFT JOIN "User" u ON n."sender_user_id" = u.id
      LEFT JOIN "Group" g ON n."group_id" = g.id
      LEFT JOIN "Task" t ON n."task_id" = t.id
      WHERE (
        ${buildNotificationWhereCondition(userId, groupIds, taskIds)}
      )
      ORDER BY n."sent_at" DESC, n.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 通知データを変換する
    const notifications = Array.isArray(notificationsRaw)
      ? notificationsRaw.map(
          (n: {
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
            userName: string | null;
            groupName: string | null;
            taskName: string | null;
          }): NotificationData => ({
            id: n.id,
            title: n.title ?? "",
            message: n.message ?? "",
            NotificationTargetType: n.NotificationTargetType,
            isRead: n.isRead === true,
            sentAt: formatDateToISOString(n.sentAt, true)!,
            readAt: formatDateToISOString(n.readAt, false),
            expiresAt: formatDateToISOString(n.expiresAt, false),
            actionUrl: n.actionUrl ?? null,
            senderUserId: n.senderUserId ?? null,
            groupId: n.groupId ?? null,
            taskId: n.taskId ?? null,
            userName: n.userName ?? null,
            groupName: n.groupName ?? null,
            taskName: n.taskName ?? null,
          }),
        )
      : [];

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 未読カウント取得
    const unreadCountResult = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM "Notification" n
      WHERE
        ${buildNotificationWhereCondition(userId, groupIds, taskIds)}
        AND
        (
          n."is_read" IS NULL
          OR
          NOT (n."is_read" ? ${userId})
          OR
          (n."is_read" -> ${userId} ->> 'isRead')::boolean IS NOT TRUE
        )
    `;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    const unreadCount = Number(unreadCountResult[0]?.count ?? 0);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 合計数取得
    const totalCountResult = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM "Notification" n
      WHERE
        ${buildNotificationWhereCondition(userId, groupIds, taskIds)}
    `;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 指定された通知の既読状態を更新する - JSONB最適化版
 * @param notificationId 通知ID
 * @param isRead 既読状態
 * @returns 成功したかどうか
 */
export async function apiUpdateNotificationStatus(notificationId: string, isRead: boolean): Promise<{ success: boolean }> {
  try {
    const userId = await getAuthenticatedUserId();

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

    revalidatePath("/dashboard/notifications");
    return { success: true };
  } catch (error) {
    console.error("通知状態更新エラー:", error);
    return {
      success: false,
    };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 全ての通知を既読にする関数
 * @returns 処理結果
 */
export async function markAllNotificationsAsRead(): Promise<{ success: boolean }> {
  try {
    const userId = await getAuthenticatedUserId();
    const groupIds = await getUserAccessibleGroupIds(userId);
    const readAt = new Date().toISOString();

    // 全ての通知を一括で既読に設定
    await prisma.$executeRaw`
      UPDATE "Notification"
      SET "is_read" = 
        COALESCE("is_read", '{}'::jsonb) || jsonb_build_object(${userId}, jsonb_build_object('isRead', true, 'readAt', ${readAt}))
      WHERE 
        ${buildNotificationWhereCondition(userId, groupIds)}
    `;

    // キャッシュを更新
    revalidatePath("/dashboard/notifications");

    return { success: true };
  } catch (error) {
    console.error("全通知既読マークエラー:", error);
    return { success: false };
  }
}
