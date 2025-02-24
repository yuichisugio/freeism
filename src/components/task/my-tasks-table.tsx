"use client";

import type { Column, DataTableProps } from "@/components/share/data-table";
import { useState } from "react";
import Link from "next/link";
import { DataTable } from "@/components/share/data-table";

type Task = {
  id: string;
  task: string;
  reference: string | null;
  status: string;
  contributionPoint: number | null;
  evaluator: string | null;
  evaluationLogic: string | null;
  contributionType: string;
  user: {
    name: string | null;
  };
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

  // かくぐの保有ポイントの合計を計算
  const totalContributionPoint = tasks.reduce((acc, task) => acc + (task.contributionPoint || 0), 0);

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
      key: "contributionPoint" as keyof Task,
      header: "Contribution Point",
      sortable: true,
      cell: (row: Task) => (row.contributionPoint ? `${row.contributionPoint}p` : "評価待ち"),
    },
    {
      key: "evaluator" as keyof Task,
      header: "算出者",
      sortable: true,
      cell: (row: Task) => row.evaluator || "-",
    },
    {
      key: "evaluationLogic" as keyof Task,
      header: "算出ロジック",
      sortable: true,
      cell: (row: Task) => row.evaluationLogic || "-",
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
