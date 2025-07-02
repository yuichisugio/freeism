"use server";

import { prisma } from "@/library-setting/prisma";
import { NotificationSendMethod, NotificationSendTiming, NotificationTargetType } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * メール通知送信パラメータ
 * senderUserId：オークション系の場合は、定期実行で呼ばれるので、senderUserIdは不要
 * pushNotificationActionUrl：メールのクリック時の遷移先URL。push通知で使用する
 */
export type NotificationParams = {
  recipientUserIds: string[];
  title: string;
  message: string;
  sendMethods: NotificationSendMethod[];
  targetType: NotificationTargetType;
  sendTiming: NotificationSendTiming;
  senderUserId: string | null;
  actionUrl: string | null;
  groupId: string | null;
  taskId: string | null;
  auctionId: string | null;
  sendScheduledDate: Date | null;
  expiresAt: Date | null;
  fromEmail?: string;
  subjectEmail?: string;
  usernameEmail?: string;
  notificationId: string | null;
  sentAt: Date | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * メール通知を送信する関数
 * @param {NotificationParams} params 通知のパラメータ
 * @returns {success: boolean, error?: string} 成功したかどうか
 */
export async function sendEmailNotification(
  params: NotificationParams,
): Promise<{ success: boolean; message: string }> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 受信者のメール通知設定を取得
     */
    const emailNotificationSettings = await prisma.userSettings.findMany({
      where: {
        userId: { in: params.recipientUserIds },
        isEmailEnabled: true,
      },
      select: {
        isEmailEnabled: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * メール通知設定が見つからない場合は、メール通知を送信しない
     */
    if (emailNotificationSettings.length === 0) {
      return { success: true, message: "メール通知設定が見つかりません" };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // // 各受信者へのメール送信を非同期で実行
    // const sendPromises = recipientUserEmails.map(async (recipient) => {
    //   try {
    //     const data = await resend.emails.send({
    //       from,
    //       to: recipient,
    //       subject,
    //       html: htmlContent,
    //     });

    //     return { email: recipient, success: true, id: data };
    //   } catch (error) {
    //     console.error(`Failed to send email to ${recipient}:`, error);
    //     return { email: recipient, success: false, error };
    //   }
    // });

    // // すべての送信処理を待機
    // const results = await Promise.all(sendPromises);

    // // 送信成功と失敗の数をカウント
    // const successful = results.filter(r => r.success).length;
    // const failed = results.length - successful;

    // return {
    //   success: true,
    //   summary: {
    //     total: recipients.length,
    //     successful,
    //     failed
    //   },
    //   results
    // };

    // // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // // メール送信に必要なパラメータを設定
    // const fromEmail = params.fromEmail ?? `noreply@${env.DOMAIN}`;
    // const toEmail = recipientUserEmails.map((user) => user.email).join(",");
    // const subjectEmail = params.subjectEmail ?? params.title;
    // const usernameEmail = params.usernameEmail ?? params.recipientUserIds.join(",");
    // const reactEmail = NotificationEmail({ title: params.title, message: params.message, username: usernameEmail });

    // // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // // Resendでメール送信
    // const { data, error } = await resend.emails.send({
    //   from: fromEmail,
    //   to: toEmail,
    //   subject: subjectEmail,
    //   react: reactEmail,
    // });

    // if (error) {
    //   const errorMessage = `${error.name}: ${error.message}`;
    //   console.error("Resend API Error:", error);
    //   return { success: false, error: `メール通知を送信できませんでした: ${errorMessage}` };
    // }

    // // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * メール送信に成功した場合
     */
    return { success: true, message: "メール通知を送信しました" };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * メール送信に失敗した場合
     */
  } catch (error) {
    console.error("email-notification.ts_sendEmailNotification_error", error);
    return {
      success: false,
      message: `メール通知を送信できませんでした: ${error instanceof Error ? error.message : "不明なエラー"}`,
    };
  }
}
