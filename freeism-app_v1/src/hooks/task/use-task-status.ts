"use client";

import { useState } from "react";
import { updateTaskStatus } from "@/actions/task/task";
import { TaskStatus } from "@prisma/client";
import { useMutation } from "@tanstack/react-query";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクステータスの定義
 */
export const taskStatuses = [
  { label: "タスク実施前", value: TaskStatus.PENDING },
  { label: "オークション中", value: TaskStatus.AUCTION_ACTIVE },
  { label: "オークション終了", value: TaskStatus.AUCTION_ENDED },
  { label: "ポイント預け済み", value: TaskStatus.POINTS_DEPOSITED },
  { label: "供給側の提供完了", value: TaskStatus.SUPPLIER_DONE },
  { label: "タスク完了確認済み", value: TaskStatus.TASK_COMPLETED },
  { label: "固定評価者による評価完了", value: TaskStatus.FIXED_EVALUATED },
  { label: "ポイント付与完了", value: TaskStatus.POINTS_AWARDED },
  { label: "アーカイブ済み", value: TaskStatus.ARCHIVED },
  { label: "オークションキャンセル", value: TaskStatus.AUCTION_CANCELED },
];

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクステータス管理のためのカスタムフック
 * @param onDataChange - データが変更されたときに呼び出されるコールバック関数
 * @returns タスクステータス管理機能
 */
export function useTaskStatus<T extends Record<string, unknown>>(onDataChange?: (data: T[]) => void) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * state
   */
  // コンボボックスの開閉状態
  const [openStatus, setOpenStatus] = useState<string | null>(null);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクステータス変更処理
   */
  const { mutate: handleStatusChange, isPending: isTaskStatusChangeLoading } = useMutation({
    mutationFn: async (variables: { taskId: string; newStatus: TaskStatus; data: T[] }) => {
      return await updateTaskStatus(variables.taskId, variables.newStatus);
    },
    onSuccess: (result, variables) => {
      if (result.success && onDataChange) {
        onDataChange(
          variables.data.map((row) => (row.id === variables.taskId ? { ...row, status: variables.newStatus } : row)),
        );
      }
    },
    onSettled: () => {
      setOpenStatus(null);
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクステータス管理機能を返す
   */
  return {
    // state
    openStatus,
    isTaskStatusChangeLoading,

    // function
    setOpenStatus,
    handleStatusChange,

    // data
    taskStatuses,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
