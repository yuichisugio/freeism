"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { joinGroup } from "@/app/actions";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Download, Upload, UserPlus } from "lucide-react";
import { toast } from "sonner";

type Task = {
  id: string;
  name: string;
  task: string;
  contributionPoint: number;
  evaluator: string;
  evaluationLogic: string;
};

type Supply = {
  id: string;
  name: string;
  provider: string;
  currentPoint: number;
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
  groupId: string;
};

export function GroupDetail({ groupId }: GroupDetailProps) {
  const router = useRouter();

  // グループ情報を取得
  const [group, setGroup] = useState<Group>({
    id: groupId,
    name: "幸福度は天下一",
    goal: "幸福度を最大化することを目指したグループです。初心者の方も大歓迎なのでぜひ気軽にご参加ください！",
    evaluationMethod: "幸福度の向上",
    maxParticipants: 140,
    members: [],
    tasks: [
      {
        id: "1",
        name: "杉尾優一",
        task: "〇〇を行った",
        contributionPoint: 150,
        evaluator: "トム・クルーズ",
        evaluationLogic: "100+55-5=150p",
      },
      {
        id: "2",
        name: "杉尾優一",
        task: "〇〇を行った",
        contributionPoint: 150,
        evaluator: "トム・クルーズ",
        evaluationLogic: "100+55-5=150p",
      },
      {
        id: "3",
        name: "杉尾優一",
        task: "〇〇を行った",
        contributionPoint: 150,
        evaluator: "トム・クルーズ",
        evaluationLogic: "100+55-5=150p",
      },
    ],
    supplies: [
      {
        id: "1",
        name: "ご飯",
        provider: "杉尾",
        currentPoint: 150,
      },
      {
        id: "2",
        name: "家",
        provider: "杉尾",
        currentPoint: 150,
      },
      {
        id: "3",
        name: "服",
        provider: "杉尾",
        currentPoint: 150,
      },
    ],
  });

  const [sortTaskConfig, setSortTaskConfig] = useState<{
    key: keyof Task;
    direction: "asc" | "desc";
  } | null>(null);

  const [sortSupplyConfig, setSortSupplyConfig] = useState<{
    key: keyof Supply;
    direction: "asc" | "desc";
  } | null>(null);

  // タスクのソート関数
  function sortTaskData(key: keyof Task) {
    let direction: "asc" | "desc" = "asc";
    if (sortTaskConfig && sortTaskConfig.key === key && sortTaskConfig.direction === "asc") {
      direction = "desc";
    }
    setSortTaskConfig({ key, direction });

    const sortedTasks = [...group.tasks].sort((a, b) => {
      if (a[key] < b[key]) return direction === "asc" ? -1 : 1;
      if (a[key] > b[key]) return direction === "asc" ? 1 : -1;
      return 0;
    });

    setGroup((prev) => ({ ...prev, tasks: sortedTasks }));
  }

  // 報酬のソート関数
  function sortSupplyData(key: keyof Supply) {
    let direction: "asc" | "desc" = "asc";
    if (sortSupplyConfig && sortSupplyConfig.key === key && sortSupplyConfig.direction === "asc") {
      direction = "desc";
    }
    setSortSupplyConfig({ key, direction });

    const sortedSupplies = [...group.supplies].sort((a, b) => {
      if (a[key] < b[key]) return direction === "asc" ? -1 : 1;
      if (a[key] > b[key]) return direction === "asc" ? 1 : -1;
      return 0;
    });

    setGroup((prev) => ({ ...prev, supplies: sortedSupplies }));
  }

  // グループ参加処理
  async function handleJoin(groupId: string) {
    try {
      const result = await joinGroup(groupId);

      if (result.success) {
        toast.success("グループに参加しました");
        setGroup((prev) => ({
          ...prev,
          members: [...prev.members, { id: "temp" }],
        }));
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("エラーが発生しました");
      console.error(error);
    }
  }

  return (
    <div className="space-y-6">
      {/* グループ情報 */}
      <div>
        <h1 className="page-title-custom">{group.name}</h1>
        <p className="page-description-custom">{group.goal}</p>
        <div className="flex items-center gap-2">
          <p className="text-sm text-neutral-600">
            参加人数: {group.maxParticipants}人 | KPI: {group.evaluationMethod}
          </p>
        </div>
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
        <Button className="button-default-custom">貢献タスク入力</Button>
        <Button className="button-default-custom">貢献評価</Button>
        <Button className="button-default-custom">
          <Download className="mr-2 h-4 w-4" />
          CSVエクスポート
        </Button>
        <Button className="button-default-custom">
          <Upload className="mr-2 h-4 w-4" />
          CSVアップロード
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
                    <button onClick={() => sortTaskData("name")} className="text-app inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600">
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
                </tr>
              </thead>
              <tbody>
                {group.tasks.map((task) => (
                  <tr key={task.id} className="border-b border-blue-50 hover:bg-blue-50/50">
                    <td className="text-app px-5 py-3 text-sm font-medium whitespace-nowrap">{task.name}</td>
                    <td className="px-5 py-3 text-sm whitespace-nowrap text-neutral-600">{task.task}</td>
                    <td className="px-5 py-3 text-sm whitespace-nowrap text-neutral-600">{task.contributionPoint}p</td>
                    <td className="px-5 py-3 text-sm whitespace-nowrap text-neutral-600">{task.evaluator}</td>
                    <td className="px-5 py-3 text-sm text-neutral-600">{task.evaluationLogic}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 報酬一覧 */}
      <div>
        <h2 className="text-app mb-4 text-xl font-semibold">報酬一覧</h2>
        <div className="rounded-lg border border-blue-100 bg-white/80 backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-blue-100 bg-blue-50/50">
                  <th className="px-5 py-3 text-left text-sm font-medium">
                    <button onClick={() => sortSupplyData("name")} className="text-app inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600">
                      NAME
                      <ArrowUpDown className="ml-1 h-4 w-4" />
                    </button>
                  </th>
                  <th className="px-5 py-3 text-left text-sm font-medium">
                    <button onClick={() => sortSupplyData("provider")} className="text-app inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600">
                      提供者
                      <ArrowUpDown className="ml-1 h-4 w-4" />
                    </button>
                  </th>
                  <th className="px-5 py-3 text-left text-sm font-medium">
                    <button onClick={() => sortSupplyData("currentPoint")} className="text-app inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600">
                      現在の入札額 Point
                      <ArrowUpDown className="ml-1 h-4 w-4" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.supplies.map((supply) => (
                  <tr key={supply.id} className="border-b border-blue-50 hover:bg-blue-50/50">
                    <td className="text-app px-5 py-3 text-sm font-medium whitespace-nowrap">{supply.name}</td>
                    <td className="px-5 py-3 text-sm whitespace-nowrap text-neutral-600">{supply.provider}</td>
                    <td className="px-5 py-3 text-sm whitespace-nowrap text-neutral-600">{supply.currentPoint}p</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
