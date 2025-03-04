"use server";

import type { NotificationType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NotificationTargetType, Prisma } from "@prisma/client";

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
};

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
    const groupIds = userGroupList.map((g) => g.groupId);

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
          (n."targetType" = 'SYSTEM') OR
          (n."targetType" = 'USER' AND n."userId" = ${userId}) OR
          (n."targetType" = 'GROUP' AND n."groupId" = ANY(${groupIds}))
        )
        AND
        (
          NOT (n."isRead" ? ${userId})
          OR
          (n."isRead" -> ${userId} ->> 'isRead')::boolean IS NOT TRUE
        )
    `;

    // bigintを安全にnumberに変換
    const unreadCount = countResult && countResult[0] ? Number(countResult[0].count) : 0;

    return unreadCount;
  } catch (error) {
    console.error("未読通知カウントエラー:", error);
    return 0; // エラー時は0を返す
  }
}

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
    const skip = (page - 1) * limit;

    // アクセス可能なグループIDを取得
    const userGroupList = await prisma.groupMembership.findMany({
      where: { userId },
      select: { groupId: true },
    });
    const groupIds = userGroupList.map((g) => g.groupId);

    // 空のグループリストの場合の処理
    if (groupIds.length === 0) {
      groupIds.push("00000000-0000-0000-0000-000000000000"); // 存在しないダミーID
    }

    // クライアントから指定されたIDを除外するためのパラメータを追加
    const excludeIds = new Set<string>();

    // ページ番号が2以上の場合は、前回取得した通知IDを除外リストに追加
    if (page > 1) {
      // 前のページの通知を取得して除外リストに追加
      const previousNotifications = await prisma.$queryRaw`
        SELECT n.id
        FROM "Notification" n
        WHERE 
          (n."targetType" = 'SYSTEM') OR
          (n."targetType" = 'USER' AND n."userId" = ${userId}) OR
          (n."targetType" = 'GROUP' AND n."groupId" = ANY(${groupIds}))
        ORDER BY n."sentAt" DESC
        LIMIT ${(page - 1) * limit}
      `;

      if (Array.isArray(previousNotifications)) {
        previousNotifications.forEach((n: any) => excludeIds.add(n.id));
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
        n."targetType" as "targetType", 
        n.priority,
        n."sentAt" as "sentAt", 
        n."expiresAt" as "expiresAt", 
        n."actionUrl" as "actionUrl", 
        n."userId" as "userId", 
        n."groupId" as "groupId", 
        n."taskId" as "taskId",
        CASE 
          WHEN n."isRead" ? ${userId} AND (n."isRead" -> ${userId} ->> 'isRead')::boolean = TRUE 
          THEN TRUE 
          ELSE FALSE 
        END as "isRead",
        CASE 
          WHEN n."isRead" ? ${userId} THEN (n."isRead" -> ${userId} ->> 'readAt')::timestamp 
          ELSE NULL 
        END as "readAt"
      FROM "Notification" n
      WHERE 
        (
          (n."targetType" = 'SYSTEM') OR
          (n."targetType" = 'USER' AND n."userId" = ${userId}) OR
          (n."targetType" = 'GROUP' AND n."groupId" = ANY(${groupIds}))
        )
        ${excludeIds.size > 0 ? Prisma.sql`AND n.id NOT IN (${Prisma.join(Array.from(excludeIds))})` : Prisma.empty}
      ORDER BY n."sentAt" DESC
      LIMIT ${limit}
    `;

    // 以下のコードは変更なし
    const notifications = Array.isArray(notificationsRaw)
      ? notificationsRaw.map((n) => ({
          id: n.id,
          title: n.title || "",
          message: n.message || "",
          NotificationType: n.type,
          NotificationTargetType: n.targetType,
          isRead: n.isRead === true,
          priority: Number(n.priority) || 1.0,
          sentAt: n.sentAt ? new Date(n.sentAt).toISOString() : new Date().toISOString(),
          readAt: n.readAt ? new Date(n.readAt).toISOString() : null,
          expiresAt: n.expiresAt ? new Date(n.expiresAt).toISOString() : null,
          actionUrl: n.actionUrl || null,
          userId: n.userId || null,
          groupId: n.groupId || null,
          taskId: n.taskId || null,
        }))
      : [];

    // 未読カウント取得
    const unreadCountResult = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM "Notification" n
      WHERE 
        (
          (n."targetType" = 'SYSTEM') OR
          (n."targetType" = 'USER' AND n."userId" = ${userId}) OR
          (n."targetType" = 'GROUP' AND n."groupId" = ANY(${groupIds}))
        )
        AND
        (
          NOT (n."isRead" ? ${userId})
          OR
          (n."isRead" -> ${userId} ->> 'isRead')::boolean IS NOT TRUE
        )
    `;

    const unreadCount = Number(unreadCountResult[0]?.count || 0);

    // 合計数取得
    const totalCountResult = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM "Notification" n
      WHERE 
        (n."targetType" = 'SYSTEM') OR
        (n."targetType" = 'USER' AND n."userId" = ${userId}) OR
        (n."targetType" = 'GROUP' AND n."groupId" = ANY(${groupIds}))
    `;

    const totalCount = Number(totalCountResult[0]?.count || 0);

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

/**
 * 指定された通知の既読状態を更新する - JSONB最適化版
 * @param notificationId 通知ID
 * @param isRead 既読状態
 * @returns 成功したかどうか
 */
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
        "isRead" || jsonb_build_object(${userId}, jsonb_build_object('isRead', true, 'readAt', ${readAt}))
      WHERE 
        (
          ("targetType" = 'SYSTEM') OR
          ("targetType" = 'USER' AND "userId" = ${userId}) OR
          ("targetType" = 'GROUP' AND "groupId" = ANY(${groupIds}))
        )
        AND
        (
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
