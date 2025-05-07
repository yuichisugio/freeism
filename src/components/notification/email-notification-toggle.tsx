"use client";

import { memo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateUserSettings } from "@/lib/actions/user-settings";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * メール通知のトグル
 */
export const EmailNotificationToggle = memo(function EmailNotificationToggle({
  isEmailEnabled,
  userId,
}: {
  isEmailEnabled: boolean;
  userId: string;
}): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * メール通知設定の更新
   */
  const queryClient = useQueryClient();
  const { mutate, variables, isPending } = useMutation({
    mutationFn: async (isEmailEnabled: boolean) => await updateUserSettings(userId, isEmailEnabled, "isEmailEnabled"),
    onSuccess: () => {
      toast.success("メール通知設定を更新しました。");
    },
    onError: (error: Error) => {
      toast.error(`メール通知設定の更新に失敗しました`);
      console.error("メール通知設定の更新に失敗しました:", error);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["userSettings", userId] });
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-app dark:text-app-dark">メール通知設定</CardTitle>
        <CardDescription>メール通知の受信設定を管理します</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2">
          <Switch id="email-notification-toggle" checked={variables ?? isEmailEnabled} onCheckedChange={mutate} disabled={isPending} />
          <Label htmlFor="email-notification-toggle">
            現在：{(variables ?? isEmailEnabled) ? "受信中" : "受信拒否中"}
            {isPending && " (更新中...)"}
          </Label>
        </div>
        <p className="mt-2 text-sm text-neutral-900 dark:text-neutral-100">メール通知を有効にすると、メールでの通知を受け取ることができます。</p>
        {process.env.NEXT_PUBLIC_IS_RESEND_ENABLED === "false" && (
          <p className="mt-2 text-sm text-red-500 dark:text-red-500">メール通知は後ほど開発予定です。</p>
        )}
      </CardContent>
    </Card>
  );
});
