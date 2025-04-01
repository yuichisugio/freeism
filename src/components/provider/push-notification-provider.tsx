"use client";

import { useEffect, useState } from "react";
import { usePushNotification } from "@/hooks/push-notification/use-push-notification";
import { useSession } from "next-auth/react";

type PushNotificationProviderProps = {
  children: React.ReactNode;
};

export function PushNotificationProvider({ children }: PushNotificationProviderProps) {
  // セッション情報を取得
  const { status } = useSession();
  // プッシュ通知のhookを使用
  const { subscribe, isSupported, isSubscribing } = usePushNotification();
  // 通知許可を要求したかどうかのフラグ
  const [hasRequestedPermission, setHasRequestedPermission] = useState(false);

  useEffect(() => {
    // ローカルストレージから許可要求状態を読み込む
    const hasRequested = localStorage.getItem("push-notification-requested") === "true";
    setHasRequestedPermission(hasRequested);
  }, []);

  useEffect(() => {
    // 認証済みで、サポートされており、まだ購読していない、かつ許可を要求していない場合
    if (status === "authenticated" && isSupported && !isSubscribing && !hasRequestedPermission) {
      // 通知許可を要求するタイミングを遅らせる（ユーザーがサイトにアクセスして少し経ってから）
      const timer = setTimeout(() => {
        if (Notification.permission !== "denied") {
          void subscribe();
          // 許可要求状態をローカルストレージに保存
          localStorage.setItem("push-notification-requested", "true");
          setHasRequestedPermission(true);
        }
      }, 3000); // 3秒後に表示

      return () => clearTimeout(timer);
    }
  }, [status, subscribe, isSupported, isSubscribing, hasRequestedPermission]);

  return <>{children}</>;
}
