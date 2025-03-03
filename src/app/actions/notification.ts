"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { type NotificationTargetType, type NotificationType, type Prisma } from "@prisma/client";

//通知の取得フィルタータイプ
export type NotificationFilter = "all" | "unread" | "read";

//通知のソートタイプ
export type NotificationSortType = "date" | "priority" | "type";

// 通知のUIタイプ
export type NotificationUIType = "info" | "success" | "warning";

// 通知型定義
export type NotificationData = {
  id: string;
  title: string;
  message: string;
  NotificationType: "INFO" | "SUCCESS" | "WARNING";
  NotificationTargetType: "SYSTEM" | "USER" | "GROUP" | "TASK";
  uiType?: NotificationUIType; // UI表示用のタイプ（オプション）
  isRead: boolean;
  priority: number;
  sentAt: Date;
  readAt: Date | null;
  expiresAt: Date | null;
  actionUrl: string | null; // 通知をクリックした時に遷移するURL
  userId: string;
  groupId: string | null;
  taskId: string | null;
};

/**
 * 未読通知の数のみを取得（軽量版）
 * @returns 未読通知の数
 */
export async function getUnreadNotificationsCount(take: number = 5) {
  try {
    console.log("getUnreadNotificationsCount");
    const session = await auth();

    if (!session?.user?.id) {
      throw new Error("認証が必要です");
    }

    // ユーザーが所属するグループのIDリストを取得
    const userGroupList = await prisma.groupMembership.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        groupId: true,
      },
    });
    const userGroupIds = userGroupList.map((group) => group.groupId);

    // ユーザーが担当するタスクのIDリストを取得
    const userTaskList = await prisma.task.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
      },
    });
    const userTaskIds = userTaskList.map((task) => task.id);

    // TargetTypeに基づいた条件を構築
    let targetTypeConditions = [
      // SYSTEM: すべてのユーザーに表示
      { targetType: "SYSTEM" as NotificationTargetType },

      // USER: 特定のユーザー向け
      {
        targetType: "USER" as NotificationTargetType,
        userId: session.user.id,
      },

      // GROUP: ユーザーが所属するグループ向け
      {
        targetType: "GROUP" as NotificationTargetType,
        groupId: { in: userGroupIds.length > 0 ? userGroupIds : [""] },
      },

      // TASK: ユーザーが担当するタスク向け
      {
        targetType: "TASK" as NotificationTargetType,
        taskId: { in: userTaskIds.length > 0 ? userTaskIds : [""] },
      },
    ];

    // 最終的なクエリ条件を構築
    const notificationWhere: Prisma.NotificationWhereInput = { OR: targetTypeConditions };

    // 通知の数を取得
    const unreadCount = await prisma.notification.count({
      where: notificationWhere,
      take: take,
    });

    return unreadCount;
  } catch (error) {
    console.error("未読通知カウントエラー:", error);
    throw error;
  }
}

/**
 * 現在のユーザーの通知を取得する
 * TergetTypeがSYSTEMの場合は、無条件で取得
 * TergetTypeがUSERの場合は、userIdが合致する通知を取得
 * TergetTypeがGROUPの場合は、userIdが所属するグループの通知を取得
 * TergetTypeがTASKの場合は、userIdがタスクの担当者の通知を取得
 * @param filter フィルタリング条件 ("all" | "unread" | "read")
 * @param limit 取得する通知の最大数
 * @param sortBy 並び順 ("date" | "priority" | "type")
 * @param skip スキップする通知の数（ページネーション用）
 * @returns 通知の配列と未読数
 */
export async function getNotificationsAndUnreadCount(
  filter: NotificationFilter = "all",
  limit: number = 10,
  sortBy: NotificationSortType = "date",
  skip: number = 0,
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new Error("認証が必要です");
    }

    // ユーザーが所属するグループのIDリストを取得
    const userGroupList = await prisma.groupMembership.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        groupId: true,
      },
    });
    const userGroupIds = userGroupList.map((group) => group.groupId);

    // ユーザーが担当するタスクのIDリストを取得
    const userTaskList = await prisma.task.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
      },
    });
    const userTaskIds = userTaskList.map((task) => task.id);

    // TargetTypeに基づいた条件を構築
    let targetTypeConditions = [
      // SYSTEM: すべてのユーザーに表示
      { targetType: "SYSTEM" as NotificationTargetType },

      // USER: 特定のユーザー向け
      {
        targetType: "USER" as NotificationTargetType,
        userId: session.user.id,
      },

      // GROUP: ユーザーが所属するグループ向け
      {
        targetType: "GROUP" as NotificationTargetType,
        groupId: { in: userGroupIds.length > 0 ? userGroupIds : [""] },
      },

      // TASK: ユーザーが担当するタスク向け
      {
        targetType: "TASK" as NotificationTargetType,
        taskId: { in: userTaskIds.length > 0 ? userTaskIds : [""] },
      },
    ];

    // 未読/既読フィルタリング条件
    let readCondition = {};
    if (filter === "unread") {
      readCondition = { isRead: false };
    } else if (filter === "read") {
      readCondition = { isRead: true };
    }

    // 最終的なクエリ条件を構築
    const notificationWhere: Prisma.NotificationWhereInput = {
      AND: [{ OR: targetTypeConditions }, readCondition],
    };

    // ソート条件の設定
    let notificationOrderBy: Prisma.NotificationOrderByWithRelationInput[] = [];
    switch (sortBy) {
      case "priority":
        notificationOrderBy = [{ priority: "desc" }, { sentAt: "desc" }];
        break;
      case "type":
        notificationOrderBy = [{ type: "asc" }, { sentAt: "desc" }];
        break;
      case "date":
      default:
        notificationOrderBy = [{ sentAt: "desc" }];
        break;
    }

    // 通知を取得（ページネーション対応）
    const notifications = await prisma.notification.findMany({
      where: notificationWhere,
      orderBy: notificationOrderBy,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        sentAt: true,
        isRead: true,
        actionUrl: true,
        priority: true,
        targetType: true,
      },
      skip: skip,
      take: limit,
    });

    // 未読通知の数を取得（TargetTypeの条件も適用）
    const unreadCount = await prisma.notification.count({
      where: {
        AND: [{ OR: targetTypeConditions }, { isRead: false }],
      },
    });

    return { notifications, unreadCount };
  } catch (error) {
    console.error("通知取得エラー:", error);
    throw error;
  }
}

