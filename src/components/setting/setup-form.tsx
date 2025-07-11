"use client";

import type { UserSettings } from "@prisma/client";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import type * as z from "zod";
import { memo, useCallback, useEffect, useState } from "react";
import { redirect, useRouter } from "next/navigation";
import { getUserSettings, updateUserSetup } from "@/actions/user/user-settings";
import { EmailNotificationToggle } from "@/components/notification/email-notification-toggle";
import { WebPushNotificationToggle } from "@/components/notification/push-notification-toggle";
import { CustomFormField } from "@/components/share/form/form-field";
import { FormLayout } from "@/components/share/form/form-layout";
import { queryCacheKeys } from "@/library-setting/tanstack-query";
import { setupSchema } from "@/library-setting/zod-schema";
import { type PromiseResult } from "@/types/general-types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";

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
   * クライアントサイドレンダリングの制御
   * Hydrationエラーを防ぐため、初期レンダリング時はサーバーサイドと同じ状態を維持
   */
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

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
  const { data: userSettings, isLoading } = useQuery({
    queryKey: queryCacheKeys.userSettings.userAll(userId),
    queryFn: async (): PromiseResult<UserSettings | null> => getUserSettings(userId),
    enabled: !!userId && !!isClient, // クライアントサイドでのみクエリを実行
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザー設定を更新する
   */
  const { mutate, isPending, variables } = useMutation({
    mutationFn: (userSettings: SetupForm): PromiseResult<null> => updateUserSetup(userSettings, userId),
    onError: (
      error: Error,
      _variables: SetupForm,
      context: { previousUserSettings: UserSettings | undefined } | undefined,
    ) => {
      form.setError("root", { message: error.message });
      if (context !== undefined) {
        queryClient.setQueryData(queryCacheKeys.userSettings.userAll(userId), context.previousUserSettings);
      }
    },
    onSuccess: () => {
      router.push("/dashboard/grouplist");
    },
    meta: {
      invalidateCacheKeys: [{ queryKey: queryCacheKeys.userSettings.userAll(userId), exact: true }],
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * useForm関数を使用してフォームの状態を管理しています。これにより、フォームの入力値を管理し、エラーメッセージを表示することができます。
   */
  const form = useForm<SetupForm>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      username: "",
      lifeGoal: "",
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フォームのデフォルト値を更新
   * userSettingsが取得された後にフォームの値を更新
   */
  useEffect(() => {
    if (userSettings && isClient) {
      form.reset({
        username: userSettings?.data?.username ?? "",
        lifeGoal: userSettings?.data?.lifeGoal ?? "",
      });
    }
  }, [userSettings, form, isClient]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 表示データの決定
   * クライアントサイドでのみ動的なデータを表示し、サーバーサイドでは静的な状態を保持
   */
  const displayData = isClient ? (isPending && variables ? variables : userSettings?.data) : null;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レンダリング内容の決定
   * サーバーサイドとクライアントサイドで一貫したHTMLを生成
   */
  const renderCurrentSettings = useCallback(() => {
    // クライアントサイドでない場合は、常に読み込み中の状態を表示
    if (!isClient) {
      return (
        <div className="flex items-center space-x-2 text-yellow-600">
          <span>読み込み中...</span>
        </div>
      );
    }

    // クライアントサイドでデータが存在する場合
    if (displayData) {
      return (
        <dl className="space-y-4">
          <div>
            <dt className="form-label-custom">ユーザー名</dt>
            <dd className="mt-1 text-sm text-neutral-900 dark:text-neutral-100">{displayData?.username}</dd>
          </div>
          <div>
            <dt className="form-label-custom">人生の目標</dt>
            <dd className="mt-1 text-sm whitespace-pre-wrap text-neutral-900 dark:text-neutral-100">
              {displayData?.lifeGoal}
            </dd>
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
      );
    }

    // データが存在しない場合
    return (
      <div className="flex items-center space-x-2 text-yellow-600">
        <span>{isLoading ? "読み込み中..." : "ユーザー設定がありません。"}</span>
      </div>
    );
  }, [isClient, isLoading, isPending, displayData]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <>
      {/* 現在の設定情報 - 統一されたレイアウト */}
      <div className="mb-8 rounded-xl border border-blue-100 bg-white/80 p-6 shadow-lg shadow-blue-100/20 backdrop-blur-sm sm:p-8 dark:border-blue-800 dark:bg-blue-950 dark:shadow-blue-800/20">
        <h2 className="text-app dark:text-app-dark mb-4 text-xl font-bold">現在の設定</h2>
        {renderCurrentSettings()}
      </div>

      {/* プッシュ通知設定 */}
      <div className="mb-8">
        <WebPushNotificationToggle
          isPushEnabled={isClient ? (userSettings?.data?.isPushEnabled ?? false) : false}
          isLoading={!isClient || isLoading}
        />
      </div>

      {/* メール通知設定 */}
      <div className="mb-8">
        <EmailNotificationToggle
          isEmailEnabled={isClient ? (userSettings?.data?.isEmailEnabled ?? false) : false}
          userId={userId}
          isLoading={!isClient || isLoading}
        />
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
