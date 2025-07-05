"use client";

import { useCallback, useState } from "react";
import { updateTaskStatus } from "@/actions/task/task";
import { TaskStatus } from "@prisma/client";
import { toast } from "sonner";

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
   * @param taskId - タスクID
   * @param newStatus - 新しいステータス
   * @param data - 現在のテーブルデータ
   */
  const handleStatusChange = useCallback(
    async (taskId: string, newStatus: TaskStatus, data: T[]): Promise<void> => {
      try {
        const result = await updateTaskStatus(taskId, newStatus);

        if (result.success) {
          if (onDataChange) {
            // データが変更されたときにコールバックを呼び出す
            onDataChange(data.map((row) => (row.id === taskId ? { ...row, status: newStatus } : row)));
          }
          toast.success("ステータスを更新しました");
        } else if (!result.success && result.message) {
          toast.error(result.message);
        }
      } catch (error) {
        console.error(error);
        toast.error("ステータスの更新に失敗しました");
      } finally {
        setOpenStatus(null);
      }
    },
    [onDataChange],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクステータス管理機能を返す
   */
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
