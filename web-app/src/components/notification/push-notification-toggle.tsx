"use client";

import { memo, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePushNotification } from "@/hooks/notification/use-push-notification";
import { AlertCircle, Loader2 } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * プッシュ通知のトグル
 */
export const WebPushNotificationToggle = memo(function PushNotificationToggle({
  isPushEnabled: initialIsPushEnabled,
  isLoading,
  userId,
}: {
  isPushEnabled: boolean;
  isLoading: boolean;
  userId: string;
}) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * クライアントサイドでのみレンダリングするためのフラグ
   */
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  /**
   * プッシュ通知のhookを使用
   */
  const {
    // state
    isSupported,
    isEnabled,
    isToggleUpdating,
    permissionState,

    // function
    togglePushNotification,
  } = usePushNotification(initialIsPushEnabled, userId);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * プッシュ通知のトグルを返す
   */
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-app dark:text-app-dark">プッシュ通知</CardTitle>
        <CardDescription>プッシュ通知の受信設定を管理します</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2">
          {isLoading || !isMounted ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-neutral-600 dark:text-neutral-400">設定を読み込み中...</span>
            </>
          ) : !isSupported ? (
            <>
              <AlertCircle className="h-5 w-5" />
              <span>
                このブラウザはプッシュ通知をサポートしていません。最新のChromeやSafariなどのモダンブラウザでご利用ください。
              </span>
            </>
          ) : (
            <>
              <Switch
                id="push-notification-toggle"
                checked={isEnabled}
                onCheckedChange={togglePushNotification}
                disabled={isToggleUpdating}
              />
              <Label htmlFor="push-notification-toggle">
                現在：{isEnabled ? "受信中" : "受信拒否中"}
                {isToggleUpdating && " (更新中...)"}
              </Label>
            </>
          )}
        </div>
        <div className="mt-2 rounded-md border border-green-200 bg-green-50 p-3">
          <p className="text-sm text-neutral-900 dark:text-neutral-100">
            プッシュ通知を有効にすると、アプリ内での通知を受け取ることができます。
            <br />
            アプリの通知設定は、このToggleでONにできますが、通知を受け取るにはchrome自体の通知設定もONにしてください。
          </p>
        </div>
        {permissionState === "denied" && (
          <div className="mt-2 rounded-md border border-yellow-200 bg-yellow-50 p-3">
            <p className="text-sm text-yellow-800">
              <strong>ブラウザの通知設定が「拒否」されています。</strong>
              <br />
              プッシュ通知を有効にするには、ブラウザの設定で通知を許可してください。設定変更後、ページを再読み込みしてください。
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
