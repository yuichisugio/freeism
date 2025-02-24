"use client";

import type { Column, DataTableProps } from "@/components/ui/data-table";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { exportGroupTask, joinGroup } from "@/app/actions";
import { CsvUploadModal } from "@/components/group/csv-upload-modal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DataTable, taskStatuses } from "@/components/ui/data-table";
import { Download, Upload, UserPlus } from "lucide-react";
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
  group: {
    id: string;
    name: string;
    maxParticipants: number;
    goal: string;
    evaluationMethod: string;
    members: {
      id: string;
      userId: string;
    }[];
  };
};

type GroupDetailProps = {
  tasks: Task[];
};

export function GroupDetail({ tasks }: GroupDetailProps) {
  const router = useRouter();
  const [nonRewardTasks, setNonRewardTasks] = useState<Task[]>(tasks);
  const [rewardTasks, setRewardTasks] = useState<Task[]>(tasks.filter((task) => task.contributionType === "REWARD"));
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

  // グループのタスク情報をCSV形式でエクスポートする関数
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
      a.download = `${tasks[0].group.name}_tasks.csv`;
      a.click();

      // 少し待ってから 一時的なURLを解放する（ダウンロード完了前に削除してしまうとバグになるため。）
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error(error);
      toast.error("エラーが発生しました");
    }
  }

  const taskColumns: Column<Task>[] = [
    {
      key: "name" as keyof Task,
      header: "NAME",
      cell: (row: Task) => row.user.name || "-",
    },
    {
      key: "task" as keyof Task,
      header: "TASK",
      cell: (row: Task) => row.task,
    },
    {
      key: "contributionPoint" as keyof Task,
      header: "POINT",
      cell: (row: Task) => `${row.contributionPoint || 0}p`,
    },
    {
      key: "contributionType" as keyof Task,
      header: "TYPE",
      cell: (row: Task) => row.contributionType,
    },
    {
      key: "evaluator" as keyof Task,
      header: "EVALUATOR",
      cell: (row: Task) => row.evaluator || "-",
    },
    {
      key: "evaluationLogic" as keyof Task,
      header: "EVALUATION LOGIC",
      cell: (row: Task) => row.evaluationLogic || "-",
    },
    {
      key: "status" as keyof Task,
      header: "STATUS",
      combobox: {
        openStatus: openStatus, //開いている場合はrow.idを、閉じている場合はnullを返す
        setOpenStatus: setOpenStatus, //開いている場合はrow.idを、閉じている場合はnullを返す
        list: taskStatuses, //ステータスのリスト
        onChange: handleStatusChange, //ステータスを変更する
      },
    },
  ];

  const taskDataTableProps: DataTableProps<Task> = {
    data: nonRewardTasks,
    columns: taskColumns,
    pagination: true,
    onDataChange: setNonRewardTasks,
  };

  const rewardColumns: Column<Task>[] = [
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
    {
      key: "contributionType" as keyof Task,
      header: "TYPE",
      cell: (row: Task) => row.contributionType,
    },
    {
      key: "evaluator" as keyof Task,
      header: "EVALUATOR",
      cell: (row: Task) => row.evaluator || "-",
    },
    {
      key: "evaluationLogic" as keyof Task,
      header: "EVALUATION LOGIC",
      cell: (row: Task) => row.evaluationLogic || "-",
    },
    {
      key: "status" as keyof Task,
      header: "STATUS",
      cell: (row: Task) => row.status,
    },
  ];

  const rewardDataTableProps: DataTableProps<Task> = {
    data: rewardTasks,
    columns: rewardColumns,
    pagination: true,
    onDataChange: setRewardTasks,
  };

  return (
    <div className="space-y-6">
      {/* グループ情報 */}
      <div>
        <h1 className="page-title-custom">{tasks[0].group.name}</h1>
        <p className="text-neutral-900">参加上限人数: {tasks[0].group.maxParticipants}人</p>
        <p className="text-neutral-900">Group目標: {tasks[0].group.goal}</p>
        <p className="text-neutral-900">評価方法: {tasks[0].group.evaluationMethod}</p>
      </div>

      {/* 参加ボタン（未参加の場合のみ表示） */}
      {tasks[0].group.members.length === 0 && (
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
                <Button onClick={() => handleJoin(tasks[0].group.id)} className="button-default-custom">
                  参加する
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* アクションボタン */}
      <div className="flex flex-wrap gap-2">
        <Button className="button-default-custom" onClick={() => router.push(`/dashboard/group/${tasks[0].group.id}/task/new`)}>
          貢献入力
        </Button>
        <Button className="button-default-custom" onClick={() => onExport(tasks[0].group.id)}>
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
        <DataTable dataTableProps={taskDataTableProps} />
      </div>

      {/* 報酬一覧（REWARDタイプのタスクのみ表示） */}
      <div>
        <h2 className="text-app mb-4 text-xl font-semibold">報酬一覧</h2>
        <DataTable dataTableProps={rewardDataTableProps} />
      </div>

      {/* CSVアップロードモーダル */}
      <CsvUploadModal isOpen={isUploadModalOpen} groupId={tasks[0].group.id} onCloseAction={() => setIsUploadModalOpen(false)} />
    </div>
  );
}
