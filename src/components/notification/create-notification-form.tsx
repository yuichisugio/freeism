"use client";

import type { RadioOption } from "@/components/share/form-field";
import type { CreateNotificationFormData } from "@/lib/zod-schema";
import { useEffect, useState } from "react";
import { createNotification } from "@/app/actions/notification";
import { sendPushNotification } from "@/app/actions/push-notification";
import { CustomFormField } from "@/components/share/form-field";
import { FormLayout } from "@/components/share/form-layout";
import { createNotificationSchema } from "@/lib/zod-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

type User = {
  id: string;
  name: string;
};

type Group = {
  id: string;
  name: string;
};

type Task = {
  id: string;
  task: string;
};

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
 */
export function CreateNotificationForm({ isAppOwner, isGroupOwner, users, groups, tasks }: CreateNotificationFormProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  const form = useForm<CreateNotificationFormData>({
    resolver: zodResolver(createNotificationSchema),
    defaultValues: {
      title: "",
      message: "",
      type: "INFO",
      targetType: "SYSTEM",
      priority: 3,
      expiresAt: new Date(),
      actionUrl: "",
      userId: "",
      groupId: "",
      taskId: "",
      sendPushNotification: false,
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const { watch, setValue, reset } = form;
  // watchでtargetTypeを監視して変更されたら即座に再レンダリングする
  const targetType = watch("targetType");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ComboBox用のstate
  const [userComboOpen, setUserComboOpen] = useState(false);
  const [groupComboOpen, setGroupComboOpen] = useState(false);
  const [taskComboOpen, setTaskComboOpen] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // targetTypeが変わったら、↓の全部の設問をnullにする
  useEffect(() => {
    setValue("userId", "");
    setValue("groupId", "");
    setValue("taskId", "");
  }, [targetType, setValue]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 通知タイプのオプション
  const notificationTypeOptions: RadioOption[] = [
    { value: "INFO", label: "情報" },
    { value: "SUCCESS", label: "成功" },
    { value: "WARNING", label: "警告" },
  ];

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 通知対象タイプのオプション（権限によってフィルタリング）
  const targetTypeOptions: RadioOption[] = isAppOwner
    ? [
        { value: "SYSTEM", label: "システム全体" },
        { value: "USER", label: "ユーザー" },
        { value: "GROUP", label: "グループ" },
        { value: "TASK", label: "タスク" },
      ]
    : [
        { value: "GROUP", label: "グループ" },
        { value: "TASK", label: "タスク" },
      ];

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 重要度のオプション
  const priorityOptions = [
    { value: 5, label: "最高" },
    { value: 4, label: "高" },
    { value: 3, label: "中" },
    { value: 2, label: "低" },
    { value: 1, label: "最低" },
  ];

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const handleSubmit = async (data: CreateNotificationFormData) => {
    try {
      // アプリ内通知を作成
      const result = await createNotification(data, isAppOwner, isGroupOwner);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      // Push通知が有効な場合、Push通知も送信
      if (data.sendPushNotification) {
        try {
          // 通知対象に応じたパラメータを設定
          const pushParams = {
            title: data.title,
            body: data.message,
            url: data.actionUrl ?? undefined,
          };

          // 通知対象タイプに応じてパラメータを追加
          switch (data.targetType) {
            case "USER":
              if (data.userId) {
                Object.assign(pushParams, { userId: data.userId });
              }
              break;
            case "GROUP":
              if (data.groupId) {
                Object.assign(pushParams, { groupId: data.groupId });
              }
              break;
            case "TASK":
              if (data.taskId) {
                Object.assign(pushParams, { taskId: data.taskId });
              }
              break;
          }

          // Push通知を送信
          await sendPushNotification(pushParams);

          toast.success("通知とプッシュ通知を作成しました");
        } catch (pushError) {
          console.error("プッシュ通知送信エラー:", pushError);
          toast.error("通知は作成されましたが、プッシュ通知の送信に失敗しました");
        }
      } else {
        toast.success("通知を作成しました");
      }

      // フォームをリセット
      reset();
    } catch (error) {
      console.error("通知作成エラー:", error);
      toast.error("通知の作成中にエラーが発生しました");
    }
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="h-full">
      <div className="text-muted-foreground mb-6 text-sm">{isAppOwner ? "アプリオーナー権限" : "グループオーナー権限"}で操作しています。</div>
      <FormLayout form={form} onSubmit={handleSubmit} submitLabel="通知を作成" submittingLabel="作成中..." className="space-y-6">
        <CustomFormField
          control={form.control}
          name="title"
          label="通知タイトル"
          description="通知のタイトルを入力してください"
          fieldType="input"
          type="text"
          placeholder="例：システムメンテナンスのお知らせ"
        />

        <CustomFormField
          control={form.control}
          name="message"
          label="通知内容"
          description="通知の本文を入力してください"
          fieldType="textarea"
          placeholder="例：2025年3月1日午前2時から5時までシステムメンテナンスを実施します。"
        />

        <CustomFormField control={form.control} name="type" label="通知タイプ" description="通知の種類を選択してください" fieldType="radio" options={notificationTypeOptions} />

        <CustomFormField control={form.control} name="priority" label="重要度" description="通知の重要度を選択してください" fieldType="radio" options={priorityOptions} />

        <CustomFormField control={form.control} name="targetType" label="通知単位" description="通知の送信単位を選択してください" fieldType="radio" options={targetTypeOptions} />

        {targetType === "USER" && (
          <CustomFormField
            control={form.control}
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
            control={form.control}
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
            control={form.control}
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
          control={form.control}
          name="actionUrl"
          label="アクションURL（オプション）"
          description="通知をクリックした時に遷移するURLを入力してください"
          fieldType="input"
          type="url"
          placeholder="例：https://example.com/page"
        />

        <CustomFormField control={form.control} name="expiresAt" label="有効期限（オプション）" description="通知の有効期限を設定します" fieldType="date" placeholder="日付を選択" />

        <CustomFormField control={form.control} name="sendPushNotification" label="プッシュ通知も送信" description="アプリ内通知と一緒にプッシュ通知も送信します" fieldType="switch" />
      </FormLayout>
    </div>
  );
}
