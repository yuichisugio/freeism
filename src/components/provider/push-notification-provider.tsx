"use client";

import { memo, useEffect } from "react";
import { usePushNotification } from "@/hooks/notification/use-push-notification";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

type PushNotificationProviderProps = {
  children: React.ReactNode;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * プッシュ通知のProvider
 * 初期化完了後、通知許可がまだの場合に購読（許可要求）を試みる
 * @param children
 * @returns
 */
export const PushNotificationProvider = memo(function PushNotificationProvider({ children }: PushNotificationProviderProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // isInitialized と permissionState をフックから取得
  const { subscribe, isSupported, subscriptionState, permissionState, isInitialized } = usePushNotification();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  useEffect(() => {
    console.log("PushNotificationProvider_useEffect", { isInitialized, isSupported, hasSubscription: !!subscriptionState, permissionState });

    // 初期化が完了し、サポートされており、まだ購読しておらず、通知許可がデフォルト状態の場合のみ実行
    // 3秒後に実行（ユーザー体験のため）
    if (isInitialized && isSupported && !subscriptionState && permissionState === "default") {
      const timer = setTimeout(() => {
        console.log("PushNotificationProvider_useEffect_timer_start: Attempting to subscribe (request permission).");
        // subscribe 関数を呼び出して通知許可ダイアログを表示させる
        if (subscribe) {
          void subscribe().catch((err) => {
            // ここでのエラーは usePushNotification 内で処理されるので、ここではログ出力程度で良い
            console.error("PushNotificationProvider: subscribe() failed:", err);
          });
        }
      }, 3000);

      // クリーンアップ: タイマーをクリア
      return () => clearTimeout(timer);
    } else {
      console.log("PushNotificationProvider_useEffect_timer_skip:", {
        isInitialized,
        isSupported,
        hasSubscription: !!subscriptionState,
        permissionState,
      });
    }
    // 依存配列に isInitialized, isSupported, subscriptionState, permissionState, subscribe を追加
  }, [isInitialized, isSupported, subscriptionState, permissionState, subscribe]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return <>{children}</>;
});
