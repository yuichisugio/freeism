"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { type CreateNotificationFormData } from "@/lib/zod-schema";
import { NotificationSendTiming, Prisma } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * フロントエンド用の通知データ型定義
 */
export type NotificationData = {
  id: string;
  title: string;
  message: string;
  NotificationType: "INFO" | "SUCCESS" | "WARNING";
  NotificationTargetType: "SYSTEM" | "USER" | "GROUP" | "TASK";
  isRead: boolean;
  priority: number;
  sentAt: Date;
  readAt: Date | null;
  expiresAt: Date | null;
  actionUrl: string | null;
  userId: string;
  groupId: string | null;
  taskId: string | null;
  userName: string | null;
  groupName: string | null;
  taskName: string | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知対象のユーザーIDリストを取得する関数
 * @param {string} targetType 通知対象タイプ
 * @param {object} options オプション（userId, groupId, taskId）
 * @returns {string[]} ユーザーIDの配列
 */
export async function getNotificationTargetUserIds(
  targetType: "SYSTEM" | "USER" | "GROUP" | "TASK",
  options: {
    userId?: string;
    groupId?: string;
    taskId?: string;
  },
): Promise<string[]> {
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
      if (!options.userId) {
        throw new Error("ユーザーIDが指定されていません");
      }
      targetUserIds = [options.userId];
      break;

    case "GROUP":
      // グループ向け通知の場合
      if (!options.groupId) {
        throw new Error("グループIDが指定されていません");
      }

      // グループメンバー全員を対象に
      const groupMembers = await prisma.groupMembership.findMany({
        where: { groupId: options.groupId },
        select: { userId: true },
      });
      targetUserIds = groupMembers.map((member) => member.userId);
      break;

    case "TASK":
      // タスク向け通知の場合
      if (!options.taskId) {
        throw new Error("タスクIDが指定されていません");
      }

      // タスクの作成者と報告者、実行者を対象に
      const task = await prisma.task.findUnique({
        where: { id: options.taskId },
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
 */
export async function getUnreadNotificationsCount() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new Error("認証が必要です");
    }

    const userId = session.user.id;

    // アクセス可能なグループIDを取得
    const userGroupList = await prisma.groupMembership.findMany({
      where: { userId },
      select: { groupId: true },
    });
    const groupIds = userGroupList.map((g) => g.groupId).filter(Boolean);

    // 空のグループリストの場合の処理
    if (groupIds.length === 0) {
      groupIds.push("00000000-0000-0000-0000-000000000000"); // 存在しないダミーID
    }

    // PostgreSQLのJSONB演算子を使用した効率的なクエリ
    const countResult = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM "Notification" n
      WHERE
        (
          (n."target_type" = 'SYSTEM') OR
          (n."target_type" = 'USER' AND n."user_id" = ${userId}) OR
          (n."target_type" = 'GROUP' AND n."group_id" = ANY(${groupIds}))
        )
        AND
        (
          (n."send_timing_type" = 'NOW') OR
          (n."send_timing_type" = 'SCHEDULED' AND n."send_scheduled_date" < NOW())
        )
        AND
        (
          n."isRead" IS NULL
          OR
          NOT (n."isRead" ? ${userId})
          OR
          (n."isRead" -> ${userId} ->> 'isRead')::boolean IS NOT TRUE
        )
    `;

    // bigintを安全にnumberに変換
    const unreadCount = countResult?.[0] ? Number(countResult[0].count) : 0;

    return unreadCount;
  } catch (error) {
    console.error("未読通知カウントエラー:", error);
    return 0; // エラー時は0を返す
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知とその未読数を取得する - ページング改善版
 * @param page ページ番号
 * @param limit 1ページあたりの表示件数
 * @returns 通知リストと未読数
 */
export async function getNotificationsAndUnreadCount(page = 1, limit = 20) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("認証が必要です");
    }
    const userId = session.user.id;

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

    // 取得したGroupに紐づくタスクを取得
    const taskList = await prisma.task.findMany({
      where: {
        groupId: { in: groupIds },
      },
      select: { id: true },
    });

    // タスクIDを配列に格納
    const taskIds = taskList.map((t) => t.id).filter(Boolean);

    // クライアントから指定されたIDを除外するためのパラメータを追加
    const excludeIds = new Set<string>();

    // ページ番号が2以上の場合は、前回取得した通知IDを除外リストに追加
    if (page > 1) {
      // 前のページの通知を取得して除外リストに追加
      const previousNotifications = await prisma.$queryRaw`
        SELECT n.id
        FROM "Notification" n
        WHERE
          (
            (n."target_type" = 'SYSTEM') OR
            (n."target_type" = 'USER' AND n."user_id" = ${userId}) OR
            (n."target_type" = 'GROUP' AND n."group_id" = ANY(${groupIds})) OR
            (n."target_type" = 'TASK' AND n."task_id" = ANY(${taskIds}))
          )
          AND
          (
            (n."send_timing_type" = 'NOW') OR
            (n."send_timing_type" = 'SCHEDULED' AND n."send_scheduled_date" < NOW())
          )
        ORDER BY n."sent_at" DESC
        LIMIT ${(page - 1) * limit}
      `;

      if (Array.isArray(previousNotifications)) {
        previousNotifications.forEach((n: { id: string }) => excludeIds.add(n.id));
      }
    }

    // JSONB演算子を使用して直接DBレベルで既読状態を計算
    // 修正：SQL関数をPrisma.sql関数に置き換え
    const notificationsRaw = await prisma.$queryRaw`
      SELECT
        n.id,
        n.title,
        n.message,
        n.type as "type",
        n."target_type" as "target_type",
        n."task_id" as "task_id",
        n.priority,
        n."sent_at" as "sent_at",
        n."expires_at" as "expires_at",
        n."action_url" as "action_url",
        n."user_id" as "user_id",
        n."group_id" as "group_id",
        n."task_id" as "task_id",
        CASE
          WHEN n."isRead" ? ${userId} AND (n."isRead" -> ${userId} ->> 'isRead')::boolean = TRUE
          THEN TRUE
          ELSE FALSE
        END as "isRead",
        CASE
          WHEN n."isRead" ? ${userId} THEN (n."isRead" -> ${userId} ->> 'readAt')::timestamp 
          ELSE NULL 
        END as "readAt",
        u.name as "userName",
        g.name as "groupName",
        t.task as "taskName"
      FROM "Notification" n
      LEFT JOIN "User" u ON n."user_id" = u.id
      LEFT JOIN "Group" g ON n."group_id" = g.id
      LEFT JOIN "Task" t ON n."task_id" = t.id
      WHERE 
        (
          (n."target_type" = 'SYSTEM') OR
          (n."target_type" = 'USER' AND n."user_id" = ${userId}) OR
          (n."target_type" = 'GROUP' AND n."group_id" = ANY(${groupIds})) OR
          (n."target_type" = 'TASK' AND n."task_id" = ANY(${taskIds}))
        )
        AND
        (
          (n."send_timing_type" = 'NOW') OR
          (n."send_timing_type" = 'SCHEDULED' AND n."send_scheduled_date" < NOW())
        )
        ${excludeIds.size > 0 ? Prisma.sql`AND n.id NOT IN (${Prisma.join(Array.from(excludeIds))})` : Prisma.sql``}
      ORDER BY n."sent_at" DESC
      LIMIT ${page * limit}
    `;
    // 上記で、limitのみになっていたので修正した

    // 以下のコードは変更なし
    const notifications = Array.isArray(notificationsRaw)
      ? notificationsRaw.map(
          (n: {
            id: string;
            title: string | null;
            message: string | null;
            type: "INFO" | "SUCCESS" | "WARNING";
            targetType: "SYSTEM" | "USER" | "GROUP" | "TASK";
            isRead: boolean;
            priority: number | string;
            sentAt: string | Date | null;
            readAt: string | Date | null;
            expiresAt: string | Date | null;
            actionUrl: string | null;
            userId: string | null;
            groupId: string | null;
            taskId: string | null;
            userName: string | null;
            groupName: string | null;
            taskName: string | null;
          }) => ({
            id: n.id,
            title: n.title ?? "",
            message: n.message ?? "",
            NotificationType: n.type,
            NotificationTargetType: n.targetType,
            isRead: n.isRead === true,
            priority: Number(n.priority) ?? 1.0,
            sentAt: n.sentAt ? new Date(n.sentAt).toISOString() : new Date().toISOString(),
            readAt: n.readAt ? new Date(n.readAt).toISOString() : null,
            expiresAt: n.expiresAt ? new Date(n.expiresAt).toISOString() : null,
            actionUrl: n.actionUrl ?? null,
            userId: n.userId ?? null,
            groupId: n.groupId ?? null,
            taskId: n.taskId ?? null,
            userName: n.userName ?? null,
            groupName: n.groupName ?? null,
            taskName: n.taskName ?? null,
          }),
        )
      : [];

    // 未読カウント取得
    const unreadCountResult = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM "Notification" n
      WHERE
        (
          (n."target_type" = 'SYSTEM') OR
          (n."target_type" = 'USER' AND n."user_id" = ${userId}) OR
          (n."target_type" = 'GROUP' AND n."group_id" = ANY(${groupIds})) OR
          (n."target_type" = 'TASK' AND n."task_id" = ANY(${taskIds}))
        )
        AND
        (
          (n."send_timing_type" = 'NOW') OR
          (n."send_timing_type" = 'SCHEDULED' AND n."send_scheduled_date" < NOW())
        )
        AND
        (
          n."isRead" IS NULL
          OR
          NOT (n."isRead" ? ${userId})
          OR
          (n."isRead" -> ${userId} ->> 'isRead')::boolean IS NOT TRUE
        )
    `;

    const unreadCount = Number(unreadCountResult[0]?.count ?? 0);

    // 合計数取得
    const totalCountResult = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM "Notification" n
      WHERE
        (
          (n."target_type" = 'SYSTEM') OR
          (n."target_type" = 'USER' AND n."user_id" = ${userId}) OR
          (n."target_type" = 'GROUP' AND n."group_id" = ANY(${groupIds})) OR
          (n."target_type" = 'TASK' AND n."task_id" = ANY(${taskIds}))
        )
        AND
        (
          (n."send_timing_type" = 'NOW') OR
          (n."send_timing_type" = 'SCHEDULED' AND n."send_scheduled_date" < NOW())
        )
    `;

    const totalCount = Number(totalCountResult[0]?.count ?? 0);

    return {
      notifications,
      totalCount,
      unreadCount,
    };
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
export async function apiUpdateNotificationStatus(notificationId: string, isRead: boolean) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new Error("認証が必要です");
    }

    const userId = session.user.id;

    // 未読の場合はreadAtをnullではなく明示的にNULLとして扱うために条件分岐
    if (isRead) {
      // 既読にする場合
      const readAt = new Date().toISOString();
      await prisma.$executeRaw`
        UPDATE "Notification"
        SET "isRead" = "isRead" || jsonb_build_object(${userId}, jsonb_build_object('isRead', true, 'readAt', ${readAt}))
        WHERE id = ${notificationId}
      `;
    } else {
      // 未読にする場合 - readAtはnullではなくプロパティそのものを設定しない
      await prisma.$executeRaw`
        UPDATE "Notification"
        SET "isRead" = "isRead" || jsonb_build_object(${userId}, jsonb_build_object('isRead', false))
        WHERE id = ${notificationId}
      `;
    }

    revalidatePath("/notifications");
    return { success: true };
  } catch (error) {
    console.error("通知状態更新エラー:", error);
    return {
      success: false,
      error: "通知の更新中にエラーが発生しました。",
    };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * すべての通知を既読にする - JSONB最適化版
 * @returns 成功したかどうか
 */
export async function markAllNotificationsAsRead() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new Error("認証が必要です");
    }

    const userId = session.user.id;
    const readAt = new Date().toISOString();

    // ユーザーがアクセス可能なグループを取得
    const userGroupList = await prisma.groupMembership.findMany({
      where: { userId },
      select: { groupId: true },
    });
    const groupIds = userGroupList.map((g) => g.groupId);

    // 空のグループリストの場合の処理
    if (groupIds.length === 0) {
      groupIds.push("00000000-0000-0000-0000-000000000000"); // 存在しないダミーID
    }

    // 一括でJSONB更新をSQLレベルで実行
    await prisma.$executeRaw`
      UPDATE "Notification"
      SET "isRead" = 
        COALESCE("isRead", '{}'::jsonb) || jsonb_build_object(${userId}, jsonb_build_object('isRead', true, 'readAt', ${readAt}))
      WHERE 
        (
          ("target_type" = 'SYSTEM') OR
          ("target_type" = 'USER' AND "user_id" = ${userId}) OR
          ("target_type" = 'GROUP' AND "group_id" = ANY(${groupIds}))
        )
        AND
        (
          "isRead" IS NULL
          OR
          NOT ("isRead" ? ${userId})
          OR
          ("isRead" -> ${userId} ->> 'isRead')::boolean IS NOT TRUE
        )
    `;

    revalidatePath("/notifications");
    return { success: true };
  } catch (error) {
    console.error("全通知既読化エラー:", error);
    return {
      success: false,
      error: "通知の一括既読化に失敗しました。",
    };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知を作成する関数
 * @param {CreateNotificationFormData} data 通知データ
 * @param {boolean} isAppOwner アプリオーナーかどうか
 * @param {boolean} isGroupOwner グループオーナーかどうか
 * @returns {success: boolean, notificationId: string, targetUserIds: string[]} 成功したかどうか
 */
export async function createNotification(data: CreateNotificationFormData, isAppOwner: boolean, isGroupOwner: boolean) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return { error: "認証が必要です" };
    }

    // アプリオーナーかグループオーナーでなければエラー
    if (!isAppOwner && !isGroupOwner) {
      return { error: "通知を作成する権限がありません" };
    }

    // グループオーナーのみの場合、SYSTEM/USERは作成不可
    if (!isAppOwner && (data.targetType === "SYSTEM" || data.targetType === "USER")) {
      return { error: "この通知タイプを作成する権限がありません" };
    }

    // 共通関数を使用してターゲットユーザーIDを取得
    try {
      const targetUserIds = await getNotificationTargetUserIds(data.targetType, {
        userId: data.userId ?? undefined,
        groupId: data.groupId ?? undefined,
        taskId: data.taskId ?? undefined,
      });

      if (targetUserIds.length === 0) {
        return { error: "通知の対象者が見つかりません" };
      }

      // isReadのJSONオブジェクトを構築
      const isReadJsonb: Record<string, { isRead: boolean; readAt: null }> = {};
      targetUserIds.forEach((targetUserId) => {
        isReadJsonb[targetUserId] = { isRead: false, readAt: null };
      });

      // 通知を保存
      const notification = await prisma.notification.create({
        data: {
          title: data.title,
          message: data.message,
          type: data.type,
          targetType: data.targetType,
          sendTimingType: data.sendTiming === "SCHEDULED" ? NotificationSendTiming.SCHEDULED : NotificationSendTiming.NOW,
          sendScheduledDate: data.sendTiming === "SCHEDULED" ? data.sendScheduledDate : null,
          sentAt: data.sendTiming === "NOW" ? new Date() : null, // 即時送信の場合は現在時刻、予約送信の場合はnull
          priority: data.priority,
          expiresAt: data.expiresAt ?? undefined,
          actionUrl: data.actionUrl ?? undefined,
          userId: session.user.id, // 通知作成者
          groupId: data.targetType === "GROUP" ? data.groupId : null,
          taskId: data.targetType === "TASK" ? data.taskId : null,
          // isReadはPrismaが自動的にJSONB型に変換
          isRead: isReadJsonb,
        },
      });

      revalidatePath("/dashboard/notifications");

      return {
        success: true,
        notificationId: notification.id,
        targetUserIds,
      };
    } catch (error) {
      console.error("ターゲットユーザー取得エラー:", error);
      if (error instanceof Error) {
        return { error: error.message };
      }
      return { error: "ターゲットユーザーの取得に失敗しました" };
    }
  } catch (error) {
    console.error("通知作成エラー:", error);
    return { error: "通知の作成中にエラーが発生しました" };
  }
}
