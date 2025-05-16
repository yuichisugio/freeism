"use client";

import type { TaskParticipant } from "@/types/group-types";
import type { UseFormReturn } from "react-hook-form";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getTaskById, updateTaskAction } from "@/lib/actions/task/edit-task-modal";
import { getAllUsers } from "@/lib/actions/user";
import { taskFormSchema } from "@/lib/zod-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { contributionType } from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク編集モーダーのカスタムフック
 */

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * User型
 */
export type User = {
  id: string;
  name: string | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// フォームスキーマ
const formSchema = taskFormSchema.extend({
  category: z.string().optional(),
  executors: z
    .array(
      z.object({
        userId: z.string().optional(),
        name: z.string().optional(),
      }),
    )
    .optional(),
  reporters: z
    .array(
      z.object({
        userId: z.string().optional(),
        name: z.string().optional(),
      }),
    )
    .optional(),
  imageUrl: z.string().optional(),
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * TaskFormValues型
 */
export type TaskFormValues = z.infer<typeof formSchema>;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * UseTaskEditModalProps型
 */
export type UseTaskEditModalProps = {
  taskId: string;
  onOpenChangeAction: (open: boolean) => void;
  onTaskUpdated?: () => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * useTaskEditModal関数の戻り値
 */
export type UseTaskEditModalReturn = {
  // state
  form: UseFormReturn<TaskFormValues>;
  isSubmitting: boolean;
  isRewardType: boolean;
  categoryOpen: boolean;
  executors: TaskParticipant[];
  nonRegisteredExecutor: string;
  reporters: TaskParticipant[];
  nonRegisteredReporter: string;
  users: User[];
  isLoadingUsers: boolean;
  isLoadingTask: boolean;

  // function
  setCategoryOpen: (open: boolean) => void;
  setNonRegisteredExecutor: (value: string) => void;
  setNonRegisteredReporter: (value: string) => void;
  handleOpenChange: (isOpen: boolean) => void;
  addExecutor: (userId?: string, name?: string) => void;
  removeExecutor: (index: number) => void;
  addReporter: (userId?: string, name?: string) => void;
  removeReporter: (index: number) => void;
  handleImageUploaded: (imageUrl: string) => void;
  handleImageRemoved: () => void;
  handleUpdate: () => Promise<void>;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * useTaskEditModal関数
 */
export function useTaskEditModal({ taskId, onOpenChangeAction, onTaskUpdated }: UseTaskEditModalProps): UseTaskEditModalReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ルーター
   */
  const router = useRouter();
  const queryClient = useQueryClient();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * state
   */
  // カテゴリオープンフラグ
  const [categoryOpen, setCategoryOpen] = useState(false);
  // 実行者
  const [executors, setExecutors] = useState<TaskParticipant[]>([]);
  // 未登録実行者
  const [nonRegisteredExecutor, setNonRegisteredExecutor] = useState("");
  // 報告者
  const [reporters, setReporters] = useState<TaskParticipant[]>([]);
  // 未登録報告者
  const [nonRegisteredReporter, setNonRegisteredReporter] = useState("");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データ取得
   */
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: getAllUsers,
    select: (data) => data ?? [],
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクデータ取得
   */
  const { data: task, isLoading: isLoadingTask } = useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => {
      if (!taskId) return null;
      const result = await getTaskById(taskId);
      if (result.error) {
        toast.error(result.error);
        return null;
      }
      return result.success ? result.task : null;
    },
    enabled: !!taskId,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フォーム初期化
   */
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      task: "",
      detail: "",
      reference: "",
      info: "",
      contributionType: contributionType.REWARD,
      category: "その他",
      executors: [],
      reporters: [],
      imageUrl: "",
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 現在選択されている貢献タイプを監視
   */
  const selectedContributionType = useMemo(() => form.watch("contributionType"), [form]);
  const isRewardType = useMemo(() => selectedContributionType === contributionType.REWARD, [selectedContributionType]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクデータが変更されたときにフォームをリセット
   */
  useEffect(() => {
    if (task) {
      const taskName = typeof task.task === "string" ? task.task : "";
      const taskDetail = typeof task.detail === "string" ? task.detail : "";
      const taskReference = typeof task.reference === "string" ? task.reference : "";
      const taskInfo = typeof task.info === "string" ? task.info : "";
      const taskImageUrl = typeof task.imageUrl === "string" ? task.imageUrl : "";
      const taskContributionType = task.contributionType;
      const taskCategory = typeof task.category === "string" ? task.category : "その他";

      form.reset({
        task: taskName,
        detail: taskDetail,
        reference: taskReference,
        info: taskInfo,
        imageUrl: taskImageUrl,
        contributionType: taskContributionType,
        category: taskCategory,
      });

      // 実行者と報告者をセット
      if (Array.isArray(task.executors)) {
        setExecutors(
          task.executors.map((executor: Partial<TaskParticipant>) => ({
            id: typeof executor?.id === "string" ? executor.id : `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            userId: typeof executor?.userId === "string" ? executor.userId : null,
            name: typeof executor?.name === "string" ? executor.name : null,
            user: executor?.user ?? null,
          })),
        );
      }
      if (Array.isArray(task.reporters)) {
        setReporters(
          task.reporters.map((reporter: Partial<TaskParticipant>) => ({
            id: typeof reporter?.id === "string" ? reporter.id : `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            userId: typeof reporter?.userId === "string" ? reporter.userId : null,
            name: typeof reporter?.name === "string" ? reporter.name : null,
            user: reporter?.user ?? null,
          })),
        );
      }
    }
  }, [task, form]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 実行者を追加する関数
   * @param userId {string} ユーザーID
   * @param name {string} ユーザー名
   */
  const addExecutor = useCallback(
    (userId?: string, name?: string) => {
      if (userId) {
        // 登録済みユーザーの場合
        const user = users?.find((u) => u.id === userId);
        if (user && !executors.some((e) => e.userId === userId)) {
          const newExecutor: TaskParticipant = {
            id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            userId,
            name: user.name,
            user: {
              id: userId,
              name: user.name,
            },
          };
          setExecutors((prev) => [...prev, newExecutor]);
        }
      } else if (name && name.trim() !== "") {
        // 未登録ユーザーの場合
        const newExecutor: TaskParticipant = {
          id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          userId: null,
          name,
          user: null,
        };
        setExecutors((prev) => [...prev, newExecutor]);
        setNonRegisteredExecutor("");
      }
    },
    [executors, users],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 報告者を追加する関数
   * @param userId {string} ユーザーID
   * @param name {string} ユーザー名
   */
  const addReporter = useCallback(
    (userId?: string, name?: string) => {
      if (userId) {
        // 登録済みユーザーの場合
        const user = users?.find((u) => u.id === userId);
        if (user && !reporters.some((r) => r.userId === userId)) {
          const newReporter: TaskParticipant = {
            id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            userId,
            name: user.name,
            user: {
              id: userId,
              name: user.name,
            },
          };
          setReporters((prev) => [...prev, newReporter]);
        }
      } else if (name && name.trim() !== "") {
        // 未登録ユーザーの場合
        const newReporter: TaskParticipant = {
          id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          userId: null,
          name,
          user: null,
        };
        setReporters((prev) => [...prev, newReporter]);
        setNonRegisteredReporter("");
      }
    },
    [reporters, users],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 実行者を削除する関数
   * @param index {number} 削除する実行者のインデックス
   */
  const removeExecutor = useCallback(
    (index: number) => {
      const newExecutors = executors.filter((_, i) => i !== index);
      setExecutors(newExecutors);
    },
    [executors],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 報告者を削除する関数
   * @param index {number} 削除する報告者のインデックス
   */
  const removeReporter = useCallback(
    (index: number) => {
      const newReporters = reporters.filter((_, i) => i !== index);
      setReporters(newReporters);
    },
    [reporters],
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
   * 更新ミューテーション
   */
  const { mutate, isPending } = useMutation({
    mutationFn: (
      data: Omit<TaskFormValues, "groupId"> & {
        executors: Array<{ userId?: string; name?: string }>;
        reporters: Array<{ userId?: string; name?: string }>;
      },
    ) => {
      if (!taskId) {
        throw new Error("Task ID is not defined");
      }
      return updateTaskAction(taskId, data);
    },
    onSuccess: async () => {
      toast.success("タスクが更新されました");
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      onOpenChangeAction(false);
      if (onTaskUpdated) {
        onTaskUpdated();
      }
      router.refresh();
    },
    onError: (error) => {
      console.error("タスク更新エラー:", error);
      toast.error("タスクの更新に失敗しました");
    },
  });

  /**
   * 更新を実行する関数
   */
  const handleUpdate = useCallback(async () => {
    // フォームから直接データを取得
    const formData = form.getValues();

    // executorsとreportersを適切な形式に変換
    const formattedExecutors = executors.map((executor) => {
      return {
        userId: executor.userId ?? undefined,
        name: executor.name ?? undefined,
      };
    });

    const formattedReporters = reporters.map((reporter) => {
      return {
        userId: reporter.userId ?? undefined,
        name: reporter.name ?? undefined,
      };
    });

    mutate({
      ...formData,
      executors: formattedExecutors,
      reporters: formattedReporters,
    });
  }, [executors, reporters, form, mutate]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * モーダルの開閉ハンドラー
   */
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isPending) {
        onOpenChangeAction(isOpen);
      }
    },
    [isPending, onOpenChangeAction],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 戻り値
   */
  return {
    // state
    form,
    isSubmitting: isPending,
    isRewardType,
    categoryOpen,
    executors,
    nonRegisteredExecutor,
    reporters,
    nonRegisteredReporter,
    users: users ?? [],
    isLoadingUsers,
    isLoadingTask,

    // function
    setCategoryOpen,
    setNonRegisteredExecutor,
    setNonRegisteredReporter,
    handleOpenChange,
    addExecutor,
    removeExecutor,
    addReporter,
    removeReporter,
    handleImageUploaded,
    handleImageRemoved,
    handleUpdate,
  };
}
