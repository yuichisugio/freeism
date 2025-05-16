"use client";

import type { Column, DataTableProps } from "@/types/group-types";
import { memo, useMemo } from "react";
import Link from "next/link";
import { ShareTable } from "@/components/share/share-table";
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
        cell: (row) => getReporterNames(row.reporters),
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
        cell: (row) => getExecutorNames(row.executors),
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
      onSortChange: (field: keyof MyTask) => {
        console.log(field);
      },
      sortDirection: "desc",
      sortField: "id",
    },
    filter: null,
  };

  return <ShareTable dataTableProps={dataTableProps} />;
});
