"use client";

import { useEffect, useMemo, useReducer, useRef } from "react";
import { deleteSubscription, getRecordId, saveSubscription } from "@/actions/notification/push-notification";
import { updateUserSettingToggle } from "@/actions/user/user-settings";
import { queryCacheKeys } from "@/library-setting/tanstack-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Notification State の型定義
 */
export type PushNotificationState = {
  isInitialized: boolean;
  isSupported: boolean;
  permissionState: NotificationPermission;
  registrationState: ServiceWorkerRegistration | null;
  subscriptionState: PushSubscription | null;
  recordId: string | null;
  deviceId: string | null;
  errorMessage: string | null;
  isEnabled: boolean;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ステート管理のためのアクション型定義
 */
export type NotificationAction =
  | { type: "SET_SUPPORT_STATUS"; payload: { isSupported: boolean; permissionState: NotificationPermission } }
  | {
      type: "SET_INITIALIZATION_COMPLETE";
      payload: {
        deviceId: string;
        registrationState: ServiceWorkerRegistration;
        subscriptionState: PushSubscription | null;
        recordId: string | null;
      };
    }
  | { type: "SET_INITIALIZATION_ERROR"; payload: { errorMessage: string } }
  | { type: "SET_ENABLED_STATE"; payload: { isEnabled: boolean } }
  | { type: "SET_SUBSCRIPTION"; payload: { subscriptionState: PushSubscription | null; recordId?: string | null } }
  | { type: "SET_ERROR"; payload: { errorMessage: string } }
  | { type: "CLEAR_ERROR" }
  | { type: "UPDATE_RECORD_ID"; payload: { recordId: string | null } };

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ステート管理のためのreducer関数
 * ステートの更新を一元管理することで、競合状態を防ぐ
 */
export function notificationReducer(state: PushNotificationState, action: NotificationAction): PushNotificationState {
  switch (action.type) {
    case "SET_SUPPORT_STATUS":
      return {
        ...state,
        isSupported: action.payload.isSupported,
        permissionState: action.payload.permissionState,
      };

    case "SET_INITIALIZATION_COMPLETE":
      return {
        ...state,
        isInitialized: true,
        deviceId: action.payload.deviceId,
        registrationState: action.payload.registrationState,
        subscriptionState: action.payload.subscriptionState,
        recordId: action.payload.recordId,
        errorMessage: null,
      };

    case "SET_INITIALIZATION_ERROR":
      return {
        ...state,
        isInitialized: true,
        errorMessage: action.payload.errorMessage,
        deviceId: null,
        registrationState: null,
        subscriptionState: null,
        recordId: null,
      };

    case "SET_ENABLED_STATE":
      return {
        ...state,
        isEnabled: action.payload.isEnabled,
      };

    case "SET_SUBSCRIPTION":
      return {
        ...state,
        subscriptionState: action.payload.subscriptionState,
        recordId: action.payload.recordId ?? state.recordId,
      };

    case "SET_ERROR":
      return {
        ...state,
        errorMessage: action.payload.errorMessage,
      };

    case "CLEAR_ERROR":
      return {
        ...state,
        errorMessage: null,
      };

    case "UPDATE_RECORD_ID":
      return {
        ...state,
        recordId: action.payload.recordId,
      };

    default:
      return state;
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * データベースに保存する購読情報の型定義
 */
export type SaveSubscriptionParams = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  recordId?: string;
  deviceId?: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * PushSubscriptionオブジェクトからサーバーに送信するデータを整形する関数
 * PushSubscriptionオブジェクトのtoJSON()メソッドを使用して、必要な情報を抽出
 */
export function formatSubscriptionForServer(
  subscription: PushSubscription,
  recordId?: string,
  deviceId?: string,
): SaveSubscriptionParams {
  // 購読情報をJSONに変換（ブラウザのPush APIが提供するメソッド）
  const subscriptionJSON = subscription.toJSON();

  // 必須のキーが存在するかチェック（endpoint、p256dh、authキーは必須）
  if (!subscriptionJSON.endpoint || !subscriptionJSON.keys?.p256dh || !subscriptionJSON.keys?.auth) {
    console.error("有効な購読情報が取得できませんでした", subscriptionJSON);
    throw new Error("有効な購読情報が取得できませんでした");
  }

  // サーバーに送信するデータを整形
  const subscriptionData: SaveSubscriptionParams = {
    endpoint: subscriptionJSON.endpoint, // プッシュサービスのエンドポイントURL
    expirationTime: subscriptionJSON.expirationTime ?? null, // 購読の有効期限
    keys: {
      p256dh: subscriptionJSON.keys.p256dh, // 公開鍵（クライアント側の暗号化キー）
      auth: subscriptionJSON.keys.auth, // 認証秘密鍵
    },
    deviceId: deviceId, // デバイス識別子
  };

  // recordIdが指定されている場合は追加（既存レコードの更新時）
  if (recordId) {
    subscriptionData.recordId = recordId;
  }

  return subscriptionData;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * デバイス識別子を生成する関数
 * ユーザーエージェント情報とユーザーIDを組み合わせて一意なIDを作成
 */
export function getDeviceId(userId: string): string {
  const deviceInfo: Partial<{
    brands: Array<{ brand: string; version: string }>;
    platform: string;
    mobile: boolean;
    userAgent: string;
    deviceId: string;
  }> = {
    userAgent: navigator.userAgent, // ブラウザのユーザーエージェント文字列
  };

  // モダンブラウザのuserAgentDataがサポートされているか確認
  if ("userAgentData" in navigator && navigator.userAgentData) {
    // navigator.userAgentDataから詳細なデバイス情報を取得
    const uaData = navigator.userAgentData as {
      brands?: Array<{ brand: string; version: string }>;
      platform?: string;
      mobile?: boolean;
    };

    // デバイス情報を設定
    deviceInfo.brands = uaData.brands ?? [];
    deviceInfo.platform = uaData.platform ?? "";
    deviceInfo.mobile = !!uaData.mobile;
  } else {
    // フォールバック: 従来のuserAgentから情報を抽出
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    deviceInfo.brands = [{ brand: "unknown", version: "0" }];

    // プラットフォームを判定
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

  // デバイスIDを生成（プラットフォーム + モバイルフラグ + ブランド + ユーザーID）
  const generatedDeviceId = `${deviceInfo.platform}-${deviceInfo.mobile ? "mobile" : "desktop"}-${deviceInfo.brands?.map((b) => b.brand).join("-") || "unknown"}-${userId}`;

  return generatedDeviceId;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * プッシュ通知フックの戻り値の型定義
 */
export type PushNotificationHookReturnType = {
  // state
  isSupported: boolean;
  isInitialized: boolean;
  isEnabled: boolean;
  isToggleUpdating: boolean;
  errorMessage: string | null;
  permissionState: NotificationPermission;

  // function
  togglePushNotification: (newPushEnabledState: boolean) => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * プッシュ通知を管理するフック
 */
export function usePushNotification(initialIsPushEnabled: boolean): PushNotificationHookReturnType {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * useReducerによるステート管理（競合状態を防ぐ）
   */
  const [notificationState, dispatch] = useReducer(notificationReducer, {
    isInitialized: false,
    isSupported: false,
    permissionState: "default" as NotificationPermission,
    registrationState: null,
    subscriptionState: null,
    recordId: null,
    deviceId: null,
    errorMessage: null,
    isEnabled: initialIsPushEnabled,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * userId の取得
   */
  const session = useSession();
  const userId = useMemo(() => session.data?.user?.id ?? null, [session.data?.user?.id]);
  console.log("userId", userId);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 初期化完了フラグのref（useEffectの重複実行を防ぐ）
   */
  const initializationRef = useRef(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * クライアント側で購読情報を更新する関数
   * Service Workerからpushsubscriptionchangeイベントが発生した際に使用
   */
  const { mutate: handleSubscriptionChange } = useMutation({
    mutationFn: async (newSubscription: PushSubscription) => {
      // 新しい購読情報をステートに設定
      dispatch({
        type: "SET_SUBSCRIPTION",
        payload: { subscriptionState: newSubscription },
      });

      // 購読情報を整形（現在のrecordIdとdeviceIdを使用）
      const subscriptionData = formatSubscriptionForServer(
        newSubscription,
        notificationState.recordId ?? undefined,
        notificationState.deviceId ?? undefined,
      );

      // 購読情報をサーバーに保存
      await saveSubscription(subscriptionData);

      // 購読情報のレコードIDを取得して更新
      const updatedRecordId = await getRecordId(newSubscription.endpoint);
      dispatch({
        type: "UPDATE_RECORD_ID",
        payload: { recordId: updatedRecordId.data },
      });
    },
    onError: (error) => {
      dispatch({
        type: "SET_ERROR",
        payload: { errorMessage: error instanceof Error ? error.message : String(error) },
      });
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 初期化処理: サポート確認、状態取得、DB同期、リスナー設定
   */
  useEffect(() => {
    console.log("useEffect - initializationRef.current:", initializationRef.current);
    // 既に初期化が完了していれば、何もしない（重複実行を防ぐ）
    if (initializationRef.current) return;

    // エラーをクリア
    dispatch({ type: "CLEAR_ERROR" });

    // 1. Service Workerサポートと通知許可を確認
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    console.log("useEffect - supported:", supported);
    const initialPermission = supported && typeof Notification !== "undefined" ? Notification.permission : "default";

    // サポート状況を更新
    dispatch({
      type: "SET_SUPPORT_STATUS",
      payload: { isSupported: supported, permissionState: initialPermission },
    });

    // サポートされていない場合は、初期化を完了
    if (!supported) {
      console.log("useEffect - supported is false");
      dispatch({
        type: "SET_INITIALIZATION_ERROR",
        payload: { errorMessage: "このブラウザはプッシュ通知をサポートしていません" },
      });
      initializationRef.current = true;
      return;
    }

    // 通知許可が拒否されている場合は、初期化を完了
    if (initialPermission === "denied") {
      console.log("useEffect - initialPermission is denied");
      dispatch({
        type: "SET_INITIALIZATION_ERROR",
        payload: { errorMessage: "通知が拒否されています" },
      });
      initializationRef.current = true;
      return;
    }

    let cleanupListener: (() => void) | null = null;

    const init = async () => {
      try {
        // userIdが取得できない場合は待機
        if (!userId) {
          console.log("useEffect - userId is not found");
          return;
        }

        // デバイスID取得
        const currentDeviceId = getDeviceId(userId);
        console.log("useEffect - currentDeviceId:", currentDeviceId);

        // Service Workerの登録を取得
        if (!navigator.serviceWorker.controller) {
          await navigator.serviceWorker.register("/service-worker.js", {
            scope: "/", // ルート配下すべてを対象にする
            updateViaCache: "none", // 強制的に最新版を取得
          });
        }

        // Service Workerの登録を取得
        const registration = await navigator.serviceWorker.ready
          .then((registration) => {
            console.log("useEffect - registration:", registration);
            return registration;
          })
          .catch((err) => {
            console.error("SW register failed:", err);
            return null;
          });
        console.log("useEffect - registration_2:", registration);

        // Windows環境でのService Worker準備確認
        if (!registration?.pushManager) {
          throw new Error("Service Workerまたはプッシュマネージャーが利用できません");
        }

        // 既存の購読情報を取得
        const existingSubscription = await registration.pushManager.getSubscription();

        // レコードID取得とDB同期
        let currentRecordId: string | null = null;
        if (existingSubscription?.endpoint) {
          try {
            const result = await getRecordId(existingSubscription.endpoint);
            currentRecordId = result.data;

            // サーバーと同期
            const subscriptionData = formatSubscriptionForServer(
              existingSubscription,
              currentRecordId ?? undefined,
              currentDeviceId,
            );

            // サーバーに保存
            await saveSubscription(subscriptionData);

            // 最新のレコードIDを取得
            const updatedRecordId = await getRecordId(existingSubscription.endpoint);
            currentRecordId = updatedRecordId.data;
          } catch (syncError) {
            console.warn("購読情報の同期に失敗しました:", syncError);
            // 同期エラーは致命的ではないので、初期化は続行
          }
        }

        // Service Workerメッセージリスナーを設定
        if (navigator.serviceWorker) {
          const messageHandler = (event: MessageEvent) => {
            const data = event.data as unknown;
            if (data && typeof data === "object" && data !== null && "type" in data && "newSubscription" in data) {
              const eventData = data as { type: string; newSubscription: PushSubscription };
              if (eventData.type === "SUBSCRIPTION_CHANGED") {
                void handleSubscriptionChange(eventData.newSubscription);
              }
            }
          };

          navigator.serviceWorker.addEventListener("message", messageHandler);

          cleanupListener = () => {
            if (navigator.serviceWorker) {
              navigator.serviceWorker.removeEventListener("message", messageHandler);
            }
          };
        } else {
          cleanupListener = () => {
            console.log("Service Worker was not available for listener cleanup.");
          };
        }

        // 初期化完了：全ての状態を一括更新
        dispatch({
          type: "SET_INITIALIZATION_COMPLETE",
          payload: {
            deviceId: currentDeviceId,
            registrationState: registration,
            subscriptionState: existingSubscription,
            recordId: currentRecordId,
          },
        });

        // 初期化完了フラグを設定
        initializationRef.current = true;
      } catch (initError) {
        dispatch({
          type: "SET_INITIALIZATION_ERROR",
          payload: {
            errorMessage: initError instanceof Error ? initError.message : String(initError),
          },
        });
        initializationRef.current = true;
      }
    };

    void init();

    // クリーンアップ処理
    return () => {
      if (cleanupListener) {
        cleanupListener();
      }
    };
  }, [userId, handleSubscriptionChange]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * プッシュ通知のトグルの状態を更新する
   */
  const queryClient = useQueryClient();
  const { mutate: togglePushNotification, isPending: isToggleUpdating } = useMutation({
    onMutate: async (newPushEnabledState: boolean) => {
      // キャッシュ更新をキャンセル
      await queryClient.cancelQueries({ queryKey: queryCacheKeys.userSettings.userAll(userId ?? "") });

      // UIをオプティミスティックに更新
      dispatch({ type: "SET_ENABLED_STATE", payload: { isEnabled: newPushEnabledState } });

      // ロールバック用に以前の値を返す
      return { previousIsEnabled: notificationState.isEnabled };
    },
    mutationFn: async (newPushEnabledState: boolean) => {
      /**
       * トグルをONにする場合の処理
       */
      if (newPushEnabledState) {
        // ブラウザの通知権限が拒否されている場合
        if (notificationState.permissionState === "denied") {
          const errorMsg = "通知がブラウザ設定で拒否されています。設定を変更してください。";
          toast.error(errorMsg);
          dispatch({ type: "SET_ERROR", payload: { errorMessage: errorMsg } });
          throw new Error(errorMsg);
        }

        // Push APIサポートチェック
        if (!notificationState.isSupported) {
          const errorMsg = "Service WorkerまたはPush APIがサポートされていません。";
          toast.error(errorMsg);
          dispatch({ type: "SET_ERROR", payload: { errorMessage: errorMsg } });
          throw new Error(errorMsg);
        }

        // Service Worker準備確認
        if (!notificationState.registrationState) {
          const errorMsg = "Service Worker の準備ができていません。";
          toast.error(errorMsg);
          dispatch({ type: "SET_ERROR", payload: { errorMessage: errorMsg } });
          throw new Error(errorMsg);
        }

        // 通知許可要求
        if (notificationState.permissionState !== "granted") {
          const permission = await Notification.requestPermission();
          dispatch({
            type: "SET_SUPPORT_STATUS",
            payload: { isSupported: notificationState.isSupported, permissionState: permission },
          });

          if (permission !== "granted") {
            const errorMsg = "通知の許可が得られませんでした。";
            toast.error(errorMsg);
            dispatch({ type: "SET_ERROR", payload: { errorMessage: errorMsg } });
            throw new Error(errorMsg);
          }
        }

        // VAPID公開鍵の取得と変換
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          const errorMsg = "VAPID 公開鍵が設定されていません";
          toast.error(errorMsg);
          dispatch({ type: "SET_ERROR", payload: { errorMessage: errorMsg } });
          throw new Error(errorMsg);
        }

        // VAPID公開鍵をURLBase64からUint8Arrayに変換
        const padding = "=".repeat((4 - (vapidPublicKey.length % 4)) % 4);
        const base64 = (vapidPublicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        const applicationServerKey = outputArray;

        // プッシュサービスに購読
        const subscription = await notificationState.registrationState.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });

        if (!subscription) {
          const errorMsg = "プッシュ通知の購読に失敗しました。";
          toast.error(errorMsg);
          dispatch({ type: "SET_ERROR", payload: { errorMessage: errorMsg } });
          throw new Error(errorMsg);
        }

        // 購読情報をステートに設定
        dispatch({ type: "SET_SUBSCRIPTION", payload: { subscriptionState: subscription } });

        // DBに保存
        await updateUserSettingToggle({ userId: userId ?? "", isEnabled: true, column: "isPushEnabled" });

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

        /**
         * トグルをOFFにする場合
         */
      } else {
        // 購読情報がある場合
        if (notificationState.subscriptionState) {
          // サーバーから購読情報を削除
          await deleteSubscription(notificationState.subscriptionState.endpoint);

          // プッシュサービスから購読を解除
          await notificationState.subscriptionState.unsubscribe();

          // ステートをクリア
          dispatch({
            type: "SET_SUBSCRIPTION",
            payload: { subscriptionState: null, recordId: null },
          });
        }

        // DBを更新
        await updateUserSettingToggle({ userId: userId ?? "", isEnabled: false, column: "isPushEnabled" });
      }
    },
    onError: (_error: Error, newPushEnabledState, context) => {
      // オプティミスティックアップデートをロールバック
      if (context?.previousIsEnabled !== undefined) {
        dispatch({
          type: "SET_ENABLED_STATE",
          payload: { isEnabled: context.previousIsEnabled },
        });
      } else {
        // フォールバック
        dispatch({
          type: "SET_ENABLED_STATE",
          payload: { isEnabled: !newPushEnabledState },
        });
      }
    },
    onSettled: () => {
      // ブラウザの実際の状態と同期
      if (!notificationState.isSupported) {
        return;
      }

      const browserIsEnabled = notificationState.permissionState === "granted" && !!notificationState.subscriptionState;
      dispatch({
        type: "SET_ENABLED_STATE",
        payload: { isEnabled: browserIsEnabled },
      });
    },
    meta: {
      invalidateCacheKeys: [{ queryKey: queryCacheKeys.userSettings.userAll(userId ?? ""), exact: true }],
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 戻り値
   */
  return {
    // state
    isSupported: notificationState.isSupported,
    isInitialized: notificationState.isInitialized,
    isEnabled: notificationState.isEnabled,
    isToggleUpdating: isToggleUpdating,
    errorMessage: notificationState.errorMessage,
    permissionState: notificationState.permissionState,

    // function
    togglePushNotification,
  };
}
