"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { exportGroupTask, getGroupDetails, joinGroup, updateTaskStatus } from "@/app/actions";
import { CsvUploadModal } from "@/components/group/csv-upload-modal";
import { GroupTasksTable } from "@/components/task/group-tasks-table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DataTable } from "@/components/ui/data-table";
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

type Group = {
  id: string;
  name: string;
  goal: string;
  evaluationMethod: string;
  maxParticipants: number;
  members: { id: string }[];
  tasks: Task[];
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
] as const;

export function GroupDetail({ groupInfo }: GroupDetailProps) {
  const router = useRouter();
  const [group, setGroup] = useState<Group>(groupInfo);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

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

  const rewardColumns = [
    {
      key: "user" as keyof Task,
      header: "NAME",
      sortable: true,
      cell: (row: Task) => row.user.name || "-",
    },
    {
      key: "task" as keyof Task,
      header: "TASK",
      sortable: true,
      cell: (row: Task) => row.task,
    },
    {
      key: "contributionPoint" as keyof Task,
      header: "現在の入札額 Point",
      sortable: true,
      cell: (row: Task) => `${row.contributionPoint || 0}p`,
    },
  ];

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
        <GroupTasksTable tasks={group.tasks} />
      </div>

      {/* 報酬一覧（REWARDタイプのタスクのみ表示） */}
      <div>
        <h2 className="text-app mb-4 text-xl font-semibold">報酬一覧</h2>
        <DataTable data={group.tasks.filter((task) => task.contributionType === "REWARD")} columns={rewardColumns} />
      </div>

      {/* CSVアップロードモーダル */}
      <CsvUploadModal isOpen={isUploadModalOpen} onClose={setIsUploadModalOpen} groupId={group.id} />
    </div>
  );
}
