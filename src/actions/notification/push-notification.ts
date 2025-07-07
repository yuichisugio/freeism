"use server";

import type { PushSubscription } from "@prisma/client";
import { getAuthSession } from "@/lib/utils";
import { prisma } from "@/library-setting/prisma";
import { type PromiseResult } from "@/types/general-types";
import webPush from "web-push";

import type { NotificationParams } from "./email-notification";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
/**
 * sendPushNotificationの結果
 */
type PushNotificationResult = {
  sent: number;
  failed: number;
  totalTargets: number;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知を送信するサーバーアクション
 * @param {SendPushNotificationParams} params (title, body, icon, badge, url, userId, groupId, taskId) 通知のパラメータ
 * @returns {PushNotificationResult} (success, sent, failed, totalTargets, message) 成功した場合はtrue, 失敗した場合はfalse
 */
export async function sendPushNotification(params: NotificationParams): PromiseResult<PushNotificationResult> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 受信者のプッシュ通知設定を取得
   * 設定画面で受信拒否しているユーザーを除外したuserIdのリストを作成
   */
  const isPushNotificationEnabled = await prisma.userSettings.findMany({
    where: {
      userId: { in: params.recipientUserIds },
    },
    select: {
      isPushEnabled: true,
      userId: true,
    },
  });

  // プッシュ通知設定が見つからない場合は送信処理を中断
  if (isPushNotificationEnabled.length === 0) {
    return {
      success: false,
      data: { sent: 0, failed: 0, totalTargets: 0 },
      message: "プッシュ通知設定が見つかりません",
    };
  }

  // 設定画面で受信拒否しているユーザーを除外したuserIdのリストを作成
  const recipientUserIds = isPushNotificationEnabled
    .filter((user) => user.isPushEnabled === true)
    .map((user) => user.userId);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * VAPIDキーの設定
   */
  // VAPIDキーを取得して設定
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY ?? "";
  const vapidSubject = process.env.VAPID_SUBJECT ?? "";

  // VAPIDキーが設定されていない場合は送信処理を中断
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error("VAPID keys are not configured. Cannot send push notification.");
    return {
      success: false,
      data: { sent: 0, failed: 0, totalTargets: 0 },
      message: "VAPIDキーが設定されていません。",
    };
  }

  // 毎回最新の環境変数で設定
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 対象ユーザーの購読情報を取得
   */
  const targetSubscriptions = await prisma.pushSubscription.findMany({
    where: {
      userId: { in: recipientUserIds }, // 設定画面で受信拒否しているユーザーを除外したuserIdのリスト
      // p256dh と auth が null でないことを確認 (不完全な購読情報は除外)
      p256dh: { not: null },
      auth: { not: null },
    },
  });

  if (targetSubscriptions.length === 0) {
    console.warn("sendPushNotification_No valid subscriptions found for the target users.");
    return {
      success: true,
      data: { sent: 0, failed: 0, totalTargets: 0 },
      message: "有効な購読者が見つかりませんでした",
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 通知ペイロードの作成。urlは指定された場合のみ含める
   */
  const payload = JSON.stringify({
    title: params.title,
    body: params.message,
    ...(params.actionUrl && { data: { url: params.actionUrl } }), // Service Workerで扱いやすいようにdataプロパティに入れる
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 端末の重複削除。new Setを使用しないのはupdatedAtで降順で並び替えたいため。
   */
  const deviceGroups = new Map<string, typeof targetSubscriptions>();

  targetSubscriptions.forEach((subscription) => {
    if (!subscription.deviceId || subscription.deviceId === null) {
      console.warn("sendPushNotification_No deviceId found for subscription:", subscription);
      return;
    }
    if (!deviceGroups.has(subscription.deviceId)) {
      deviceGroups.set(subscription.deviceId, []);
    }
    deviceGroups.get(subscription.deviceId)!.push(subscription);
  });

  const noDuplicationTargetSubscriptions: PushSubscription[] = [];

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * デバイスごとに1つのサブスクリプションにのみ通知を送信
   */
  for (const deviceSubscriptions of deviceGroups.values()) {
    // デバイスごとに最新のサブスクリプションを使用（最新 = 最後に更新されたもの）
    const sortedSubscriptions = deviceSubscriptions.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    const subscription = sortedSubscriptions[0];
    noDuplicationTargetSubscriptions.push(subscription);
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 購読情報を送信 (Promise.allSettledで個々の送信結果を取得)
   */
  const results = await Promise.allSettled(
    noDuplicationTargetSubscriptions.map(async (subscription) => {
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
        return { success: true, endpoint: subscription.endpoint };
      } catch (error) {
        const typedError = error as { statusCode?: number; body?: string };
        console.error(
          `sendPushNotification_Notification sent failed to ${subscription.endpoint}:`,
          typedError.statusCode,
          typedError.body,
        );

        // エラーの種類に応じて処理（購読が無効になっている場合はDBから削除）
        // 404 Not Found, 410 Gone は購読が無効と判断
        if (typedError.statusCode === 404 || typedError.statusCode === 410) {
          // deleteSubscriptionを呼び出す (エラーハンドリングはdeleteSubscription内で行う)
          await deleteSubscription(subscription.endpoint).catch((delErr) => {
            console.error(
              `sendPushNotification_Failed to delete subscription ${subscription.endpoint} after send error:`,
              delErr,
            );
          });
          // 送信自体は失敗としてマーク
          return {
            success: false,
            endpoint: subscription.endpoint ?? "",
            error: `Subscription expired or invalid (status code: ${typedError.statusCode})`,
          };
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

  /**
   * 結果の集計
   * allSettled()が自動的にstatusをfulfilledまたはrejectedに設定してくれる
   */
  const fulfilledResults = results.filter(
    (result): result is PromiseFulfilledResult<{ success: boolean; endpoint: string; error?: string }> =>
      result.status === "fulfilled",
  );
  const successCount = fulfilledResults.filter((result) => result.value.success).length;
  const failedCount = fulfilledResults.filter((result) => !result.value.success).length;
  const rejectedCount = results.filter((result) => result.status === "rejected").length;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 詳細な失敗理由もログ出力やデバッグ用に保持しておくと良い
   */
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

  /**
   * 結果を返す
   */
  return {
    success: successCount > 0, // 1件でも成功すればtrue
    data: {
      sent: successCount,
      failed: failedCount + rejectedCount, // 失敗とリジェクトを合算
      totalTargets: targetSubscriptions.length,
    },
    message: "通知の送信に成功しました",
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 購読情報を取得するサーバーアクション
 * @param endpoint - 購読情報のエンドポイント
 * @returns {string | null} 購読情報のID
 */
export async function getRecordId(endpoint: string): PromiseResult<string | null> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * エンドポイントがない場合はエラー
   */
  if (!endpoint) {
    throw new Error("エンドポイントがありません");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 購読情報を取得
   */
  const recordId = await prisma.pushSubscription.findUnique({
    where: {
      endpoint: endpoint,
    },
    select: {
      id: true,
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 結果を返却
   */
  return {
    success: true,
    data: recordId?.id ?? null,
    message: "購読情報のIDを取得しました",
  };
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
  deviceId?: string;
}): PromiseResult<PushSubscription> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 購読情報が不完全な場合はエラー
   */
  if (!subscription.endpoint || !subscription.keys.p256dh || !subscription.keys.auth) {
    throw new Error("購読情報が不完全です");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーIDを取得
   */
  const session = await getAuthSession();
  const userId = session?.user?.id;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ダミーのレコードID
   */
  const dummyRecordId = "00000000000000000000000000000000";

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 購読情報のレコードIDがない場合は、購読情報を取得する
   */
  if (!subscription.recordId) {
    const recordId = await getRecordId(subscription.endpoint);
    if (!recordId.success || recordId.data === null || recordId.data === undefined) {
      // ダミーを入れる
      subscription.recordId = dummyRecordId;
    } else {
      subscription.recordId = recordId.data;
    }
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 有効期限をDateオブジェクトに変換
   */
  const expirationTimeDate =
    typeof subscription.expirationTime === "number"
      ? new Date(subscription.expirationTime) // numberならDateオブジェクトに変換
      : null; // nullまたはundefinedならnull

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  let result: PushSubscription | undefined = undefined;

  /**
   * ダミーのレコードIDの場合は新規作成、それ以外は更新
   */
  if (dummyRecordId === subscription.recordId) {
    result = await prisma.pushSubscription.create({
      data: {
        userId: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        expirationTime: expirationTimeDate,
        deviceId: subscription.deviceId,
      },
    });
  } else {
    /**
     * Prismaを使用してDBに保存
     */
    result = await prisma.pushSubscription.update({
      where: {
        id: subscription.recordId,
      },
      data: {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        expirationTime: expirationTimeDate,
        userId: userId,
        deviceId: subscription.deviceId,
      },
    });
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 結果をチェック＆返却
   */
  if (!result) {
    throw new Error("保存処理中にエラーが発生しました。");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 結果を返却
   */
  return {
    success: true,
    data: result,
    message: "購読情報を保存しました",
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 購読情報を削除するサーバーアクション
 * @param endpoint - 購読情報のエンドポイント
 * @returns {success: boolean} 成功した場合はtrue, 失敗した場合はfalse
 */
export async function deleteSubscription(endpoint: string): PromiseResult<null> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * エンドポイントがない場合はエラー
     */
    if (!endpoint) {
      throw new Error("エンドポイントがありません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 購読情報を削除
     */
    await prisma.pushSubscription.delete({
      where: {
        endpoint: endpoint,
      },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 結果を返却
     */
    return { success: true, data: null, message: "購読情報を削除しました" };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    // レコードが見つからない場合(P2025)はエラーとしないことが多いが、ここでは念のためログ出力
    if (error instanceof Error && (error as { code?: string }).code === "P2025") {
      console.warn(`Subscription not found for endpoint: ${endpoint}. Already deleted?`);
      return { success: true, data: null, message: "購読情報を削除しました" }; // すでに削除されている場合も成功として扱う
    }
    console.error("購読情報の削除に失敗しました:", error);
    throw new Error(`購読情報の削除に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`);
  }
}
