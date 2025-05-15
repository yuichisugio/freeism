"use client";

import type { Task, TaskParticipant, User } from "@/types/group-types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { redirect, useRouter } from "next/navigation";
import { deleteTask, getTasksByGroupId } from "@/lib/actions/task/task";
import { getAllUsers } from "@/lib/actions/user";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { contributionType } from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループタスク用のカスタムフックの引数の型
 */
type UseGroupTasksProps = {
  groupId: string;
  isGroupOwner: boolean;
  isAppOwner: boolean;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループタスク用のカスタムフックの戻り値の型
 */
type UseGroupTasksReturn = {
  // state
  isLoading: boolean;
  tasks: Task[];
  nonRewardTasks: Task[];
  rewardTasks: Task[];
  users: User[];
  isUploadModalOpen: boolean;
  isExportModalOpen: boolean;

  // action
  setIsUploadModalOpen: (open: boolean) => void;
  setIsExportModalOpen: (open: boolean) => void;
  getReporterNames: (reporters: TaskParticipant[]) => string;
  getExecutorNames: (executors: TaskParticipant[]) => string;
  handleDeleteTask: (taskId: string) => Promise<void>;
  canDeleteTask: (task: Task) => boolean;
  canEditTask: (task: Task) => boolean;
  handleTaskEdited: () => void;
  updateNonRewardTasks: (tasks: Task[]) => void;
  updateRewardTasks: (tasks: Task[]) => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループタスク用のカスタムフック
 * @param groupId {string} グループID
 * @param isGroupOwner {boolean} グループオーナーかどうか
 * @param isAppOwner {boolean} アプリオーナーかどうか
 */
export function useGroupTasks({ groupId, isGroupOwner, isAppOwner }: UseGroupTasksProps): UseGroupTasksReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ルーター
   */
  const router = useRouter();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * クエリクライアント
   */
  const queryClient = useQueryClient();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * state
   */
  // モーダーの表示状態
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  // データエクスポートモーダーの表示状態
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  // 内部管理用のタスクリスト
  const [internalNonRewardTasks, setInternalNonRewardTasks] = useState<Task[]>([]);
  const [internalRewardTasks, setInternalRewardTasks] = useState<Task[]>([]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * セッションのuserIdを取得
   */
  const { data: session } = useSession();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/auth/signin");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクデータの取得
   */
  const { data: tasksData, isLoading: isLoadingTasks } = useQuery({
    queryKey: queryCacheKeys.tasks.byGroupId(groupId),
    queryFn: async () => await getTasksByGroupId(groupId),
    enabled: !!groupId,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * tasksData が変更された場合に内部ステートを更新
   */
  useEffect(() => {
    const allTasks = tasksData ?? [];
    setInternalNonRewardTasks(allTasks.filter((task) => task.contributionType === contributionType.NON_REWARD));
    setInternalRewardTasks(allTasks.filter((task) => task.contributionType === contributionType.REWARD));
  }, [tasksData]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーデータの取得
   */
  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: queryCacheKeys.users.all(),
    queryFn: getAllUsers,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーデータの取得
   */
  const users = useMemo(() => usersData ?? [], [usersData]);

  const { mutateAsync: deleteTaskMutateAsync, isPending: isDeletingTask } = useMutation({
    mutationFn: deleteTask,
    onSuccess: async () => {
      toast.success("タスクを削除しました");
      // キャッシュを無効化してタスクリストを再取得
      await queryClient.invalidateQueries({
        queryKey: queryCacheKeys.tasks.byGroupId(groupId),
      });
      void router.refresh(); // 念のためUIを強制更新
    },
    onError: (error) => {
      console.error("タスク削除エラー:", error);
      toast.error("タスクの削除中にエラーが発生しました");
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク削除処理
   * @param taskId {string} タスクID
   */
  const handleDeleteTask = useCallback(
    async (taskId: string): Promise<void> => {
      try {
        await deleteTaskMutateAsync(taskId);
      } catch (error) {
        // エラー処理は mutation の onError で行われるため、ここでは再throwしないか、
        // もしくは特定のUIフィードバックをここで行う。
        // 今回は mutation 側の onError で toast 表示しているので、ここでは console.error のみ。
        console.error("handleDeleteTask でエラーハンドリング:", error);
      }
    },
    [deleteTaskMutateAsync],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 報告者名を連結する関数
   * @param reporters {TaskParticipant[]} 報告者データ
   * @returns {string} 報告者名
   */
  const getReporterNames = useCallback((reporters: TaskParticipant[]): string => {
    return reporters.map((reporter: TaskParticipant) => reporter.user?.name ?? reporter.name ?? "不明").join(", ");
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 実行者名を連結する関数
   * @param executors {TaskParticipant[]} 実行者データ
   * @returns {string} 実行者名
   */
  const getExecutorNames = useCallback((executors: TaskParticipant[]): string => {
    return executors.map((executor: TaskParticipant) => executor.user?.name ?? executor.name ?? "不明").join(", ");
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク削除可能かどうかの判定
   * @param task {Task} タスクデータ
   * @returns {boolean} 削除可能かどうか
   */
  const canDeleteTask = useCallback(
    (task: Task): boolean => {
      // 権限チェック - 報告者、実行者、グループオーナーのみ削除可能
      if (!userId) return false;

      // 報告者チェック
      const isReporter = task.reporters.some((r: TaskParticipant) => r.userId === userId);

      // 実行者チェック
      const isExecutor = task.executors.some((e: TaskParticipant) => e.userId === userId);

      // ステータスチェック
      if (task.contributionType === contributionType.REWARD) {
        // 報酬タスクは、AuctionがPENDINGの場合のみ削除可能
        // 注: ここではAuction情報を持っていないため、ステータスでPENDINGかどうかを判断
        return (isGroupOwner || isReporter || isExecutor) && task.status === "PENDING";
      } else {
        // 非報酬タスクは、TaskStatusがPENDINGの場合のみ削除可能
        return (isGroupOwner || isReporter || isExecutor) && task.status === "PENDING";
      }
    },
    [isGroupOwner, userId],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク編集可能かどうかの判定
   * @param task {Task} タスクデータ
   * @returns {boolean} 編集可能かどうか
   */
  const canEditTask = useCallback(
    (task: Task): boolean => {
      // 変更不可のステータスチェック
      const immutableStatuses = ["FIXED_EVALUATED", "POINTS_AWARDED", "ARCHIVED"];
      if (immutableStatuses.includes(task.status)) {
        return false;
      }

      // 権限チェック - 報告者、実行者、アプリオーナー、グループオーナーのみ編集可能
      if (!userId) return false;

      // 報告者チェック
      const isReporter = task.reporters.some((r: TaskParticipant) => r.userId === userId);

      // 実行者チェック
      const isExecutor = task.executors.some((e: TaskParticipant) => e.userId === userId);

      // アプリオーナーまたはグループオーナーの場合は編集可能
      return isAppOwner || isGroupOwner || isReporter || isExecutor;
    },
    [isAppOwner, isGroupOwner, userId],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク編集後の更新処理
   */
  const handleTaskEdited = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryCacheKeys.tasks.byGroupId(groupId) });
    toast.success("タスクデータを更新しました");
    void router.refresh();
  }, [groupId, router, queryClient]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 非報酬タスクリストを更新する関数
   * @param updatedTasks {Task[]} 更新された非報酬タスクリスト
   */
  const updateNonRewardTasks = useCallback((updatedTasks: Task[]) => {
    setInternalNonRewardTasks(updatedTasks);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 報酬タスクリストを更新する関数
   * @param updatedTasks {Task[]} 更新された報酬タスクリスト
   */
  const updateRewardTasks = useCallback((updatedTasks: Task[]) => {
    setInternalRewardTasks(updatedTasks);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループタスク用のカスタムフックの戻り値
   */
  return {
    // state
    isLoading: isLoadingTasks || isLoadingUsers || isDeletingTask,
    tasks: tasksData ?? [],
    nonRewardTasks: internalNonRewardTasks,
    rewardTasks: internalRewardTasks,
    users,
    isUploadModalOpen,
    isExportModalOpen,

    // action
    setIsUploadModalOpen,
    setIsExportModalOpen,
    getReporterNames,
    getExecutorNames,
    handleDeleteTask,
    canDeleteTask,
    canEditTask,
    handleTaskEdited,
    updateNonRewardTasks,
    updateRewardTasks,
  };
}
