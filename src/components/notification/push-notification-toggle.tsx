"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePushNotification } from "@/hooks/notification/use-push-notification";
import { updateUserSettings } from "@/lib/actions/user-settings";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * プッシュ通知のトグル
 */
export const WebPushNotificationToggle = memo(function PushNotificationToggle({ isPushEnabled, userId }: { isPushEnabled: boolean; userId: string }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * プッシュ通知のhookを使用
   */
  const { isSupported, subscriptionState, subscribe, unsubscribe, error, permissionState } = usePushNotification();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * プッシュ通知のトグルの状態
   */
  const [isEnabled, setIsEnabled] = useState<boolean>(isPushEnabled);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ブラウザの通知許可状態と購読状態に基づいてトグルの状態を更新する関数
   */
  const checkPermission = useCallback(async () => {
    setIsEnabled(permissionState === "granted" && !!subscriptionState);
  }, [permissionState, subscriptionState]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ブラウザの通知許可状態と購読状態に基づいてトグルの状態を更新するリスナーとして設定
   */
  useEffect(() => {
    void checkPermission();
  }, [subscriptionState, permissionState, checkPermission]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * トグルの状態を変更する関数
   * @param {boolean} checked トグルの状態
   */
  const handleToggleChange = useCallback(
    async (checked: boolean) => {
      // ユーザーIDがない場合はエラーを表示
      if (!userId) {
        toast.error("ユーザーIDがありません");
        return;
      }

      // トグルをONにしたとき
      if (checked) {
        // ーーーーーーーーーーーーーーーーーーーーー

        // 通知許可が拒否されている場合はブラウザの設定を開くように促す
        if (permissionState === "denied") {
          // 通知許可が拒否されている場合はブラウザの設定を開くように促す
          alert("通知が拒否されています。ブラウザの設定から通知を許可してください。");
          return;
        }

        // ーーーーーーーーーーーーーーーーーーーーー

        // 購読を要求する
        await subscribe();

        // ーーーーーーーーーーーーーーーーーーーーー

        // ユーザー設定を更新
        const result = await updateUserSettings(userId, checked, "isPushEnabled");

        // ーーーーーーーーーーーーーーーーーーーーー

        // 成功した場合のみ状態を更新
        if (result.success) {
          setIsEnabled(checked);
        } else {
          // エラーの場合は元の状態に戻す
          console.error("プッシュ通知設定の更新に失敗しました:", result.error);
          setIsEnabled(!checked);
        }

        // ーーーーーーーーーーーーーーーーーーーーー

        // OFFにしたとき
      } else {
        // ーーーーーーーーーーーーーーーーーーーーー

        // 購読を解除する
        await unsubscribe();

        // ーーーーーーーーーーーーーーーーーーーーー

        // ユーザー設定を更新
        const result = await updateUserSettings(userId, checked, "isPushEnabled");

        // ーーーーーーーーーーーーーーーーーーーーー

        // 成功した場合のみ状態を更新
        if (result.success) {
          setIsEnabled(checked);
        } else {
          // エラーの場合は元の状態に戻す
          console.error("プッシュ通知設定の更新に失敗しました:", result.error);
          setIsEnabled(!checked);
        }
      }
    },
    [subscribe, unsubscribe, permissionState, userId],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * プッシュ通知のトグルを返す
   */
  return isSupported ? (
    <Card>
      <CardHeader>
        <CardTitle className="text-app dark:text-app-dark">プッシュ通知設定</CardTitle>
        <CardDescription>プッシュ通知の受信設定を管理します</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2">
          <Switch id="push-notification-toggle" checked={isEnabled} onCheckedChange={handleToggleChange} />
          <Label htmlFor="push-notification-toggle">現在：{isEnabled ? "受信中" : "受信拒否中"}</Label>
        </div>
        <p className="mt-2 text-sm text-neutral-900 dark:text-neutral-100">プッシュ通知を有効にすると、アプリ内での通知を受け取ることができます。</p>
        <p className="mt-2 text-sm text-neutral-900 dark:text-neutral-100">
          アプリの通知設定は、このToggleでONにできますが、通知を受け取るにはchrome自体の通知設定もONにしてください。
        </p>
        {error && <p className="mt-2 text-sm text-red-500">{error.message}</p>}
      </CardContent>
    </Card>
  ) : (
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
});
