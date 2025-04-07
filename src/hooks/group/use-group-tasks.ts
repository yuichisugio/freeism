"use client";

import type { Task, TaskParticipant, User } from "@/types/group";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteTask, getTasksByGroupId } from "@/lib/actions/task";
import { getAllUsers } from "@/lib/actions/user";
import { contributionType } from "@prisma/client";
import { toast } from "sonner";

type UseGroupTasksProps = {
  initialTasks: Task[];
  userId: string | null;
  isGroupOwner: boolean;
  isAppOwner: boolean;
};

export function useGroupTasks({ initialTasks, userId, isGroupOwner, isAppOwner }: UseGroupTasksProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [nonRewardTasks, setNonRewardTasks] = useState<Task[]>(initialTasks.filter((task) => task.contributionType === contributionType.NON_REWARD));
  const [rewardTasks, setRewardTasks] = useState<Task[]>(initialTasks.filter((task) => task.contributionType === contributionType.REWARD));
  const [users, setUsers] = useState<User[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // ユーザー一覧を取得
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

  // 報告者名を連結する関数
  const getReporterNames = (reporters: TaskParticipant[]): string => {
    return reporters.map((reporter: TaskParticipant) => reporter.user?.name ?? reporter.name ?? "不明").join(", ");
  };

  // 実行者名を連結する関数
  const getExecutorNames = (executors: TaskParticipant[]): string => {
    return executors.map((executor: TaskParticipant) => executor.user?.name ?? executor.name ?? "不明").join(", ");
  };

  // タスク削除ハンドラー
  const handleDeleteTask = async (taskId: string) => {
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
  };

  // データを更新するメソッド
  const updateNonRewardTasks = (data: Task[]) => {
    setNonRewardTasks(data);
  };

  // データを更新するメソッド
  const updateRewardTasks = (data: Task[]) => {
    setRewardTasks(data);
  };

  // タスク削除可能かどうかの判定
  const canDeleteTask = (task: Task): boolean => {
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
  };

  // タスク編集可能かどうかの判定
  const canEditTask = (task: Task): boolean => {
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
  };

  // タスク編集後の更新処理
  const handleTaskEdited = () => {
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
  };

  return {
    isLoading,
    nonRewardTasks,
    rewardTasks,
    setNonRewardTasks,
    setRewardTasks,
    updateNonRewardTasks,
    updateRewardTasks,
    users,
    isUploadModalOpen,
    setIsUploadModalOpen,
    isExportModalOpen,
    setIsExportModalOpen,
    getReporterNames,
    getExecutorNames,
    handleDeleteTask,
    canDeleteTask,
    canEditTask,
    handleTaskEdited,
  };
}
