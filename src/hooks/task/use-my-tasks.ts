"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkAppOwner } from "@/lib/actions/group";
import { getMyTasks } from "@/lib/actions/task";
import { getAllUsers } from "@/lib/actions/user";
import { fetchAuthenticatedUserId } from "@/lib/utils";
import { toast } from "react-hot-toast";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの型
 */
type BasicUser = {
  id: string;
  name: string | null;
  email: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 簡易ユーザーの型
 */
type SimpleUser = {
  id: string;
  name: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * マイタスク管理のためのカスタムフック
 * @param initialTasks - 初期タスクデータ
 * @returns タスク管理に必要な状態と関数
 */
export function useMyTasks<T extends Record<string, unknown>>(initialTasks: T[]) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * router
   */
  const router = useRouter();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * state
   */
  // タスクデータ
  const [tasks, setTasks] = useState<T[]>(initialTasks);

  // ユーザーデータ
  const [users, setUsers] = useState<BasicUser[]>([]);

  // ユーザーID
  const [userId, setUserId] = useState<string | null>(null);

  // アプリオーナーかどうか
  const [isAppOwner, setIsAppOwner] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザー一覧を取得
   */
  useEffect(() => {
    async function fetchUsers() {
      try {
        const allUsers = await getAllUsers();
        setUsers(allUsers as BasicUser[]);
      } catch (error) {
        console.error("ユーザー一覧取得エラー:", error);
      }
    }

    void fetchUsers();
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 権限情報を取得
   */
  useEffect(() => {
    async function checkPermissions() {
      try {
        const currentUserId = await fetchAuthenticatedUserId();
        if (currentUserId) {
          setUserId(currentUserId);
          const isOwner = await checkAppOwner(currentUserId);
          setIsAppOwner(isOwner);
        }
      } catch (error) {
        console.error("権限チェックエラー:", error);
      }
    }

    void checkPermissions();
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 報告者名を連結する関数
   */
  const getReporterNames = (reporters: { user?: { name: string | null } | null; name?: string | null }[]): string => {
    if (!reporters || reporters.length === 0) return "-";
    return reporters.map((r) => (r.user ? r.user.name : r.name) ?? "不明").join(", ");
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 実行者名を連結する関数
   */
  const getExecutorNames = (executors: { user?: { name: string | null } | null; name?: string | null }[]): string => {
    if (!executors || executors.length === 0) return "-";
    return executors.map((e) => (e.user ? e.user.name : e.name) ?? "不明").join(", ");
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク編集可能かどうかの判定
   */
  const canEditTask = (task: T): boolean => {
    // タスクのステータスを取得
    const status = task.status as string;

    // 変更不可のステータスチェック
    const immutableStatuses = ["FIXED_EVALUATED", "POINTS_AWARDED", "ARCHIVED"];
    if (immutableStatuses.includes(status)) {
      return false;
    }

    // 権限チェック - 報告者、実行者、アプリオーナーのみ編集可能
    if (!userId) return false;

    // 報告者チェック
    const reporters = task.reporters as { userId?: string }[] | undefined;
    const isReporter = reporters?.some((r) => r.userId === userId) ?? false;

    // 実行者チェック
    const executors = task.executors as { userId?: string }[] | undefined;
    const isExecutor = executors?.some((e) => e.userId === userId) ?? false;

    // アプリオーナーの場合は編集可能
    return isAppOwner || isReporter || isExecutor;
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク編集後の更新処理
   */
  const handleTaskEdited = () => {
    void (async () => {
      try {
        // タスクデータを再取得
        const updatedTasks = await getMyTasks();

        // 表示用のタスクデータを更新
        if (updatedTasks && Array.isArray(updatedTasks) && updatedTasks.length > 0) {
          // 型互換性エラーを避けるために明示的な型変換を行う
          setTasks(updatedTasks as unknown as T[]);
          toast.success("タスクデータを更新しました");
        }
      } catch (error) {
        console.error("タスクデータ更新エラー:", error);
      } finally {
        router.refresh(); // バックアップとしてのrefresh
      }
    })();
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 編集用のユーザー一覧を整形
   */
  const getSimpleUsers = (): SimpleUser[] => {
    return users.map((user) => ({
      id: user.id,
      name: user.name ?? "",
    }));
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    // state
    tasks,
    users,
    userId,
    isAppOwner,

    // function
    setTasks,
    getReporterNames,
    getExecutorNames,
    canEditTask,
    handleTaskEdited,
    getSimpleUsers,
  };
}
