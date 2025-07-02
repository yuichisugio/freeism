"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { deleteSubscription, getRecordId, saveSubscription } from "@/actions/notification/push-notification";
import { updateUserSettingToggle } from "@/actions/user/user-settings";
import { queryCacheKeys } from "@/library-setting/tanstack-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

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
  // トグル関連の状態を追加
  isEnabled: boolean;
  isUpdating: boolean;
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
  // トグル関連の初期状態
  isEnabled: false, // デフォルトでOFF
  isUpdating: false,
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
  | { type: "SET_IS_ENABLED"; payload: boolean }
  | { type: "SET_IS_UPDATING"; payload: boolean }
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
    case "SET_IS_ENABLED":
      return { ...state, isEnabled: action.payload };
    case "SET_IS_UPDATING":
      return { ...state, isUpdating: action.payload };
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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
function formatSubscriptionForServer(
  subscription: PushSubscription | null,
  recordId?: string,
  deviceId?: string,
): SaveSubscriptionParams | null {
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
 * @param initialIsPushEnabled - 初期のプッシュ通知有効状態（DBから取得）
 * @returns {Object} プッシュ通知の購読情報とエラー
 */
export function usePushNotification(initialIsPushEnabled?: boolean) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // useReducer フックを使用
  const [state, dispatch] = useReducer(reducer, initialState);
  const {
    isInitialized,
    isSupported,
    permissionState,
    registrationState,
    subscriptionState,
    recordId,
    deviceId,
    error,
    isEnabled,
  } = state;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // userId の取得
  const session = useSession();
  const userId = useMemo(() => session.data?.user?.id ?? null, [session.data?.user?.id]);
  const userIdRef = useRef(userId); // ★ userId を保持する Ref

  // Refs to hold the latest values of recordId and deviceId for callbacks
  const recordIdRef = useRef(recordId);
  const deviceIdRef = useRef(deviceId);
  const isInitialSetupDoneRef = useRef(false); // ★ 初期セットアップ完了フラグ

  // Update refs whenever the state changes
  useEffect(() => {
    recordIdRef.current = recordId;
  }, [recordId]);

  useEffect(() => {
    deviceIdRef.current = deviceId;
  }, [deviceId]);

  // userIdRef を最新に保つための Effect
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ブラウザの通知許可状態と購読状態に基づいてローカルの isEnabled を更新する関数
   */
  const syncEnabledStateWithBrowser = useCallback(() => {
    if (!isSupported) {
      return;
    }
    // 'prompt' の間はユーザーの選択待ち。購読が実際に確立されているかで判断。
    const browserIsEnabled = permissionState === "granted" && !!subscriptionState;
    dispatch({ type: "SET_IS_ENABLED", payload: browserIsEnabled });
  }, [isSupported, permissionState, subscriptionState]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * isSupported, permissionState, subscriptionState が変更されたときに isEnabled を同期
   */
  useEffect(() => {
    syncEnabledStateWithBrowser();
  }, [syncEnabledStateWithBrowser]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * initialIsPushEnabled (DBからの設定値) が変更された場合、isEnabled に反映。
   * これにより、invalidateQueries後の親からのprops変更がUIに反映される。
   * その後、syncEnabledStateWithBrowserがブラウザの実際の状態と最終調整する。
   */
  useEffect(() => {
    if (initialIsPushEnabled !== undefined) {
      dispatch({ type: "SET_IS_ENABLED", payload: initialIsPushEnabled });
    }
  }, [initialIsPushEnabled]);

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
        // 新しい購読情報をステートに設定
        dispatch({ type: "SET_SUBSCRIPTION", payload: newSubscription });

        // 購読情報を整形 (現在の recordId と deviceId を Ref から取得)
        const currentRecordId = recordIdRef.current;
        const currentDeviceId = deviceIdRef.current;
        const subscriptionData = formatSubscriptionForServer(
          newSubscription,
          currentRecordId ?? undefined,
          currentDeviceId ?? undefined,
        );
        if (!subscriptionData) {
          throw new Error("有効な購読情報を整形できませんでした");
        }

        const result = await saveSubscription(subscriptionData);

        if (!("error" in result)) {
          const updatedRecordId = await getRecordId(newSubscription.endpoint);
          dispatch({ type: "SET_RECORD_ID", payload: updatedRecordId });
          recordIdRef.current = updatedRecordId;
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
        if (messageData && messageData.type === "SUBSCRIPTION_CHANGED") {
          if (messageData.newSubscription) {
            void handleSubscriptionChange(messageData.newSubscription);
          } else {
            console.warn("initializeServiceWorker: SUBSCRIPTION_CHANGED message received without newSubscription.");
          }
        }
      };
      navigator.serviceWorker.addEventListener("message", messageHandler);
    } catch (error) {
      console.error("initializeServiceWorker_error", error);
      dispatch({ type: "SET_ERROR", payload: error instanceof Error ? error : new Error(String(error)) });
    }

    // クリーンアップ関数を返す
    return () => {
      if (messageHandler && navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener("message", messageHandler);
      }
    };
  }, [handleSubscriptionChange]);

  /**
   * 初期化処理: サポート確認、状態取得、DB同期、リスナー設定
   */
  useEffect(() => {
    // 既に初期セットアップが完了していれば、userId 変更時のみDB同期を試みる
    if (isInitialSetupDoneRef.current && userIdRef.current && subscriptionState?.endpoint && deviceId) {
      const syncExistingSubscription = async () => {
        try {
          let currentRecordId = recordIdRef.current; // Ref から最新の値を取得
          // 必要であれば getRecordId を再度呼ぶ
          if (!currentRecordId && subscriptionState.endpoint) {
            currentRecordId ??= await getRecordId(subscriptionState.endpoint);
            recordIdRef.current = currentRecordId; // Ref を更新
            dispatch({ type: "SET_RECORD_ID", payload: currentRecordId }); // State も更新
          }

          const subscriptionData = formatSubscriptionForServer(
            subscriptionState,
            currentRecordId ?? undefined,
            deviceId,
          );
          if (subscriptionData) {
            const result = await saveSubscription(subscriptionData);
            if ("error" in result) {
              console.error("Failed to sync subscription on userId change:", result.error);
              // エラーを state に反映させるか検討
              // dispatch({ type: 'SET_ERROR', payload: new Error(`Failed to sync subscription: ${result.error}`) });
            } else {
              // 同期成功後、最新の recordId を再取得・更新
              const updatedRecordId = await getRecordId(subscriptionState.endpoint);
              if (updatedRecordId !== currentRecordId) {
                recordIdRef.current = updatedRecordId;
                dispatch({ type: "SET_RECORD_ID", payload: updatedRecordId });
              }
            }
          }
        } catch (dbError) {
          console.error("Error during DB sync on userId change:", dbError);
          // dispatch({ type: 'SET_ERROR', payload: dbError instanceof Error ? dbError : new Error(String(dbError)) });
        }
      };
      void syncExistingSubscription();
      return; // userId 変更のみの場合はここで終了
    }

    // --- 以下は初回実行時または isInitialSetupDoneRef が false の場合のみ実行 ---
    if (isInitialSetupDoneRef.current) return; // 二重実行防止

    dispatch({ type: "SET_IS_INITIALIZED", payload: false });
    dispatch({ type: "SET_ERROR", payload: null });

    // 1. Service Workerサポートと通知許可を確認
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    dispatch({ type: "SET_SUPPORTED", payload: supported });
    const initialPermission = supported && typeof Notification !== "undefined" ? Notification.permission : "default";
    dispatch({ type: "SET_PERMISSION", payload: initialPermission });

    if (!supported) {
      dispatch({ type: "SET_IS_INITIALIZED", payload: true });
      isInitialSetupDoneRef.current = true; // ★ セットアップ完了（失敗含む）
      return;
    }
    if (initialPermission === "denied") {
      dispatch({ type: "SET_IS_INITIALIZED", payload: true });
      isInitialSetupDoneRef.current = true; // ★ セットアップ完了（失敗含む）
      return;
    }

    let cleanupListener: (() => void) | null = null;

    const init = async () => {
      try {
        // --- 1 & 2: デバイスID取得とService Worker準備 (並列実行) ---
        const [deviceIdResult, registrationResult] = await Promise.allSettled([
          getDeviceId(),
          navigator.serviceWorker.ready,
        ]);

        // --- 結果の処理 & エラーハンドリング ---
        if (deviceIdResult.status === "rejected") {
          console.error("Failed to get deviceId:", deviceIdResult.reason);
          throw new Error("Failed to get deviceId");
        }
        const currentDeviceId = deviceIdResult.value;

        if (registrationResult.status === "rejected") {
          console.error("Failed to get service worker registration:", registrationResult.reason);
          throw new Error("Service worker not ready");
        }
        const registration = registrationResult.value;
        if (!registration) throw new Error("Service worker registration is null after check");

        // --- 3: 既存の購読情報取得 ---
        const existingSubscription = await registration.pushManager.getSubscription();

        // --- 4 & 5: レコードID取得とDB同期 (userId があれば) ---
        let currentRecordId: string | null = null;
        let syncError: Error | null = null;
        if (userIdRef.current && existingSubscription?.endpoint) {
          // ★ userIdRef を使用
          try {
            currentRecordId ??= await getRecordId(existingSubscription.endpoint);
            const subscriptionData = formatSubscriptionForServer(
              existingSubscription,
              currentRecordId ?? undefined,
              currentDeviceId,
            );
            if (subscriptionData) {
              const result = await saveSubscription(subscriptionData);
              if ("error" in result) {
                syncError = new Error(`Failed to sync subscription: ${String(result.error)}`);
              } else {
                currentRecordId ??= await getRecordId(existingSubscription.endpoint);
              }
            } else {
              syncError = new Error("Failed to format subscription data for sync.");
            }
          } catch (dbError) {
            syncError = dbError instanceof Error ? dbError : new Error(String(dbError));
          }
        } else {
          currentRecordId = null; // userId がない or 購読がない場合は null
        }

        // --- 6: Service Worker リスナー初期化 ---
        cleanupListener = await initializeServiceWorker();

        // --- 7: ★★★ 状態を一括更新 ★★★ ---
        dispatch({
          type: "SET_INITIAL_DATA",
          payload: {
            deviceId: currentDeviceId,
            registrationState: registration,
            subscriptionState: existingSubscription,
            recordId: currentRecordId,
            error: syncError, // DB同期中のエラーのみをセット
            isInitialized: true, // ★★★ 初期化完了 ★★★
          },
        });
        // Ref を state に合わせて更新
        deviceIdRef.current = currentDeviceId;
        recordIdRef.current = currentRecordId;

        isInitialSetupDoneRef.current = true; // ★ 初期セットアップ完了
      } catch (initError) {
        // init 関数内の致命的なエラー
        console.error("Error during initialization sequence (catch block):", initError);
        dispatch({
          type: "SET_INITIAL_DATA", // エラー情報と初期化完了フラグをセット
          payload: {
            error: initError instanceof Error ? initError : new Error(String(initError)),
            isInitialized: true, // エラーでも初期化試行は完了とみなす
            // 他のstateは初期値のままか、可能な範囲で設定するか検討
            deviceId: null,
            registrationState: null,
            subscriptionState: null,
            recordId: null,
          },
        });
        isInitialSetupDoneRef.current = true; // ★ セットアップ完了（失敗含む）
      } finally {
      }
    };

    // 初回マウント時に userId がなくても基本的なセットアップは試みる
    // DB同期のみ userId が確定してから行う (init 内で条件分岐)
    void init();

    // クリーンアップ処理
    return () => {
      if (cleanupListener) {
        cleanupListener(); // Service Workerのリスナー等を解除
      }
      // isInitialSetupDoneRef はコンポーネントがアンマウントされる際にリセットする必要はない
    };
    // 依存配列から userId を削除。userId の変更は useEffect の先頭で別途処理。
  }, [getDeviceId, initializeServiceWorker, subscriptionState, deviceId]); // subscriptionState と deviceId は userId 変更時の同期処理で必要になるため追加

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 通知を購読 (ブラウザへの購読と許可要求のみ)
   * @returns {PushSubscription | null} 購読情報
   */
  const subscribe = useCallback(async () => {
    // ガード条件: サポート状況、初期化完了、サービスワーカー登録
    if (!isSupported) {
      dispatch({ type: "SET_ERROR", payload: new Error("Service WorkerまたはPush APIがサポートしていません。") });
      console.error("subscribe: Not supported.");
      toast.error("Service WorkerまたはPush APIがサポートしていません。");
      return null;
    }
    // registrationState がまだ null の場合は初期化中か失敗の可能性
    if (!registrationState) {
      dispatch({ type: "SET_ERROR", payload: new Error("Service Worker の準備ができていません。") });
      console.error("subscribe: Service Worker registration not ready.");
      toast.error("Service Worker の準備ができていません。");
      return null;
    }

    // 最新の通知許可状態を取得
    const currentPermission = typeof Notification !== "undefined" ? Notification.permission : "default";
    dispatch({ type: "SET_PERMISSION", payload: currentPermission });

    if (currentPermission === "denied") {
      dispatch({ type: "SET_ERROR", payload: new Error("通知の許可が拒否されています。") });
      console.error("subscribe: Permission denied.");
      toast.error("通知の許可が拒否されています。");
      return null;
    }

    try {
      // 既存の購読を再確認 (最新の状態を取得)
      let sub = await registrationState.pushManager.getSubscription();
      if (sub) {
        return sub;
      }

      // 通知の許可を要求 (granted でなければ)
      if (currentPermission !== "granted") {
        if (typeof Notification === "undefined") {
          dispatch({ type: "SET_ERROR", payload: new Error("このブラウザでは通知機能がサポートされていません。") });
          return null;
        }
        const permission = await Notification.requestPermission();
        dispatch({ type: "SET_PERMISSION", payload: permission });
        if (permission !== "granted") {
          console.warn("subscribe: Notification permission not granted:", permission);
          // エラーにはせず、null を返す (ユーザーが許可しなかった場合)
          dispatch({ type: "SET_ERROR", payload: new Error("通知の許可が得られませんでした。") });
          return null;
        }
      }

      // VAPID 公開鍵を取得
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error("VAPID 公開鍵が設定されていません");
      }
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      // プッシュサービスに購読
      sub = await registrationState.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      dispatch({ type: "SET_SUBSCRIPTION", payload: sub });

      // ★★★ DBへの保存は useEffect で行うため、ここでは削除 ★★★

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
  }, [isSupported, registrationState]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 通知の購読を解除
   */
  const unsubscribe = useCallback(async () => {
    if (!registrationState) {
      console.warn("unsubscribe: No service worker registration found.");
      dispatch({ type: "SET_SUBSCRIPTION", payload: null }); // 登録がないなら購読もないはず
      return true;
    }

    try {
      // 最新の購読情報を取得
      const sub = await registrationState.pushManager.getSubscription();

      if (!sub) {
        dispatch({ type: "SET_SUBSCRIPTION", payload: null }); // 購読がないことを state に反映
        return true;
      }

      // サーバーから購読情報を削除 (endpoint をキーに)
      await deleteSubscription(sub.endpoint);

      // プッシュサービスから購読を解除
      const result = await sub.unsubscribe();

      if (result) {
        dispatch({ type: "SET_SUBSCRIPTION", payload: null }); // 購読解除成功 -> state を null に
        dispatch({ type: "SET_RECORD_ID", payload: null }); // recordId も null に
        recordIdRef.current = null;
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

  /**
   * プッシュ通知のトグルの状態を更新する
   */
  const queryClient = useQueryClient();
  const { mutate: togglePushNotification, isPending: isUpdating } = useMutation<
    { success: boolean; error?: string }, // APIレスポンスの型
    Error, // エラーの型
    boolean, // mutateに渡す引数の型 (トグルの新しい状態)
    { previousIsEnabled: boolean } // onMutateのコンテキストの型
  >({
    mutationFn: async (newPushEnabledState: boolean) => {
      if (!userId) {
        throw new Error("ユーザーIDがありません。");
      }

      if (newPushEnabledState) {
        // トグルをONにする場合
        if (permissionState === "denied") {
          alert("通知がブラウザ設定で拒否されています。設定を変更してください。");
          throw new Error("通知はブラウザ設定で拒否されています。");
        }
        // 購読を試みる (これにより許可ダイアログが表示される場合がある)
        const subscription = await subscribe();
        if (!subscription) {
          // ユーザーが許可しなかったか、その他の理由で購読に失敗
          throw new Error("プッシュ通知の購読に失敗しました。通知が許可されていないか、ブラウザが対応していません。");
        }
        // 購読成功、DBを更新
        const result = await updateUserSettingToggle({ userId, isEnabled: true, column: "isPushEnabled" });
        return result;
      } else {
        // トグルをOFFにする場合
        if (subscriptionState) {
          // 既に購読中の場合のみ解除
          await unsubscribe();
        }
        // 購読解除後 (または元々未購読)、DBを更新
        const result = await updateUserSettingToggle({ userId, isEnabled: false, column: "isPushEnabled" });
        return result;
      }
    },
    onMutate: async (newPushEnabledState: boolean) => {
      // 既存の関連クエリをキャンセル
      if (userId) {
        await queryClient.cancelQueries({ queryKey: ["userSettings", userId] });
      }

      // ロールバック用に現在のUIの状態を保存
      const previousIsEnabled = isEnabled;

      // UIをオプティミスティックに更新
      dispatch({ type: "SET_IS_ENABLED", payload: newPushEnabledState });

      // contextとして以前の値を返す
      return { previousIsEnabled };
    },
    onSuccess: () => {
      toast.success("プッシュ通知設定を更新しました");
      // isEnabled は onMutate で更新済み。
      // onSettled で invalidateQueries を呼び出し、サーバーの最新状態でUIが最終同期される。
      // 必要であれば、ここで syncEnabledStateWithBrowser() を呼び出し、ブラウザ状態を即時反映も可能。
    },
    onError: (error: Error, newPushEnabledState, context) => {
      toast.error(error.message || "プッシュ通知設定の更新に失敗しました。");
      // オプティミスティックアップデートをロールバック
      if (context?.previousIsEnabled !== undefined) {
        dispatch({ type: "SET_IS_ENABLED", payload: context.previousIsEnabled });
      } else {
        // contextがない場合のフォールバック (稀なケース)
        dispatch({ type: "SET_IS_ENABLED", payload: !newPushEnabledState });
      }
      // エラー後もブラウザの最新状態にUIを同期
      syncEnabledStateWithBrowser();
    },
    onSettled: async () => {
      // 成功・失敗に関わらず、サーバーの最新の状態で関連クエリを無効化して再フェッチ
      if (userId) {
        await queryClient.invalidateQueries({ queryKey: queryCacheKeys.userSettings.userAll(userId) });
      }
      // 再フェッチ後、新しい initialIsPushEnabled が渡され、useEffect を通じて isEnabled が更新され、
      // syncEnabledStateWithBrowser によりブラウザの実際の状態と最終同期される。
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 権限が拒否またはリセットされた場合にDBを自動的にOFFに更新する関数
   */
  const syncPermissionToDatabase = useCallback(
    async (reason: "denied" | "reset") => {
      if (!userId) return;

      try {
        await updateUserSettingToggle({ userId, isEnabled: false, column: "isPushEnabled" });
        // DB更新成功時にクエリを無効化して最新状態を取得
        await queryClient.invalidateQueries({ queryKey: queryCacheKeys.userSettings.userAll(userId) });
        const message =
          reason === "denied"
            ? "通知の権限が拒否されたため、設定を自動的にOFFにしました"
            : "通知の権限がリセットされたため、設定を自動的にOFFにしました";
        toast.info(message);
        return true;
      } catch (error) {
        console.error(`権限${reason}時のDB更新でエラー:`, error);
        return false;
      }
    },
    [userId, queryClient],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 権限が拒否またはリセットされた場合に自動的にDBを更新する
   */
  useEffect(() => {
    // 初期化が完了していて、初期設定がONの場合
    if (isInitialized && initialIsPushEnabled === true) {
      // 権限が拒否されている場合
      if (permissionState === "denied") {
        void syncPermissionToDatabase("denied");
      }
      // 権限がリセット（default）されていて、購読がない場合
      else if (permissionState === "default" && !subscriptionState) {
        void syncPermissionToDatabase("reset");
      }
    }
  }, [isInitialized, permissionState, subscriptionState, initialIsPushEnabled, syncPermissionToDatabase]);

  /**
   * ページフォーカス時に権限状態をチェックして、必要に応じてDB同期
   */
  useEffect(() => {
    if (!isSupported || !isInitialized) return;

    const handleFocus = () => {
      // ページフォーカス時に最新の権限状態を確認
      const currentPermission = typeof Notification !== "undefined" ? Notification.permission : "default";

      // 初期設定がONの場合のみチェック
      if (initialIsPushEnabled === true) {
        // 権限が拒否されている場合
        if (currentPermission === "denied") {
          void syncPermissionToDatabase("denied");
        }
        // 権限がリセット（default）されている場合、購読状態を再確認してDB同期
        else if (currentPermission === "default") {
          // Service Workerから最新の購読状態を取得
          if (registrationState) {
            // 非同期処理を即座に実行
            void (async () => {
              try {
                const currentSubscription = await registrationState.pushManager.getSubscription();
                if (!currentSubscription) {
                  void syncPermissionToDatabase("reset");
                }
              } catch (error) {
                console.error("フォーカス時の購読状態確認でエラー:", error);
              }
            })();
          }
        }
      }
    };

    // ページフォーカスイベントリスナーを追加
    window.addEventListener("focus", handleFocus);

    // クリーンアップ
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [isSupported, isInitialized, initialIsPushEnabled, registrationState, syncPermissionToDatabase]);

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
    // トグル関連の戻り値を追加
    isEnabled, // 現在のトグル状態
    isUpdating, // 更新中フラグ
    togglePushNotification, // トグル機能
  };
}
