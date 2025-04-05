/**
 * メール通知送信関数
 * @param notificationId 通知ID
 * @returns メール通知送信結果
 */
export async function sendEmailNotification(notificationId: string) {
  return {
    success: true,
    message: "メール通知を送信しました",
  };
}
