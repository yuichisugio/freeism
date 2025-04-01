"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePushNotification } from "@/hooks/push-notification/use-push-notification";
import { AlertCircle } from "lucide-react";

export function NotificationToggle() {
  const { isSupported, subscription, subscribe, unsubscribe, error } = usePushNotification();
  const [isEnabled, setIsEnabled] = useState(false);

  // ブラウザの通知許可状態と購読状態に基づいてトグルの状態を更新
  useEffect(() => {
    const checkPermission = async () => {
      const permission = Notification.permission;
      setIsEnabled(permission === "granted" && !!subscription);
    };

    void checkPermission();
  }, [subscription]);

  const handleToggleChange = async (checked: boolean) => {
    if (checked) {
      // トグルをONにしたとき
      if (Notification.permission === "denied") {
        // 通知許可が拒否されている場合はブラウザの設定を開くように促す
        alert("通知が拒否されています。ブラウザの設定から通知を許可してください。");
        return;
      }
      await subscribe();
    } else {
      // トグルをOFFにしたとき
      await unsubscribe();
    }
    setIsEnabled(checked);
  };

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
        {error && <p className="mt-2 text-sm text-red-500">{error.message}</p>}
      </CardContent>
    </Card>
  );
}
