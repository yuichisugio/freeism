#!/usr/bin/env tsx
/**
 * 予約送信の通知を送信するスクリプト
 * GitHub Actionsから実行するためのスクリプトです
 */
import { sendGeneralNotification } from "@/lib/actions/notification/general-notification";
import { prisma } from "@/lib/prisma";
import { NotificationSendTiming } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 予約送信の通知を送信する
 * sendScheduledDateが現在日時以前かつsendTimingTypeがSCHEDULEDかつsentAtがnullの通知を処理する
 *
 * @returns 処理された通知の数
 */
export async function sendScheduledNotifications(): Promise<number> {
  try {
    // 現在の日時を取得
    const now = new Date();

    // 処理対象の通知を取得
    // sendScheduledDateが現在日時以前かつsendTimingTypeがSCHEDULEDかつsentAtがnullの通知
    const notifications = await prisma.notification.findMany({
      where: {
        sendScheduledDate: {
          lte: now,
        },
        sendTimingType: NotificationSendTiming.SCHEDULED,
        sentAt: null,
      },
    });

    console.log(`処理対象の通知: ${notifications.length}件`);

    // 処理した通知の数
    let processedCount = 0;

    // 各通知に対して処理
    for (const notification of notifications) {
      try {
        // isReadフィールドからユーザーIDを抽出
        const userIds = Object.keys(notification.isRead as Record<string, { isRead: boolean; readAt: null }>);

        if (userIds.length === 0) {
          console.log(`通知(ID: ${notification.id})には対象ユーザーがいません。スキップします。`);
          continue;
        }

        // 通知用のパラメータを作成
        const notificationParams = {
          title: notification.title,
          message: notification.message,
          sendMethods: notification.sendMethods,
          targetType: notification.targetType,
          recipientUserIds: userIds,
          groupId: notification.groupId,
          taskId: notification.taskId,
          auctionId: notification.auctionId,
          actionUrl: notification.actionUrl,
          sendTiming: NotificationSendTiming.NOW, // 即時送信に変更
          sendScheduledDate: null,
          expiresAt: notification.expiresAt,
          notificationId: notification.id,
        };

        // 通知を送信
        const result = await sendGeneralNotification(notificationParams);

        if (result.success) {
          // 送信完了後、sentAtを更新
          await prisma.notification.update({
            where: { id: notification.id },
            data: { sentAt: new Date() },
          });

          processedCount++;
          console.log(`通知(ID: ${notification.id})の送信が完了しました`);
        } else {
          console.error(`通知(ID: ${notification.id})の送信に失敗しました: ${result.error}`);
        }
      } catch (error) {
        console.error(`通知(ID: ${notification.id})の処理中にエラーが発生:`, error);
      }
    }

    return processedCount;
  } catch (error) {
    console.error("予約送信通知処理でエラーが発生しました:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * メイン関数
 */
export async function main() {
  try {
    console.log("予約送信の通知処理を開始します...");

    // 予約送信通知処理を実行
    const processedCount = await sendScheduledNotifications();

    console.log(`処理が完了しました。${processedCount}件の通知を処理しました。`);
    process.exit(0);
  } catch (error) {
    console.error("エラーが発生しました:", error);
    process.exit(1);
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// スクリプト実行（テスト時は実行しない）
if (require.main === module) {
  main().catch((error) => {
    console.error("スクリプト実行中にエラーが発生しました:", error);
    process.exit(1);
  });
}
