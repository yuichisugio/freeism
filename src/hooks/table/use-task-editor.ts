import { useState } from "react";
import { type contributionType } from "@prisma/client";

export type TaskParticipant = {
  id: string;
  name: string;
};

/**
 * タスク編集機能のためのカスタムフック
 * @returns タスク編集関連の状態と処理
 */
export function useTaskEditor<T extends Record<string, unknown>>() {
  // 現在編集中のタスク
  const [editingTask, setEditingTask] = useState<T | null>(null);

  // 編集モーダルの状態
  const [editModalOpen, setEditModalOpen] = useState(false);

  /**
   * タスク編集処理
   * @param row - 編集対象のタスク行
   * @param canEdit - 編集可能かどうかを判定する関数
   */
  const handleEditTask = (row: T, canEdit: (row: T) => boolean) => {
    if (canEdit(row)) {
      setEditingTask(row);
      setEditModalOpen(true);
    }
  };

  /**
   * タスク編集用のデータを準備
   * @param task - 編集対象のタスク
   */
  const prepareTaskForEdit = (task: T) => {
    if (!task) return null;

    return {
      id: task.id as string,
      task: task.task as string,
      detail: task.detail as string | null,
      reference: task.reference as string | null,
      info: task.info as string | null,
      status: task.status as string,
      contributionType: task.contributionType as contributionType,
      reporters: (task.reporters ?? []) as TaskParticipant[],
      executors: (task.executors ?? []) as TaskParticipant[],
      imageUrl: task.imageUrl as string | null,
      group: {
        id: (task.group as { id: string; name: string })?.id ?? "",
        name: (task.group as { id: string; name: string })?.name ?? "",
      },
    };
  };

  /**
   * モーダルを閉じる処理
   */
  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditingTask(null);
  };

  return {
    editingTask,
    setEditingTask,
    editModalOpen,
    setEditModalOpen,
    handleEditTask,
    prepareTaskForEdit,
    closeEditModal,
  };
}
