"use client";

import type { Column, DataTableProps } from "@/components/share/data-table";
import { memo, useMemo } from "react";
import Link from "next/link";
import { DataTable } from "@/components/share/data-table";
import { useMyTaskTable } from "@/hooks/task/use-my-task-table";
import { type contributionType } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 報告者と実行者の型
 */
type TaskParticipant = {
  id: string;
  name: string | null;
  userId: string | null;
  user: {
    name: string | null;
  } | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * MyTasksTable用のタスク型
 */
export type MyTask = {
  id: string;
  action: string;
  task: string;
  detail: string | null;
  reference: string | null;
  status: string;
  fixedContributionPoint: number | null;
  fixedEvaluator: string | null;
  fixedEvaluationLogic: string | null;
  contributionType: contributionType;
  creator: {
    id: string;
    name: string | null;
  };
  reporters: TaskParticipant[];
  executors: TaskParticipant[];
  group: {
    id: string;
    name: string;
  };
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクテーブル
 * @param tasks タスク
 * @returns タスクテーブル
 */
export const MyTaskTable = memo(function MyTaskTable(): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // カスタムフックを使用してタスク管理機能を実装
  const { tasks, setTasks, getReporterNames, getExecutorNames, canEditTask, handleTaskEdited, getSimpleUsers } = useMyTaskTable<MyTask>();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const columns = useMemo<Column<MyTask>[]>(
    () => [
      {
        key: "group",
        header: "GROUP NAME",
        sortable: true,
        className: null,
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
      },
      {
        key: "task",
        header: "TASK",
        sortable: true,
        cell: (row) => row.task,
        className: null,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
      },
      {
        key: "detail",
        header: "DETAIL",
        sortable: true,
        cell: (row) => row.detail,
        className: null,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
      },
      {
        key: "reporters",
        header: "報告者",
        sortable: false,
        cell: (row) => getReporterNames(row.reporters),
        className: null,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
      },
      {
        key: "executors",
        header: "実行者",
        sortable: false,
        cell: (row) => getExecutorNames(row.executors),
        className: null,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
      },
      {
        key: "fixedContributionPoint",
        header: "Contribution Point",
        sortable: true,
        cell: (row) => {
          const typedRow = row;
          return typedRow.fixedContributionPoint ? `${typedRow.fixedContributionPoint}p` : "評価待ち";
        },
        className: null,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
      },
      {
        key: "fixedEvaluator",
        header: "算出者",
        sortable: true,
        cell: (row) => row.fixedEvaluator ?? "-",
        className: null,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
      },
      {
        key: "fixedEvaluationLogic",
        header: "算出ロジック",
        sortable: true,
        cell: (row) => row.fixedEvaluationLogic ?? "-",
        className: null,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
      },
      {
        key: "status",
        header: "ステータス",
        statusCombobox: true,
        cell: () => null,
        sortable: true,
        className: null,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
      },
      {
        key: "action",
        header: "アクション",
        cell: () => null,
        sortable: false,
        editTask: true,
        className: null,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        deleteTask: null,
      },
    ],
    [getReporterNames, getExecutorNames],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const dataTableProps: DataTableProps<MyTask> = {
    initialData: tasks,
    columns: columns,
    onDataChange: (changedData) => setTasks(changedData),
    editTask: {
      canEdit: (row) => canEditTask(row),
      onEdit: () => handleTaskEdited(),
      users: getSimpleUsers(),
    },
    className: null,
    maxHeight: null,
    rowClassName: null,
    headerClassName: null,
    cellClassName: null,
    stickyHeader: false,
    deleteModal: null,
    renderEditModal: () => null,
    pagination: true,
  };

  return <DataTable dataTableProps={dataTableProps} />;
});
