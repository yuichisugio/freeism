"use client";

import type { Task, TaskParticipant, User } from "@/types/group-types";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteTask, getTasksByGroupId } from "@/lib/actions/task";
import { getAllUsers } from "@/lib/actions/user";
import { contributionType } from "@prisma/client";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループタスク用のカスタムフックの引数の型
 */
type UseGroupTasksProps = {
  initialTasks: Task[];
  userId: string | null;
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
  updateNonRewardTasks: (data: Task[]) => void;
  updateRewardTasks: (data: Task[]) => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループタスク用のカスタムフック
 * @param initialTasks {Task[]} 初期タスクデータ
 * @param userId {string | null} ユーザーID
 * @param isGroupOwner {boolean} グループオーナーかどうか
 * @param isAppOwner {boolean} アプリオーナーかどうか
 */
export function useGroupTasks({ initialTasks, userId, isGroupOwner, isAppOwner }: UseGroupTasksProps): UseGroupTasksReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ルーター
   */
  const router = useRouter();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * state
   */
  // ローディング中かどうか
  const [isLoading, setIsLoading] = useState(false);
  // 非報酬タスク
  const [nonRewardTasks, setNonRewardTasks] = useState<Task[]>(initialTasks.filter((task) => task.contributionType === contributionType.NON_REWARD));
  // 報酬タスク
  const [rewardTasks, setRewardTasks] = useState<Task[]>(initialTasks.filter((task) => task.contributionType === contributionType.REWARD));
  // ユーザー一覧
  const [users, setUsers] = useState<User[]>([]);
  // アップロードモーダー
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  // エクスポートモーダー
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザー一覧を取得
   */
  useEffect(() => {
    async function fetchUsers() {
      try {
        const allUsers = await getAllUsers();
        setUsers(allUsers);
      } catch (error) {
        console.error("ユーザー一覧取得エラー:", error);
      }
    }

    void fetchUsers();
  }, []);

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
   * タスク削除ハンドラー
   * @param taskId {string} タスクID
   */
  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      try {
        setIsLoading(true);
        const result = await deleteTask(taskId);

        if (result.success) {
          toast.success("タスクを削除しました");

          // タスクデータを更新
          if (initialTasks.length > 0) {
            const groupId = initialTasks[0].group.id;
            const updatedTasks = await getTasksByGroupId(groupId);

            // 表示用のタスクデータを更新
            if (updatedTasks && Array.isArray(updatedTasks) && updatedTasks.length > 0) {
              const newRewardTasks = updatedTasks.filter((task: Task) => task.contributionType === contributionType.REWARD);
              const newNonRewardTasks = updatedTasks.filter((task: Task) => task.contributionType === contributionType.NON_REWARD);

              setRewardTasks(newRewardTasks);
              setNonRewardTasks(newNonRewardTasks);
            }
          }

          router.refresh(); // UIを更新
        } else if (result.error) {
          toast.error(result.error);
        }
      } catch (error) {
        console.error("タスク削除エラー:", error);
        toast.error("タスクの削除中にエラーが発生しました");
      } finally {
        setIsLoading(false);
      }
    },
    [initialTasks, router],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 非報酬タスクを更新するメソッド
   * @param data {Task[]} タスクデータ
   */
  const updateNonRewardTasks = useCallback((data: Task[]) => {
    setNonRewardTasks(data);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 報酬タスクを更新するメソッド
   * @param data {Task[]} タスクデータ
   */
  const updateRewardTasks = useCallback((data: Task[]) => {
    setRewardTasks(data);
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
    setIsLoading(true);

    // 非同期処理を即時実行関数として実行
    void (async () => {
      try {
        // タスクデータを再取得
        if (initialTasks.length > 0) {
          const groupId = initialTasks[0].group.id;
          const updatedTasks = await getTasksByGroupId(groupId);

          // 表示用のタスクデータを更新
          if (updatedTasks && Array.isArray(updatedTasks) && updatedTasks.length > 0) {
            const newRewardTasks = updatedTasks.filter((task: Task) => task.contributionType === contributionType.REWARD);
            const newNonRewardTasks = updatedTasks.filter((task: Task) => task.contributionType === contributionType.NON_REWARD);

            setRewardTasks(newRewardTasks);
            setNonRewardTasks(newNonRewardTasks);

            toast.success("タスクデータを更新しました");
          }
        }
      } catch (error) {
        console.error("タスクデータ更新エラー:", error);
      } finally {
        router.refresh(); // バックアップとしてのrefresh
        setIsLoading(false);
      }
    })();
  }, [initialTasks, router]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    // state
    isLoading,
    nonRewardTasks,
    rewardTasks,
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
