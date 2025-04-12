"use client";

import type { UserSettings } from "@prisma/client";
import { memo, useCallback, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateUserSettings } from "@/lib/actions/user-settings";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * メール通知のトグル
 */
export const EmailNotificationToggle = memo(function EmailNotificationToggle({ userSettings }: { userSettings: UserSettings }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // メール通知のhookを使用
  const [isEnabled, setIsEnabled] = useState<boolean>(userSettings.isEmailEnabled);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // トグルの状態を変更する関数
  const handleToggleChange = useCallback(
    async (checked: boolean) => {
      try {
        // ユーザー設定の更新
        const result = await updateUserSettings(userSettings.userId, checked, "isEmailEnabled");

        // 成功した場合のみ状態を更新
        if (result.success) {
          setIsEnabled(checked);
        } else {
          // エラーの場合は元の状態に戻す
          console.error("メール通知設定の更新に失敗しました:", result.error);
          setIsEnabled(!checked);
        }
      } catch (error) {
        console.error("メール通知設定の更新に失敗しました:", error);
        // エラーが発生した場合は元の状態に戻す
        setIsEnabled(!checked);
      }
    },
    [userSettings.userId],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-app dark:text-app-dark">メール通知設定</CardTitle>
        <CardDescription>メール通知の受信設定を管理します</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2">
          <Switch id="notification-toggle" checked={isEnabled} onCheckedChange={handleToggleChange} />
          <Label htmlFor="notification-toggle">現在：{isEnabled ? "受信中" : "受信拒否中"}</Label>
        </div>
        <p className="mt-2 text-sm text-neutral-900 dark:text-neutral-100">メール通知を有効にすると、メールでの通知を受け取ることができます。</p>
        {process.env.NEXT_PUBLIC_IS_RESEND_ENABLED === "false" && (
          <p className="mt-2 text-sm text-red-500 dark:text-red-500">メール通知は後ほど開発予定です。</p>
        )}
      </CardContent>
    </Card>
  );
});
