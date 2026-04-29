"use client";

import { useState } from "react";
import {
  deleteSubscription,
  deleteSubscriptionByDeviceId,
  getRecordId,
  saveSubscription,
} from "@/actions/notification/push-notification";
import { updateUserSettingToggle } from "@/actions/user/user-settings";
import { queryCacheKeys } from "@/library-setting/tanstack-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Notification State の型定義
 */
export type PushNotificationState = {
  isSupported: boolean;
  permissionState: NotificationPermission;
  registration: ServiceWorkerRegistration | null;
  subscription: PushSubscription | null;
  recordId: string | null;
  deviceId: string | null;
  isEnabled: boolean;
};

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
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 購読情報をJSONに変換（ブラウザのPush APIが提供するメソッド）
   */
  const subscriptionJSON = subscription.toJSON();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 必須のキーが存在するかチェック（endpoint、p256dh、authキーは必須）
   */
  if (!subscriptionJSON.endpoint || !subscriptionJSON.keys?.p256dh || !subscriptionJSON.keys?.auth) {
    console.error("有効な購読情報が取得できませんでした", subscriptionJSON);
    throw new Error("有効な購読情報が取得できませんでした");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * サーバーに送信するデータを整形
   */
  const subscriptionData: SaveSubscriptionParams = {
    endpoint: subscriptionJSON.endpoint, // プッシュサービスのエンドポイントURL
    expirationTime: subscriptionJSON.expirationTime ?? null, // 購読の有効期限
    keys: {
      p256dh: subscriptionJSON.keys.p256dh, // 公開鍵（クライアント側の暗号化キー）
      auth: subscriptionJSON.keys.auth, // 認証秘密鍵
    },
    deviceId: deviceId, // デバイス識別子
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * recordIdが指定されている場合は追加（既存レコードの更新時）
   */
  if (recordId) {
    subscriptionData.recordId = recordId;
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 戻り値
   */
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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * モダンブラウザのuserAgentDataがサポートされているか確認
   */
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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * デバイスIDを生成（プラットフォーム + モバイルフラグ + ブランド + ユーザーID）
   */
  const generatedDeviceId = `${deviceInfo.platform}-${deviceInfo.mobile ? "mobile" : "desktop"}-${deviceInfo.brands?.map((b) => b.brand).join("-") || "unknown"}-${userId}`;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 戻り値
   */
  return generatedDeviceId;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * プッシュ通知フックの戻り値の型定義
 */
export type PushNotificationHookReturnType = {
  // state
  isSupported: boolean;
  isEnabled: boolean;
  isToggleUpdating: boolean;
  permissionState: NotificationPermission;

  // function
  togglePushNotification: (newPushEnabledState: boolean) => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * プッシュ通知を管理するフック
 */
export function usePushNotification(initialIsPushEnabled: boolean, userId: string): PushNotificationHookReturnType {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * useReducerによるステート管理（競合状態を防ぐ）
   */
  const [notificationState, setNotificationState] = useState<PushNotificationState>({
    isSupported:
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window,
    permissionState: typeof Notification !== "undefined" ? Notification.permission : "default",
    registration: null,
    subscription: null,
    recordId: null,
    deviceId: null,
    isEnabled: initialIsPushEnabled,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * プッシュ通知のトグルの状態を更新する
   */
  const { mutate: togglePushNotification, isPending: isToggleUpdating } = useMutation({
    mutationFn: async (newPushEnabledState: boolean) => {
      /**
       * トグルをONにする場合の処理
       */
      if (newPushEnabledState) {
        // Push APIサポートチェック
        if (!notificationState.isSupported) {
          const errorMsg = "Service WorkerまたはPush APIがサポートされていません。";
          toast.error(errorMsg);
          throw new Error(errorMsg);
        }

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

        // 通知許可を確認
        let permission = notificationState.permissionState;

        // 通知が得られていない場合
        if (permission !== "granted") {
          // 通知許可のダイアログを表示して許可を要求
          permission = await Notification.requestPermission();

          // 許可が得られていない場合
          if (permission !== "granted") {
            const errorMsg = "通知の許可が得られませんでした。ブラウザ設定から許可してください。";
            toast.error(errorMsg);
            setNotificationState((prev) => ({
              ...prev,
              isEnabled: false,
              permissionState: permission,
            }));
            throw new Error(errorMsg);
          }
        }

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

        // Service Workerがすでにアクティブかつコントロール状態ではない場合は、Service Workerを登録
        let registration: ServiceWorkerRegistration;
        // コントロール状態ではない場合は、Service Workerを登録
        // serviceWorker.controllerでtrue(コントロール状態)になることをこのファイルで待つ必要はない。
        // service-worker.jsのevent.waitUntil(clients.claim())で、待っているため
        if (!navigator.serviceWorker.controller) {
          registration = await navigator.serviceWorker.register("/service-worker.js");
        }

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

        // すでにアクティブなService Workerを取得。アクティブな場合のみここに到達するので無限に待つことはない
        // ここでregisterで登録完了まで待たないと、getSubscription()がnullを返す。
        registration = await navigator.serviceWorker.ready;

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

        // VAPID公開鍵の取得と変換(Uint8Arrayに変換する必要があるため)
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          const errorMsg = "VAPID 公開鍵が設定されていません";
          toast.error(errorMsg);
          throw new Error(errorMsg);
        }

        // VAPID公開鍵をURLBase64からUint8Arrayに変換
        const padding = "=".repeat((4 - (vapidPublicKey.length % 4)) % 4);
        const base64 = (vapidPublicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = window.atob(base64);
        const applicationServerKey = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
          applicationServerKey[i] = rawData.charCodeAt(i);
        }

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

        // プッシュサービスに購読
        let subscription = await registration.pushManager.getSubscription();
        subscription ??= await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey,
        });

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

        // デバイスID取得
        const currentDeviceId = getDeviceId(userId);

        // レコードID取得とDB同期
        let currentRecordId: string | null = null;
        if (subscription?.endpoint) {
          const result = await getRecordId(subscription.endpoint);

          // サーバーと同期
          const subscriptionData = formatSubscriptionForServer(subscription, result.data ?? undefined, currentDeviceId);

          // サーバーに保存
          await saveSubscription(subscriptionData);

          // 最新のレコードIDを取得
          currentRecordId = result.data;
        }

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

        // 初期化完了：全ての状態を一括更新
        setNotificationState((prev) => ({
          ...prev,
          permissionState: permission,
          registration: registration,
          subscription: subscription,
          recordId: currentRecordId,
          deviceId: currentDeviceId,
          isEnabled: true,
        }));

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

        // DBに保存
        await updateUserSettingToggle({ userId, isEnabled: true, column: "isPushEnabled" });

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

        /**
         * トグルをOFFにする場合
         */
      } else {
        // Service Workerの登録がある場合
        if (navigator.serviceWorker.controller) {
          // Service Workerの登録を取得
          const registration = await navigator.serviceWorker.ready;

          // 実際のサブスクリプションを取得
          const subscription = await registration.pushManager.getSubscription();

          // 購読情報がある場合
          if (subscription) {
            // サーバーから購読情報を削除
            await deleteSubscription(subscription.endpoint);

            // プッシュサービスから購読を解除
            await subscription.unsubscribe();
          }
        }

        // ステートをクリア
        setNotificationState((prev) => ({
          ...prev,
          registration: null,
          subscription: null,
          recordId: null,
          deviceId: null,
          isEnabled: false,
        }));

        // DBを更新
        await updateUserSettingToggle({ userId, isEnabled: false, column: "isPushEnabled" });
      }
      return true;
    },
    meta: {
      invalidateCacheKeys: [{ queryKey: queryCacheKeys.userSettings.userAll(userId), exact: true }],
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * push通知が受信中だが、ブラウザの権限が失効しているor無効にしている場合に、DBのデータを削除する処理
   * 初回に開いたときに毎回実行したい
   * queryKeyを、userAllにしてはダメ。既存の設定を上書きしてしまうし、この関数はtrueを返すのみのため。
   * 毎回実行したいためキャッシュしない。なのでstaleTime,gcTimeを0に設定しておく
   */
  const queryClient = useQueryClient();
  /* eslint-disable @tanstack/query/exhaustive-deps -- queryClient / setNotificationState を queryKey に含めると不要な再フェッチになるため省略 */
  const { isPending: isUserSettingsLoading } = useQuery({
    queryKey: [
      "if-push-notification-permission-is-not-granted-and-push-notification-is-enabled-then-update-user-settings-to-false",
      userId,
      initialIsPushEnabled,
    ],
    queryFn: async () => {
      // ① Push が有効設定のまま ② ブラウザ権限が失効していたら cleanup
      if (initialIsPushEnabled && Notification.permission !== "granted") {
        // デバイスID取得
        const deviceId = getDeviceId(userId);

        // DB の購読情報を削除
        await deleteSubscriptionByDeviceId(deviceId);

        // DB の設定を無効にする
        await updateUserSettingToggle({
          userId,
          isEnabled: false,
          column: "isPushEnabled",
        });

        // フロントの state も合わせてリセット
        setNotificationState((prev) => ({
          ...prev,
          isEnabled: false,
          subscription: null,
          recordId: null,
        }));

        void queryClient.invalidateQueries({ queryKey: queryCacheKeys.userSettings.userAll(userId) });
      }
      return true;
    },
    staleTime: 0,
    gcTime: 0,
  });
  /* eslint-enable @tanstack/query/exhaustive-deps */

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 戻り値
   */
  return {
    // state
    isSupported: notificationState.isSupported,
    isEnabled: notificationState.isEnabled,
    isToggleUpdating: isToggleUpdating || isUserSettingsLoading,
    permissionState: notificationState.permissionState,

    // function
    togglePushNotification,
  };
}
