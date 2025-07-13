"use client";

import { memo } from "react";
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
  isLoading: isPushNotificationLoading,
}: {
  isPushEnabled: boolean;
  isLoading: boolean; // プッシュ通知のトグルの更新中フラグ
}) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * プッシュ通知のhookを使用
   */
  const {
    // state
    isSupported,
    isEnabled,
    isToggleUpdating,
    permissionState,
    isLoading,

    // function
    togglePushNotification,
  } = usePushNotification(initialIsPushEnabled);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * プッシュ通知のトグルを返す
   */
  return isSupported ? (
    <Card>
      <CardHeader>
        <CardTitle className="text-app dark:text-app-dark">プッシュ通知</CardTitle>
        <CardDescription>プッシュ通知の受信設定を管理します</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2">
          {isPushNotificationLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-neutral-600 dark:text-neutral-400">設定を読み込み中...</span>
            </>
          ) : (
            <>
              <Switch
                id="push-notification-toggle"
                checked={isEnabled}
                onCheckedChange={togglePushNotification} // hookのtoggle関数を直接使用
                disabled={isToggleUpdating} // 更新中はトグルを無効化
              />
              <Label htmlFor="push-notification-toggle">
                現在：{isEnabled ? "受信中" : "受信拒否中"}
                {isToggleUpdating && " (更新中...)"}
                {isLoading && " (データ取得中...)"}
              </Label>
            </>
          )}
        </div>
        <p className="mt-2 text-sm text-neutral-900 dark:text-neutral-100">
          プッシュ通知を有効にすると、アプリ内での通知を受け取ることができます。
          <br />
          アプリの通知設定は、このToggleでONにできますが、通知を受け取るにはchrome自体の通知設定もONにしてください。
        </p>
        {permissionState === "denied" && (
          <div className="mt-2 rounded-md border border-yellow-200 bg-yellow-50 p-2">
            <p className="text-sm text-yellow-800">
              <strong>ブラウザの通知設定が「拒否」されています。</strong>
            </p>
            <p className="mt-1 text-sm text-yellow-700">
              プッシュ通知を有効にするには、ブラウザの設定で通知を許可してください。設定変更後、ページを再読み込みしてください。
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  ) : (
    <Card>
      <CardHeader>
        <CardTitle className="text-app dark:text-app-dark">通知設定</CardTitle>
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
});
