"use server";

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
 * 通知を送信するサーバーアクション
 * @param title - 通知のタイトル
 * @param body - 通知の本文
 * @param icon - 通知のアイコン
 * @param badge - 通知のバッジ
 * @param url - 通知のURL
 * @param userId - 通知を送信するユーザーのID
 */
export async function sendNotification({ title, body, icon, badge, url, userId }: { title: string; body: string; icon?: string; badge?: string; url?: string; userId?: string }) {
  try {
    // ユーザーIDが指定されている場合は、特定のユーザーに通知を送信
    // 指定されていない場合は、すべての購読者に送信
    const subscriptions = userId
      ? await prisma.pushSubscription.findMany({
          where: { userId },
        })
      : await prisma.pushSubscription.findMany();

    if (subscriptions.length === 0) {
      return { success: false, message: "購読者が見つかりませんでした" };
    }

    const payload = JSON.stringify({
      title,
      body,
      icon,
      badge,
      url,
    });

    // 購読情報を送信
    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          // PushSubscriptionオブジェクトの形式に変換して送信
          await webPush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh!,
                auth: subscription.auth!,
              },
            },
            payload,
          );
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
