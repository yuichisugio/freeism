"use client";

import { memo } from "react";
import { updateUserSettingToggle } from "@/actions/user/user-settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { queryCacheKeys } from "@/library-setting/tanstack-query";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * メール通知のトグル
 */
export const EmailNotificationToggle = memo(function EmailNotificationToggle({
  isEmailEnabled,
  userId,
  isLoading = false,
}: {
  isEmailEnabled: boolean;
  userId: string;
  isLoading?: boolean;
}): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * メール通知設定の更新
   */
  const { mutate, variables, isPending } = useMutation({
    mutationFn: async (isEmailEnabled: boolean) =>
      await updateUserSettingToggle({ userId, isEnabled: isEmailEnabled, column: "isEmailEnabled" }),
    meta: {
      invalidateCacheKeys: [{ queryKey: queryCacheKeys.userSettings.userAll(userId), exact: true }],
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 表示する値を決定（Hydrationエラーを防ぐため、サーバー・クライアント間で一貫した初期値を使用）
   * isPendingで変更中の場合のみvariablesの値を使用し、それ以外は常にisEmailEnabledを使用
   */
  const displayValue = isPending && variables !== undefined ? variables : isEmailEnabled;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ラベルテキストの決定（Hydrationエラーを防ぐため、サーバー・クライアント間で一貫性を保つ）
   */
  const getLabelText = () => {
    const statusText = displayValue ? "受信中" : "受信拒否中";
    const pendingText = isPending ? " (更新中...)" : "";
    return `現在：${statusText}${pendingText}`;
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-app dark:text-app-dark">メール通知設定</CardTitle>
        <CardDescription>メール通知の受信設定を管理します</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-neutral-600 dark:text-neutral-400">設定を読み込み中...</span>
            </>
          ) : (
            <>
              <Switch
                id="email-notification-toggle"
                checked={displayValue}
                onCheckedChange={mutate}
                disabled={isPending}
              />
              <Label htmlFor="email-notification-toggle">{getLabelText()}</Label>
            </>
          )}
        </div>
        <p className="mt-2 text-sm text-neutral-900 dark:text-neutral-100">
          メール通知を有効にすると、メールでの通知を受け取ることができます。
        </p>
        {process.env.NEXT_PUBLIC_IS_RESEND_ENABLED === "false" && (
          <p className="mt-2 text-sm text-red-500 dark:text-red-500">メール通知は後ほど開発予定です。</p>
        )}
      </CardContent>
    </Card>
  );
});
