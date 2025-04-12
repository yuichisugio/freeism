"use client";

import type { Group, Task, User } from "@/hooks/notification/use-create-notification";
import { memo, useMemo } from "react";
import { CustomFormField } from "@/components/share/form-field";
import { FormLayout } from "@/components/share/form-layout";
import { useCreateNotification } from "@/hooks/notification/use-create-notification";
import { type Control, type FieldValues, type UseFormReturn } from "react-hook-form";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

type CreateNotificationFormProps = {
  isAppOwner: boolean;
  isGroupOwner: boolean;
  users: User[];
  groups: Group[];
  tasks: Task[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知作成フォーム
 * @param isAppOwner アプリオーナー権限
 * @param isGroupOwner グループオーナー権限
 * @param users ユーザーリスト
 * @param groups グループリスト
 * @param tasks タスクリスト
 * @returns {JSX.Element} 通知作成フォーム
 */
export const CreateNotificationForm = memo(function CreateNotificationForm({
  isAppOwner,
  isGroupOwner,
  users,
  groups,
  tasks,
}: CreateNotificationFormProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 通知作成フォームのフォームオブジェクト
  const {
    form,
    targetType,
    sendTiming,
    userComboOpen,
    setUserComboOpen,
    groupComboOpen,
    setGroupComboOpen,
    taskComboOpen,
    setTaskComboOpen,
    sendTimingOptions,
    targetTypeOptions,
    handleSubmit,
  } = useCreateNotification({
    isAppOwner,
    isGroupOwner,
    users,
    groups,
    tasks,
  });

  // 型の互換性のために型キャスト
  const typedForm = useMemo(() => form as unknown as UseFormReturn<FieldValues>, [form]);
  const typedControl = useMemo(() => form.control as unknown as Control<FieldValues>, [form]);
  const typedHandleSubmit = useMemo(() => handleSubmit as (data: FieldValues) => Promise<void>, [handleSubmit]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
