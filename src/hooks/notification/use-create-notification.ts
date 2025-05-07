"use client";

import type { GeneralNotificationParams } from "@/lib/actions/notification/general-notification";
import type { CreateNotificationFormData } from "@/lib/zod-schema";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createNotificationSchema } from "@/lib/zod-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { NotificationSendMethod } from "@prisma/client";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知作成フォーム用のカスタムフック
 */

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ラジオボタン用のオプション
 */
export type RadioOption = {
  value: string | number;
  label: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザー用の型
 */
export type User = {
  id: string;
  name: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ用の型
 */
export type Group = {
  id: string;
  name: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク用の型
 */
export type Task = {
  id: string;
  task: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知作成フォーム用の型
 */
export type UseCreateNotificationProps = {
  isAppOwner: boolean;
  isGroupOwner: boolean;
  users: User[];
  groups: Group[];
  tasks: Task[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知作成フォーム用の型
 */
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
  sendTimingOptions: RadioOption[];
  targetTypeOptions: RadioOption[];
  handleSubmit: (data: CreateNotificationFormData) => Promise<void>;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知作成フォーム用のカスタムフック
 * @param {UseCreateNotificationProps} props 通知作成フォーム用のプロップス
 * @returns {UseCreateNotificationResult} 通知作成フォーム用の結果
 */
export function useCreateNotification({ isAppOwner, isGroupOwner }: UseCreateNotificationProps): UseCreateNotificationResult {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フォームの作成
   */
  const form = useForm<CreateNotificationFormData>({
    // フォームのスキーマ
    resolver: zodResolver(createNotificationSchema),
    // フォームのデフォルト値
    defaultValues: {
      title: "",
      message: "",
      targetType: "SYSTEM",
      sendTiming: "NOW",
      sendScheduledDate: null,
      expiresAt: new Date(),
      actionUrl: "",
      userId: "",
      groupId: "",
      taskId: "",
      sendPushNotification: false,
      sendEmailNotification: false,
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フォームの監視
   */
  const { watch, setValue, reset } = form;
  const targetType = watch("targetType");
  const sendTiming = watch("sendTiming");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ComboBox用のstate
   */
  const [userComboOpen, setUserComboOpen] = useState(false);
  const [groupComboOpen, setGroupComboOpen] = useState(false);
  const [taskComboOpen, setTaskComboOpen] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * targetTypeが変わったら関連するフィールドをリセット
   */
  useEffect(() => {
    setValue("userId", "");
    setValue("groupId", "");
    setValue("taskId", "");
  }, [targetType, setValue]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 送信タイミングのオプション
   */
  const sendTimingOptions: RadioOption[] = useMemo(
    () => [
      { value: "NOW", label: "即時送信" },
      { value: "SCHEDULED", label: "送信予約" },
    ],
    [],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 通知対象タイプのオプション（権限によってフィルタリング）
   */
  const targetTypeOptions: RadioOption[] = useMemo(() => {
    return isAppOwner
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
  }, [isAppOwner]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フォーム送信処理
   */
  const handleSubmit = useCallback(
    async (data: CreateNotificationFormData) => {
      try {
        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

        // 予約送信の場合に送信日が設定されていないとエラー
        if (data.sendTiming === "SCHEDULED" && !data.sendScheduledDate) {
          toast.error("送信予約の場合は日付を選択してください");
          return;
        }

        // アプリオーナーかグループオーナーでなければエラー
        if (!isAppOwner && !isGroupOwner) {
          toast.error("通知を作成する権限がありません");
          return;
        }

        // グループオーナーのみの場合、SYSTEMは作成不可
        if (!isAppOwner && data.targetType === "SYSTEM") {
          toast.error("この通知タイプを作成する権限がありません");
          return;
        }

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

        // 通知作成パラメータ
        const sendGeneralNotificationParams: GeneralNotificationParams = {
          title: data.title,
          message: data.message,
          targetType: data.targetType,
          sendMethods: [NotificationSendMethod.IN_APP],
          recipientUserIds: data.userId ? [data.userId] : null,
          groupId: data.groupId ?? null,
          taskId: data.taskId ?? null,
          auctionId: null,
          actionUrl: data.actionUrl ?? null,
          sendTiming: data.sendTiming,
          sendScheduledDate: data.sendScheduledDate ?? null,
          expiresAt: data.expiresAt ?? null,
          notificationId: null,
        };

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

        // プッシュ通知ONの場合は、WEB_PUSHを入れる
        if (data.sendPushNotification) {
          sendGeneralNotificationParams.sendMethods.push(NotificationSendMethod.WEB_PUSH);
        }

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

        // メール通知ONの場合は、EMAILを入れる
        if (data.sendEmailNotification) {
          sendGeneralNotificationParams.sendMethods.push(NotificationSendMethod.EMAIL);
        }

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

        console.log("data", data);
        console.log("data.sendPushNotification", data.sendPushNotification);
        console.log("data.sendEmailNotification", data.sendEmailNotification);
        console.log("sendGeneralNotificationParams", sendGeneralNotificationParams);

        // サーバーアクションを直接呼び出す代わりに、APIエンドポイントを使用
        const response = await fetch("/api/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(sendGeneralNotificationParams),
        });

        const result = (await response.json()) as { success: boolean; error?: string };

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

        // エラーがあればエラーメッセージを表示
        if (!result.success) {
          toast.error(result.error ?? "通知の作成に失敗しました");
          return;
        } else {
          // 送信タイミングがNOWの場合は、通知とプッシュ通知を作成したときのメッセージを表示
          if (data.sendTiming === "NOW") {
            // プッシュ通知とメール通知がONの場合
            if (data.sendPushNotification && data.sendEmailNotification) {
              toast.success("「アプリ内通知」と「プッシュ通知」と「メール通知」を作成しました");
              // プッシュ通知がONの場合
            } else if (data.sendPushNotification) {
              toast.success("「アプリ内通知」と「プッシュ通知」を作成しました");
              // メール通知がONの場合
            } else if (data.sendEmailNotification) {
              toast.success("「アプリ内通知」と「メール通知」を作成しました");
              // プッシュ通知とメール通知がOFFの場合
            } else {
              toast.success("「アプリ内通知」を作成しました");
            }
          } else if (data.sendTiming === "SCHEDULED") {
            toast.success("通知の予約送信を設定しました");
          }
        }

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

        // フォームをリセット
        reset();

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      } catch (error) {
        console.error("通知作成エラー:", error);
        toast.error("通知の作成中にエラーが発生しました");
      }
    },
    [isAppOwner, isGroupOwner, reset],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 通知作成フォーム用のカスタムフックの結果
   */
  return {
    // state
    form,
    targetType,
    sendTiming,
    userComboOpen,
    groupComboOpen,
    taskComboOpen,
    sendTimingOptions,
    targetTypeOptions,
    // action
    handleSubmit,
    setUserComboOpen,
    setGroupComboOpen,
    setTaskComboOpen,
  };
}