/**
 * 通知の既読/未読状態を更新
 * @param id 通知ID（nullの場合はすべての通知）
 * @param isRead 既読状態
 * @returns 更新された通知の数
 */
export async function apiUpdateNotificationStatus(id: string, isRead: boolean) {
  console.log("apiUpdateNotificationStatus", id, isRead);
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new Error("認証が必要です");
    }

    // whereにuserIdを指定してはダメ。そのidがある通知しか変更できなくなる。
    const result = await prisma.notification.update({
      where: {
        id: id,
      },
      data: {
        isRead,
        readAt: isRead ? new Date() : null,
      },
    });

    console.log("apiUpdateNotificationStatus 完了", result);

    // キャッシュをクリア
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/notifications");
  } catch (error) {
    console.error("通知状態更新エラー:", error);
    throw error;
  }
}

/**
 * 通知を作成
 * @param userId 通知を送信するユーザーID
 * @param data 通知データ
 * @returns 作成された通知
 */
export async function createNotification({
  userId,
  title,
  message,
  type = "INFO",
  priority = 3,
  actionUrl = null,
  targetType = "USER",
  groupId = null,
}: {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: number;
  actionUrl: string | null;
  targetType: NotificationTargetType;
  groupId: string | null;
}) {
  try {
    // 優先度を1-5の範囲に正規化
    const normalizedPriority = Math.min(5, Math.max(1, priority));

    // 通知を作成
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type: type,
        targetType: targetType,
        priority: normalizedPriority,
        actionUrl,
        sentAt: new Date(),
        isRead: false,
        groupId: groupId,
      },
    });

    // キャッシュをクリア
    revalidatePath("/dashboard");

    return notification;
  } catch (error) {
    console.error("通知作成エラー:", error);
    throw error;
  }
}

/**
 * テスト用の通知を作成（開発環境のみ）
 */
export async function createTestNotifications() {
  try {
    if (process.env.NODE_ENV !== "development") {
      throw new Error("この関数は開発環境でのみ使用できます");
    }

    const session = await auth();

    if (!session?.user?.id) {
      throw new Error("認証されていません");
    }

    const userId = session.user.id;

    // テスト用の通知データ
    const testNotifications = [
      {
        title: "優先度高: 重要なお知らせ",
        message: "このメッセージは最高優先度の通知です。至急確認してください。",
        type: "WARNING" as NotificationType,
        priority: 5,
      },
      {
        title: "優先度中: 進捗更新",
        message: "プロジェクトの進捗が更新されました。確認してください。",
        type: "INFO" as NotificationType,
        priority: 3,
      },
      {
        title: "優先度低: 情報共有",
        message: "新しいドキュメントが追加されました。時間があるときに確認してください。",
        type: "INFO" as NotificationType,
        priority: 1,
      },
      {
        title: "タスク完了",
        message: "割り当てられたタスクが完了しました。お疲れ様でした！",
        type: "INFO" as NotificationType,
        priority: 2,
      },
      {
        title: "期限間近の通知",
        message: "明日が期限のタスクがあります。忘れずに完了してください。",
        type: "WARNING" as NotificationType,
        priority: 4,
      },
    ];

    // 通知を作成
    for (const notification of testNotifications) {
      await createNotification({
        userId,
        ...notification,
        actionUrl: null,
        targetType: "USER",
        groupId: null,
      });
    }

    // キャッシュをクリア
    revalidatePath("/dashboard");

    return { success: true, count: testNotifications.length };
  } catch (error) {
    console.error("テスト通知作成エラー:", error);
    throw error;
  }
}

/**
 * 特定のグループのメンバーに通知を一括送信する
 * @param groupId グループID
 * @param data 通知データ（userIdを除く）
 * @returns 作成された通知の数
 */
export async function notifyGroupMembers(
  groupId: string,
  data: {
    title: string;
    message: string;
    type: NotificationType;
    targetType: NotificationTargetType;
    taskId?: string;
    actionUrl?: string;
    expiresAt?: Date;
  },
) {
  // グループメンバーを取得
  const members = await prisma.groupMembership.findMany({
    where: { groupId },
    select: { userId: true },
  });

  // 各メンバーに通知を作成
  const notificationPromises = members.map((member) =>
    createNotification({
      userId: member.userId,
      ...data,
      priority: 3,
      groupId: groupId,
      actionUrl: data.actionUrl || null,
    }),
  );

  const results = await Promise.all(notificationPromises);
  return results.length;
}
