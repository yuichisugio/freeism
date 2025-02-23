"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { exportGroupTask, getGroupDetails, joinGroup, updateTaskStatus } from "@/app/actions";
import { CsvUploadModal } from "@/components/group/csv-upload-modal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ArrowUpDown, Check, ChevronsUpDown, Download, Upload, UserPlus } from "lucide-react";
import Papa from "papaparse";
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
};

type Supply = {
  id: string;
  name: string;
  currentPoint: number;
  user: {
    name: string | null;
  };
};

type Group = {
  id: string;
  name: string;
  goal: string;
  evaluationMethod: string;
  maxParticipants: number;
  members: { id: string }[];
  tasks: Task[];
  supplies: Supply[];
};

type GroupDetailProps = {
  groupInfo: Group;
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
];

export function GroupDetail({ groupInfo }: GroupDetailProps) {
  const router = useRouter();
  const [group, setGroup] = useState<Group>(groupInfo);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [openStatus, setOpenStatus] = useState<string | null>(null);

  // タスクのソート関数
  function sortTaskData(key: keyof Task) {
    const sortedTasks = [...group.tasks].sort((a, b) => {
      const aValue = a[key];
      const bValue = b[key];

      if (aValue === null || bValue === null) return 0;
      if (typeof aValue === "object" || typeof bValue === "object") return 0;

      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    });

    setGroup({ ...group, tasks: sortedTasks });
  }

  // グループ参加処理
  async function handleJoin(groupId: string) {
    try {
      const result = await joinGroup(groupId);

      if (result.success) {
        toast.success("グループに参加しました");
        router.refresh();
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("エラーが発生しました");
      console.error(error);
    }
  }

  async function onExport(groupId: string) {
    try {
      // タスク情報を取得(タスクごとにオブジェクトの要素を配列として取得)
      const tasks = await exportGroupTask(groupId);

      // Papaparse を利用して、JavaScript のオブジェクト配列を CSV 形式の文字列に変換する
      const csv = Papa.unparse(tasks);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${group.name}_tasks.csv`;
      a.click();

      // 少し待ってから 一時的なURLを解放する（ダウンロード完了前に削除してしまうとバグになるため。）
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error(error);
      toast.error("エラーが発生しました");
    }
  }

  // ステータス変更処理
  async function handleStatusChange(taskId: string, newStatus: string) {
    try {
      const result = await updateTaskStatus(taskId, newStatus);

      if (result.success) {
        setGroup((prevGroup) => ({
          ...prevGroup,
          tasks: prevGroup.tasks.map((task) => (task.id === taskId ? { ...task, status: newStatus } : task)),
        }));
      }

      toast.success("ステータスを更新しました");
    } catch (error) {
      console.error(error);
      toast.error("ステータスの更新に失敗しました");
    }
  }

  return (
    <div className="space-y-6">
      {/* グループ情報 */}
      <div>
        <h1 className="page-title-custom">{group.name}</h1>
        <p className="text-neutral-900">参加上限人数: {group.maxParticipants}人</p>
        <p className="text-neutral-900">Group目標: {group.goal}</p>
        <p className="text-neutral-900">評価方法: {group.evaluationMethod}</p>
      </div>

      {/* 参加ボタン（未参加の場合のみ表示） */}
      {group.members.length === 0 && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className="button-default-custom">
              <UserPlus className="mr-2 h-4 w-4" />
              参加する
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="alert-dialog-title-custom">グループに参加しますか？</AlertDialogTitle>
              <AlertDialogDescription className="alert-dialog-description-custom">グループに参加すると、グループのメンバーとして参加できます。</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button onClick={() => handleJoin(group.id)} className="button-default-custom">
                  参加する
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* アクションボタン */}
      <div className="flex flex-wrap gap-2">
        <Button className="button-default-custom" onClick={() => router.push(`/dashboard/group/${group.id}/task/new`)}>
          貢献入力
        </Button>
        <Button className="button-default-custom" onClick={() => onExport(group.id)}>
          <Download />
          Export
        </Button>
        <Button className="button-default-custom" onClick={() => setIsUploadModalOpen(true)}>
          <Upload />
          Upload
        </Button>
      </div>

      {/* タスク一覧 */}
      <div>
        <h2 className="text-app mb-4 text-xl font-semibold">Task一覧</h2>
        <div className="rounded-lg border border-blue-100 bg-white/80 backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-blue-100 bg-blue-50/50">
                  <th className="px-5 py-3 text-left text-sm font-medium">
                    <button onClick={() => sortTaskData("task")} className="text-app inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600">
                      NAME
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
                  <th className="px-5 py-3 text-left text-sm font-medium">ステータス</th>
                </tr>
              </thead>
              <tbody>
                {group.tasks.map((task) => (
                  <tr key={task.id} className="border-b border-blue-50 hover:bg-blue-50/50">
                    <td className="px-5 py-3 text-sm whitespace-nowrap text-neutral-600">{task.user.name || "-"}</td>
                    <td className="px-5 py-3 text-sm whitespace-nowrap text-neutral-600">{task.task}</td>
                    <td className="px-5 py-3 text-sm whitespace-nowrap text-neutral-600">{task.contributionPoint ? `${task.contributionPoint}p` : "評価待ち"}</td>
                    <td className="px-5 py-3 text-sm whitespace-nowrap text-neutral-600">{task.evaluator || "-"}</td>
                    <td className="px-5 py-3 text-sm text-neutral-600">{task.evaluationLogic || "-"}</td>

                    {/* ステータス変更ポップオーバー */}
                    <td className="px-5 py-3 text-sm text-neutral-600">
                      <Popover open={openStatus === task.id} onOpenChange={(isOpen) => setOpenStatus(isOpen ? task.id : null)}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" role="combobox" aria-expanded={openStatus === task.id} className="w-[200px] justify-between">
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
                                <CommandItem
                                  key={status.value}
                                  value={status.value}
                                  onSelect={() => {
                                    handleStatusChange(task.id, status.value);
                                    setOpenStatus(null);
                                  }}
                                >
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

      {/* 報酬一覧（REWARDタイプのタスクのみ表示） */}
      <div>
        <h2 className="text-app mb-4 text-xl font-semibold">報酬一覧</h2>
        <div className="rounded-lg border border-blue-100 bg-white/80 backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-blue-100 bg-blue-50/50">
                  <th className="px-5 py-3 text-left text-sm font-medium">
                    <button className="text-app inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600">
                      NAME
                      <ArrowUpDown className="ml-1 h-4 w-4" />
                    </button>
                  </th>
                  <th className="px-5 py-3 text-left text-sm font-medium">
                    <button className="text-app inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600">
                      TASK
                      <ArrowUpDown className="ml-1 h-4 w-4" />
                    </button>
                  </th>
                  <th className="px-5 py-3 text-left text-sm font-medium">
                    <button className="text-app inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600">
                      現在の入札額 Point
                      <ArrowUpDown className="ml-1 h-4 w-4" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.tasks
                  .filter((task) => task.contributionType === "REWARD")
                  .map((task) => (
                    <tr key={task.id} className="border-b border-blue-50 hover:bg-blue-50/50">
                      <td className="px-5 py-3 text-sm whitespace-nowrap text-neutral-600">{task.user.name || "-"}</td>
                      <td className="px-5 py-3 text-sm whitespace-nowrap text-neutral-600">{task.task}</td>
                      <td className="px-5 py-3 text-sm whitespace-nowrap text-neutral-600">{task.contributionPoint || 0}p</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CSVアップロードモーダル */}
      {isUploadModalOpen && <CsvUploadModal isOpen={isUploadModalOpen} onCloseAction={setIsUploadModalOpen} groupId={group.id} />}
    </div>
  );
}
