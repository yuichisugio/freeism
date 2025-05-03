"use cache";

import type { NotificationTargetType } from "@prisma/client";
import { cache } from "react";
import { unstable_cacheTag as cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

import { buildCommonNotificationWhereClause, formatDateToISOString } from "./notification-utilities";

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
 * 未読通知の数を取得する - JSONB最適化版
 * @returns 未読通知の数
 * 未読の有無のみ知りたいので、1件のみ取得
 */
export const cachedGetUnreadNotificationsCount = cache(async (userId: string): Promise<string[]> => {
  cacheTag("notification");
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
    cacheTag("notification");
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
