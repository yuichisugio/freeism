"use client";

import { useCallback, useState } from "react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク参加者の型
 */
export type TaskParticipant = {
  id: string;
  name: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 編集用の汎用タスクインターフェース
 */
export type EditableTask = {
  id: string;
  [key: string]: unknown;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク編集機能のためのカスタムフック
 * @returns タスク編集関連の状態と処理
 */
export function useTaskEditor<T extends EditableTask>() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * state
   */
  // 現在編集中のタスク
  const [editingTask, setEditingTask] = useState<T | null>(null);

  // 編集モーダルの状態
  const [editModalOpen, setEditModalOpen] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク編集処理
   * @param row - 編集対象のタスク行
   * @param canEdit - 編集可能かどうかを判定する関数
   */
  const handleEditTask = useCallback((row: T, canEdit: (row: T) => boolean) => {
    if (canEdit(row)) {
      setEditingTask(row);
      setEditModalOpen(true);
    }
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク編集用のデータを準備
   * @param task - 編集対象のタスク
   * @returns 編集用に整形されたタスクデータ
   */
  const prepareTaskForEdit = useCallback((task: T): T => {
    // クローンを作成して返す
    return { ...task };
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    // state
    editingTask,
    editModalOpen,

    // function
    setEditModalOpen,
    handleEditTask,
    prepareTaskForEdit,
  };
}
