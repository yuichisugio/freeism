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
 * @returns {Object} プッシュ通知の購読情報とエラー
 */
export function usePushNotification() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 購読情報を管理
  const [subscriptionState, setSubscriptionState] = useState<PushSubscription | null>(null);
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

      // Service Workerの登録状態と既存の購読を確認
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        setSubscriptionState(subscription);
        console.log("initializeServiceWorker_getSubscription", subscription);
      } else {
        setSubscriptionState(null);
        console.log("initializeServiceWorker_getSubscription_null");
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
    if (!isSupported) {
      setError(new Error("Service WorkerまたはPush APIがサポートしていません。"));
      setPermissionState(Notification.permission);
      return null;
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 通知の許可が得られていない場合はnullを返す
    if (!permissionState) {
      setError(new Error("通知の許可が得られませんでした"));
      setPermissionState(Notification.permission);
      return null;
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    try {
      const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
      console.log("Service Worker registered:", registration);

      // 既存の購読を確認
      let sub = await getSubscription();

      // 既に購読している場合は、その情報を返す
      if (sub) {
        setSubscriptionState(sub);
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

      if (!registrationState) {
        console.error("サービスワーカーが登録されていません");
        return null;
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // デバイスIDがない場合はエラーを返す
      if (!deviceId) {
        console.error("デバイスIDがありません");
        throw new Error("デバイスIDがありません");
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

      // プッシュサービスに購読
      sub = await registrationState.pushManager.subscribe({
        userVisibleOnly: true, // 通知は常にユーザーに表示される
        applicationServerKey,
      });
      console.log("通知を購読しました:", sub);
      // 購読情報を更新
      setSubscriptionState(sub);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 購読情報をJSONに変換
      const subscriptionJson = sub.toJSON();
      console.log("subscriptionJson", subscriptionJson);

      // endpoint または keys が取得できなかった場合のエラーハンドリング
      if (!subscriptionJson.endpoint || !subscriptionJson.keys?.p256dh || !subscriptionJson.keys?.auth) {
        // endpoint または keys が取得できなかった場合のエラーハンドリング
        const errorMessage = "通知の有効化に失敗しました。有効な購読情報が取得できませんでした。";
        console.error("Failed to get a valid push subscription object:", errorMessage, subscriptionJson);
        setError(new Error(errorMessage)); // エラー状態を更新
        return null; //  処理を中断
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // サーバーに購読情報を送信
      const result = await saveSubscription({
        endpoint: subscriptionJson.endpoint,
        expirationTime: subscriptionJson.expirationTime ?? null,
        keys: {
          p256dh: subscriptionJson.keys.p256dh,
          auth: subscriptionJson.keys.auth,
        },
        deviceId: deviceId,
      });
      console.log("購読情報を保存しました:", result);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      return result;

      //ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
    } catch (err) {
      console.error("通知の購読に失敗しました:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    }
  }, [registrationState, isSupported, getSubscription, permissionState, deviceId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 通知の購読を解除
   * @returns {boolean} 購読解除の成否
   */
  const unsubscribe = useCallback(async () => {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
    // 購読情報を取得
    const sub = await getSubscription();

    // 購読情報がない場合はtrueを返す
    if (!sub) {
      console.log("購読情報がありません");
      return true;
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    try {
      // サーバーから購読情報を削除
      await deleteSubscription(sub.endpoint);

      // プッシュサービスから購読を解除
      const result = await sub.unsubscribe();

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 購読情報を更新
      if (result) {
        setSubscriptionState(null);
        console.log("通知の購読を解除しました");
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // デバイスIDを削除
      localStorage.removeItem("device_id");
      setDeviceId(null);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      return result;

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
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
    // 通知許可
    permissionState,
  };
}
