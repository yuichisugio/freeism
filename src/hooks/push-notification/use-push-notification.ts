// hooks/usePushNotification.ts

"use client";

import { useCallback, useEffect, useState } from "react";
import { deleteSubscription, saveSubscription } from "@/app/actions/push-notification";
import { useSession } from "next-auth/react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// サービスワーカーのパス
const SERVICE_WORKER_PATH = "/service-worker.js";

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
  const [subscriptionState, setSubscriptionState] = useState<PushSubscription | null>(null);
  // 購読中かどうかを管理
  const [isSubscribing, setIsSubscribing] = useState(false);
  // エラー情報を管理
  const [error, setError] = useState<Error | null>(null);
  // isSupported: サービスワーカーとPush APIがサポートされているかどうか
  const [isSupported, setIsSupported] = useState(false);
  // サービスワーカーの登録情報
  const [registrationState, setRegistrationState] = useState<ServiceWorkerRegistration | null>(null);
  // 通知の許可
  const [permissionState, setPermissionState] = useState<NotificationPermission>("default");
  // デバイスID
  const [deviceId, setDeviceId] = useState<string | null>(null);
  // セッション情報
  const { status } = useSession();
  // 通知許可を要求したかどうかのフラグ
  const [hasRequestedPermission, setHasRequestedPermission] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 現在の購読情報を取得
   * @returns {PushSubscription | null} 購読情報
   */
  const getSubscription = useCallback(async () => {
    // サービスワーカーが登録されていない場合はnullを返す
    if (!subscriptionState) {
      console.error("サービスワーカーが登録されていません");
      return null;
    }

    try {
      if (!registrationState) {
        console.error("サービスワーカーが登録されていません");
        return null;
      }
      // 購読情報を取得
      const sub = await registrationState.pushManager.getSubscription();
      // stateに購読情報を保存
      setSubscriptionState(sub);
      return sub;
    } catch (err) {
      console.error("購読情報の取得に失敗しました:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    }
  }, [subscriptionState, registrationState]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Service Workerの初期化
   * 1. Service Workerの登録
   * 2. readyでactiveなService Workerを取得
   * 3. getSubscriptionで購読情報を取得
   * 4. 購読情報がある場合は購読中フラグをtrueにする
   * @returns {void}
   */
  const initializeServiceWorker = useCallback(async () => {
    try {
      // Service Workerを登録
      const reg = await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
      setRegistrationState(reg);
      console.log("initializeServiceWorker_navigator.serviceWorker.register", reg);

      // Service Workerを登録
      const swRegistration = await navigator.serviceWorker.ready;
      console.log("initializeServiceWorker_navigator.serviceWorker.ready", swRegistration);

      // 購読情報を取得
      const subscription = await swRegistration.pushManager.getSubscription();
      console.log("initializeServiceWorker_getSubscription", subscription);

      // 購読情報がある場合は購読中フラグをtrueにする
      if (subscription) {
        setIsSubscribing(true);
        console.log("initializeServiceWorker_subscription_true", subscription.endpoint);
      } else {
        setIsSubscribing(false);
        console.log("initializeServiceWorker_subscription_false");
      }
    } catch (error) {
      console.error("initializeServiceWorker_error", error);
      setError(error instanceof Error ? error : new Error(String(error)));
    }
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 1. Service WorkerとPush APIがサポートされているかどうか確認を管理
   * 2. サービスワーカーを登録
   * @returns {void}
   */
  useEffect(() => {
    // 1. Service Workerがブラウザでサポートされているか確認
    const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
    setIsSupported(supported);
    setPermissionState(Notification.permission);

    // 2. サービスワーカーが登録されていない場合は登録
    if (supported && !subscriptionState) {
      // service workerを登録・取得・stateに保存
      void initializeServiceWorker();
    }
  }, [status, subscriptionState, initializeServiceWorker]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 通知を購読
   * @returns {PushSubscription | null} 購読情報
   */
  const subscribe = useCallback(async () => {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // サービスワーカーが登録されていない場合はnullを返す
    if (!subscriptionState || !isSupported || !permissionState) {
      setError(new Error("Service WorkerまたはPush APIがサポート or 通知の許可が得られませんでした"));
      setIsSubscribing(false);
      setPermissionState(Notification.permission);
      return null;
    }

    try {
      // 既存の購読を確認
      let sub = await getSubscription();

      // 既に購読している場合は、その情報を返す
      if (sub) {
        setIsSubscribing(false);
        return sub;
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 通知の許可が得られていない場合は、通知の許可を要求
      if (!permissionState) {
        // プッシュ通知の許可を要求
        const permission = await Notification.requestPermission();
        setPermissionState(permission);
      }

      // 通知の許可が得られなかった場合はエラーを返す
      if (permissionState !== "granted") {
        throw new Error("通知の許可が得られませんでした");
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // VAPID 公開鍵を環境変数から取得
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      // VAPID 公開鍵が設定されていない場合はエラーを返す
      if (!vapidPublicKey) {
        throw new Error("VAPID 公開鍵が設定されていません");
      }

      // 公開鍵をUint8Arrayに変換
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      //ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      if (!registrationState) {
        console.error("サービスワーカーが登録されていません");
        return null;
      }

      // プッシュサービスに購読
      sub = await registrationState.pushManager.subscribe({
        userVisibleOnly: true, // 通知は常にユーザーに表示される
        applicationServerKey,
      });

      console.log("通知を購読しました:", sub);

      // 購読情報を更新
      setSubscriptionState(sub);

      const subscriptionJson = sub.toJSON();

      console.log("subscriptionJson", subscriptionJson);

      // endpoint または keys が取得できなかった場合のエラーハンドリング
      if (!subscriptionJson.endpoint || !subscriptionJson.keys?.p256dh || !subscriptionJson.keys?.auth) {
        // endpoint または keys が取得できなかった場合のエラーハンドリング
        const errorMessage = "通知の有効化に失敗しました。有効な購読情報が取得できませんでした。";
        console.error("Failed to get a valid push subscription object:", errorMessage, subscriptionJson);
        setError(new Error(errorMessage)); // エラー状態を更新
        setIsSubscribing(false); // 購読中フラグをリセット
        return null; //  処理を中断
      }

      // サーバーに購読情報を送信
      // この時点では TypeScript は endpoint, keys.p256dh, keys.auth が string であると認識する
      // saveSubscription に渡すオブジェクトの型を明示的に合わせる
      const result = await saveSubscription({
        endpoint: subscriptionJson.endpoint,
        // expirationTime は null | undefined の可能性があるため、nullish coalescing operator (??) を使って null にフォールバックさせる
        expirationTime: subscriptionJson.expirationTime ?? null,
        keys: {
          p256dh: subscriptionJson.keys.p256dh,
          auth: subscriptionJson.keys.auth,
        },
      });

      // 購読中かどうかを管理
      setIsSubscribing(true);

      console.log("購読情報を保存しました:", result);

      return sub;

      //ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
    } catch (err) {
      console.error("通知の購読に失敗しました:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsSubscribing(false);
      return null;
    }
  }, [registrationState, isSupported, getSubscription, permissionState, subscriptionState]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 通知の購読を解除
   * @returns {boolean} 購読解除の成否
   */
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
        setSubscriptionState(null);
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

  return {
    // サービスワーカーの登録情報
    registrationState,
    // 購読情報
    subscriptionState,
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
    // デバイスID
    deviceId,
    // デバイスIDを更新
    setDeviceId,
    // セッション情報
    status,
    // 通知許可を要求したかどうかのフラグ
    hasRequestedPermission,
    // 通知許可を要求したかどうかのフラグを更新
    setHasRequestedPermission,
    // 通知許可
    permissionState,
  };
}
