"use server";

import { NotificationSendMethod, NotificationSendTiming, NotificationTargetType } from "@prisma/client";

import type { NotificationParams } from "./email-notification";
import { sendEmailNotification } from "./email-notification";
import { sendInAppNotification } from "./in-app-notification";
import { getNotificationTargetUserIds } from "./notification-utilities";
import { sendPushNotification } from "./push-notification";

/**
 * オークション以外の通知の管理を行うファイル
 */

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション以外の通知メッセージデータ
 */
export type GeneralNotificationParams = {
  title: string;
  message: string;
  sendMethods: NotificationSendMethod[];
  targetType: NotificationTargetType;
  recipientUserIds: string[];
  groupId: string | null;
  taskId: string | null;
  auctionId: string | null;
  actionUrl: string | null;
  sendTiming: NotificationSendTiming;
  sendScheduledDate: Date | null;
  expiresAt: Date | null;
  notificationId: string | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション以外の通知メッセージデータ
 * @param {GeneralNotificationParams} params 通知メッセージデータ
 * @returns {success: boolean, message: string} 成功したかどうか
 */
export async function sendGeneralNotification(
  params: GeneralNotificationParams,
): Promise<{ success: boolean; message: string }> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 必須パラメータのチェック
     */
    if (
      !params.title ||
      !params.message ||
      !params.sendMethods ||
      params.sendMethods.length === 0 ||
      !params.sendMethods.every((method) => Object.values(NotificationSendMethod).includes(method)) ||
      !params.targetType ||
      !Object.values(NotificationTargetType).includes(params.targetType) ||
      !params.recipientUserIds ||
      params.recipientUserIds.length === 0 ||
      !params.sendTiming ||
      !Object.values(NotificationSendTiming).includes(params.sendTiming)
    ) {
      throw new Error("必須パラメータが不足しています");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 通知するユーザーIDリストを取得
     */
    // 受信者のユーザーIDを取得
    const targetUserIds = await getNotificationTargetUserIds(params.targetType, {
      userIds: params.recipientUserIds,
      groupId: params.groupId ?? undefined,
      taskId: params.taskId ?? undefined,
    });

    // 通知するユーザーが見つからない場合はエラー
    if (targetUserIds.length === 0) {
      throw new Error("通知の対象者が見つかりません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 通知パラメータを作成
     */
    const notificationParams: NotificationParams = {
      recipientUserIds: targetUserIds,
      title: params.title,
      message: params.message,
      senderUserId: null,
      actionUrl: params.actionUrl,
      targetType: params.targetType,
      groupId: params.groupId,
      taskId: params.taskId,
      auctionId: params.auctionId,
      sendTiming: params.sendTiming,
      sendScheduledDate: params.sendScheduledDate,
      expiresAt: params.expiresAt,
      sendMethods: params.sendMethods,
      notificationId: params.notificationId,
      sentAt: null,
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * アプリ内通知を送信。NOW以外でも登録する。
     * アプリ内表示は、通知のデータ表示時に制限しているので、登録しただけでは表示されない。
     * その登録したdataを元に、GitHub Actionsで送信する
     */
    if (notificationParams.sendMethods.includes(NotificationSendMethod.IN_APP)) {
      const inAppNotificationResult = await sendInAppNotification(notificationParams);
      if (!inAppNotificationResult.success) {
        throw new Error("アプリ内通知の送信に失敗しました");
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // スケジュール通知の場合は、「sendScheduledDate」がある。その「sendScheduledDate」が過去の場合のみ、スケジュール通知を送信する
    // 「NOTIFICATION_SEND_TIMING」が「SCHEDULE」で判断してはダメ。GitHub Actionsの実行時も「SCHEDULE」で判断してpush通知をスキップしてしまうため。
    // さらに、予約送信は、すでにレコードがある状態で送るので、「notificationId」があるかどうかで判断する
    // params.sendScheduledDate > nowの場合は、まだ通知を送るタイミングではないため、push通知やメール通知はスキップする
    const now = new Date();
    if (
      params.notificationId &&
      params.sendTiming === NotificationSendTiming.SCHEDULED &&
      params.sendScheduledDate &&
      params.sendScheduledDate > now
    ) {
      return { success: true, message: "スケジュール通知の登録を完了しました" };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * プッシュ通知を送信。
     */
    if (notificationParams.sendMethods.includes(NotificationSendMethod.WEB_PUSH)) {
      const pushNotificationResult = await sendPushNotification(notificationParams);
      if (!pushNotificationResult.success) {
        throw new Error("プッシュ通知の送信に失敗しました");
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * メール通知を送信。
     */
    if (notificationParams.sendMethods.includes(NotificationSendMethod.EMAIL)) {
      const emailNotificationResult = await sendEmailNotification(notificationParams);
      if (!emailNotificationResult.success) {
        throw new Error("メール通知の送信に失敗しました");
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 返す値は、成功したかどうかだけなので、trueを返す
     */
    return { success: true, message: "通知の登録を完了しました" };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("sendGeneralNotification_エラーstack:", new Error().stack);
    return { success: false, message: error instanceof Error ? error.message : "通知エラーが発生しました" };
  }
}
