"use server";

import type { PushSubscription } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import webPush from "web-push";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// VAPID詳細を設定
const vapidDetails = {
  subject: process.env.VAPID_SUBJECT ?? "",
  publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  privateKey: process.env.VAPID_PRIVATE_KEY ?? "",
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// プッシュ通知の設定を初期化
webPush.setVapidDetails(vapidDetails.subject, vapidDetails.publicKey, vapidDetails.privateKey);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 購読情報を保存するサーバーアクション
 * @param subscription - 購読情報
 * @returns 成功した場合はtrue, 失敗した場合はfalse
 */
export async function saveSubscription(subscription: {
  endpoint: string;
  expirationTime: number | null | undefined;
  keys: {
    p256dh: string;
    auth: string;
  };
}) {
  try {
    // ユーザーIDを取得
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      throw new Error("ユーザーが見つかりません");
    }

    // データベース操作をトランザクションで行う
    const result = await prisma.$transaction(async (tx) => {
      // 1. 同じユーザーIDを持つ既存の購読情報を削除 (同じユーザーIDを持つものすべて)
      await tx.pushSubscription.deleteMany({
        where: {
          userId: userId,
        },
      });

      // 2. 新しい購読情報を作成
      const newSubscription = await tx.pushSubscription.create({
        data: {
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userId: userId,
          expirationTime:
            typeof subscription.expirationTime === "number"
              ? new Date(subscription.expirationTime) // numberならDateオブジェクトに変換
              : null, // nullまたはundefinedならnull
        },
      });
      return newSubscription; // トランザクションの結果として新しい購読情報を返す
    });

    return { success: true, id: result.id };
  } catch (error) {
    console.error("購読情報の保存に失敗しました:", error);
    throw new Error("購読情報の保存に失敗しました");
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 購読情報を削除するサーバーアクション
 * @param endpoint - 購読情報のエンドポイント
 * @returns 成功した場合はtrue, 失敗した場合はfalse
 */
export async function deleteSubscription(endpoint: string) {
  try {
    await prisma.pushSubscription.delete({
      where: {
        endpoint: endpoint,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("購読情報の削除に失敗しました:", error);
    throw new Error("購読情報の削除に失敗しました");
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知送信用のパラメータ型
 */
type SendNotificationParams = {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  userId?: string;
  groupId?: string;
  taskId?: string;
};

/**
 * Web Push用のサブスクリプション型
 */
type WebPushSubscription = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

/**
 * 通知を送信するサーバーアクション
 * @param params - 通知のパラメータ
 */
export async function sendNotification(params: SendNotificationParams) {
  try {
    // 購読情報を取得
    let subscriptions: PushSubscription[] = [];

    // 通知送信対象の決定
    if (params.userId) {
      // 特定のユーザーに送信
      subscriptions = await prisma.pushSubscription.findMany({
        where: { userId: params.userId },
      });
    } else if (params.groupId) {
      // グループメンバー全員に送信
      const groupMembers = await prisma.groupMembership.findMany({
        where: { groupId: params.groupId },
        select: { userId: true },
      });

      const userIds = groupMembers.map((member) => member.userId);

      subscriptions = await prisma.pushSubscription.findMany({
        where: { userId: { in: userIds } },
      });
    } else if (params.taskId) {
      // タスク関連のユーザーに送信
      const task = await prisma.task.findUnique({
        where: { id: params.taskId },
        select: {
          creatorId: true,
          groupId: true,
          reporters: { select: { userId: true } },
          executors: { select: { userId: true } },
        },
      });

      if (task) {
        const userIds = [task.creatorId, ...task.reporters.filter((r) => r.userId).map((r) => r.userId!), ...task.executors.filter((e) => e.userId).map((e) => e.userId!)];

        // タスクのグループメンバーも追加
        const groupMembers = await prisma.groupMembership.findMany({
          where: { groupId: task.groupId },
          select: { userId: true },
        });

        userIds.push(...groupMembers.map((member) => member.userId));

        // 重複を削除
        const uniqueUserIds = [...new Set(userIds)];

        subscriptions = await prisma.pushSubscription.findMany({
          where: { userId: { in: uniqueUserIds } },
        });
      }
    } else {
      // デフォルト: すべての購読者に送信
      subscriptions = await prisma.pushSubscription.findMany();
    }

    if (subscriptions.length === 0) {
      return { success: false, message: "購読者が見つかりませんでした" };
    }

    // 通知ペイロードの作成
    const payload = JSON.stringify({
      title: params.title,
      body: params.body,
      icon: "/notification-icon.svg",
      badge: "/notification-badge.svg",
      url: params.url,
    });

    console.log("sendNotification_payload", payload);

    // 購読情報を送信
    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          // p256dhとauthが存在することを確認
          if (!subscription.p256dh || !subscription.auth) {
            return {
              success: false,
              endpoint: subscription.endpoint,
              error: "購読情報が不完全です",
            };
          }

          // PushSubscriptionオブジェクトの形式に変換して送信
          const webPushSubscription: WebPushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          };

          console.log("sendNotification_webPushSubscription", webPushSubscription);

          await webPush.sendNotification(webPushSubscription, payload);
          console.log("sendNotification_success");
          return { success: true, endpoint: subscription.endpoint };
        } catch (error) {
          console.error(`通知の送信に失敗しました (${subscription.endpoint}):`, error);

          // エラーの種類に応じて処理（購読が無効になっている場合は削除）
          const webPushError = error as { statusCode?: number };
          if (webPushError.statusCode === 404 || webPushError.statusCode === 410) {
            await prisma.pushSubscription.delete({
              where: { endpoint: subscription.endpoint },
            });
          }

          return { success: false, endpoint: subscription.endpoint, error };
        }
      }),
    );

    const successCount = results.filter((result) => result.status === "fulfilled" && (result.value as { success: boolean }).success).length;

    console.log("sendNotification_successCount", successCount);

    return {
      success: successCount > 0,
      sent: successCount,
      total: subscriptions.length,
      results,
    };
  } catch (error) {
    console.error("通知の送信に失敗しました:", error);
    throw new Error("通知の送信に失敗しました");
  }
}
