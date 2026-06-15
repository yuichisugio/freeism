"use client";

import type { UserSettings } from "@prisma/client";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import type * as z from "zod";
import { memo, useEffect, useMemo, useState } from "react";
import { getUserSettings, updateUserSetup } from "@/actions/user/user-settings";
import { EmailNotificationToggle } from "@/components/notification/email-notification-toggle";
import { WebPushNotificationToggle } from "@/components/notification/push-notification-toggle";
import { CustomFormField } from "@/components/share/form/form-field";
import { FormLayout } from "@/components/share/form/form-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { queryCacheKeys } from "@/library-setting/tanstack-query";
import { setupSchema } from "@/library-setting/zod-schema";
import { type PromiseResult } from "@/types/general-types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
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
   * ユーザーIDを取得
   */
  const { data: session } = useSession();
  const userId = useMemo(() => session?.user?.id ?? "", [session]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * クライアントサイドでのみレンダリングするためのフラグ
   */
  const [onMount, setOnMount] = useState(false);
  useEffect(() => {
    setOnMount(true);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザー設定を取得
   */
  const { data: userSettings, isLoading } = useQuery({
    queryKey: queryCacheKeys.userSettings.userAll(userId),
    queryFn: async (): PromiseResult<UserSettings | null> => getUserSettings(userId),
    enabled: !!userId,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザー設定を更新する
   */
  const { mutate } = useMutation({
    mutationFn: (userSettings: SetupForm): PromiseResult<null> => updateUserSetup(userSettings, userId),
    onError: (error: Error) => {
      form.setError("root", { message: error.message });
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
   * ユーザー設定をフォームに反映
   */
  useEffect(() => {
    if (userSettings?.data) {
      form.reset({
        username: userSettings.data.username ?? "",
        lifeGoal: userSettings.data.lifeGoal ?? "",
      });
    }
  }, [userSettings, form]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <>
      {/* 現在の設定情報 */}
      <div className="mb-8 rounded-xl border border-blue-100 bg-white/80 p-6 shadow-lg shadow-blue-100/20 backdrop-blur-sm sm:p-8 dark:border-blue-800 dark:bg-blue-950 dark:shadow-blue-800/20">
        <h2 className="text-app dark:text-app-dark mb-4 text-xl font-bold">現在の設定</h2>
        <dl className="space-y-4">
          <div>
            <dt className="form-label-custom">ユーザー名</dt>
            <dd className="mt-1 text-sm text-neutral-900 dark:text-neutral-100">
              {isLoading || !onMount ? <Skeleton className="h-4 w-24" /> : (userSettings?.data?.username ?? "未設定")}
            </dd>
          </div>
          <div>
            <dt className="form-label-custom">人生の目標</dt>
            <dd className="mt-1 text-sm whitespace-pre-wrap text-neutral-900 dark:text-neutral-100">
              {isLoading || !onMount ? <Skeleton className="h-4 w-24" /> : (userSettings?.data?.lifeGoal ?? "未設定")}
            </dd>
          </div>
          <div>
            <dt className="form-label-custom">最終更新日</dt>
            <dd className="mt-1 text-sm text-neutral-900 dark:text-neutral-100">
              {isLoading || !onMount ? (
                <Skeleton className="h-4 w-24" />
              ) : userSettings?.data?.updatedAt && userSettings?.data?.createdAt ? (
                format(userSettings?.data?.updatedAt ?? userSettings?.data?.createdAt, "yyyy/MM/dd", {
                  locale: ja,
                })
              ) : (
                "未設定"
              )}
            </dd>
          </div>
        </dl>
      </div>

      {/* プッシュ通知設定 */}
      <div className="mb-8">
        <WebPushNotificationToggle
          isPushEnabled={userSettings?.data?.isPushEnabled ?? false}
          isLoading={isLoading}
          userId={userId}
        />
      </div>

      {/* メール通知設定 */}
      <div className="mb-8">
        <EmailNotificationToggle
          isEmailEnabled={userSettings?.data?.isEmailEnabled ?? false}
          userId={userId}
          isLoading={isLoading}
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
