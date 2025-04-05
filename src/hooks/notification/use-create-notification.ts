"use client";

import type { CreateNotificationFormData } from "@/lib/zod-schema";
import { useEffect, useState } from "react";
import { sendInAppNotification } from "@/lib/actions/notification/notification-utilities";
import { sendPushNotification } from "@/lib/actions/notification/push-notification";
import { createNotificationSchema } from "@/lib/zod-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

export type RadioOption = {
  value: string | number;
  label: string;
};

export type User = {
  id: string;
  name: string;
};

export type Group = {
  id: string;
  name: string;
};

export type Task = {
  id: string;
  task: string;
};

export type UseCreateNotificationProps = {
  isAppOwner: boolean;
  isGroupOwner: boolean;
  users: User[];
  groups: Group[];
  tasks: Task[];
};

export type UseCreateNotificationResult = {
  form: ReturnType<typeof useForm<CreateNotificationFormData>>;
  targetType: string;
  sendTiming: string;
  userComboOpen: boolean;
  setUserComboOpen: (open: boolean) => void;
  groupComboOpen: boolean;
  setGroupComboOpen: (open: boolean) => void;
  taskComboOpen: boolean;
  setTaskComboOpen: (open: boolean) => void;
  notificationTypeOptions: RadioOption[];
  sendTimingOptions: RadioOption[];
  targetTypeOptions: RadioOption[];
  priorityOptions: RadioOption[];
  handleSubmit: (data: CreateNotificationFormData) => Promise<void>;
};

/**
 * 通知作成フォーム用のカスタムフック
 */
export function useCreateNotification({ isAppOwner, isGroupOwner }: UseCreateNotificationProps): UseCreateNotificationResult {
  const form = useForm<CreateNotificationFormData>({
    resolver: zodResolver(createNotificationSchema),
    defaultValues: {
      title: "",
      message: "",
      type: "INFO",
      targetType: "SYSTEM",
      priority: 3,
      sendTiming: "NOW",
      sendScheduledDate: null,
      expiresAt: new Date(),
      actionUrl: "",
      userId: "",
      groupId: "",
      taskId: "",
      sendPushNotification: false,
    },
  });

  const { watch, setValue, reset } = form;
  const targetType = watch("targetType");
  const sendTiming = watch("sendTiming");

  // ComboBox用のstate
  const [userComboOpen, setUserComboOpen] = useState(false);
  const [groupComboOpen, setGroupComboOpen] = useState(false);
  const [taskComboOpen, setTaskComboOpen] = useState(false);

  // targetTypeが変わったら関連するフィールドをリセット
  useEffect(() => {
    setValue("userId", "");
    setValue("groupId", "");
    setValue("taskId", "");
  }, [targetType, setValue]);

  // 通知タイプのオプション
  const notificationTypeOptions: RadioOption[] = [
    { value: "INFO", label: "情報" },
    { value: "SUCCESS", label: "成功" },
    { value: "WARNING", label: "警告" },
  ];

  // 送信タイミングのオプション
  const sendTimingOptions: RadioOption[] = [
    { value: "NOW", label: "即時送信" },
    { value: "SCHEDULED", label: "送信予約" },
  ];

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

  // 重要度のオプション
  const priorityOptions = [
    { value: 5, label: "最高" },
    { value: 4, label: "高" },
    { value: 3, label: "中" },
    { value: 2, label: "低" },
    { value: 1, label: "最低" },
  ];

  // フォーム送信処理
  const handleSubmit = async (data: CreateNotificationFormData) => {
    try {
      // 予約送信の場合に送信日が設定されていないとエラー
      if (data.sendTiming === "SCHEDULED" && !data.sendScheduledDate) {
        toast.error("送信予約の場合は日付を選択してください");
        return;
      }

      // アプリ内通知を作成
      const result = await sendInAppNotification(data, isAppOwner, isGroupOwner);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      // 即時送信の場合のみプッシュ通知を送信
      if (data.sendTiming === "NOW" && data.sendPushNotification) {
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
      } else if (data.sendTiming === "SCHEDULED") {
        toast.success("通知の予約送信を設定しました");
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

  return {
    form,
    targetType,
    sendTiming,
    userComboOpen,
    setUserComboOpen,
    groupComboOpen,
    setGroupComboOpen,
    taskComboOpen,
    setTaskComboOpen,
    notificationTypeOptions,
    sendTimingOptions,
    targetTypeOptions,
    priorityOptions,
    handleSubmit,
  };
}
