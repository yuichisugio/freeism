import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { NotificationSendTiming } from "@prisma/client";

import type { NotificationParams } from "./email-notification";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知を作成する関数
 * @param {NotificationParams} notificationParams 通知データ
 * @returns {success: boolean, error?: string} 成功したかどうか
 */
export async function sendInAppNotification(notificationParams: NotificationParams): Promise<{ success: boolean; error?: string }> {
  "use server"; // Server Actions としてマーク

  try {
    // isReadのJSONオブジェクトを構築
    const isReadJsonb: Record<string, { isRead: boolean; readAt: null }> = {};
    notificationParams.recipientUserIds.forEach((targetUserId) => {
      isReadJsonb[targetUserId] = { isRead: false, readAt: null };
    });

    // 通知を保存
    await prisma.notification.create({
      data: {
        title: notificationParams.title,
        message: notificationParams.message,
        targetType: notificationParams.targetType,
        sendTimingType: notificationParams.sendTiming === "SCHEDULED" ? NotificationSendTiming.SCHEDULED : NotificationSendTiming.NOW,
        sendScheduledDate: notificationParams.sendTiming === "SCHEDULED" ? notificationParams.sendScheduledDate : null,
        sentAt: notificationParams.sendTiming === "NOW" ? new Date() : null, // 即時送信の場合は現在時刻、予約送信の場合はnull
        expiresAt: notificationParams.expiresAt ?? undefined,
        actionUrl: notificationParams.actionUrl ?? undefined,
        senderUserId: notificationParams.senderUserId ?? null, // 通知作成者
        groupId: notificationParams.targetType === "GROUP" ? notificationParams.groupId : null,
        taskId: notificationParams.targetType === "TASK" ? notificationParams.taskId : null,
        // isReadはPrismaが自動的にJSONB型に変換
        isRead: isReadJsonb,
      },
    });

    revalidatePath("/dashboard/notifications");

    return { success: true };
  } catch (error) {
    console.error("sendInAppNotification_エラー:", error);
    console.error("sendInAppNotification_エラーstack:", new Error().stack);
    return { success: false, error: "通知の作成中にエラーが発生しました" };
  }
}
