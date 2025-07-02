"use cache";

import type { AuctionEventType, NotificationTargetType } from "@prisma/client";
import { cache } from "react";
import { unstable_cacheTag as cacheTag } from "next/cache";
import { buildCommonNotificationWhereClause } from "@/actions/notification/notification-utilities";
import { useCacheKeys } from "@/library-setting/nextjs-use-cache";
import { prisma } from "@/library-setting/prisma";
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
 * 通知とその未読数を取得する関数の戻り値の型
 */
export type NotificationAndUnreadCount = {
  notifications: NotificationData[];
  totalCount: number;
  unreadCount: number;
  readCount: number;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知とその未読数を取得する - ページング改善版
 * @param page ページ番号
 * @param limit 1ページあたりの表示件数
 * @returns 通知リストと未読数
 */
export const cachedGetNotificationsAndUnreadCount = cache(
  async (userId: string, page = 1, limit = 20): Promise<NotificationAndUnreadCount> => {
    cacheTag(useCacheKeys.notification.notificationByUserId(userId).join(":"));
    try {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * パラメータチェック
       */
      if (
        !userId ||
        !page ||
        typeof page !== "number" ||
        page < 1 ||
        !limit ||
        typeof limit !== "number" ||
        limit < 1
      ) {
        throw new Error("Invalid parameters");
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 共通のWHERE句を取得 (タスク条件を含む)
       */
      const commonWhereClause = await buildCommonNotificationWhereClause(userId, true);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * orderBy , where条件を作成する
       */
      // 各カテゴリのオフセットを計算
      const offset = (page - 1) * limit;

      // 未読フィルター条件。NOTをつけているので、ユーザーIDが存在しているかつ、isReadがTRUEである場合は除外する
      const unreadFilterCondition = Prisma.sql`AND (NOT (n."is_read" ? ${userId} AND (n."is_read" -> ${userId} ->> 'isRead')::boolean = TRUE))`;

      // 既読フィルター条件。ユーザーIDが存在しているかつ、isReadがTRUEである場合は取得する
      const readFilterCondition = Prisma.sql`AND (n."is_read" ? ${userId} AND (n."is_read" -> ${userId} ->> 'isRead')::boolean = TRUE)`;

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 通知リストを取得するSQLを作成
       */
      const allRawNotificationsFromDb: RawNotificationFromDB[] = [];

      for (const filterCondition of [unreadFilterCondition, readFilterCondition]) {
        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

        /**
         * メモ
         * sender_user_idは、通知の受信者ではなく、通知の送信者を取得して、それを通知に表示する
         */
        const notificationsQuery = Prisma.sql`
          SELECT
            n.id,
            n.title,
            n.message,
            n."target_type" as "NotificationTargetType",
            CASE -- isRead を動的に設定
              WHEN n."is_read" ? ${userId} AND (n."is_read" -> ${userId} ->> 'isRead')::boolean = TRUE
              THEN TRUE
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
          WHERE ${commonWhereClause} ${filterCondition}
          ORDER BY n."sent_at" DESC, n.id DESC
          LIMIT ${limit} OFFSET ${offset}
      `;

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

        /**
         * 通知を取得
         * 未読と既読の通知を結合して取得し、最終ソート
         */
        const currentBatch = await prisma.$queryRaw<RawNotificationFromDB[]>(notificationsQuery);
        if (Array.isArray(currentBatch)) {
          allRawNotificationsFromDb.push(...currentBatch);
        }
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 通知データを整形し、重複を除去する
       */
      // 重複除去のためのMapを使用（IDをキーとして使用）
      const uniqueNotificationsMap = new Map<string, NotificationData>();

      for (const n of allRawNotificationsFromDb) {
        const notificationData: NotificationData = {
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
        };

        // 重複チェック：同じIDが存在しない場合のみ追加
        if (!uniqueNotificationsMap.has(n.id)) {
          uniqueNotificationsMap.set(n.id, notificationData);
        }
      }

      // MapからArrayに変換し、送信日時順でソート
      const notifications: NotificationData[] = Array.from(uniqueNotificationsMap.values()).sort((a, b) => {
        const dateA = a.sentAt?.getTime() ?? 0;
        const dateB = b.sentAt?.getTime() ?? 0;
        return dateB - dateA; // 降順（新しい順）
      });

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 通知カウント取得する条件を作成
       */
      const isUnreadCondition = Prisma.sql`(NOT (n."is_read" ? ${userId} AND (n."is_read" -> ${userId} ->> 'isRead')::boolean = TRUE))`;
      const unreadWhereClause = Prisma.sql`${commonWhereClause} AND ${isUnreadCondition}`;

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 未読通知カウントを取得
       */
      const unreadCountResult = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "Notification" n
        WHERE ${unreadWhereClause}
      `;
      const unreadCount = Number(unreadCountResult[0]?.count ?? 0);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 通知全体の件数を取得
       */
      const allNotificationsTotalCountResult = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "Notification" n
        WHERE ${commonWhereClause}
      `;
      const allNotificationsTotalCount = Number(allNotificationsTotalCountResult[0]?.count ?? 0);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 全体の既読数を計算
       */
      const readCount = allNotificationsTotalCount - unreadCount;

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 通知リストとその未読数を返す
       */
      return {
        notifications, // 通知リスト
        totalCount: allNotificationsTotalCount, // これはフィルター条件に応じた総件数
        unreadCount, // これは全体の未読件数
        readCount, // これは全体の既読件数
      };

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * エラーが発生した場合
       */
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
