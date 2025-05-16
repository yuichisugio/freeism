"use client";

import type { Column, DataTableProps } from "@/types/group-types";
import { memo, useMemo } from "react";
import Link from "next/link";
import { ShareTable } from "@/components/share/share-table";
import { useMyTaskTable } from "@/hooks/task/use-my-task-table";
import { type MyTaskTable } from "@/types/group-types";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクテーブル
 * @param tasks タスク
 * @returns タスクテーブル
 */
export const MyTaskTableComponent = memo(function MyTaskTable(): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * カスタムフックを使用してタスク管理機能を実装
   */
  const { tasks, setTasks, canEditTask, handleTaskEdited, users } = useMyTaskTable();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクテーブルのカラム
   */
  const columns = useMemo<Column<MyTaskTable>[]>(
    () => [
      {
        key: "group",
        header: "GROUP NAME",
        sortable: true,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cell: (row) => {
          const typedRow = row;
          return (
            <Link href={`/dashboard/group/${typedRow.group.id}`} className="text-app hover:underline">
              {typedRow.group.name}
            </Link>
          );
        },
        cellClassName: null,
      },
      {
        key: "task",
        header: "TASK",
        sortable: true,
        cell: (row) => row.task,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "detail",
        header: "DETAIL",
        sortable: true,
        cell: (row) => row.detail,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "reporters",
        header: "報告者",
        sortable: false,
        cell: (row) => row.reporters.map((r) => r.name).join(", "),
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "executors",
        header: "実行者",
        sortable: false,
        cell: (row) => row.executors.map((e) => e.name).join(", "),
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "fixedContributionPoint",
        header: "Contribution Point",
        sortable: true,
        cell: (row) => {
          const typedRow = row;
          return typedRow.fixedContributionPoint ? `${typedRow.fixedContributionPoint}p` : "評価待ち";
        },
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: "text-center",
      },
      {
        key: "fixedEvaluator",
        header: "算出者",
        sortable: true,
        cell: (row) => row.fixedEvaluator ?? "-",
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "fixedEvaluationLogic",
        header: "算出ロジック",
        sortable: true,
        cell: (row) => row.fixedEvaluationLogic ?? "-",
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "status",
        header: "ステータス",
        statusCombobox: true,
        cell: () => null,
        sortable: true,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "action",
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
    ],
    [],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テーブルのプロパティ
   */
  const dataTableProps: DataTableProps<MyTaskTable> = {
    initialData: tasks,
    columns: columns,
    onDataChange: (changedData) => setTasks(changedData),
    editTask: {
      canEdit: (row) => canEditTask(row),
      onEdit: () => handleTaskEdited(),
      users: users,
      editingTaskId: null,
      isTaskEditModalOpen: false,
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      onCloseTaskEditModal: () => {},
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      onTaskEdited: () => {},
    },
    pagination: {
      totalRowCount: tasks.length,
      currentPage: 1,
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      onPageChange: () => {},
      itemPerPage: 10,
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      onItemPerPageChange: () => {},
    },
    sort: {
      onSortChange: (field: keyof MyTaskTable) => {
        console.log(field);
      },
      sortDirection: "desc",
      sortField: "id",
    },
    filter: null,
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクテーブルを表示
   */
  return <ShareTable dataTableProps={dataTableProps} />;
});
