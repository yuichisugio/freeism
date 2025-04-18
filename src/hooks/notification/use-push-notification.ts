"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { deleteSubscription, getRecordId, saveSubscription } from "@/lib/actions/notification/push-notification";
import { useSession } from "next-auth/react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// State の型定義
type PushNotificationState = {
  isInitialized: boolean;
  isSupported: boolean;
  permissionState: NotificationPermission;
  registrationState: ServiceWorkerRegistration | null;
  subscriptionState: PushSubscription | null;
  recordId: string | null;
  deviceId: string | null;
  error: Error | null;
};

// 初期状態
const initialState: PushNotificationState = {
  isInitialized: false,
  isSupported: false,
  permissionState: "default",
  registrationState: null,
  subscriptionState: null,
  recordId: null,
  deviceId: null,
  error: null,
};

// Action の型定義
type Action =
  | { type: "SET_INITIAL_DATA"; payload: Partial<PushNotificationState> }
  | { type: "SET_IS_INITIALIZED"; payload: boolean }
  | { type: "SET_SUPPORTED"; payload: boolean }
  | { type: "SET_PERMISSION"; payload: NotificationPermission }
  | { type: "SET_REGISTRATION"; payload: ServiceWorkerRegistration | null }
  | { type: "SET_SUBSCRIPTION"; payload: PushSubscription | null }
  | { type: "SET_RECORD_ID"; payload: string | null }
  | { type: "SET_DEVICE_ID"; payload: string | null }
  | { type: "SET_ERROR"; payload: Error | null }
  | { type: "RESET_STATE" };

// Reducer 関数
function reducer(state: PushNotificationState, action: Action): PushNotificationState {
  switch (action.type) {
    case "SET_INITIAL_DATA":
      return { ...state, ...action.payload };
    case "SET_IS_INITIALIZED":
      return { ...state, isInitialized: action.payload };
    case "SET_SUPPORTED":
      return { ...state, isSupported: action.payload };
    case "SET_PERMISSION":
      return { ...state, permissionState: action.payload };
    case "SET_REGISTRATION":
      return { ...state, registrationState: action.payload };
    case "SET_SUBSCRIPTION":
      return { ...state, subscriptionState: action.payload };
    case "SET_RECORD_ID":
      return { ...state, recordId: action.payload };
    case "SET_DEVICE_ID":
      return { ...state, deviceId: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "RESET_STATE":
      return { ...initialState, isSupported: state.isSupported }; // isSupported は維持
    default:
      return state;
  }
}

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
  deviceId?: string;
};

/**
 * デバイス情報の型定義
 */
