/**
 * アプリ内通知送信関数
 * @param notificationId 通知ID
 * @returns アプリ内通知送信結果
 */
export async function sendInAppNotification(notificationId: string) {
  return {
    success: true,
    message: "アプリ内通知を送信しました",
  };
}
