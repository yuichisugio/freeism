"use client";

import type { Column, DataTableProps } from "@/components/share/data-table";
import { useState } from "react";
import Link from "next/link";
import { DataTable } from "@/components/share/data-table";

// 報告者と実行者の型
type TaskParticipant = {
  id: string;
  name: string | null;
  userId: string | null;
  user: {
    name: string | null;
  } | null;
};

type Task = {
  id: string;
  task: string;
  reference: string | null;
  status: string;
  fixedContributionPoint: number | null;
  fixedEvaluator: string | null;
  fixedEvaluationLogic: string | null;
  contributionType: string;
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

type MyTasksTableProps = {
  tasks: Task[];
};

export function MyTasksTable({ tasks: initialTasks }: MyTasksTableProps) {
  const [tasks, setTasks] = useState(initialTasks);

  // 報告者名を連結する関数
  const getReporterNames = (reporters: TaskParticipant[]): string => {
    if (!reporters || reporters.length === 0) return "-";
    return reporters.map((r) => (r.user ? r.user.name : r.name) || "不明").join(", ");
  };

  // 実行者名を連結する関数
  const getExecutorNames = (executors: TaskParticipant[]): string => {
    if (!executors || executors.length === 0) return "-";
    return executors.map((e) => (e.user ? e.user.name : e.name) || "不明").join(", ");
  };

  const columns: Column<Task>[] = [
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
      cell: (row: Task) => row.fixedEvaluator || "-",
    },
    {
      key: "fixedEvaluationLogic" as keyof Task,
      header: "算出ロジック",
      sortable: true,
      cell: (row: Task) => row.fixedEvaluationLogic || "-",
    },
    {
      key: "status" as keyof Task,
      header: "ステータス",
      sortable: true,
      statusCombobox: true,
    },
  ];

  const dataTableProps: DataTableProps<Task> = {
    data: tasks,
    columns: columns,
    pagination: true,
    onDataChange: setTasks,
    stickyHeader: true,
  };

  return <DataTable dataTableProps={dataTableProps} />;
}
