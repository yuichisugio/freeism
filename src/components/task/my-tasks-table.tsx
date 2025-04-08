"use client";

import type { BaseRecord, Column } from "@/components/share/data-table";
import { memo, useMemo } from "react";
import Link from "next/link";
import { DataTable } from "@/components/share/data-table";
import { useMyTasks } from "@/hooks/table/use-my-tasks";
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
type MyTask = {
  id: string;
  task: string;
  detail: string | null;
  reference: string | null;
  status: string;
  fixedContributionPoint: number | null;
  fixedEvaluator: string | null;
  fixedEvaluationLogic: string | null;
  contributionType: contributionType;
  // 作成者・報告者・実行者情報
  creator: {
    id: string;
    name: string | null;
    [key: string]: unknown;
  };
  reporters: TaskParticipant[];
  executors: TaskParticipant[];
  group: {
    id: string;
    name: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクテーブルの型
 */
type MyTasksTableProps = {
  tasks: MyTask[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクテーブル
 * @param tasks タスク
 * @returns タスクテーブル
 */
export const MyTasksTable = memo(function MyTasksTable({ tasks: initialTasks }: MyTasksTableProps): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // カスタムフックを使用してタスク管理機能を実装
  const { tasks, setTasks, getReporterNames, getExecutorNames, canEditTask, handleTaskEdited, getSimpleUsers } = useMyTasks<MyTask>(initialTasks);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const columns = useMemo<Column<BaseRecord>[]>(
    () => [
      {
        key: "group",
        header: "GROUP NAME",
        sortable: true,
        cell: (row) => {
          const typedRow = row as MyTask;
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
        cell: (row) => (row as MyTask).task,
      },
      {
        key: "detail",
        header: "DETAIL",
        sortable: true,
        cell: (row) => (row as MyTask).detail,
      },
      {
        key: "reporters",
        header: "報告者",
        sortable: false,
        cell: (row) => getReporterNames((row as MyTask).reporters),
      },
      {
        key: "executors",
        header: "実行者",
        sortable: false,
        cell: (row) => getExecutorNames((row as MyTask).executors),
      },
      {
        key: "contributionPoint",
        header: "Contribution Point",
        sortable: true,
        cell: (row) => {
          const typedRow = row as MyTask;
          return typedRow.fixedContributionPoint ? `${typedRow.fixedContributionPoint}p` : "評価待ち";
        },
      },
      {
        key: "fixedEvaluator",
        header: "算出者",
        sortable: true,
        cell: (row) => (row as MyTask).fixedEvaluator ?? "-",
      },
      {
        key: "fixedEvaluationLogic",
        header: "算出ロジック",
        sortable: true,
        cell: (row) => (row as MyTask).fixedEvaluationLogic ?? "-",
      },
      {
        key: "status",
        header: "ステータス",
        statusCombobox: true,
        sortable: true,
      },
      {
        key: "action",
        header: "アクション",
        editTask: true,
      },
    ],
    [getReporterNames, getExecutorNames],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <DataTable
      dataTableProps={{
        data: tasks as unknown as BaseRecord[],
        columns,
        onDataChange: (changedData) => setTasks(changedData as unknown as MyTask[]),
        editTask: {
          canEdit: (row) => canEditTask(row as MyTask),
          onEdit: () => handleTaskEdited(),
          users: getSimpleUsers(),
        },
      }}
    />
  );
});
