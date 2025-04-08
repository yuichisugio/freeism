import type { NotificationSendTiming, NotificationTargetType } from "@prisma/client";
import NotificationEmail from "@/emails/notification";
import { env } from "@/env";
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
  toEmail?: string;
  subjectEmail?: string;
  usernameEmail?: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * メール通知送信関数
 * @param _params メール通知送信パラメータ
 * @returns メール通知送信結果
 */
export async function sendEmailNotification(params: NotificationParams): Promise<{ success: boolean; error?: string }> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // メール送信に必要なパラメータを設定
    const fromEmail = params.fromEmail ?? `noreply@${env.DOMAIN}`;
    const toEmail = params.toEmail ?? params.recipientUserIds.join(",");
    const subjectEmail = params.subjectEmail ?? params.title;
    const usernameEmail = params.usernameEmail ?? params.recipientUserIds.join(",");
    const reactEmail = NotificationEmail({ title: params.title, message: params.message, username: usernameEmail });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // Resendでメール送信
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: subjectEmail,
      react: reactEmail,
    });

    console.log("email-notification.ts_sendEmailNotification_data", data);

    if (error) {
      const errorMessage = `${error.name}: ${error.message}`;
      console.error("Resend API Error:", error);
      return { success: false, error: `メール通知を送信できませんでした: ${errorMessage}` };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
