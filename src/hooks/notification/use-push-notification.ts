"use client";

import { useCallback, useEffect, useState } from "react";
import { deleteSubscription, getRecordId, saveSubscription } from "@/app/actions/push-notification";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// サービスワーカーのパス
const SERVICE_WORKER_PATH = "/service-worker.js";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * サービスワーカーのメッセージイベントの型定義
 */
type ServiceWorkerMessageEvent = {
  type: string;
  oldEndpoint?: string;
  newSubscription?: PushSubscription;
};

/**
 * データベースに保存する購読情報の型定義
 */
type SaveSubscriptionParams = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  recordId?: string;
};

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

/**
 * PushSubscriptionオブジェクトからサーバーに送信するデータを整形する関数
 * @param subscription - PushSubscriptionオブジェクト
 * @param recordId - 購読情報のレコードID（オプション）
 * @returns サーバーに送信する購読情報
 */
function formatSubscriptionForServer(subscription: PushSubscription | null, recordId?: string): SaveSubscriptionParams | null {
  if (!subscription) {
    return null;
  }

  // 購読情報をJSONに変換
  const subscriptionJSON = subscription.toJSON();

  // キーが不足している場合はnullを返す
  if (!subscriptionJSON.endpoint || !subscriptionJSON.keys?.p256dh || !subscriptionJSON.keys?.auth) {
    console.error("有効な購読情報が取得できませんでした", subscriptionJSON);
    return null;
  }

  // サーバーに送信するデータを整形
  const subscriptionData: SaveSubscriptionParams = {
    endpoint: subscriptionJSON.endpoint,
    expirationTime: subscriptionJSON.expirationTime ?? null,
    keys: {
      p256dh: subscriptionJSON.keys.p256dh,
      auth: subscriptionJSON.keys.auth,
    },
  };

  // recordIdが指定されている場合は追加
  if (recordId) {
    subscriptionData.recordId = recordId;
  }

  return subscriptionData;
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
  // レコードID
  const [recordId, setRecordId] = useState<string | null>(null);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 現在の購読情報を取得
   * @returns {PushSubscription | null} 購読情報
   */
  const getSubscription = useCallback(async () => {
    // サービスワーカーが登録されていない場合はnullを返す
    if (!registrationState) {
      console.error("サービスワーカーが登録されていません");
      return null;
    }

    try {
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
  }, [registrationState]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * クライアント側で購読情報を更新する関数
   * Service Workerからpushsubscriptionchangeイベントが発生した際に、
   * メッセージングを通じて呼び出される
   */
  const handleSubscriptionChange = useCallback(async (oldEndpoint: string, newSubscription: PushSubscription) => {
    try {
      console.log("購読情報の変更を検出しました。更新します...");

      // 新しい購読情報をステートに設定
      setSubscriptionState(newSubscription);

      // 購読情報を整形
      const subscriptionData = formatSubscriptionForServer(newSubscription);
      if (!subscriptionData) {
        throw new Error("有効な購読情報を整形できませんでした");
      }

      // サーバーに購読情報を送信
      const result = await saveSubscription(subscriptionData);

      console.log("購読情報の更新が完了しました:", result);
    } catch (err) {
      console.error("購読情報の更新に失敗しました:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Service Workerの初期化
   * 1. Service Workerの登録
   * 2. readyでactiveなService Workerを取得
   * 3. getSubscriptionで購読情報を取得
   * 4. 購読情報がある場合は購読中フラグをtrueにする
   * 5. メッセージングのためのイベントリスナーを設定
   * @returns {void}
   */
  const initializeServiceWorker = useCallback(async () => {
    try {
      // 1. Service Workerを登録
      console.log("initializeServiceWorker_navigator.serviceWorker.register_start");
      // 既に登録されているService Workerを取得
      const existingRegistration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_PATH);
      // 既に登録されている場合は、その情報を保存
      if (existingRegistration) {
        console.log("initializeServiceWorker_navigator.serviceWorker.register_existingRegistration", existingRegistration);
        setRegistrationState(existingRegistration);
      } else {
        // 既に登録されていない場合は、新しく登録
        const reg = await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
        setRegistrationState(reg);
        console.log("initializeServiceWorker_navigator.serviceWorker.register", reg);
      }

      // 2. Service Workerの登録状態と既存の購読を確認
      const registration = await navigator.serviceWorker.ready;
      console.log("initializeServiceWorker_navigator.serviceWorker.ready", registration);

      // 3. 購読情報を取得
      const subscription = await registration.pushManager.getSubscription();
      console.log("initializeServiceWorker_getSubscription", subscription);

      // 4. 購読情報がある場合は購読中フラグをtrueにする
      if (subscription) {
        setSubscriptionState(subscription);
        console.log("initializeServiceWorker_getSubscription_existing", subscription);
      } else {
        setSubscriptionState(null);
        console.log("initializeServiceWorker_getSubscription_null");
      }

      // 5. 購読情報をDBに保存
      const subscriptionData = formatSubscriptionForServer(subscription);
      if (subscriptionData) {
        await saveSubscription(subscriptionData);
        console.log("initializeServiceWorker_saveSubscription", subscriptionData);
      }

      // 5. メッセージングのためのイベントリスナーを設定
      navigator.serviceWorker.addEventListener("message", (event) => {
        // Service Workerからのメッセージを処理
        const messageData = event.data as ServiceWorkerMessageEvent;
        if (messageData && messageData.type === "SUBSCRIPTION_CHANGED") {
          if (messageData.oldEndpoint && messageData.newSubscription) {
            // 購読情報が変更された場合の処理を非同期で実行
            void handleSubscriptionChange(messageData.oldEndpoint, messageData.newSubscription);
          }
        }
      });
      console.log("initializeServiceWorker_addEventListener_message");
    } catch (error) {
      console.error("initializeServiceWorker_error", error);
      setError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [handleSubscriptionChange]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 1. Service WorkerとPush APIがサポートされているかどうか確認を管理
   * 2. サービスワーカーを登録
   * 3. デバイスIDを読み込む
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

    // pushSubscriptionテーブルのrecord_idを読み込む
    const loadRecordId = async () => {
      const recordId = await getRecordId(subscriptionState?.endpoint ?? "");
      setRecordId(recordId);
    };
    void loadRecordId();
  }, [subscriptionState, initializeServiceWorker]);

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

    // 通知の許可が"denied"の場合はnullを返す（許可ダイアログは表示されない）
    if (permissionState === "denied") {
      setError(new Error("通知の許可が得られませんでした"));
      return null;
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    try {
      // サービスワーカーの登録がない場合は登録を行う（二重登録を避ける）
      let registration = registrationState;
      if (!registration) {
        // Service Workerの登録を試みる
        registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
        setRegistrationState(registration);
        console.log("Service Worker registered:", registration);
      }

      // 既存の購読を確認
      let sub = await getSubscription();

      // 既に購読している場合は、その情報を返す
      if (sub) {
        console.log("既存の購読が見つかりました:", sub);
        setSubscriptionState(sub);
        return sub;
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 通知の許可が得られていない場合は、通知の許可を要求
      if (permissionState !== "granted") {
        console.log("通知の許可を要求します");
        // プッシュ通知の許可を要求
        const permission = await Notification.requestPermission();
        setPermissionState(permission);

        // 許可が得られなかった場合はエラーを返す
        if (permission !== "granted") {
          console.log("通知の許可が得られませんでした:", permission);
          throw new Error("通知の許可が得られませんでした");
        }
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

      // サービスワーカーの登録状態を再確認
      if (!registration) {
        console.error("サービスワーカーが登録されていません");
        return null;
      }

      // プッシュサービスに購読
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true, // 通知は常にユーザーに表示される
        applicationServerKey,
      });
      console.log("通知を購読しました:", sub);
      // 購読情報を更新
      setSubscriptionState(sub);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 購読情報を整形
      const subscriptionData = formatSubscriptionForServer(sub, recordId ?? undefined);
      if (!subscriptionData) {
        throw new Error("有効な購読情報が取得できませんでした");
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // サーバーに購読情報を送信
      const result = await saveSubscription(subscriptionData);
      console.log("購読情報を保存しました:", result);

      // エラーレスポンスをチェック
      if ("error" in result) {
        console.warn("購読情報の保存中にエラーが発生しました:", result.error);
        // エラーがあってもクライアント側の購読は維持する
        return sub;
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      return result;

      //ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
    } catch (err) {
      console.error("通知の購読に失敗しました:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    }
  }, [registrationState, isSupported, getSubscription, permissionState, recordId]);

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
    // 通知許可
    permissionState,
    // 購読情報の変更を処理する関数
    handleSubscriptionChange,
  };
}
