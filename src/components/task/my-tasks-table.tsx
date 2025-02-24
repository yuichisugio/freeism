"use client";

import type { Column, DataTableProps } from "@/components/ui/data-table";
import { useState } from "react";
import { DataTable } from "@/components/ui/data-table";

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
      cell: (row: Task) => row.group.name,
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
