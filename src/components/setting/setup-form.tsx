"use client";

import type { UserSettings } from "@prisma/client";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import type * as z from "zod";
import { memo } from "react";
import { redirect, useRouter } from "next/navigation";
import { EmailNotificationToggle } from "@/components/notification/email-notification-toggle";
import { WebPushNotificationToggle } from "@/components/notification/push-notification-toggle";
import { CustomFormField } from "@/components/share/form/form-field";
import { FormLayout } from "@/components/share/form/form-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateUserSetup } from "@/lib/actions/user-settings";
import { getUserSettings } from "@/lib/auction/action/user";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { setupSchema } from "@/lib/zod-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * フォームの型定義
 */
export type SetupForm = z.infer<typeof setupSchema>;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * セットアップフォームコンポーネント
 * @param initialData 初期データ
 * @returns セットアップフォーム
 */
export const SetupForm = memo(function SetupForm() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ルーターを使用してリロードを行う
   */
  const router = useRouter();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーIDを取得
   */
  const { data: session } = useSession();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/auth/signin");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * queryClientを取得
   */
  const queryClient = useQueryClient();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザー設定を取得
   */
  const { data: userSettings, isLoading } = useQuery<UserSettings | null, Error, UserSettings | null, Readonly<[string, string]>>({
    queryKey: queryCacheKeys.userSettings.userAll(userId),
    queryFn: async (): Promise<UserSettings | null> => getUserSettings(userId),
    enabled: !!userId,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    refetchIntervalInBackground: false,
  });
  console.log("src/components/auth/setup-form.tsx_userSettings", userSettings);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザー設定を更新する
   */
  const { mutate, isPending, variables } = useMutation({
    mutationKey: queryCacheKeys.userSettings.update(userId),
    gcTime: Infinity,
    mutationFn: (userSettings: SetupForm): Promise<{ success: boolean; error?: string }> => updateUserSetup(userSettings),
    onError: (error: Error, _variables: SetupForm, context: { previousUserSettings: UserSettings | undefined } | undefined) => {
      toast.error("ユーザー設定の更新に失敗しました");
      console.error("ユーザー設定の更新に失敗しました:", error);
      form.setError("root", { message: error.message });
      if (context !== undefined) {
        queryClient.setQueryData(queryCacheKeys.userSettings.userAll(userId), context.previousUserSettings);
      }
    },
    onSuccess: (data) => {
      toast.success("ユーザー設定を更新しました");
      if (data.success) {
        router.refresh();
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryCacheKeys.userSettings.userAll(userId) });
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * useForm関数を使用してフォームの状態を管理しています。これにより、フォームの入力値を管理し、エラーメッセージを表示することができます。
   */
  const form = useForm<SetupForm>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      username: userSettings?.username ?? "",
      lifeGoal: userSettings?.lifeGoal ?? "",
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザー設定が見つかった場合は設定ページを表示
   * isPending または isLoading の場合は optimistic update の variables を、それ以外は userSettings を使用
   */
  const displayData = isPending || isLoading ? variables : userSettings;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <>
      {/* 現在の設定情報 */}
      {displayData ? (
        <>
          <div className="mb-8 rounded-xl border border-blue-100 bg-white/80 p-6 shadow-lg shadow-blue-100/20 backdrop-blur-sm sm:p-8 dark:border-blue-800 dark:bg-blue-950 dark:shadow-blue-800/20">
            <h2 className="text-app dark:text-app-dark mb-4 text-xl font-bold">現在の設定</h2>
            <dl className="space-y-4">
              <div>
                <dt className="form-label-custom">ユーザー名</dt>
                <dd className="mt-1 text-sm text-neutral-900 dark:text-neutral-100">{displayData.username}</dd>
              </div>
              <div>
                <dt className="form-label-custom">人生の目標</dt>
                <dd className="mt-1 text-sm whitespace-pre-wrap text-neutral-900 dark:text-neutral-100">{displayData.lifeGoal}</dd>
              </div>
              {/* displayDataがUserSettings型で、かつupdatedAtが存在する場合 */}
              {!isPending &&
                typeof displayData === "object" &&
                displayData !== null &&
                "updatedAt" in displayData &&
                displayData.updatedAt instanceof Date && (
                  <div>
                    <dt className="form-label-custom">最終更新日</dt>
                    <dd className="mt-1 text-sm text-neutral-900 dark:text-neutral-100">
                      {new Date(displayData.updatedAt).toLocaleDateString("ja-JP")}
                    </dd>
                  </div>
                )}
            </dl>
          </div>
        </>
      ) : (
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-app dark:text-app-dark">ユーザー設定</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 text-yellow-600">
                <span>ユーザー設定がありません。</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* プッシュ通知設定 */}
      <div className="mb-8">
        <WebPushNotificationToggle isPushEnabled={userSettings?.isPushEnabled ?? false} userId={userId} />
      </div>

      {/* メール通知設定 */}
      <div className="mb-8">
        <EmailNotificationToggle isEmailEnabled={userSettings?.isEmailEnabled ?? false} userId={userId} />
      </div>

      {/* フォームコンテナ */}
      <div className="rounded-xl border border-blue-100 bg-white/80 p-6 shadow-lg shadow-blue-100/20 backdrop-blur-sm sm:p-8 dark:border-blue-800 dark:bg-blue-950 dark:shadow-blue-800/20">
        <h2 className="text-app dark:text-app-dark mb-4 text-xl font-bold">変更内容</h2>
        <FormLayout
          form={form as unknown as UseFormReturn<FieldValues>}
          onSubmit={(data: FieldValues) => {
            mutate(data as SetupForm);
          }}
          submitLabel="設定を保存"
        >
          <CustomFormField
            fieldType="input"
            control={form.control}
            name="username"
            label="ユーザー名"
            placeholder="ユーザー名を入力"
            description="あなたの表示名として使用されます"
            type="text"
          />

          <CustomFormField
            fieldType="textarea"
            control={form.control}
            name="lifeGoal"
            label="自分の人生の目標"
            placeholder="自分の人生の目標を入力"
            description="自分が達成したい人生の目標を記入してください"
          />
        </FormLayout>
      </div>
    </>
  );
});
