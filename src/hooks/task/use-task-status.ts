"use client";

import { useState } from "react";
import { updateTaskStatus } from "@/lib/actions/task/task";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクステータスの型
 */
export type TaskStatus = {
  label: string;
  value: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクステータスの定義
 */
export const taskStatuses: TaskStatus[] = [
  { label: "タスク実施予定", value: "PENDING" },
  { label: "落札済み", value: "BIDDED" },
  { label: "ポイント預け済み", value: "POINTS_DEPOSITED" },
  { label: "タスク完了", value: "TASK_COMPLETED" },
  { label: "固定評価者による評価完了", value: "FIXED_EVALUATED" },
  { label: "ポイント付与完了", value: "POINTS_AWARDED" },
  { label: "アーカイブ", value: "ARCHIVED" },
];

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクステータス管理のためのカスタムフック
 * @returns タスクステータス管理機能
 */
export function useTaskStatus<T extends Record<string, unknown>>(onDataChange?: (data: T[]) => void) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * state
   */
  // コンボボックスの開閉状態
  const [openStatus, setOpenStatus] = useState<string | null>(null);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクステータス変更処理
   * @param taskId - タスクID
   * @param newStatus - 新しいステータス
   * @param data - 現在のテーブルデータ
   */
  const handleStatusChange = async (taskId: string, newStatus: string, data: T[]) => {
    try {
      const result = await updateTaskStatus(taskId, newStatus);

      if (result.success) {
        if (onDataChange) {
          // データが変更されたときにコールバックを呼び出す
          onDataChange(data.map((row) => (row.id === taskId ? { ...row, status: newStatus } : row)));
        }
        toast.success("ステータスを更新しました");
      } else if (result.error) {
        toast.error(result.error);
      }

      setOpenStatus(null);
    } catch (error) {
      console.error(error);
      toast.error("ステータスの更新に失敗しました");
      setOpenStatus(null);
    }
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    // state
    openStatus,

    // function
    setOpenStatus,
    handleStatusChange,

    // data
    taskStatuses,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
