// hooks/usePushNotification.ts

"use client";

import { useCallback, useEffect, useState } from "react";
import { deleteSubscription, saveSubscription } from "@/app/actions/push-notification";

import { useServiceWorker } from "./use-service-worker";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * URLBase64をUint8Arrayに変換するヘルパー関数
 * @param base64String - URLBase64文字列
 * @returns Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * プッシュ通知を管理するフック
 * @returns プッシュ通知の購読情報とエラー
 */
export function usePushNotification() {
  const { registration, isSupported, error: swError } = useServiceWorker();
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [error, setError] = useState<Error | null>(swError);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 現在の購読情報を取得
  const getSubscription = useCallback(async () => {
    if (!registration) return null;

    try {
      const sub = await registration.pushManager.getSubscription();
      setSubscription(sub);
      return sub;
    } catch (err) {
      console.error("購読情報の取得に失敗しました:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    }
  }, [registration]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 通知を購読
  const subscribe = useCallback(async () => {
    if (!registration || !isSupported) {
      setError(new Error("Service WorkerまたはPush APIがサポートされていません"));
      return null;
    }

    setIsSubscribing(true);

    try {
      // 既存の購読を確認
      let sub = await getSubscription();

      // 既に購読している場合は、その情報を返す
      if (sub) {
        setIsSubscribing(false);
        return sub;
      }

      // プッシュ通知の許可を要求
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        throw new Error("通知の許可が得られませんでした");
      }

      // VAPID 公開鍵を環境変数から取得
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!vapidPublicKey) {
        throw new Error("VAPID 公開鍵が設定されていません");
      }

      // 公開鍵をUint8Arrayに変換
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      // プッシュサービスに購読
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true, // 通知は常にユーザーに表示される
        applicationServerKey,
      });

      console.log("通知を購読しました:", sub);

      // サーバーに購読情報を送信
      await saveSubscription(sub);

      setSubscription(sub);
      setIsSubscribing(false);
      return sub;
    } catch (err) {
      console.error("通知の購読に失敗しました:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsSubscribing(false);
      return null;
    }
  }, [registration, isSupported, getSubscription]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 通知の購読を解除
  const unsubscribe = useCallback(async () => {
    const sub = await getSubscription();

    if (!sub) {
      console.log("購読情報がありません");
      return true;
    }

    try {
      // サーバーから購読情報を削除
      await deleteSubscription(sub.endpoint);

      // プッシュサービスから購読を解除
      const result = await sub.unsubscribe();

      if (result) {
        setSubscription(null);
        console.log("通知の購読を解除しました");
      }

      return result;
    } catch (err) {
      console.error("通知の購読解除に失敗しました:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  }, [getSubscription]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  useEffect(() => {
    if (registration) {
      void getSubscription();
    }
  }, [registration, getSubscription]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    subscription,
    isSubscribing,
    isSupported,
    error,
    subscribe,
    unsubscribe,
    getSubscription,
  };
}
