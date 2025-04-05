"use server";

import type { PushSubscription } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import webPush from "web-push";

import { getNotificationTargetUserIds } from "./notification-utilities";

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
 * 購読情報を取得するサーバーアクション
 * @param endpoint - 購読情報のエンドポイント
 * @returns {string | null} 購読情報のID
 */
export async function getRecordId(endpoint: string): Promise<string | null> {
  const recordId = await prisma.pushSubscription.findUnique({
    where: {
      endpoint: endpoint,
    },
    select: {
      id: true,
    },
  });

  return recordId?.id ?? null;
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
  recordId?: string;
}): Promise<PushSubscription | { error: string }> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // ユーザーIDを取得
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      console.log("未認証ユーザーです。プッシュ通知の購読はスキップします。");
      return { error: "ユーザーが認証されていません" };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    if (!subscription.recordId) {
      const recordId = await getRecordId(subscription.endpoint);
      if (recordId === null || recordId === undefined) {
        // ダミーを入れる
        subscription.recordId = "00000000000000000000000000000000";
        console.log("購読情報が見つからないため、ダミーを入れます。", subscription.recordId);
      } else {
        subscription.recordId = recordId;
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    const expirationTimeDate =
      typeof subscription.expirationTime === "number"
        ? new Date(subscription.expirationTime) // numberならDateオブジェクトに変換
        : null; // nullまたはundefinedならnull

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // Prismaを使用してDBに保存
    const result = await prisma.pushSubscription.upsert({
      where: {
        id: subscription.recordId,
      },
      update: {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        expirationTime: expirationTimeDate,
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

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    return result;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("購読情報の保存に失敗しました:", error);
    return { error: "購読情報の保存に失敗しました" };
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
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    await prisma.pushSubscription.delete({
      where: {
        endpoint: endpoint,
      },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    return { success: true };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
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
  userId?: string | string[];
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

type PushNotificationResult = {
  success: boolean;
  sent?: number;
  failed?: number;
  totalTargets?: number;
  message?: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知を送信するサーバーアクション
 * @param {SendPushNotificationParams} params (title, body, icon, badge, url, userId, groupId, taskId) 通知のパラメータ
 * @returns {PushNotificationResult} (success, sent, failed, totalTargets, message) 成功した場合はtrue, 失敗した場合はfalse
 */
export async function sendPushNotification(params: SendPushNotificationParams): Promise<PushNotificationResult> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // VAPIDキーが設定されていない場合は送信処理を中断
    if (!vapidDetails.publicKey || !vapidDetails.privateKey) {
      console.error("VAPID keys are not configured. Cannot send push notification.");
      return { success: false, message: "VAPIDキーが設定されていません。" };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 共通関数を使って通知対象のユーザーIDを取得
    let targetUserIds: string[] = [];
    let targetType: "SYSTEM" | "USER" | "GROUP" | "TASK" = "SYSTEM"; // デフォルト値

    if (params.userId) {
      targetType = "USER";
    } else if (params.groupId) {
      targetType = "GROUP";
    } else if (params.taskId) {
      targetType = "TASK";
    }

    try {
      targetUserIds = await getNotificationTargetUserIds(targetType, {
        userIds: params.userId ? (Array.isArray(params.userId) ? params.userId : [params.userId]) : undefined,
        groupId: params.groupId,
        taskId: params.taskId,
      });
    } catch (error) {
      console.error("通知対象ユーザー取得エラー:", error);
      return { success: false, message: "通知対象ユーザーの取得に失敗しました" };
    }

    if (targetUserIds.length === 0) {
      console.warn("通知対象ユーザーが見つかりません");
      return { success: false, message: "通知対象ユーザーが見つかりません" };
    }

    console.log("sendPushNotification_targetUserIds", targetUserIds);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 対象ユーザーの購読情報を取得
    const targetSubscriptions = await prisma.pushSubscription.findMany({
      where: {
        userId: { in: targetUserIds },
        // p256dh と auth が null でないことを確認 (不完全な購読情報は除外)
        p256dh: { not: null },
        auth: { not: null },
      },
    });

    console.log("sendPushNotification_targetSubscriptions", targetSubscriptions);

    if (targetSubscriptions.length === 0) {
      console.log("sendPushNotification_No valid subscriptions found for the target users.");
      return { success: false, message: "有効な購読者が見つかりませんでした" };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 通知ペイロードの作成
    const payload = JSON.stringify({
      title: params.title,
      body: params.body,
      icon: params.icon ?? "favicon.svg", // デフォルトアイコンパス
      badge: params.badge ?? "favicon.svg", // デフォルトバッジパス
      // urlは指定された場合のみ含める
      ...(params.url && { data: { url: params.url } }), // Service Workerで扱いやすいようにdataプロパティに入れる
    });

    console.log(`sendPushNotification_Sending push notification to ${targetSubscriptions.length} subscriptions. Payload:`, payload);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 購読情報を送信 (Promise.allSettledで個々の送信結果を取得)
    const results = await Promise.allSettled(
      targetSubscriptions.map(async (subscription) => {
        // p256dhとauthがnullでないことを再確認 (findManyのwhere条件でフィルタ済みだが念のため)
        if (!subscription.p256dh || !subscription.auth || !subscription.endpoint) {
          console.warn(`Skipping subscription ${subscription.id} due to missing keys.`);
          return {
            success: false,
            endpoint: subscription.endpoint,
            error: "購読情報が不完全です (p256dh or auth is null)",
          };
        }

        // push通知の購読情報を作成
        const webPushSubscription: WebPushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        };

        try {
          // push通知を送信
          await webPush.sendNotification(webPushSubscription, payload);
          console.log(`sendPushNotification_Notification sent successfully to ${subscription.endpoint}, ${subscription.id}`);
          return { success: true, endpoint: subscription.endpoint };
        } catch (error) {
          const typedError = error as { statusCode?: number; body?: string };
          console.error(`sendPushNotification_Notification sent failed to ${subscription.endpoint}:`, typedError.statusCode, typedError.body);

          // エラーの種類に応じて処理（購読が無効になっている場合はDBから削除）
          // 404 Not Found, 410 Gone は購読が無効と判断
          if (typedError.statusCode === 404 || typedError.statusCode === 410) {
            console.log(`sendPushNotification_Deleting expired/invalid subscription: ${subscription.endpoint}`);
            // deleteSubscriptionを呼び出す (エラーハンドリングはdeleteSubscription内で行う)
            await deleteSubscription(subscription.endpoint).catch((delErr) => {
              console.error(`sendPushNotification_Failed to delete subscription ${subscription.endpoint} after send error:`, delErr);
            });
            // 送信自体は失敗としてマーク
            return { success: false, endpoint: subscription.endpoint ?? "", error: `Subscription expired or invalid (status code: ${typedError.statusCode})` };
          } else {
            // その他のエラー (レート制限、認証エラーなど)
            return {
              success: false,
              endpoint: subscription.endpoint ?? "",
              error: typedError.body ?? `Unknown error (status code: ${typedError.statusCode ?? "unknown"})`,
            };
          }
        }
      }),
    );

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 結果の集計
    const fulfilledResults = results.filter((result): result is PromiseFulfilledResult<{ success: boolean; endpoint: string; error?: string }> => result.status === "fulfilled");
    const successCount = fulfilledResults.filter((result) => result.value.success).length;
    const failedCount = fulfilledResults.length - successCount;
    const rejectedCount = results.filter((result) => result.status === "rejected").length;

    console.log(`sendPushNotification_Push notification results: ${successCount} sent, ${failedCount} failed, ${rejectedCount} rejected.`);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 詳細な失敗理由もログ出力やデバッグ用に保持しておくと良い
    const failures = fulfilledResults.filter((result) => !result.value.success).map((result) => result.value);
    if (failures.length > 0) {
      console.warn("sendPushNotification_Failed endpoints:", failures);
    }
    const rejections = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    if (rejections.length > 0) {
      console.error(
        "sendPushNotification_Rejected promises:",
        rejections.map((r) => r.reason as Error),
      );
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 結果を返す
    return {
      success: successCount > 0, // 1件でも成功すればtrue
      sent: successCount,
      failed: failedCount + rejectedCount, // 失敗とリジェクトを合算
      totalTargets: targetSubscriptions.length,
      // results: results // 詳細な結果が必要な場合はこれも返す
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("sendPushNotification_Failed to send push notification:", error);
    return {
      success: false,
      message: "通知の送信に失敗しました",
    };
  }
}
