import type { NotificationSendTiming, NotificationTargetType } from "@prisma/client";
import NotificationEmail from "@/emails/notification";
import { env } from "@/env";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";

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
  senderUserId: string | null;
  actionUrl: string | null;
  targetType: NotificationTargetType;
  groupId: string | null;
  taskId: string | null;
  auctionId: string | null;
  sendTiming: NotificationSendTiming;
  sendScheduledDate: Date | null;
  expiresAt: Date | null;
  fromEmail?: string;
  subjectEmail?: string;
  usernameEmail?: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * メール通知を送信する関数
 * @param {NotificationParams} params 通知のパラメータ
 * @returns {success: boolean, error?: string} 成功したかどうか
 */
export async function sendEmailNotification(params: NotificationParams): Promise<{ success: boolean; error?: string }> {
  "use server"; // Server Actions としてマーク

  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // // 受信者のメールアドレスを取得
    // const recipientUserEmails = await prisma.user.findMany({
    //   where: {
    //     id: { in: params.recipientUserIds },
    //   },
    //   select: {
    //     email: true,
    //   },
    // });

    // console.log("email-notification.ts_sendEmailNotification_recipientUserEmails", recipientUserEmails);

    // // 受信者リストの検証
    // if (!recipientUserEmails || recipientUserEmails.length === 0) {
    //   return { success: false, error: "受信者リストが空です" };
    // }

    // // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // // // 各受信者へのメール送信を非同期で実行
    // // const sendPromises = recipientUserEmails.map(async (recipient) => {
    // //   try {
    // //     const data = await resend.emails.send({
    // //       from,
    // //       to: recipient,
    // //       subject,
    // //       html: htmlContent,
    // //     });

    // //     return { email: recipient, success: true, id: data };
    // //   } catch (error) {
    // //     console.error(`Failed to send email to ${recipient}:`, error);
    // //     return { email: recipient, success: false, error };
    // //   }
    // // });

    // // // すべての送信処理を待機
    // // const results = await Promise.all(sendPromises);

    // // // 送信成功と失敗の数をカウント
    // // const successful = results.filter(r => r.success).length;
    // // const failed = results.length - successful;

    // // return {
    // //   success: true,
    // //   summary: {
    // //     total: recipients.length,
    // //     successful,
    // //     failed
    // //   },
    // //   results
    // // };

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

    // console.log("email-notification.ts_sendEmailNotification_data", data);

    // if (error) {
    //   const errorMessage = `${error.name}: ${error.message}`;
    //   console.error("Resend API Error:", error);
    //   return { success: false, error: `メール通知を送信できませんでした: ${errorMessage}` };
    // }

    // // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // メール送信に成功した場合
    return { success: true };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // メール送信に失敗した場合
  } catch (error) {
    console.error("email-notification.ts_sendEmailNotification_error", error);
    return {
      success: false,
      error: "メール通知を送信できませんでした",
    };
  }
}
