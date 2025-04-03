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
  const { subscribe, isSupported, subscriptionState, setDeviceId, permissionState } = usePushNotification();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // デバイスIDを読み込む
  useEffect(() => {
    try {
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
    } catch (error) {
      console.error("デバイスIDの設定に失敗しました:", error);
    }
  }, [setDeviceId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  useEffect(() => {
    // サポートされており、まだ購読していない、かつ通知許可が拒否されていない場合
    // status が "loading" または "unauthenticated" の場合は実行しない
    if (isSupported && !subscriptionState && permissionState !== "denied") {
      console.log("プッシュ通知の購読を試みます", {
        isSupported,
        hasSubscription: !!subscriptionState,
        permissionState,
      });
    }
    // 3秒後に表示。通知許可を要求するタイミングを遅らせる（ユーザーがサイトにアクセスして少し経ってから）
    const timer = setTimeout(() => {
      // 購読を要求する
      if (subscribe)
        void subscribe().catch((err) => {
          console.error("購読に失敗しました:", err);
        });
    }, 3000);
    // タイムアウトをクリア
    return () => clearTimeout(timer);
  }, [subscribe, isSupported, subscriptionState, permissionState]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return <>{children}</>;
}
