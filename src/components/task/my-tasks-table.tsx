"use client";

import { useState } from "react";
import { updateTaskStatus } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ArrowUpDown, Check, ChevronsUpDown } from "lucide-react";
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

const taskStatuses = [
  { label: "タスク実施予定", value: "PENDING" },
  { label: "落札済み", value: "BIDDED" },
  { label: "ポイント預け済み", value: "POINTS_DEPOSITED" },
  { label: "タスク完了", value: "TASK_COMPLETED" },
  { label: "Group内レビュー完了", value: "GROUP_REVIEW_COMPLETED" },
  { label: "Group外レビュー完了", value: "EXTERNAL_REVIEW_COMPLETED" },
  { label: "ポイント付与完了", value: "POINTS_AWARDED" },
  { label: "アーカイブ", value: "ARCHIVED" },
] as const;

export function MyTasksTable({ tasks: initialTasks }: MyTasksTableProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [openStatus, setOpenStatus] = useState<string | null>(null);

  // タスクのソート関数
  function sortTaskData(key: keyof Task) {
    const sortedTasks = [...tasks].sort((a, b) => {
      const aValue = a[key];
      const bValue = b[key];

      if (aValue === null || bValue === null) return 0;
      if (typeof aValue === "object" || typeof bValue === "object") return 0;

      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    });

    setTasks(sortedTasks);
  }

  // ステータス変更処理
  async function handleStatusChange(taskId: string, newStatus: string) {
    try {
      const result = await updateTaskStatus(taskId, newStatus);

      if (result.success) {
        setTasks((prevTasks) => prevTasks.map((task) => (task.id === taskId ? { ...task, status: newStatus } : task)));
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

  return (
    <div className="rounded-lg border border-blue-100 bg-white/80 backdrop-blur-sm">
      <div className="h-[calc(100vh-16rem)] overflow-y-auto">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-blue-100 bg-blue-50/50">
                <th className="px-5 py-3 text-left text-sm font-medium">
                  <button onClick={() => sortTaskData("group")} className="text-app inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600">
                    GROUP NAME
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </button>
                </th>
                <th className="px-5 py-3 text-left text-sm font-medium">
                  <button onClick={() => sortTaskData("task")} className="text-app inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600">
                    TASK
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </button>
                </th>
                <th className="px-5 py-3 text-left text-sm font-medium">
                  <button onClick={() => sortTaskData("contributionPoint")} className="text-app inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600">
                    Contribution Point
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </button>
                </th>
                <th className="px-5 py-3 text-left text-sm font-medium">
                  <button onClick={() => sortTaskData("evaluator")} className="text-app inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600">
                    算出者
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </button>
                </th>
                <th className="px-5 py-3 text-left text-sm font-medium">
                  <button onClick={() => sortTaskData("evaluationLogic")} className="text-app inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600">
                    算出ロジック
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </button>
                </th>
                <th className="text-app px-5 py-3 text-left text-sm font-medium">
                  <button onClick={() => sortTaskData("status")} className="text-app inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600">
                    ステータス
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-b border-blue-50 hover:bg-blue-50/50">
                  <td className="px-5 py-3 text-sm whitespace-nowrap text-neutral-600">{task.group.name}</td>
                  <td className="px-5 py-3 text-sm whitespace-nowrap text-neutral-600">{task.task}</td>
                  <td className="px-5 py-3 text-sm whitespace-nowrap text-neutral-600">{task.contributionPoint ? `${task.contributionPoint}p` : "評価待ち"}</td>
                  <td className="px-5 py-3 text-sm whitespace-nowrap text-neutral-600">{task.evaluator || "-"}</td>
                  <td className="px-5 py-3 text-sm text-neutral-600">{task.evaluationLogic || "-"}</td>
                  <td className="py-3 text-sm text-neutral-600">
                    <Popover open={openStatus === task.id} onOpenChange={(isOpen: boolean) => setOpenStatus(isOpen ? task.id : null)}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="mr-3">
                          {task.status ? taskStatuses.find((status) => status.value === task.status)?.label : "ステータスを選択"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0">
                        <Command>
                          <CommandInput placeholder="ステータスを検索..." />
                          <CommandEmpty>ステータスが見つかりません</CommandEmpty>
                          <CommandGroup>
                            {taskStatuses.map((status) => (
                              <CommandItem key={status.value} value={status.label} onSelect={() => handleStatusChange(task.id, status.value)}>
                                <Check className={cn("mr-2 h-4 w-4", task.status === status.value ? "opacity-100" : "opacity-0")} />
                                {status.label}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
