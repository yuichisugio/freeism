// hooks/usePushNotification.ts

"use client";

import { useCallback, useEffect, useState } from "react";
import { deleteSubscription, saveSubscription } from "@/app/actions/push-notification";

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
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 購読情報を管理
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  // 購読中かどうかを管理
  const [isSubscribing, setIsSubscribing] = useState(false);
  // エラー情報を管理
  const [error, setError] = useState<Error | null>(null);
  // registration: サービスワーカーの登録情報
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  // isSupported: サービスワーカーとPush APIがサポートされているかどうか
  const [isSupported, setIsSupported] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  useEffect(() => {
    // Service Workerがブラウザでサポートされているか確認
    const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
    setIsSupported(supported);

    if (!supported) {
      setError(new Error("このブラウザはService WorkerとPush APIをサポートしていません"));
      return;
    }

    // Service Workerの登録
    const registerServiceWorker = async () => {
      try {
        // Service Workerを登録
        const reg = await navigator.serviceWorker.register("/service-worker.js");
        console.log("Service Worker が登録されました:", reg);
        setRegistration(reg);
      } catch (err) {
        console.error("Service Worker の登録に失敗しました:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    };

    void registerServiceWorker();
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 現在の購読情報を取得
  const getSubscription = useCallback(async () => {
    // サービスワーカーが登録されていない場合はnullを返す
    if (!registration) return null;

    try {
      // 購読情報を取得
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
    // サービスワーカーが登録されていない場合はnullを返す
    if (!registration || !isSupported) {
      setError(new Error("Service WorkerまたはPush APIがサポートされていません"));
      setIsSubscribing(false);
      return null;
    }

    setIsSubscribing(false);

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

      // 通知の許可が得られなかった場合はエラーを返す
      if (permission !== "granted") {
        throw new Error("通知の許可が得られませんでした");
      }

      // VAPID 公開鍵を環境変数から取得
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      // VAPID 公開鍵が設定されていない場合はエラーを返す
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

      const subscriptionJson = sub.toJSON();

      console.log("subscriptionJson", subscriptionJson);

      if (!subscriptionJson.endpoint || !subscriptionJson.keys?.p256dh || !subscriptionJson.keys?.auth) {
        // endpoint または keys が取得できなかった場合のエラーハンドリング
        const errorMessage = "通知の有効化に失敗しました。有効な購読情報が取得できませんでした。";
        console.error("Failed to get a valid push subscription object:", errorMessage, subscriptionJson);
        setError(new Error(errorMessage)); // エラー状態を更新
        setIsSubscribing(false); // 購読中フラグをリセット
        // alert(errorMessage); // 必要であればアラート表示
        return null; // ★★★ 処理を中断 ★★★
      }

      // サーバーに購読情報を送信
      // この時点では TypeScript は endpoint, keys.p256dh, keys.auth が string であると認識する
      // saveSubscription に渡すオブジェクトの型を明示的に合わせる
      await saveSubscription({
        endpoint: subscriptionJson.endpoint,
        // expirationTime は null | undefined の可能性があるため、nullish coalescing operator (??) を使って null にフォールバックさせる
        expirationTime: subscriptionJson.expirationTime ?? null,
        keys: {
          p256dh: subscriptionJson.keys.p256dh,
          auth: subscriptionJson.keys.auth,
        },
      });

      // 購読情報を更新
      setSubscription(sub);
      // 購読中かどうかを管理
      setIsSubscribing(true);
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
    // 購読情報を取得
    const sub = await getSubscription();

    // 購読情報がない場合はtrueを返す
    if (!sub) {
      console.log("購読情報がありません");
      return true;
    }

    try {
      // サーバーから購読情報を削除
      await deleteSubscription(sub.endpoint);

      // プッシュサービスから購読を解除
      const result = await sub.unsubscribe();

      // 購読情報を更新
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

  // 購読情報を取得
  useEffect(() => {
    // サービスワーカーが登録されている場合は購読情報を取得
    if (registration) {
      // 購読情報を取得
      void getSubscription();
    }
  }, [registration, getSubscription]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    // サービスワーカーの登録情報
    registration,
    // 購読情報
    subscription,
    // 購読中かどうか
    isSubscribing,
    // サポートされているかどうか
    isSupported,
    // エラー情報
    error,
    // 購読
    subscribe,
    // 購読解除
    unsubscribe,
    // 購読情報を取得
    getSubscription,
  };
}