export type DeviceInfo = {
  brands: Array<{ brand: string; version: string }>;
  platform: string;
  mobile: boolean;
  userAgent: string;
  deviceId: string;
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
 * @param deviceId - デバイスID（オプション）
 * @returns サーバーに送信する購読情報
 */
function formatSubscriptionForServer(subscription: PushSubscription | null, recordId?: string, deviceId?: string): SaveSubscriptionParams | null {
  // 購読情報がない場合はnullを返す
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
    deviceId: deviceId,
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

  // useReducer フックを使用
  const [state, dispatch] = useReducer(reducer, initialState);
  const { isInitialized, isSupported, permissionState, registrationState, subscriptionState, recordId, deviceId, error } = state;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // userId の取得 (ここは変更なし)
  const session = useSession();
  const userId = useMemo(() => session.data?.user?.id ?? null, [session.data?.user?.id]);

  // Refs to hold the latest values of recordId and deviceId for callbacks (変更なし)
  const recordIdRef = useRef(recordId);
  const deviceIdRef = useRef(deviceId);

  // Update refs whenever the state changes (変更なし)
  useEffect(() => {
    recordIdRef.current = recordId;
  }, [recordId]);

  useEffect(() => {
    deviceIdRef.current = deviceId;
  }, [deviceId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * デバイスIDを作成
   * @returns {string} デバイスID
   */
  const getDeviceId = useCallback(async (): Promise<string> => {
    const deviceInfo: Partial<DeviceInfo> = {
      userAgent: navigator.userAgent,
    };

    // userAgentDataがサポートされているか確認
    if ("userAgentData" in navigator && navigator.userAgentData) {
      // userAgentDataを取得
      const uaData = navigator.userAgentData as {
        brands?: Array<{ brand: string; version: string }>;
        platform?: string;
        mobile?: boolean;
      };

      // deviceInfoにuserAgentDataの情報をセット
      deviceInfo.brands = uaData.brands ?? [];
      deviceInfo.platform = uaData.platform ?? "";
      deviceInfo.mobile = !!uaData.mobile;
    } else {
      // フォールバック: userAgentから情報を抽出
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      deviceInfo.brands = [{ brand: "unknown", version: "0" }];
      deviceInfo.platform = /Win/i.test(navigator.userAgent)
        ? "Windows"
        : /Mac/i.test(navigator.userAgent)
          ? "macOS"
          : /Linux/i.test(navigator.userAgent)
            ? "Linux"
            : /Android/i.test(navigator.userAgent)
              ? "Android"
              : /iOS/i.test(navigator.userAgent)
                ? "iOS"
                : "unknown";
      deviceInfo.mobile = isMobile;
    }

    // デバイスIDを生成（プラットフォームとモバイルフラグを組み合わせた簡易的なもの）同一デバイスで識別できる程度の精度があればよい
    const generatedDeviceId = `${deviceInfo.platform}-${deviceInfo.mobile ? "mobile" : "desktop"}-${deviceInfo.brands?.map((b) => b.brand).join("-") || "unknown"}-${userId}`;

    return generatedDeviceId;
  }, [userId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * クライアント側で購読情報を更新する関数
   * Service Workerからpushsubscriptionchangeイベントが発生した際に、メッセージングを通じて呼び出される
   */
  const handleSubscriptionChange = useCallback(
    async (newSubscription: PushSubscription) => {
      try {
        console.log("購読情報の変更を検出しました。更新します...");

        // 新しい購読情報をステートに設定
        dispatch({ type: "SET_SUBSCRIPTION", payload: newSubscription });

        // 購読情報を整形 (現在の recordId と deviceId を Ref から取得)
        const currentRecordId = recordIdRef.current;
        const currentDeviceId = deviceIdRef.current;
        const subscriptionData = formatSubscriptionForServer(newSubscription, currentRecordId ?? undefined, currentDeviceId ?? undefined);
        if (!subscriptionData) {
          throw new Error("有効な購読情報を整形できませんでした");
        }

        console.log("use-push-notification.ts_handleSubscriptionChange_saveSubscription_start");
        const result = await saveSubscription(subscriptionData);
        console.log("use-push-notification.ts_handleSubscriptionChange_saveSubscription_end");

        if (!("error" in result)) {
          const updatedRecordId = await getRecordId(newSubscription.endpoint);
          dispatch({ type: "SET_RECORD_ID", payload: updatedRecordId });
          recordIdRef.current = updatedRecordId;
          console.log("購読情報の更新後、recordId を更新しました:", updatedRecordId);
        } else {
          console.error("購読情報のサーバー保存(更新)に失敗しました:", result.error);
        }
      } catch (err) {
        console.error("購読情報の更新処理に失敗しました:", err);
        dispatch({ type: "SET_ERROR", payload: err instanceof Error ? err : new Error(String(err)) });
      }
    },
    [dispatch],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Service Workerの初期化 (リスナー設定など)
   */
  const initializeServiceWorker = useCallback(async () => {
    let messageHandler: ((event: MessageEvent) => void) | null = null;
    try {
      console.log("initializeServiceWorker_start: Setting up listener.");

      // Service Worker の準備は useEffect で待つので、ここではリスナー設定のみ
      if (!navigator.serviceWorker) {
        console.error("initializeServiceWorker: navigator.serviceWorker is not available.");
        // Service Worker が利用できない場合はリスナーを設定できないので、空のクリーンアップを返す
        return () => {
          console.log("initializeServiceWorker_cleanup: No listener to remove as serviceWorker was not available.");
        };
      }

      // メッセージングのためのイベントリスナーを設定
      messageHandler = (event: MessageEvent) => {
        const messageData = event.data as ServiceWorkerMessageEvent;
        console.log("initializeServiceWorker_message_received", messageData); // 受信ログ
        if (messageData && messageData.type === "SUBSCRIPTION_CHANGED") {
          console.log("initializeServiceWorker: SUBSCRIPTION_CHANGED message received.");
          if (messageData.newSubscription) {
            void handleSubscriptionChange(messageData.newSubscription);
          } else {
            console.warn("initializeServiceWorker: SUBSCRIPTION_CHANGED message received without newSubscription.");
          }
        }
      };
      navigator.serviceWorker.addEventListener("message", messageHandler);
      console.log("initializeServiceWorker_addEventListener_message");
    } catch (error) {
      console.error("initializeServiceWorker_error", error);
      dispatch({ type: "SET_ERROR", payload: error instanceof Error ? error : new Error(String(error)) });
    }

    // クリーンアップ関数を返す
    return () => {
      if (messageHandler && navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener("message", messageHandler);
        console.log("initializeServiceWorker_removeEventListener_message");
      }
    };
  }, [handleSubscriptionChange]);

  /**
   * 初期化処理: サポート確認、状態取得、DB同期、リスナー設定
   */
  useEffect(() => {
    console.log("use-push-notification.ts_usePushNotification_useEffect_start");
    dispatch({ type: "SET_IS_INITIALIZED", payload: false });
    dispatch({ type: "SET_ERROR", payload: null });

    // 1. Service Workerサポートと通知許可を確認
    const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
    dispatch({ type: "SET_SUPPORTED", payload: supported });
    const initialPermission = Notification.permission;
    dispatch({ type: "SET_PERMISSION", payload: initialPermission });

    if (!supported) {
      console.log("Service Worker or Push API not supported.");
      dispatch({ type: "SET_IS_INITIALIZED", payload: true });
      return;
    }
    if (initialPermission === "denied") {
      console.log("Notification permission denied.");
      dispatch({ type: "SET_IS_INITIALIZED", payload: true });
      return;
    }

    let cleanupListener: (() => void) | null = null;

    const init = async () => {
      try {
        console.log("useEffect_init_start");

        // 1. デバイスIDを取得 & state更新
        const currentDeviceId = await getDeviceId();
        dispatch({ type: "SET_DEVICE_ID", payload: currentDeviceId });
        deviceIdRef.current = currentDeviceId;
        console.log("useEffect_init_deviceId", currentDeviceId);

        // 2. Service Workerの登録/準備完了を待つ
        console.log("useEffect_init_waiting_serviceWorkerReady");
        const registration = await navigator.serviceWorker.ready;
        console.log("useEffect_init_serviceWorkerReady", registration);
        dispatch({ type: "SET_REGISTRATION", payload: registration });

        // 3. ブラウザから現在の購読情報を取得 & state更新
        const existingSubscription = await registration.pushManager.getSubscription();
        dispatch({ type: "SET_SUBSCRIPTION", payload: existingSubscription });
        console.log("useEffect_init_existingSubscription", existingSubscription?.endpoint);

        // 4. DBから購読情報のレコードIDを取得 & state更新
        // endpoint が存在する場合のみ DB に問い合わせる
        let currentRecordId: string | null = null;
        if (existingSubscription?.endpoint) {
          currentRecordId = await getRecordId(existingSubscription.endpoint);
        }
        dispatch({ type: "SET_RECORD_ID", payload: currentRecordId });
        recordIdRef.current = currentRecordId;
        console.log("useEffect_init_currentRecordId", currentRecordId);

        // 5. 購読状態とDBの状態を同期 (DBへの保存/更新はここで行う)
        if (existingSubscription) {
          // ブラウザに購読が存在する場合
          const subscriptionData = formatSubscriptionForServer(existingSubscription, currentRecordId ?? undefined, currentDeviceId);
          if (subscriptionData) {
            if (!currentRecordId) {
              // DBにレコードがない場合: 新規保存
              console.log("useEffect_init_sync: Subscription exists but not in DB. Saving...");
              console.log("useEffect_init_saveSubscription_start", subscriptionData);
              const result = await saveSubscription(subscriptionData);
              console.log("useEffect_init_saveSubscription_end", result);
              // 保存後に再度 recordId を取得して state/Ref を更新
              if (!("error" in result)) {
                const newRecordId = await getRecordId(existingSubscription.endpoint);
                dispatch({ type: "SET_RECORD_ID", payload: newRecordId });
                recordIdRef.current = newRecordId;
                console.log("useEffect_init_sync: Updated recordId after save:", newRecordId);
              } else {
                console.error("useEffect_init_sync: Failed to save subscription to DB:", result.error);
                dispatch({ type: "SET_ERROR", payload: new Error(`Failed to save subscription: ${result.error}`) });
              }
            } else {
              // DBにレコードがある場合: deviceId など更新の可能性があるため save (upsert)
              console.log("useEffect_init_sync: Subscription exists and found in DB. Ensuring data is up-to-date...");
              console.log("useEffect_init_updateSubscription_start", subscriptionData);
              // saveSubscription は endpoint がキーで、他を更新すると期待
              const result = await saveSubscription(subscriptionData);
              console.log("useEffect_init_updateSubscription_end", result);
              if ("error" in result) {
                console.error("useEffect_init_sync: Failed to update subscription in DB:", result.error);
                // 更新エラーは致命的ではないかもしれないので、エラー状態にはしないでおくか検討
                // dispatch({ type: "SET_ERROR", payload: new Error(`Failed to update subscription: ${result.error}`) });
              }
            }
          } else {
            console.error("useEffect_init_sync: Failed to format subscription data for saving/updating.");
            dispatch({ type: "SET_ERROR", payload: new Error("Failed to format subscription data.") });
          }
        } else {
          // ブラウザに購読がない場合 (DB にもし孤児レコードがあれば削除するなども検討可能だが、一旦何もしない)
          console.log("useEffect_init_sync: No active subscription found in browser.");
          // 必要ならここで recordId を null に設定し直す
          dispatch({ type: "SET_RECORD_ID", payload: null });
          recordIdRef.current = null;
        }

        // 6. Service Workerのメッセージリスナー等を初期化
        cleanupListener = await initializeServiceWorker();
        console.log("useEffect_init_initializeServiceWorker_done");

        // ★★★★★ 正常に初期化処理が完了した場合にフラグを立てる ★★★★★
        dispatch({ type: "SET_IS_INITIALIZED", payload: true });
      } catch (error) {
        console.error("Error during initialization:", error);
        dispatch({ type: "SET_ERROR", payload: error instanceof Error ? error : new Error(String(error)) });
        // エラーが発生した場合も初期化処理自体は終了したとみなすか、
        // あるいは初期化失敗状態を示す別の state を設けるか検討。
        // ここでは一旦、エラー時は isInitialized は false のままにする。
      } finally {
        console.log("useEffect_init_finished");
      }
    };

    // userId が存在する場合のみ初期化を実行
    if (userId) {
      void init();
    } else {
      // userIdがない場合は購読関連の処理は行わないが、サポート状況などは確認済みなので初期化完了とする
      dispatch({ type: "SET_IS_INITIALIZED", payload: true });
      console.log("useEffect_init_skip: No userId.");
      // 関連する state をクリアする方が安全かもしれない
      dispatch({ type: "SET_SUBSCRIPTION", payload: null });
      dispatch({ type: "SET_RECORD_ID", payload: null });
      dispatch({ type: "SET_DEVICE_ID", payload: null });
      dispatch({ type: "SET_REGISTRATION", payload: null }); // registration もクリアすべきか検討
    }

    // クリーンアップ処理
    return () => {
      console.log("use-push-notification.ts_usePushNotification_useEffect_cleanup");
      if (cleanupListener) {
        cleanupListener(); // Service Workerのリスナー等を解除
      }
    };
    // getDeviceId, initializeServiceWorker は useCallbackされているので依存配列に追加
  }, [userId, getDeviceId, initializeServiceWorker]); // permissionState は init 内で取得するので依存不要

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 通知を購読 (ブラウザへの購読と許可要求のみ)
   * @returns {PushSubscription | null} 購読情報
   */
  const subscribe = useCallback(async () => {
    console.log("subscribe_called", { isSupported, permissionState }); // 呼び出し時の状態ログ
    // ガード条件: サポート状況、初期化完了、サービスワーカー登録
    if (!isSupported) {
      dispatch({ type: "SET_ERROR", payload: new Error("Service WorkerまたはPush APIがサポートしていません。") });
      console.error("subscribe: Not supported.");
      return null;
    }
    // registrationState がまだ null の場合は初期化中か失敗の可能性
    if (!registrationState) {
      dispatch({ type: "SET_ERROR", payload: new Error("Service Worker の準備ができていません。") });
      console.error("subscribe: Service Worker registration not ready.");
      return null;
    }

    // 最新の通知許可状態を取得
    const currentPermission = Notification.permission;
    dispatch({ type: "SET_PERMISSION", payload: currentPermission });

    if (currentPermission === "denied") {
      dispatch({ type: "SET_ERROR", payload: new Error("通知の許可が拒否されています。") });
      console.error("subscribe: Permission denied.");
      return null;
    }

    try {
      // 既存の購読を再確認 (最新の状態を取得)
      let sub = await registrationState.pushManager.getSubscription();
      if (sub) {
        console.log("subscribe: Existing subscription found (no action needed).", sub.endpoint);
        return sub;
      }

      // 通知の許可を要求 (granted でなければ)
      if (currentPermission !== "granted") {
        console.log("subscribe: Requesting notification permission...");
        const permission = await Notification.requestPermission();
        dispatch({ type: "SET_PERMISSION", payload: permission });
        if (permission !== "granted") {
          console.warn("subscribe: Notification permission not granted:", permission);
          // エラーにはせず、null を返す (ユーザーが許可しなかった場合)
          dispatch({ type: "SET_ERROR", payload: new Error("通知の許可が得られませんでした。") });
          return null;
        }
        console.log("subscribe: Notification permission granted.");
      }

      // VAPID 公開鍵を取得
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error("VAPID 公開鍵が設定されていません");
      }
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      // プッシュサービスに購読
      console.log("subscribe: Subscribing to push manager...");
      sub = await registrationState.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      console.log("subscribe: Subscribed successfully:", sub.endpoint);
      dispatch({ type: "SET_SUBSCRIPTION", payload: sub });

      // ★★★ DBへの保存は useEffect で行うため、ここでは削除 ★★★
      console.log("subscribe: Subscription successful. DB sync will be handled by useEffect.");

      return sub; // 新しく取得した購読情報を返す
    } catch (err) {
      console.error("通知の購読処理中にエラーが発生しました:", err);
      dispatch({ type: "SET_ERROR", payload: err instanceof Error ? err : new Error(String(err)) });
      // エラー発生時、購読状態を null に戻す
      dispatch({ type: "SET_SUBSCRIPTION", payload: null });
      return null;
    }
    // isSupported, registrationState はガード条件として必要
    // permissionState は内部で Notification.permission を見るので依存不要かもしれないが、変更トリガーとして入れておく
  }, [isSupported, registrationState, permissionState]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 通知の購読を解除
   */
  const unsubscribe = useCallback(async () => {
    console.log("unsubscribe_called");
    if (!registrationState) {
      console.warn("unsubscribe: No service worker registration found.");
      dispatch({ type: "SET_SUBSCRIPTION", payload: null }); // 登録がないなら購読もないはず
      return true;
    }

    try {
      // 最新の購読情報を取得
      const sub = await registrationState.pushManager.getSubscription();

      if (!sub) {
        console.log("unsubscribe: No active subscription found to unsubscribe.");
        dispatch({ type: "SET_SUBSCRIPTION", payload: null }); // 購読がないことを state に反映
        return true;
      }
      console.log("unsubscribe: Found subscription to unsubscribe:", sub.endpoint);

      // サーバーから購読情報を削除 (endpoint をキーに)
      console.log("unsubscribe: Deleting subscription from DB...");
      await deleteSubscription(sub.endpoint);
      console.log("unsubscribe: DB deletion attempted (errors ignored for now)."); // deleteSubscription のエラーハンドリングは要検討

      // プッシュサービスから購読を解除
      console.log("unsubscribe: Unsubscribing from push service...");
      const result = await sub.unsubscribe();
      console.log("unsubscribe: Push service unsubscribe result:", result);

      if (result) {
        dispatch({ type: "SET_SUBSCRIPTION", payload: null }); // 購読解除成功 -> state を null に
        dispatch({ type: "SET_RECORD_ID", payload: null }); // recordId も null に
        recordIdRef.current = null;
        console.log("通知の購読を解除しました");
      } else {
        console.warn("unsubscribe: Failed to unsubscribe from push service.");
        // 解除失敗した場合でも、サーバーからは削除試行済み。state はどうするか？一旦そのままにするか？
        // 再度 getSubscription して確認する？
        dispatch({ type: "SET_ERROR", payload: new Error("プッシュサービスからの購読解除に失敗しました。") });
      }

      return result; // 解除の成否を返す
    } catch (err) {
      console.error("通知の購読解除処理中にエラーが発生しました:", err);
      dispatch({ type: "SET_ERROR", payload: err instanceof Error ? err : new Error(String(err)) });
      // エラー発生時も購読状態を null にしておく方が安全か？
      dispatch({ type: "SET_SUBSCRIPTION", payload: null });
      dispatch({ type: "SET_RECORD_ID", payload: null });
      recordIdRef.current = null;
      return false;
    }
  }, [registrationState]); // registrationState に依存

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 戻り値に isInitialized を追加
  return {
    isInitialized, // ★ 初期化完了フラグ
    registrationState, // Service Worker の登録情報
    subscriptionState, // 現在の購読情報 (PushSubscription | null)
    isSupported, // ブラウザが Push API をサポートしているか
    error, // 発生したエラー
    subscribe, // 購読を開始する関数 (許可要求含む)
    unsubscribe, // 購読を解除する関数
    permissionState, // 現在の通知許可状態
  };
}
