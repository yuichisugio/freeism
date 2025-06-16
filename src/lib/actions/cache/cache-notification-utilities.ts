"use cache";

import type { AuctionEventType, NotificationTargetType } from "@prisma/client";
import { cache } from "react";
import { unstable_cacheTag as cacheTag } from "next/cache";
import { buildCommonNotificationWhereClause } from "@/lib/actions/notification/notification-utilities";
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
  sentAt: Date | null;
  readAt: Date | null;
  expiresAt: Date | null;
  actionUrl: string | null;
  senderUserId: string | null;
  groupId: string | null;
  taskId: string | null;
  userName: string | null;
  groupName: string | null;
  taskName: string | null;
  auctionEventType: AuctionEventType | null;
  auctionId: string | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * データベースからの生の通知データ型
 */
export type RawNotificationFromDB = {
  id: string;
  title: string | null;
  message: string | null;
  NotificationTargetType: NotificationTargetType; // from @prisma/client
  isRead: boolean;
  sentAt: Date | null;
  readAt: Date | null;
  expiresAt: Date | null;
  actionUrl: string | null;
  senderUserId: string | null;
  groupId: string | null;
  taskId: string | null;
  auctionEventType: string | null;
  auctionId: string | null;
  userName: string | null;
  groupName: string | null;
  taskName: string | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
/**
 * 未読通知の数を取得する - JSONB最適化版
 * @returns 未読通知の数
 * 未読の有無のみ知りたいので、1件のみ取得
 */
export const cachedGetUnreadNotificationsCount = cache(async (userId: string): Promise<boolean> => {
  cacheTag(`Notification:${userId}`);
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 共通のWHERE句を取得 (タスク条件を含む)
    const commonWhereClause = await buildCommonNotificationWhereClause(userId, true);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 未読条件を追加
    const isReadCondition = Prisma.sql`(NOT (n."is_read" ? ${userId} AND (n."is_read" -> ${userId} ->> 'isRead')::boolean = TRUE))`;
    const whereClause = Prisma.sql`${commonWhereClause} AND ${isReadCondition}`;

    // PostgreSQLのJSONB演算子を使用した効率的なクエリ
    const countResult = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM "Notification" n
      WHERE ${whereClause} -- 結合したWHERE句を使用
      LIMIT 1
    `;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 未読通知があるかどうかを返す
    return countResult.length > 0;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("未読通知カウントエラー:", error);
    return false;
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
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{
    notifications: NotificationData[];
    totalCount: number;
    unreadCount: number;
    readCount: number;
  }> => {
    cacheTag(`Notification:${userId}`);
    try {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 共通のWHERE句を取得 (タスク条件を含む)
      const commonWhereClause = await buildCommonNotificationWhereClause(userId, true);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 各カテゴリのオフセットを計算
      const offset = (page - 1) * limit;

      // フィルター条件に応じたWHERE句の追加部分
      const unreadFilterCondition = Prisma.sql`AND (NOT (n."is_read" ? ${userId} AND (n."is_read" -> ${userId} ->> 'isRead')::boolean = TRUE))`;
      const readFilterCondition = Prisma.sql`AND (n."is_read" ? ${userId} AND (n."is_read" -> ${userId} ->> 'isRead')::boolean = TRUE)`;

      const allRawNotificationsFromDb: RawNotificationFromDB[] = [];

      for (const filterCondition of [unreadFilterCondition, readFilterCondition]) {
        // 通知取得クエリパート
        const notificationsQuery = Prisma.sql`
        SELECT
          n.id,
          n.title,
          n.message,
          n."target_type" as "NotificationTargetType",
          CASE -- isRead を動的に設定
            WHEN n."is_read" ? ${userId} AND (n."is_read" -> ${userId} ->> 'isRead')::boolean = TRUE THEN TRUE
            ELSE FALSE
          END as "isRead",
          n."sent_at" as "sentAt",
          CASE -- readAt を動的に設定
            WHEN n."is_read" ? ${userId} AND (n."is_read" -> ${userId} ->> 'isRead')::boolean = TRUE
            THEN (n."is_read" -> ${userId} ->> 'readAt')::timestamp
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
        WHERE ${commonWhereClause} ${filterCondition} -- filterCondition を適用
        ORDER BY n."sent_at" DESC, n.id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

        // 未読と既読の通知を結合して取得し、最終ソート
        const currentBatch = await prisma.$queryRaw<RawNotificationFromDB[]>(notificationsQuery);
        if (Array.isArray(currentBatch)) {
          allRawNotificationsFromDb.push(...currentBatch);
        }
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 通知データを変換する
      const uniqueRawNotifications = Array.isArray(allRawNotificationsFromDb)
        ? Array.from(new Map(allRawNotificationsFromDb.map((n) => [n.id, n])).values())
        : [];

      const notifications: NotificationData[] = uniqueRawNotifications.map(
        (n: RawNotificationFromDB): NotificationData => ({
          id: n.id,
          title: n.title ?? "",
          message: n.message ?? "",
          NotificationTargetType: n.NotificationTargetType,
          isRead: n.isRead,
          sentAt: n.sentAt ? new Date(n.sentAt) : null,
          readAt: n.readAt ? new Date(n.readAt) : null,
          expiresAt: n.expiresAt ? new Date(n.expiresAt) : null,
          actionUrl: n.actionUrl ?? null,
          senderUserId: n.senderUserId ?? null,
          groupId: n.groupId ?? null,
          taskId: n.taskId ?? null,
          auctionEventType: n.auctionEventType as AuctionEventType | null,
          auctionId: n.auctionId ?? null,
          userName: n.userName ?? null,
          groupName: n.groupName ?? null,
          taskName: n.taskName ?? null,
        }),
      );

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 通知カウント取得
       */
      const isUnreadCondition = Prisma.sql`(NOT (n."is_read" ? ${userId} AND (n."is_read" -> ${userId} ->> 'isRead')::boolean = TRUE))`;
      const unreadWhereClause = Prisma.sql`${commonWhereClause} AND ${isUnreadCondition}`;

      const unreadCountResult = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "Notification" n
        WHERE ${unreadWhereClause} -- 未読カウント用WHERE句
      `;
      const unreadCount = Number(unreadCountResult[0]?.count ?? 0);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const allNotificationsTotalCountResult = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "Notification" n
        WHERE ${commonWhereClause}
      `;
      const allNotificationsTotalCount = Number(allNotificationsTotalCountResult[0]?.count ?? 0);

      // 全体の既読数を計算
      const readCount = allNotificationsTotalCount - unreadCount;

      return {
        notifications,
        totalCount: allNotificationsTotalCount, // これはフィルター条件に応じた総件数
        unreadCount, // これは全体の未読件数
        readCount, // これは全体の既読件数
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
