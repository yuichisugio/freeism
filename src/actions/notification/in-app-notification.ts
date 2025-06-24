"use server";

import { getAuthSession } from "@/lib/utils";
import { prisma } from "@/library-setting/prisma";
import { NotificationSendTiming } from "@prisma/client";

import type { NotificationParams } from "./email-notification";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知を作成または更新する関数
 * SCHEDULEDの場合は通知を作成し、NOWの場合は通知を作成してsentAtを設定する
 * @param {NotificationParams} notificationParams 通知データ
 * @returns {success: boolean, error?: string} 成功したかどうか
 */
export async function sendInAppNotification(
  notificationParams: NotificationParams,
): Promise<{ success: boolean; error?: string }> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // すでに通知がある場合は、SCHEDULEDで、GitHub Actionsによる予約通知の送信のため、すでにレコードがあるので、情報を更新
    if (notificationParams.notificationId) {
      // sentAtを更新するため、現時点の日時を取得
      const now = new Date();
      // sentAtを更新
      notificationParams.sentAt = now;
      // 通知を更新
      await prisma.notification.updateMany({
        where: { id: notificationParams.notificationId },
        data: {
          sentAt: now,
        },
      });
      return { success: true };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // isReadのJSONオブジェクトを構築
    const isReadJsonb: Record<string, { isRead: boolean; readAt: null }> = {};
    notificationParams.recipientUserIds.forEach((targetUserId) => {
      isReadJsonb[targetUserId] = { isRead: false, readAt: null };
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 送信者のuserIDを入れる変数
    let senderUserId: string | null = null;

    // オークション通知の場合は、GitHub Actionsやシステムメッセージのみなので、通知作成フォームから送信しないため、senderUserIdをnullにする。
    if (!notificationParams.auctionId) {
      // 通知作成者を取得
      const session = await getAuthSession();
      senderUserId = session?.user?.id ?? null;
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 通知を保存
    await prisma.notification.create({
      data: {
        title: notificationParams.title,
        message: notificationParams.message,
        targetType: notificationParams.targetType,
        sendTimingType:
          notificationParams.sendTiming === "SCHEDULED" ? NotificationSendTiming.SCHEDULED : NotificationSendTiming.NOW,
        sendScheduledDate: notificationParams.sendTiming === "SCHEDULED" ? notificationParams.sendScheduledDate : null,
        sentAt: notificationParams.sendTiming === "NOW" ? new Date() : null, // 即時送信の場合は現在時刻、予約送信の場合はnull
        expiresAt: notificationParams.expiresAt ?? undefined,
        actionUrl: notificationParams.actionUrl ?? undefined,
        senderUserId: senderUserId ?? null, // 通知作成者
        groupId: notificationParams.targetType === "GROUP" ? notificationParams.groupId : null,
        taskId: notificationParams.targetType === "TASK" ? notificationParams.taskId : null,
        // isReadはPrismaが自動的にJSONB型に変換
        isRead: isReadJsonb,
        sendMethods: notificationParams.sendMethods,
      },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // trueを返す
    return { success: true };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("sendInAppNotification_エラー:", error);
    console.error("sendInAppNotification_エラーstack:", new Error().stack);
    return { success: false, error: "通知の作成中にエラーが発生しました" };
  }
}
