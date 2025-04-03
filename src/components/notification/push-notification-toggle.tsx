"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePushNotification } from "@/hooks/push-notification/use-push-notification";
import { AlertCircle } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * プッシュ通知のトグル
 */
export function NotificationToggle() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // プッシュ通知のhookを使用
  const { isSupported, subscriptionState, subscribe, unsubscribe, error, permissionState } = usePushNotification();
  // トグルの状態
  const [isEnabled, setIsEnabled] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ブラウザの通知許可状態と購読状態に基づいてトグルの状態を更新
  useEffect(() => {
    const checkPermission = async () => {
      setIsEnabled(permissionState === "granted" && !!subscriptionState);
    };

    void checkPermission();
  }, [subscriptionState, permissionState]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // トグルの状態を変更する関数
  const handleToggleChange = useCallback(
    async (checked: boolean) => {
      // トグルをONにしたとき
      if (checked) {
        // 通知許可が拒否されている場合はブラウザの設定を開くように促す
        if (permissionState === "denied") {
          // 通知許可が拒否されている場合はブラウザの設定を開くように促す
          alert("通知が拒否されています。ブラウザの設定から通知を許可してください。");
          return;
        }
        // 購読を要求する
        await subscribe();
      } else {
        // トグルをOFFにしたとき
        await unsubscribe();
      }
      setIsEnabled(checked);
    },
    [subscribe, unsubscribe, permissionState],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ブラウザがプッシュ通知をサポートしていない場合
  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>通知設定</CardTitle>
          <CardDescription>このブラウザはプッシュ通知をサポートしていません</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 text-yellow-600">
            <AlertCircle className="h-5 w-5" />
            <span>最新のChromeやSafariなどのモダンブラウザでご利用ください</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <Card>
      <CardHeader>
        <CardTitle>通知設定</CardTitle>
        <CardDescription>プッシュ通知の受信設定を管理します</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2">
          <Switch id="notification-toggle" checked={isEnabled} onCheckedChange={handleToggleChange} />
          <Label htmlFor="notification-toggle">プッシュ通知を{isEnabled ? "受信する" : "受信しない"}</Label>
        </div>
        <p className="mt-2 text-sm text-neutral-900 dark:text-neutral-100">プッシュ通知を有効にすると、アプリ内での通知を受け取ることができます。</p>
        <p className="mt-2 text-sm text-neutral-900 dark:text-neutral-100">アプリの通知設定は、このToggleでONにできますが、通知を受け取るにはchrome自体の通知設定もONにしてください。</p>
        {error && <p className="mt-2 text-sm text-red-500">{error.message}</p>}
      </CardContent>
    </Card>
  );
}
