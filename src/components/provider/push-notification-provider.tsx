"use client";

import { useEffect, useState } from "react";
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
  const { subscribe, isSupported, isSubscribing, setDeviceId, status } = usePushNotification();
  // 通知許可を要求したかどうかのフラグ
  const [hasRequestedPermission, setHasRequestedPermission] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 許可要求状態を読み込む
  useEffect(() => {
    // ローカルストレージから許可要求状態を読み込む
    const hasRequested = localStorage.getItem("push-notification-requested") === "true";
    setHasRequestedPermission(hasRequested);
  }, []);

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
    // 認証済みで、サポートされており、まだ購読していない、かつ許可を要求していない、かつ通知許可が拒否されていない場合
    if (status === "authenticated" && isSupported && !isSubscribing && !hasRequestedPermission && Notification.permission !== "denied") {
      // 通知許可を要求するタイミングを遅らせる（ユーザーがサイトにアクセスして少し経ってから）
      const timer = setTimeout(() => {
        // 購読を要求する
        if (subscribe) void subscribe();
        // 許可要求状態をローカルストレージに保存
        localStorage.setItem("push-notification-requested", "true");
        // 許可要求状態を更新
        setHasRequestedPermission(true);
      }, 3000); // 3秒後に表示

      // タイムアウトをクリア
      return () => clearTimeout(timer);
    }
  }, [status, subscribe, isSupported, isSubscribing, hasRequestedPermission]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return <>{children}</>;
}
