"use client";

import type { Column } from "@/components/share/data-table";
import { useMemo } from "react";
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
 * タスクの型
 */
type Task = {
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
    name: string | null;
  };
  reporters: TaskParticipant[];
  executors: TaskParticipant[];
  group: {
    name: string;
    id: string;
  };
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクテーブルの型
 */
type MyTasksTableProps = {
  tasks: Task[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクテーブル
 * @param tasks タスク
 * @returns タスクテーブル
 */
export function MyTasksTable({ tasks: initialTasks }: MyTasksTableProps): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // カスタムフックを使用してタスク管理機能を実装
  const { tasks, setTasks, getReporterNames, getExecutorNames, canEditTask, handleTaskEdited, getSimpleUsers } = useMyTasks<Task>(initialTasks);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const columns: Column<Task>[] = useMemo(
    () => [
      {
        key: "group" as keyof Task,
        header: "GROUP NAME",
        sortable: true,
        cell: (row: Task) => (
          <Link href={`/dashboard/group/${row.group.id}`} className="text-app hover:underline">
            {row.group.name}
          </Link>
        ),
      },
      {
        key: "task" as keyof Task,
        header: "TASK",
        sortable: true,
        cell: (row: Task) => row.task,
      },
      {
        key: "detail" as keyof Task,
        header: "DETAIL",
        sortable: true,
        cell: (row: Task) => row.detail,
      },
      {
        key: "reporters" as keyof Task,
        header: "報告者",
        sortable: false,
        cell: (row: Task) => getReporterNames(row.reporters),
      },
      {
        key: "executors" as keyof Task,
        header: "実行者",
        sortable: false,
        cell: (row: Task) => getExecutorNames(row.executors),
      },
      {
        key: "contributionPoint" as keyof Task,
        header: "Contribution Point",
        sortable: true,
        cell: (row: Task) => (row.fixedContributionPoint ? `${row.fixedContributionPoint}p` : "評価待ち"),
      },
      {
        key: "fixedEvaluator" as keyof Task,
        header: "算出者",
        sortable: true,
        cell: (row: Task) => row.fixedEvaluator ?? "-",
      },
      {
        key: "fixedEvaluationLogic" as keyof Task,
        header: "算出ロジック",
        sortable: true,
        cell: (row: Task) => row.fixedEvaluationLogic ?? "-",
      },
      {
        key: "status" as keyof Task,
        header: "ステータス",
        statusCombobox: true,
        sortable: true,
      },
      {
        key: "action" as keyof Task,
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
        data: tasks,
        columns,
        onDataChange: (data) => setTasks(data),
        editTask: {
          canEdit: canEditTask,
          onEdit: handleTaskEdited,
          users: getSimpleUsers(),
        },
      }}
    />
  );
}
