"use client";

import { useEffect } from "react";
import { usePushNotification } from "@/hooks/push-notification/use-push-notification";
import { v4 as uuidv4 } from "uuid";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

type PushNotificationProviderProps = {
  children: React.ReactNode;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * プッシュ通知のProvider
 * セッション情報を取得し、プッシュ通知の許可を要求する
 * @param children
 * @returns
 */
export function PushNotificationProvider({ children }: PushNotificationProviderProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // プッシュ通知のhookを使用
  const { subscribe, isSupported, subscriptionState, setDeviceId, status } = usePushNotification();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // デバイスIDを読み込む
  useEffect(() => {
    // デバイスIDを読み込む
    let deviceId = localStorage.getItem("device_id");
    // デバイスIDが存在しない場合
    if (!deviceId) {
      // デバイスIDを生成
      deviceId = uuidv4();
      // デバイスIDをlocalstorageに保存
      localStorage.setItem("device_id", deviceId);
    }
    // デバイスIDを設定
    setDeviceId(deviceId);
  }, [setDeviceId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  useEffect(() => {
    // 認証済みで、サポートされており、まだ購読していない、かつ通知許可が拒否されていない場合
    if (status === "authenticated" && isSupported && !subscriptionState && Notification.permission !== "denied") {
      // 3秒後に表示。通知許可を要求するタイミングを遅らせる（ユーザーがサイトにアクセスして少し経ってから）
      const timer = setTimeout(() => {
        // 購読を要求する
        if (subscribe) void subscribe();
      }, 3000);

      // タイムアウトをクリア
      return () => clearTimeout(timer);
    }
  }, [status, subscribe, isSupported, subscriptionState]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return <>{children}</>;
}
