import type { NotificationSendTiming, NotificationTargetType } from "@prisma/client";
import { getAuthSession } from "@/lib/utils";
import { NotificationSendMethod } from "@prisma/client";

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
  userId: string[] | null;
  groupId: string | null;
  taskId: string | null;
  auctionId: string | null;
  actionUrl: string | null;
  sendTiming: NotificationSendTiming;
  sendScheduledDate: Date | null;
  expiresAt: Date | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション以外の通知メッセージデータ
 * @param {GeneralNotificationParams} params 通知メッセージデータ
 * @returns {success: boolean, error?: string} 成功したかどうか
 */
export async function sendGeneralNotification(params: GeneralNotificationParams): Promise<{ success: boolean; error?: string }> {
  "use server"; // Server Actions としてマーク
  console.log("src/lib/actions/notification/general-notification.ts_sendGeneralNotification_start");

  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // GitHub Actionsで定期実行する場合は、auth()がエラーになるため、エラーが出た場合は送信者はnullとする
    let senderUserId: string | null = null;
    try {
      // 通知のデータを取得
      const session = await getAuthSession();
      senderUserId = session?.user?.id ?? null;
    } catch (error) {
      // 認証エラーが発生した場合は、定期実行なので、nullを入れて、senderUserIdをnull(空欄)にする
      senderUserId = null;
      console.error("sendGeneralNotification_auth_nullにする:", error);
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 受信者のユーザーIDを取得
    const targetUserIds = await getNotificationTargetUserIds(params.targetType, {
      userIds: params.userId ?? undefined,
      groupId: params.groupId ?? undefined,
      taskId: params.taskId ?? undefined,
    });

    if (targetUserIds.length === 0) {
      console.error("sendGeneralNotification_targetUserIds_エラー:", new Error().stack);
      console.error("sendGeneralNotification_targetUserIds_エラー:", "通知の対象者が見つかりません");
      return { success: false, error: "通知の対象者が見つかりません" };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 通知するユーザーIDリストを作成
    const notificationParams: NotificationParams = {
      recipientUserIds: targetUserIds,
      title: params.title,
      message: params.message,
      senderUserId: senderUserId,
      actionUrl: params.actionUrl,
      targetType: params.targetType,
      groupId: params.groupId,
      taskId: params.taskId,
      auctionId: params.auctionId,
      sendTiming: params.sendTiming,
      sendScheduledDate: params.sendScheduledDate,
      expiresAt: params.expiresAt,
      sendMethods: params.sendMethods,
    };

    // 通知するユーザーが見つからない場合はエラー
    if (notificationParams.recipientUserIds.length === 0) {
      console.error("sendGeneralNotification_recipientUserIds_エラー:");
      console.error("sendGeneralNotification_recipientUserIds_エラー_stack:", new Error().stack);
      return { success: false, error: "通知するユーザーが見つかりません" };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // プッシュ通知を送信。NOWの場合のみ送信する
    if (notificationParams.sendMethods.includes(NotificationSendMethod.WEB_PUSH) && params.sendTiming === "NOW") {
      const pushNotificationResult = await sendPushNotification(notificationParams);
      if (!pushNotificationResult.success) {
        console.error("sendGeneralNotification_sendPushNotification_エラー:");
        console.error("sendGeneralNotification_sendPushNotification_エラー_stack:", new Error().stack);
        return { success: false, error: "プッシュ通知の送信に失敗しました" };
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // メール通知を送信。NOWの場合のみ送信する
    if (notificationParams.sendMethods.includes(NotificationSendMethod.EMAIL) && params.sendTiming === "NOW") {
      const emailNotificationResult = await sendEmailNotification(notificationParams);
      if (!emailNotificationResult.success) {
        console.error("sendGeneralNotification_sendEmailNotification_エラー:");
        console.error("sendGeneralNotification_sendEmailNotification_エラー_stack:", new Error().stack);
        return { success: false, error: "メール通知の送信に失敗しました" };
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // アプリ内通知を送信。NOW以外でも登録する。
    // アプリ内表示は、通知のデータ表示時に制限しているので、登録しただけでは表示されない。
    // その登録したdataを元に、GitHub Actionsで送信する
    if (notificationParams.sendMethods.includes(NotificationSendMethod.IN_APP)) {
      const inAppNotificationResult = await sendInAppNotification(notificationParams);
      if (!inAppNotificationResult.success) {
        console.error("sendGeneralNotification_sendInAppNotification_エラー:");
        console.error("sendGeneralNotification_sendInAppNotification_エラー_stack:", new Error().stack);
        return { success: false, error: "アプリ内通知の送信に失敗しました" };
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    return { success: true };
  } catch (error) {
    console.error("sendGeneralNotification_エラー:", error);
    console.error("sendGeneralNotification_エラーstack:", new Error().stack);
    return { success: false, error: "通知エラーが発生しました" };
  }
}
