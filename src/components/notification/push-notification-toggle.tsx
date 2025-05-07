"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePushNotification } from "@/hooks/notification/use-push-notification";
import { updateUserSettings } from "@/lib/actions/user-settings";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * プッシュ通知のトグル
 */
export const WebPushNotificationToggle = memo(function PushNotificationToggle({
  isPushEnabled: initialIsPushEnabled, // 初期値をリネーム
  userId,
}: {
  isPushEnabled: boolean;
  userId: string;
}) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * プッシュ通知のhookを使用
   */
  const { isSupported, subscriptionState, subscribe, unsubscribe, error: pushHookError, permissionState } = usePushNotification();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * プッシュ通知のトグルの状態
   * 初期値は props から受け取り、その後はブラウザの実際の状態と同期
   */
  const [isEnabled, setIsEnabled] = useState<boolean>(initialIsPushEnabled);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ブラウザの通知許可状態と購読状態に基づいてローカルの isEnabled を更新する関数
   */
  const syncEnabledStateWithBrowser = useCallback(() => {
    if (!isSupported) {
      // サポートされていない場合は、isEnabled を false にするなどの対応も可能
      return;
    }
    // 'prompt' の間はユーザーの選択待ち。購読が実際に確立されているかで判断。
    const browserIsEnabled = permissionState === "granted" && !!subscriptionState;
    setIsEnabled(browserIsEnabled);
  }, [isSupported, permissionState, subscriptionState]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * isSupported, permissionState, subscriptionState が変更されたときに isEnabled を同期
   */
  useEffect(() => {
    syncEnabledStateWithBrowser();
  }, [syncEnabledStateWithBrowser]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * initialIsPushEnabled (DBからの設定値) が変更された場合、isEnabled に反映。
   * これにより、invalidateQueries後の親からのprops変更がUIに反映される。
   * その後、syncEnabledStateWithBrowserがブラウザの実際の状態と最終調整する。
   */
  useEffect(() => {
    setIsEnabled(initialIsPushEnabled);
  }, [initialIsPushEnabled]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * プッシュ通知のトグルの状態を更新する
   */
  const queryClient = useQueryClient();
  const { mutate, isPending: isUpdating } = useMutation<
    { success: boolean; error?: string }, // APIレスポンスの型
    Error, // エラーの型
    boolean, // mutateに渡す引数の型 (トグルの新しい状態)
    { previousIsEnabled: boolean } // onMutateのコンテキストの型
  >({
    mutationFn: async (newPushEnabledState: boolean) => {
      if (!userId) {
        throw new Error("ユーザーIDがありません。");
      }

      if (newPushEnabledState) {
        // トグルをONにする場合
        if (permissionState === "denied") {
          alert("通知がブラウザ設定で拒否されています。設定を変更してください。");
          throw new Error("通知はブラウザ設定で拒否されています。");
        }
        // 購読を試みる (これにより許可ダイアログが表示される場合がある)
        const subscription = await subscribe();
        if (!subscription) {
          // ユーザーが許可しなかったか、その他の理由で購読に失敗
          throw new Error("プッシュ通知の購読に失敗しました。通知が許可されていないか、ブラウザが対応していません。");
        }
        // 購読成功、DBを更新
        const result = await updateUserSettings(userId, true, "isPushEnabled");
        if (!result.success) {
          throw new Error(result.error ?? "サーバーでの設定更新に失敗しました。");
        }
        return result;
      } else {
        // トグルをOFFにする場合
        if (subscriptionState) {
          // 既に購読中の場合のみ解除
          await unsubscribe();
        }
        // 購読解除後 (または元々未購読)、DBを更新
        const result = await updateUserSettings(userId, false, "isPushEnabled");
        if (!result.success) {
          throw new Error(result.error ?? "サーバーでの設定更新に失敗しました。");
        }
        return result;
      }
    },
    onMutate: async (newPushEnabledState: boolean) => {
      // 既存の関連クエリをキャンセル
      await queryClient.cancelQueries({ queryKey: ["userSettings", userId] });

      // ロールバック用に現在のUIの状態を保存
      const previousIsEnabled = isEnabled;

      // UIをオプティミスティックに更新
      setIsEnabled(newPushEnabledState);

      // contextとして以前の値を返す
      return { previousIsEnabled };
    },
    onSuccess: () => {
      toast.success("プッシュ通知設定を更新しました");
      // isEnabled は onMutate で更新済み。
      // onSettled で invalidateQueries を呼び出し、サーバーの最新状態でUIが最終同期される。
      // 必要であれば、ここで syncEnabledStateWithBrowser() を呼び出し、ブラウザ状態を即時反映も可能。
    },
    onError: (error: Error, newPushEnabledState, context) => {
      toast.error(error.message || "プッシュ通知設定の更新に失敗しました。");
      // オプティミスティックアップデートをロールバック
      if (context?.previousIsEnabled !== undefined) {
        setIsEnabled(context.previousIsEnabled);
      } else {
        // contextがない場合のフォールバック (稀なケース)
        setIsEnabled(!newPushEnabledState);
      }
      // エラー後もブラウザの最新状態にUIを同期
      syncEnabledStateWithBrowser();
    },
    onSettled: async () => {
      // 成功・失敗に関わらず、サーバーの最新の状態で関連クエリを無効化して再フェッチ
      await queryClient.invalidateQueries({ queryKey: ["userSettings", userId] });
      // 再フェッチ後、新しい initialIsPushEnabled が渡され、useEffect を通じて isEnabled が更新され、
      // syncEnabledStateWithBrowser によりブラウザの実際の状態と最終同期される。
    },
  });

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
          <Switch
            id="push-notification-toggle"
            checked={isEnabled}
            onCheckedChange={mutate} // mutate関数を直接渡す
            disabled={isUpdating} // 更新中はトグルを無効化
          />
          <Label htmlFor="push-notification-toggle">
            現在：{isEnabled ? "受信中" : "受信拒否中"}
            {isUpdating && " (更新中...)"}
          </Label>
        </div>
        <p className="mt-2 text-sm text-neutral-900 dark:text-neutral-100">プッシュ通知を有効にすると、アプリ内での通知を受け取ることができます。</p>
        <p className="mt-2 text-sm text-neutral-900 dark:text-neutral-100">
          アプリの通知設定は、このToggleでONにできますが、通知を受け取るにはchrome自体の通知設定もONにしてください。
        </p>
        {/* usePushNotificationフックからのエラー表示 */}
        {pushHookError && <p className="mt-2 text-sm text-red-500">エラー: {pushHookError.message}</p>}
        {/* ブラウザで通知が拒否されている場合のアラート */}
        {permissionState === "denied" && (
          <p className="mt-2 text-sm text-yellow-600">
            ブラウザの通知設定が「拒否」されています。プッシュ通知を有効にするには、ブラウザの設定を変更してください。
          </p>
        )}
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
