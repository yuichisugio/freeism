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
  fixedContributionPoint: number | null;
  fixedEvaluator: string | null;
  fixedEvaluationLogic: string | null;
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
