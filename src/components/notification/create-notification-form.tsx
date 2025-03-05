"use client";

import type { CreateNotificationFormData } from "@/lib/zod-schema";
import { useEffect, useState } from "react";
import { createNotification } from "@/app/actions/notification";
import { CustomFormField } from "@/components/share/form-field";
import { FormLayout } from "@/components/share/form-layout";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createNotificationSchema } from "@/lib/zod-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

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

export function CreateNotificationForm({ isAppOwner, isGroupOwner: _isGroupOwner, users, groups, tasks }: CreateNotificationFormProps) {
  const form = useForm<CreateNotificationFormData>({
    resolver: zodResolver(createNotificationSchema),
    defaultValues: {
      title: "",
      message: "",
      type: "INFO",
      targetType: "SYSTEM",
      expiresAt: null,
      actionUrl: null,
      userId: null,
      groupId: null,
      taskId: null,
    },
  });

  const { watch, setValue, reset } = form;
  const targetType = watch("targetType");

  // ComboBox用のstate
  const [userComboOpen, setUserComboOpen] = useState(false);
  const [groupComboOpen, setGroupComboOpen] = useState(false);
  const [taskComboOpen, setTaskComboOpen] = useState(false);

  // targetTypeに応じて関連フィールドをリセット
  useEffect(() => {
    setValue("userId", null);
    setValue("groupId", null);
    setValue("taskId", null);
  }, [targetType, setValue]);

  // 通知タイプのオプション
  const notificationTypeOptions = [
    { value: "INFO", label: "情報" },
    { value: "SUCCESS", label: "成功" },
    { value: "WARNING", label: "警告" },
  ];

  // 通知対象タイプのオプション（権限によってフィルタリング）
  const targetTypeOptions = isAppOwner
    ? [
        { value: "SYSTEM", label: "システム全体" },
        { value: "USER", label: "特定ユーザー" },
        { value: "GROUP", label: "特定グループ" },
        { value: "TASK", label: "特定タスク" },
      ]
    : [
        { value: "GROUP", label: "特定グループ" },
        { value: "TASK", label: "特定タスク" },
      ];

  const handleSubmit = async (data: CreateNotificationFormData) => {
    try {
      const result = await createNotification(data);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("通知を作成しました");
        reset();
      }
    } catch (error) {
      console.error("通知作成エラー:", error);
      toast.error("通知の作成中にエラーが発生しました");
    }
  };

  // 期限日選択のカスタム入力
  const ExpiresAtField = () => {
    const expiresAt = watch("expiresAt");

    return (
      <div className="space-y-2">
        <div className="font-medium">有効期限（オプション）</div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {expiresAt ? format(expiresAt, "yyyy年MM月dd日", { locale: ja }) : "日付を選択"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={expiresAt || undefined}
              onSelect={(date: Date | undefined) => setValue("expiresAt", date || null)}
              initialFocus
              locale={ja}
            />
          </PopoverContent>
        </Popover>
        <p className="text-muted-foreground text-sm">通知の有効期限を設定します（オプション）</p>
      </div>
    );
  };

  return (
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

      <CustomFormField
        control={form.control}
        name="type"
        label="通知タイプ"
        description="通知の種類を選択してください"
        fieldType="radio"
        options={notificationTypeOptions}
      />

      <CustomFormField
        control={form.control}
        name="targetType"
        label="通知対象"
        description="通知の送信対象を選択してください"
        fieldType="radio"
        options={targetTypeOptions}
      />

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

      <ExpiresAtField />
    </FormLayout>
  );
}
