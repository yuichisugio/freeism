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
 * プッシュ通知のエンドポイントを登録するサーバーアクション
 * @param userId - ユーザーID
 * @param deviceId - デバイスID
 * @param endpoint - エンドポイント
 */
export async function registerPushEndpoint(id: string, endpoint: string): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("ユーザーが見つかりません");
  }

  // Prismaを使用してDBに保存
  const result = await prisma.pushSubscription.upsert({
    where: {
      id: id,
    },
    update: {
      endpoint: endpoint,
    },
    create: {
      userId: userId,
      endpoint: endpoint,
    },
  });

  return result.id;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 購読情報を保存するサーバーアクション
 * @param subscription - 購読情報
 * @returns {id: string} 購読情報のID
 */
export async function saveSubscription(subscription: {
  endpoint: string;
  expirationTime: number | null | undefined;
  keys: {
    p256dh: string;
    auth: string;
  };
}) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  try {
    // ユーザーIDを取得
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      throw new Error("ユーザーが見つかりません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    const expirationTimeDate =
      typeof subscription.expirationTime === "number"
        ? new Date(subscription.expirationTime) // numberならDateオブジェクトに変換
        : null; // nullまたはundefinedならnull

    // Prismaを使用してDBに保存
    const result = await prisma.pushSubscription.upsert({
      where: {
        endpoint: subscription.endpoint,
      },
      update: {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userId: userId,
      },
      create: {
        userId: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        expirationTime: expirationTimeDate,
      },
    });

    return result.id;
  } catch (error) {
    console.error("購読情報の保存に失敗しました:", error);
    throw new Error("購読情報の保存に失敗しました");
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 購読情報を削除するサーバーアクション
 * @param endpoint - 購読情報のエンドポイント
 * @returns {success: boolean} 成功した場合はtrue, 失敗した場合はfalse
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
    // レコードが見つからない場合(P2025)はエラーとしないことが多いが、ここでは念のためログ出力
    if (error instanceof Error && (error as { code?: string }).code === "P2025") {
      console.warn(`Subscription not found for endpoint: ${endpoint}. Already deleted?`);
      return { success: true }; // すでに削除されている場合も成功として扱う
    }
    console.error("購読情報の削除に失敗しました:", error);
    throw new Error("購読情報の削除に失敗しました");
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知送信用のパラメータ型
 */
type SendPushNotificationParams = {
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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

type PushNotificationResult = {
  success: boolean;
  sent?: number;
  failed?: number;
  totalTargets?: number;
  message?: string;
};

/**
 * 通知を送信するサーバーアクション
 * @param params - 通知のパラメータ
 * @returns {success: boolean, sent: number, total: number, results: {success: boolean, endpoint: string, error: string}[]} 成功した場合はtrue, 失敗した場合はfalse
 */
export async function sendPushNotification(params: SendPushNotificationParams): Promise<PushNotificationResult> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // VAPIDキーが設定されていない場合は送信処理を中断
    if (!vapidDetails.publicKey || !vapidDetails.privateKey) {
      console.error("VAPID keys are not configured. Cannot send push notification.");
      return { success: false, message: "VAPIDキーが設定されていません。" };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 購読情報を取得
    let subscriptions: PushSubscription[] = [];
    const userIdsToSend = new Set<string>();
    let targetSubscriptions: PushSubscription[] = [];

    // 1.通知送信対象の決定
    if (params.userId) {
      // 特定のユーザーに送信
      userIdsToSend.add(params.userId);
      subscriptions = await prisma.pushSubscription.findMany({
        where: { userId: params.userId },
      });

      // 2.グループメンバー全員に送信
    } else if (params.groupId) {
      const groupMembers = await prisma.groupMembership.findMany({
        where: { groupId: params.groupId },
        select: { userId: true },
      });
      groupMembers.forEach((member) => userIdsToSend.add(member.userId));

      const userIds = groupMembers.map((member) => member.userId);

      await prisma.pushSubscription.findMany({
        where: { userId: { in: userIds } },
      });

      // 3.タスク関連のユーザーに送信
    } else if (params.taskId) {
      const task = await prisma.task.findUnique({
        where: { id: params.taskId },
        select: {
          creatorId: true,
          groupId: true,
          reporters: { select: { userId: true } },
          executors: { select: { userId: true } },
          // 必要に応じてタスクのウォッチャーなども追加
        },
      });

      if (task) {
        // タスク作成者
        userIdsToSend.add(task.creatorId);
        // 報告者 (userIdが存在する場合)
        task.reporters.forEach((r) => r.userId && userIdsToSend.add(r.userId));
        // 実行者 (userIdが存在する場合)
        task.executors.forEach((e) => e.userId && userIdsToSend.add(e.userId));

        // タスクが属するグループのメンバーも追加 (重複はSetが自動で処理)
        const groupMembers = await prisma.groupMembership.findMany({
          where: { groupId: task.groupId },
          select: { userId: true },
        });
        groupMembers.forEach((member) => userIdsToSend.add(member.userId));
      }
    } else {
      targetSubscriptions = await prisma.pushSubscription.findMany();
    }

    if (userIdsToSend.size > 0) {
      targetSubscriptions = await prisma.pushSubscription.findMany({
        where: {
          userId: { in: Array.from(userIdsToSend) },
          // p256dh と auth が null でないことを確認 (不完全な購読情報は除外)
          p256dh: { not: null },
          auth: { not: null },
        },
      });
    }

    if (targetSubscriptions.length === 0) {
      console.log("No valid subscriptions found for the target users.");
      return { success: false, message: "有効な購読者が見つかりませんでした" };
    }

    // 通知ペイロードの作成
    const payload = JSON.stringify({
      title: params.title,
      body: params.body,
      icon: params.icon ?? "/icons/icon-192x192.png", // デフォルトアイコンパス
      badge: params.badge ?? "/icons/badge-72x72.png", // デフォルトバッジパス
      // urlは指定された場合のみ含める
      ...(params.url && { data: { url: params.url } }), // Service Workerで扱いやすいようにdataプロパティに入れる
    });

    console.log(`Sending push notification to ${targetSubscriptions.length} subscriptions. Payload:`, payload);

    // 購読情報を送信 (Promise.allSettledで個々の送信結果を取得)
    const results = await Promise.allSettled(
      targetSubscriptions.map(async (subscription) => {
        // p256dhとauthがnullでないことを再確認 (findManyのwhere条件でフィルタ済みだが念のため)
        if (!subscription.p256dh || !subscription.auth) {
          console.warn(`Skipping subscription ${subscription.id} due to missing keys.`);
          return {
            success: false,
            endpoint: subscription.endpoint,
            error: "購読情報が不完全です (p256dh or auth is null)",
          };
        }

        const webPushSubscription: WebPushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        };

        try {
          await webPush.sendNotification(webPushSubscription, payload, {
            TTL: 60 * 60 * 24, // Time To Live: 1日 (秒単位)
          });
          // console.log(`Notification sent successfully to ${subscription.endpoint}`);
          return { success: true, endpoint: subscription.endpoint };
        } catch (error) {
          const typedError = error as { statusCode?: number; body?: string };
          console.error(`通知の送信に失敗しました (${subscription.endpoint}):`, typedError.statusCode, typedError.body);

          // エラーの種類に応じて処理（購読が無効になっている場合はDBから削除）
          // 404 Not Found, 410 Gone は購読が無効と判断
          if (typedError.statusCode === 404 || typedError.statusCode === 410) {
            console.log(`Deleting expired/invalid subscription: ${subscription.endpoint}`);
            // deleteSubscriptionを呼び出す (エラーハンドリングはdeleteSubscription内で行う)
            await deleteSubscription(subscription.endpoint).catch((delErr) => {
              console.error(`Failed to delete subscription ${subscription.endpoint} after send error:`, delErr);
            });
            // 送信自体は失敗としてマーク
            return { success: false, endpoint: subscription.endpoint, error: `Subscription expired or invalid (status code: ${typedError.statusCode})` };
          } else {
            // その他のエラー (レート制限、認証エラーなど)
            return {
              success: false,
              endpoint: subscription.endpoint,
              error: typedError.body ?? `Unknown error (status code: ${typedError.statusCode ?? "unknown"})`,
            };
          }
        }
      }),
    );

    // 結果の集計
    const fulfilledResults = results.filter((result): result is PromiseFulfilledResult<{ success: boolean; endpoint: string; error?: string }> => result.status === "fulfilled");
    const successCount = fulfilledResults.filter((result) => result.value.success).length;
    const failedCount = fulfilledResults.length - successCount;
    const rejectedCount = results.filter((result) => result.status === "rejected").length;

    console.log(`Push notification results: ${successCount} sent, ${failedCount} failed, ${rejectedCount} rejected.`);

    // 詳細な失敗理由もログ出力やデバッグ用に保持しておくと良い
    const failures = fulfilledResults.filter((result) => !result.value.success).map((result) => result.value);
    if (failures.length > 0) {
      console.warn("Failed endpoints:", failures);
    }
    const rejections = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    if (rejections.length > 0) {
      console.error(
        "Rejected promises:",
        rejections.map((r) => r.reason as Error),
      );
    }

    // 結果を返す
    return {
      success: successCount > 0, // 1件でも成功すればtrue
      sent: successCount,
      failed: failedCount + rejectedCount, // 失敗とリジェクトを合算
      totalTargets: targetSubscriptions.length,
      // results: results // 詳細な結果が必要な場合はこれも返す
    };
  } catch (error) {
    console.error("通知の送信に失敗しました:", error);
    return {
      success: false,
      message: "通知の送信に失敗しました",
    };
  }
}
