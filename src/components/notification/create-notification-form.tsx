"use client";

import { memo, useMemo } from "react";
import Link from "next/link";
import { CustomFormField } from "@/components/share/form/form-field";
import { FormLayout } from "@/components/share/form/form-layout";
import { Loading } from "@/components/share/share-loading";
import { useCreateNotification } from "@/hooks/notification/use-create-notification";
import { ArrowLeft } from "lucide-react";
import { type Control, type FieldValues, type UseFormReturn } from "react-hook-form";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知作成フォーム
 * @returns {JSX.Element} 通知作成フォーム
 */
export const CreateNotificationForm = memo(function CreateNotificationForm() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 通知作成フォームのフォームオブジェクト
   */
  const {
    // state
    form,
    targetType,
    sendTiming,
    userComboOpen,
    groupComboOpen,
    taskComboOpen,
    sendTimingOptions,
    targetTypeOptions,
    isLoading,
    hasPermission,
    users,
    groups,
    tasks,
    isAppOwner,

    // action
    setGroupComboOpen,
    setTaskComboOpen,
    setUserComboOpen,
    handleSubmit,
  } = useCreateNotification();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 型の互換性のために型キャスト
   */
  const typedForm = useMemo(() => form as unknown as UseFormReturn<FieldValues>, [form]);
  const typedControl = useMemo(() => form.control as unknown as Control<FieldValues>, [form]);
  const typedHandleSubmit = useMemo(() => handleSubmit as (data: FieldValues) => Promise<void>, [handleSubmit]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ローディング中の場合
   */
  if (isLoading) {
    return <Loading />;
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 権限がない場合
   */
  if (!hasPermission) {
    return (
      <div className="container max-w-4xl py-10">
        <Link href="/dashboard/group-list" className="mb-6 flex items-center text-blue-600 hover:underline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          ダッシュボードに戻る
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <h1 className="mb-4 text-2xl font-bold text-red-700">オーナー権限がありません</h1>
          <p className="text-red-600">通知作成には、アプリオーナー権限またはいずれかのグループでグループオーナー権限が必要です。</p>
        </div>
      </div>
    );
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 通知作成フォームのレンダリング
   * @returns {JSX.Element} 通知作成フォーム
   */
  return (
    <div className="h-full">
      <div className="text-muted-foreground mb-6 text-sm">{isAppOwner ? "アプリオーナー権限" : "グループオーナー権限"}で操作しています。</div>
      <FormLayout form={typedForm} onSubmit={typedHandleSubmit} submitLabel="通知を作成" submittingLabel="作成中..." className="space-y-6">
        <CustomFormField
          control={typedControl}
          name="title"
          label="通知タイトル"
          description="通知のタイトルを入力してください"
          fieldType="input"
          type="text"
          placeholder="例：システムメンテナンスのお知らせ"
        />

        <CustomFormField
          control={typedControl}
          name="message"
          label="通知内容"
          description="通知の本文を入力してください"
          fieldType="textarea"
          placeholder="例：2025年3月1日午前2時から5時までシステムメンテナンスを実施します。"
        />

        <CustomFormField
          control={typedControl}
          name="targetType"
          label="通知単位"
          description="通知の送信単位を選択してください"
          fieldType="radio"
          options={targetTypeOptions}
        />

        <CustomFormField
          control={typedControl}
          name="sendTiming"
          label="送信タイミング"
          description="通知の送信タイミングを選択してください"
          fieldType="radio"
          options={sendTimingOptions}
        />

        {sendTiming === "SCHEDULED" && (
          <CustomFormField
            control={typedControl}
            name="sendScheduledDate"
            label="送信予定日"
            description="通知を送信する日付を選択してください"
            fieldType="date"
            placeholder="日付を選択"
            disablePastDates={true}
          />
        )}

        {targetType === "USER" && (
          <CustomFormField
            control={typedControl}
            name="userId"
            label="ユーザー"
            description="通知を送信するユーザーを選択してください"
            fieldType="combobox"
            options={users.map((user) => ({ id: user.id, name: user.name }))}
            open={userComboOpen}
            setOpen={setUserComboOpen}
            placeholder="ユーザーを選択"
            searchPlaceholder="ユーザーを検索..."
            emptyMessage="ユーザーが見つかりません"
          />
        )}

        {targetType === "GROUP" && (
          <CustomFormField
            control={typedControl}
            name="groupId"
            label="グループ"
            description="通知を送信するグループを選択してください"
            fieldType="combobox"
            options={groups.map((group) => ({ id: group.id, name: group.name }))}
            open={groupComboOpen}
            setOpen={setGroupComboOpen}
            placeholder="グループを選択"
            searchPlaceholder="グループを検索..."
            emptyMessage="グループが見つかりません"
          />
        )}

        {targetType === "TASK" && (
          <CustomFormField
            control={typedControl}
            name="taskId"
            label="タスク"
            description="通知を送信するタスクを選択してください"
            fieldType="combobox"
            options={tasks.map((task) => ({ id: task.id, name: task.task }))}
            open={taskComboOpen}
            setOpen={setTaskComboOpen}
            placeholder="タスクを選択"
            searchPlaceholder="タスクを検索..."
            emptyMessage="タスクが見つかりません"
          />
        )}

        <CustomFormField
          control={typedControl}
          name="actionUrl"
          label="アクションURL（オプション）"
          description="通知をクリックした時に遷移するURLを入力してください"
          fieldType="input"
          type="url"
          placeholder="例：https://example.com/page"
        />

        <CustomFormField
          control={typedControl}
          name="expiresAt"
          label="有効期限（オプション）"
          description="通知の有効期限を設定します"
          fieldType="date"
          placeholder="日付を選択"
        />

        <CustomFormField
          control={typedControl}
          name="sendPushNotification"
          label="プッシュ通知も送信"
          description="アプリ内通知と一緒にプッシュ通知も送信します"
          fieldType="switch"
        />

        <CustomFormField
          control={typedControl}
          name="sendEmailNotification"
          label="メール通知も送信"
          description="アプリ内通知と一緒にメール通知も送信します"
          fieldType="switch"
        />

        {process.env.NEXT_PUBLIC_IS_RESEND_ENABLED === "false" && (
          <div className="text-muted-foreground text-sm">メール通知は後ほど開発予定です。</div>
        )}
      </FormLayout>
    </div>
  );
});
