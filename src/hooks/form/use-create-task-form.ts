"use client";

import type { UseFormReturn } from "react-hook-form";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { prepareCreateTaskForm } from "@/lib/actions/task/create-task-form";
import { createTask } from "@/lib/actions/task/task";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { taskFormSchema } from "@/lib/zod-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { contributionType } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 型定義
 */
export type Group = {
  id: string;
  name: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザー型定義
 */
export type User = {
  id: string;
  name: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク実行者または報告者の型定義
 */
export type TaskParticipant = {
  userId?: string;
  name?: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * フォームスキーマの拡張
 */
const formSchema = taskFormSchema.extend({
  groupId: z.string({
    required_error: "グループに参加して下さい。",
  }),
  // カテゴリを追加
  category: z.string().optional(),
  // 実行者の配列（オプション）
  executors: z
    .array(
      z.object({
        userId: z.string().optional(),
        name: z.string().optional(),
      }),
    )
    .optional(),
  // 報告者の配列（オプション）
  reporters: z
    .array(
      z.object({
        userId: z.string().optional(),
        name: z.string().optional(),
      }),
    )
    .optional(),
  // 画像URL
  imageUrl: z.string().optional(),
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * フォーム値の型定義
 */
export type TaskFormValues = z.infer<typeof formSchema>;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// Helper function to get date with time set to 00:00:00
function getDateWithoutTime(date: Date): Date {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * フォーム値とグループIDの型定義
 */
export type TaskFormValuesAndGroupId = TaskFormValues & {
  groupId: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * カスタムフックの戻り値の型定義
 */
type UseTaskInputFormReturn = {
  // state
  groups: { id: string; name: string }[];
  users: { id: string; name: string }[];
  groupComboBoxFlag: boolean;
  form: UseFormReturn<TaskFormValues>;
  open: boolean;
  categoryOpen: boolean;
  executors: TaskParticipant[];
  nonRegisteredExecutor: string;
  reporters: TaskParticipant[];
  nonRegisteredReporter: string;
  isRewardType: boolean;
  isLoading: boolean;

  // function
  setOpen: (open: boolean) => void;
  setCategoryOpen: (open: boolean) => void;
  setNonRegisteredExecutor: (value: string) => void;
  setNonRegisteredReporter: (value: string) => void;
  addExecutor: (userId?: string, name?: string) => void;
  removeExecutor: (index: number) => void;
  addReporter: (userId?: string, name?: string) => void;
  removeReporter: (index: number) => void;
  handleImageUploaded: (imageUrl: string) => void;
  handleImageRemoved: () => void;
  onSubmit: (data: TaskFormValues) => Promise<void>;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * カスタムフック
 */
export function useTaskInputForm(groupId: string | null): UseTaskInputFormReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ルーター
   */
  const router = useRouter();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * state管理
   */
  const [open, setOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [executors, setExecutors] = useState<TaskParticipant[]>([]);
  const [nonRegisteredExecutor, setNonRegisteredExecutor] = useState("");
  const [reporters, setReporters] = useState<TaskParticipant[]>([]);
  const [nonRegisteredReporter, setNonRegisteredReporter] = useState("");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク作成フォームのデータを取得
   */
  const { data: formData, isLoading: isLoadingFormData } = useQuery({
    queryKey: queryCacheKeys.tasks.prepareCreateTaskForm(groupId),
    queryFn: () => prepareCreateTaskForm(groupId),
    enabled: true,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });

  // useQueryから取得したデータがない場合のデフォルト値
  const { groups = [], users = [], groupComboBoxFlag = false } = formData ?? {};

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フォーム
   */
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      task: "",
      detail: "",
      reference: "",
      info: "",
      contributionType: contributionType.REWARD,
      category: "その他", // デフォルト値を設定
      executors: [],
      reporters: [],
      imageUrl: "",
      auctionStartTime: getDateWithoutTime(new Date()), // 時刻をリセット
      auctionEndTime: getDateWithoutTime(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 時刻をリセット
      deliveryMethod: "",
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 現在選択されている貢献タイプ
   */
  const selectedContributionType = form.watch("contributionType");
  const isRewardType = useMemo(() => selectedContributionType === contributionType.REWARD, [selectedContributionType]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 実行者を追加する関数
   * @param userId {string | undefined} ユーザーID
   * @param name {string | undefined} ユーザー名
   */
  const addExecutor = useCallback(
    (userId?: string, name?: string) => {
      if (userId) {
        // 登録済みユーザーの場合
        const user = users.find((u: User) => u.id === userId);
        if (user && !executors.some((e) => e.userId === userId)) {
          const newExecutors = [...executors, { userId, name: user.name }];
          setExecutors(newExecutors);
          form.setValue("executors", newExecutors);
        }
      } else if (name && name.trim() !== "") {
        // 未登録ユーザーの場合
        const newExecutors = [...executors, { name }];
        setExecutors(newExecutors);
        form.setValue("executors", newExecutors);
        setNonRegisteredExecutor("");
      }
    },
    [executors, form, users, setNonRegisteredExecutor],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 報告者を追加する関数
   * @param userId {string | undefined} ユーザーID
   * @param name {string | undefined} ユーザー名
   */
  const addReporter = useCallback(
    (userId?: string, name?: string) => {
      if (userId) {
        // 登録済みユーザーの場合
        const user = users.find((u: User) => u.id === userId);
        if (user && !reporters.some((r) => r.userId === userId)) {
          const newReporters = [...reporters, { userId, name: user.name }];
          setReporters(newReporters);
          form.setValue("reporters", newReporters);
        }
      } else if (name && name.trim() !== "") {
        // 未登録ユーザーの場合
        const newReporters = [...reporters, { name }];
        setReporters(newReporters);
        form.setValue("reporters", newReporters);
        setNonRegisteredReporter("");
      }
    },
    [reporters, form, users, setNonRegisteredReporter],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 実行者を削除する関数
   * @param index {number} インデックス
   */
  const removeExecutor = useCallback(
    (index: number) => {
      const newExecutors = executors.filter((_, i) => i !== index);
      setExecutors(newExecutors);
      form.setValue("executors", newExecutors);
    },
    [executors, form],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 報告者を削除する関数
   * @param index {number} インデックス
   */
  const removeReporter = useCallback(
    (index: number) => {
      const newReporters = reporters.filter((_, i) => i !== index);
      setReporters(newReporters);
      form.setValue("reporters", newReporters);
    },
    [reporters, form],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 画像アップロード完了時のハンドラー
   * @param imageUrl {string} 画像URL
   */
  const handleImageUploaded = useCallback(
    (imageUrl: string) => {
      form.setValue("imageUrl", imageUrl);
    },
    [form],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 画像削除時のハンドラー
   */
  const handleImageRemoved = useCallback(() => {
    form.setValue("imageUrl", "");
  }, [form]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フォーム送信
   * @param data {TaskFormValues} フォームデータ
   */
  const onSubmit = useCallback(
    async (data: TaskFormValues) => {
      console.log("フォーム送信データ:", data);

      try {
        // 時刻を00:00:00に設定
        const startTime =
          data.contributionType === contributionType.REWARD && data.auctionStartTime ? getDateWithoutTime(data.auctionStartTime) : undefined;
        const endTime =
          data.contributionType === contributionType.REWARD && data.auctionEndTime ? getDateWithoutTime(data.auctionEndTime) : undefined;

        // タスクを保存
        const result = await createTask({
          task: data.task,
          detail: data.detail,
          reference: data.reference,
          info: data.info,
          imageUrl: data.imageUrl,
          contributionType: data.contributionType,
          category: data.category, // カテゴリを追加
          groupId: data.groupId,
          executors: executors.length > 0 ? executors : undefined,
          reporters: reporters.length > 0 ? reporters : undefined,
          // 修正した日時を使用
          auctionStartTime: startTime,
          auctionEndTime: endTime,
          deliveryMethod: data.contributionType === contributionType.REWARD ? data.deliveryMethod : undefined,
        });

        if (result.success) {
          toast.success("タスクを保存しました");
          router.push(result.task.groupId ? `/dashboard/group/${result.task.groupId}` : "/dashboard/my-tasks");
          router.refresh();
        } else if (result.error) {
          toast.error(result.error);
        }
      } catch (error) {
        console.error("フォーム送信エラー:", error);
        toast.error("タスクの保存に失敗しました");
      }
    },
    [executors, reporters, router],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    // state
    groups,
    users,
    groupComboBoxFlag,
    form,
    open,
    setOpen,
    categoryOpen,
    setCategoryOpen,
    executors,
    nonRegisteredExecutor,
    setNonRegisteredExecutor,
    reporters,
    nonRegisteredReporter,
    setNonRegisteredReporter,
    isRewardType,
    isLoading: isLoadingFormData,

    // function
    addExecutor,
    removeExecutor,
    addReporter,
    removeReporter,
    handleImageUploaded,
    handleImageRemoved,
    onSubmit,
  };
}
