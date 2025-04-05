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
  targetType: "SYSTEM" | "USER" | "GROUP" | "TASK";
  groupId: string | null;
  taskId: string | null;
  sendTiming: "NOW" | "SCHEDULED";
  sendScheduledDate: Date | null;
  expiresAt: Date | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * メール通知送信関数
 * @param params メール通知送信パラメータ
 * @returns メール通知送信結果
 */
export async function sendEmailNotification(params: NotificationParams): Promise<{ success: boolean; message: string }> {
  return {
    success: true,
    message: "メール通知は準備中です",
  };
}
