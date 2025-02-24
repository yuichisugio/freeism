"use client";

import type { DataTableProps } from "@/components/ui/data-table";
import type { Column } from "@/components/ui/data-table";
import { useState } from "react";
import { updateTaskStatus } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { DataTable } from "@/components/ui/data-table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";

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

type TaskStatus = {
  label: string;
  value: string;
};

const taskStatuses: TaskStatus[] = [
  { label: "タスク実施予定", value: "PENDING" },
  { label: "落札済み", value: "BIDDED" },
  { label: "ポイント預け済み", value: "POINTS_DEPOSITED" },
  { label: "タスク完了", value: "TASK_COMPLETED" },
  { label: "Group内レビュー完了", value: "GROUP_REVIEW_COMPLETED" },
  { label: "Group外レビュー完了", value: "EXTERNAL_REVIEW_COMPLETED" },
  { label: "ポイント付与完了", value: "POINTS_AWARDED" },
  { label: "アーカイブ", value: "ARCHIVED" },
];

export function MyTasksTable({ tasks: initialTasks }: MyTasksTableProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [openStatus, setOpenStatus] = useState<string | null>(null);

  // ステータス変更処理
  async function handleStatusChange(taskId: string, newStatus: string) {
    try {
      const result = await updateTaskStatus(taskId, newStatus);

      if (result.success) {
        setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, status: newStatus } : task)));
        toast.success("ステータスを更新しました");
      } else if (result.error) {
        toast.error(result.error);
      }

      setOpenStatus(null);
    } catch (error) {
      console.error(error);
      toast.error("ステータスの更新に失敗しました");
      setOpenStatus(null);
    }
  }

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
      combobox: {
        openStatus: openStatus, //開いている場合はrow.idを、閉じている場合はnullを返す
        setOpenStatus: setOpenStatus, //開いている場合はrow.idを、閉じている場合はnullを返す
        list: taskStatuses, //ステータスのリスト
        onChange: handleStatusChange, //ステータスを変更する
      },
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
