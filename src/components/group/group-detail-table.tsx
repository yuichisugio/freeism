"use client";

import type { Column, DataTableProps, Task, TaskParticipant, User } from "@/types/group-types";
import { memo, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ShareTable } from "@/components/share/share-table";
import { Button } from "@/components/ui/button";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ詳細ページのコンポーネントのprops
 * @param tasks {Task[]} タスクデータ
 */
type GroupDetailTableProps = {
  nonRewardTasks: Task[];
  rewardTasks: Task[];
  users: User[];
  getReporterNames: (reporters: TaskParticipant[]) => string;
  getExecutorNames: (executors: TaskParticipant[]) => string;
  canDeleteTask: (task: Task) => boolean;
  handleDeleteTask: (taskId: string) => Promise<void>;
  canEditTask: (task: Task) => boolean;
  handleTaskEdited: () => void;
  updateNonRewardTasks: (tasks: Task[]) => void;
  updateRewardTasks: (tasks: Task[]) => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ詳細ページのコンポーネント
 * @param tasks {Task[]} タスクデータ
 * @returns {JSX.Element} グループ詳細ページのコンポーネント
 */
export const GroupDetailTable = memo(function GroupDetailTable({
  nonRewardTasks,
  rewardTasks,
  users,
  getReporterNames,
  getExecutorNames,
  canDeleteTask,
  handleDeleteTask,
  canEditTask,
  handleTaskEdited,
  updateNonRewardTasks,
  updateRewardTasks,
}: GroupDetailTableProps): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ルーター
   */
  const router = useRouter();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 共通のテーブル列定義（contributionType列を含まない）
   */
  const commonColumns: Column<Task>[] = useMemo(
    () => [
      {
        key: "task" as keyof Task,
        header: "TASK",
        cell: (row: Task) => row.task ?? "不明",
        sortable: true,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "name" as keyof Task,
        header: "作成者",
        cell: (row: Task) => row.creator.name ?? "-",
        sortable: true,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "reporters" as keyof Task,
        header: "報告者",
        cell: (row: Task) => {
          if (typeof getReporterNames === "function") {
            return getReporterNames(row.reporters);
          }
          return "-";
        },
        sortable: false,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "executors" as keyof Task,
        header: "実行者",
        cell: (row: Task) => {
          if (typeof getExecutorNames === "function") {
            return getExecutorNames(row.executors);
          }
          return "-";
        },
        sortable: false,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "fixedEvaluator" as keyof Task,
        header: "評価者",
        cell: (row: Task) => row.fixedEvaluator ?? "-",
        sortable: true,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "fixedEvaluationLogic" as keyof Task,
        header: "評価ロジック",
        cell: (row: Task) => row.fixedEvaluationLogic ?? "-",
        sortable: true,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "status" as keyof Task,
        header: "ステータス",
        cell: () => null,
        statusCombobox: true,
        sortable: true,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "action" as keyof Task,
        header: "アクション",
        cell: () => null,
        sortable: false,
        statusCombobox: false,
        editTask: true,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "detail" as keyof Task,
        header: "詳細",
        cell: (row: Task) => row.detail ?? "-",
        sortable: false,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
    ],
    [getReporterNames, getExecutorNames],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 非報酬タスク用のカラム
   */
  const nonRewardColumns: Column<Task>[] = useMemo(
    () => [
      ...commonColumns.slice(0, 4), // task, name, reporters, executors 列をコピー
      {
        key: "contributionPoint" as keyof Task,
        header: "貢献ポイント",
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        cell: (row: Task) => (row.fixedContributionPoint ? `${row.fixedContributionPoint}p` : "評価待ち"),
        sortable: true,
        statusCombobox: false,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      ...commonColumns.slice(4, 7), // fixedEvaluator, fixedEvaluationLogic, status 列をコピー
      {
        key: "action" as keyof Task,
        cell: () => null,
        header: "アクション",
        sortable: false,
        statusCombobox: false,
        editTask: true,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "delete" as keyof Task,
        cell: () => null,
        header: "削除",
        sortable: false,
        statusCombobox: false,
        editTask: false,
        deleteTask: {
          canDelete: (row: Task) => canDeleteTask(row),
          onDelete: (rowId: string) => handleDeleteTask(rowId),
        },
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        cellClassName: null,
      },
      {
        key: "detail" as keyof Task,
        header: "詳細",
        cell: (row: Task) => row.detail ?? "-",
        sortable: false,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
    ],
    [canDeleteTask, handleDeleteTask, commonColumns],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 報酬タスク用のカラム
   */
  const rewardColumns: Column<Task>[] = useMemo(
    () => [
      {
        key: "auction" as keyof Task,
        header: "オークション",
        cell: (row: Task) => (
          <Button onClick={() => router.push(`/dashboard/auction/${row.id}`)} className="button-default-custom" size="sm">
            オークションに参加
          </Button>
        ),
        sortable: false,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      ...commonColumns.slice(0, 4), // task, name, reporters, executors 列をコピー
      {
        key: "contributionPoint" as keyof Task,
        header: "現在の入札額",
        cell: (row: Task) => `${row.fixedContributionPoint ?? 0}p`,
        sortable: true,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: "text-center",
      },
      ...commonColumns.slice(4, 7), // fixedEvaluator, fixedEvaluationLogic, status 列をコピー
      {
        key: "action" as keyof Task,
        header: "アクション",
        cell: () => null,
        sortable: false,
        editTask: true,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "delete" as keyof Task,
        header: "削除",
        cell: () => null,
        deleteTask: {
          canDelete: (row: Task) => canDeleteTask(row),
          onDelete: (rowId: string) => handleDeleteTask(rowId),
        },
        sortable: false,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        cellClassName: null,
      },
      {
        key: "detail" as keyof Task,
        header: "詳細",
        cell: (row: Task) => row.detail ?? "-",
        sortable: false,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
    ],
    [canDeleteTask, router, handleDeleteTask, commonColumns],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * DataTableコンポーネントのpropsを設定
   */
  const taskDataTableProps: DataTableProps<Task> = useMemo(
    () => ({
      initialData: nonRewardTasks,
      columns: nonRewardColumns,
      onDataChange: (data) => updateNonRewardTasks(data),
      editTask: {
        canEdit: (row) => canEditTask(row),
        onEdit: () => handleTaskEdited(),
        users: Array.isArray(users)
          ? users.map((user) => ({
              id: user.id,
              name: user.name ?? "",
            }))
          : [],
      },
      pagination: {
        totalRowCount: nonRewardTasks.length,
        currentPage: 1,
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        onPageChange: () => {},
        itemPerPage: 10,
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        onItemPerPageChange: () => {},
      },
      sort: {
        onSortChange: (field: keyof Task) => {
          console.log(field);
        },
        sortField: "id",
        sortDirection: "desc",
      },
      filter: null,
    }),
    [canEditTask, handleTaskEdited, updateNonRewardTasks, users, nonRewardColumns, nonRewardTasks],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 報酬タスク用のDataTableコンポーネントのpropsを設定
   */
  const rewardTaskDataTableProps: DataTableProps<Task> = useMemo(
    () => ({
      initialData: rewardTasks,
      columns: rewardColumns,
      onDataChange: (data) => updateRewardTasks(data),
      editTask: {
        canEdit: (row) => canEditTask(row),
        onEdit: () => handleTaskEdited(),
        users: Array.isArray(users)
          ? users.map((user) => ({
              id: user.id,
              name: user.name ?? "",
            }))
          : [],
      },
      pagination: {
        totalRowCount: rewardTasks.length,
        currentPage: 1,
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        onPageChange: () => {},
        itemPerPage: 10,
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        onItemPerPageChange: () => {},
      },
      sort: {
        sortField: "id",
        sortDirection: "desc",
        onSortChange: (field: keyof Task) => {
          console.log(field);
        },
      },
      filter: null,
    }),
    [canEditTask, handleTaskEdited, updateRewardTasks, users, rewardColumns, rewardTasks],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ詳細ページのコンポーネント
   */
  return (
    <>
      {/* タスク一覧 */}
      <div className="rounded-lg border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center">
          {/* <ClipboardList className="mr-2 h-5 w-5 text-gray-500" /> */}
          <h2 className="text-xl font-semibold text-gray-900">タスク一覧</h2>
        </div>
        <ShareTable dataTableProps={taskDataTableProps} />
      </div>

      {/* 報酬一覧（REWARDタイプのタスクのみ表示） */}
      <div className="mt-8 rounded-lg border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center">
          {/* <Award className="mr-2 h-5 w-5 text-gray-500" /> */}
          <h2 className="text-xl font-semibold text-gray-900">報酬一覧</h2>
        </div>
        <ShareTable dataTableProps={rewardTaskDataTableProps} />
      </div>
    </>
  );
});
