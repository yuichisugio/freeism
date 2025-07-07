"use client";

import type { UseFormReturn } from "react-hook-form";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createTask, prepareCreateTaskForm } from "@/actions/task/create-task-form";
import { queryCacheKeys } from "@/library-setting/tanstack-query";
import { taskFormSchema } from "@/library-setting/zod-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { ContributionType } from "@prisma/client";
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
  // オークション延長フラグを追加（文字列として定義）
  isExtension: z.string().optional(),
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
  form: UseFormReturn<TaskFormValues>;
  open: boolean;
  categoryOpen: boolean;
  executors: TaskParticipant[];
  nonRegisteredExecutor: string;
  reporters: TaskParticipant[];
  nonRegisteredReporter: string;
  isRewardType: boolean;
  isLoading: boolean;
  reporterComboboxOpen: boolean;
  selectedReporterId: string | undefined;
  executorsComboboxOpen: boolean;
  selectedExecutorId: string | undefined;

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
  setReporterComboboxOpen: (open: boolean) => void;
  handleReporterSelect: (userId: string) => void;
  setExecutorsComboboxOpen: (open: boolean) => void;
  handleExecutorSelect: (userId: string) => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * カスタムフック
 */
export function useTaskInputForm(): UseTaskInputFormReturn {
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
  const [executorsComboboxOpen, setExecutorsComboboxOpen] = useState(false);
  const [selectedExecutorId, setSelectedExecutorId] = useState<string | undefined>(undefined);
  const [reporterComboboxOpen, setReporterComboboxOpen] = useState(false);
  const [selectedReporterId, setSelectedReporterId] = useState<string | undefined>(undefined);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク作成フォームのデータを取得
   */
  const { data: queryData, isLoading: isLoadingFormData } = useQuery({
    queryKey: queryCacheKeys.tasks.prepareCreateTaskForm(),
    queryFn: () => prepareCreateTaskForm(),
    placeholderData: {
      success: true,
      message: "データを取得しました",
      data: { groups: [], users: [] },
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });

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
      contributionType: ContributionType.REWARD,
      category: "その他", // デフォルト値を設定
      executors: [],
      reporters: [],
      imageUrl: "",
      auctionStartTime: getDateWithoutTime(new Date()), // 時刻をリセット
      auctionEndTime: getDateWithoutTime(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 時刻をリセット
      deliveryMethod: "",
      isExtension: "false", // 文字列として設定
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 現在選択されている貢献タイプ
   */
  const selectedContributionType = form.watch("contributionType");
  const isRewardType = useMemo(() => selectedContributionType === ContributionType.REWARD, [selectedContributionType]);

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
        const user = queryData?.data?.users.find((u: User) => u.id === userId);
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
    [executors, form, queryData?.data?.users, setNonRegisteredExecutor],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 報告者を追加する関数
   * @param userId {string | undefined} ユーザーID
   * @param name {string | undefined} ユーザー名
   */
  const addReporter = useCallback(
    (userId?: string, name?: string) => {
      let newReportersList = [...reporters];
      let newParticipant: TaskParticipant | null = null;

      if (name && name.trim() !== "") {
        if (!reporters.some((r) => r.name === name.trim() && !r.userId)) {
          newParticipant = { name: name.trim() };
          setNonRegisteredReporter("");
        }
      } else if (userId) {
        const user = queryData?.data?.users.find((u: User) => u.id === userId);
        if (user && !reporters.some((r) => r.userId === userId)) {
          newParticipant = { userId, name: user.name };
        }
      }

      if (newParticipant) {
        newReportersList = [...newReportersList, newParticipant];
        setReporters(newReportersList);
        form.setValue("reporters", newReportersList);
      }
    },
    [reporters, form, queryData?.data?.users, setNonRegisteredReporter],
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
      try {
        // 時刻を00:00:00に設定
        const startTime =
          data.contributionType === ContributionType.REWARD && data.auctionStartTime
            ? getDateWithoutTime(data.auctionStartTime)
            : undefined;
        const endTime =
          data.contributionType === ContributionType.REWARD && data.auctionEndTime
            ? getDateWithoutTime(data.auctionEndTime)
            : undefined;

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
          deliveryMethod: data.contributionType === ContributionType.REWARD ? data.deliveryMethod : undefined,
          isExtension: data.isExtension, // 文字列として送信
        });

        if (result.success) {
          toast.success("タスクを保存しました");
          router.push(`/dashboard/group/${data.groupId}`);
          router.refresh();
        }
      } catch (error) {
        console.error("フォーム送信エラー:", error);
        toast.error("タスクの保存に失敗しました");
      }
    },
    [executors, reporters, router],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 報告者Comboboxでユーザーが選択されたときのハンドラ
   * @param userId 選択されたユーザーのID (空文字の場合は選択解除)
   */
  const handleReporterSelect = useCallback(
    (userId: string) => {
      if (!userId) {
        if (selectedReporterId) {
          const userExistsInReporters = reporters.find((r) => r.userId === selectedReporterId);
          if (userExistsInReporters) {
            const updatedReporters = reporters.filter((r) => r.userId !== selectedReporterId);
            setReporters(updatedReporters);
            form.setValue("reporters", updatedReporters);
          }
        }
        setSelectedReporterId(undefined);
        setReporterComboboxOpen(false);
        return;
      }

      const user = queryData?.data?.users.find((u: User) => u.id === userId);
      if (user) {
        const isAlreadyAdded = reporters.some((r) => r.userId === userId);
        if (!isAlreadyAdded) {
          const newParticipant: TaskParticipant = { userId, name: user.name };
          const newReportersList = [...reporters, newParticipant];
          setReporters(newReportersList);
          form.setValue("reporters", newReportersList);
        }
        setSelectedReporterId(userId);
        setReporterComboboxOpen(false);
      }
    },
    [queryData?.data?.users, reporters, form, selectedReporterId, setSelectedReporterId, setReporterComboboxOpen],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 実行者Comboboxでユーザーが選択されたときのハンドラ
   * @param userId 選択されたユーザーのID (空文字の場合は選択解除)
   */
  const handleExecutorSelect = useCallback(
    (userId: string) => {
      if (!userId) {
        if (selectedExecutorId) {
          const userExistsInExecutors = executors.find((r) => r.userId === selectedExecutorId);
          if (userExistsInExecutors) {
            const updatedExecutors = executors.filter((r) => r.userId !== selectedExecutorId);
            setExecutors(updatedExecutors);
            form.setValue("executors", updatedExecutors);
          }
        }
        setSelectedExecutorId(undefined);
        setExecutorsComboboxOpen(false);
        return;
      }

      const user = queryData?.data?.users.find((u: User) => u.id === userId);
      if (user) {
        const isAlreadyAdded = executors.some((r) => r.userId === userId);
        if (!isAlreadyAdded) {
          const newParticipant: TaskParticipant = { userId, name: user.name };
          const newExecutorsList = [...executors, newParticipant];
          setExecutors(newExecutorsList);
          form.setValue("executors", newExecutorsList);
        }
        setSelectedExecutorId(userId);
        setExecutorsComboboxOpen(false);
      }
    },
    [queryData?.data?.users, executors, form, selectedExecutorId, setSelectedExecutorId, setExecutorsComboboxOpen],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 戻り値
   */
  return {
    // state
    groups: queryData?.data?.groups ?? [],
    users: queryData?.data?.users ?? [],
    form,
    open,
    categoryOpen,
    executors,
    nonRegisteredExecutor,
    reporters,
    nonRegisteredReporter,
    isRewardType,
    isLoading: isLoadingFormData,
    reporterComboboxOpen,
    selectedReporterId,
    executorsComboboxOpen,
    selectedExecutorId,

    // function
    setOpen,
    setNonRegisteredReporter,
    setNonRegisteredExecutor,
    setCategoryOpen,
    addExecutor,
    removeExecutor,
    addReporter,
    removeReporter,
    handleImageUploaded,
    handleImageRemoved,
    onSubmit,
    setReporterComboboxOpen,
    handleReporterSelect,
    handleExecutorSelect,
    setExecutorsComboboxOpen,
  };
}
