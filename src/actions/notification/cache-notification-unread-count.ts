"use cache";

import type { AuctionEventType, NotificationTargetType } from "@prisma/client";
import { cache } from "react";
import { unstable_cacheTag as cacheTag } from "next/cache";
import { buildCommonNotificationWhereClause } from "@/actions/notification/notification-utilities";
import { useCacheKeys } from "@/library-setting/nextjs-use-cache";
import { prisma } from "@/library-setting/prisma";
import { type PromiseResult } from "@/types/general-types";
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
 * 未読通知の有無を取得する
 * @param userId ユーザーID
 * @returns 未読通知の有無
 */
export const cachedGetUnreadNotificationsCount = cache(async (userId: string): PromiseResult<boolean> => {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュタグを設定
   */
  cacheTag(useCacheKeys.notification.notificationByUserId(userId).join(":"));

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーIDが存在しない場合はエラーを返す
   */
  if (!userId) {
    throw new Error("userId is required");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 共通のWHERE句を取得 (タスク条件を含む)
   */
  const commonWhereClause = await buildCommonNotificationWhereClause(userId, true);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 未読条件を追加
   */
  const isReadCondition = Prisma.sql`(NOT (n."is_read" ? ${userId} AND (n."is_read" -> ${userId} ->> 'isRead')::boolean = TRUE))`;
  const whereClause = Prisma.sql`${commonWhereClause} AND ${isReadCondition}`;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * PostgreSQLのJSONB演算子を使用した効率的なクエリ
   */
  const countResult = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM "Notification" n
      WHERE ${whereClause} -- 結合したWHERE句を使用
      LIMIT 1
    `;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 未読通知があるかどうかを返す
   */
  return {
    success: true,
    message: "未読通知カウントを取得しました",
    data: countResult.length > 0,
  };
});
