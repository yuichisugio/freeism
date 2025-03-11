"use client";

import type { Column } from "@/components/share/data-table";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { checkAppOwner, checkAuth } from "@/app/actions/group";
import { getMyTasks } from "@/app/actions/task";
import { getAllUsers } from "@/app/actions/user";
import { DataTable } from "@/components/share/data-table";
import { type contributionType } from "@prisma/client";
import { toast } from "react-hot-toast";

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
  contributionType: contributionType;
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
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [users, setUsers] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAppOwner, setIsAppOwner] = useState(false);

  // ユーザー一覧を取得
  useEffect(() => {
    async function fetchUsers() {
      try {
        const allUsers = await getAllUsers();
        setUsers(allUsers);
      } catch (error) {
        console.error("ユーザー一覧取得エラー:", error);
      }
    }

    fetchUsers();
  }, []);

  // 権限情報を取得
  useEffect(() => {
    async function checkPermissions() {
      try {
        const currentUserId = await checkAuth();
        if (currentUserId) {
          setUserId(currentUserId);
          const isOwner = await checkAppOwner(currentUserId);
          setIsAppOwner(isOwner);
        }
      } catch (error) {
        console.error("権限チェックエラー:", error);
      }
    }

    checkPermissions();
  }, []);

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

  // タスク編集可能かどうかの判定
  const canEditTask = (task: Task): boolean => {
    // 変更不可のステータスチェック
    const immutableStatuses = ["FIXED_EVALUATED", "POINTS_AWARDED", "ARCHIVED"];
    if (immutableStatuses.includes(task.status)) {
      return false;
    }

    // 権限チェック - 報告者、実行者、アプリオーナーのみ編集可能
    if (!userId) return false;

    // 報告者チェック
    const isReporter = task.reporters.some((r) => r.userId === userId);

    // 実行者チェック
    const isExecutor = task.executors.some((e) => e.userId === userId);

    // アプリオーナーの場合は編集可能
    return isAppOwner || isReporter || isExecutor;
  };

  // タスク編集後の更新処理
  const handleTaskEdited = () => {
    // 非同期処理を即時実行関数として実行
    (async () => {
      try {
        // タスクデータを再取得
        const updatedTasks = await getMyTasks();

        // 表示用のタスクデータを更新
        if (updatedTasks && Array.isArray(updatedTasks) && updatedTasks.length > 0) {
          setTasks(updatedTasks);
          toast.success("タスクデータを更新しました");
        }
      } catch (error) {
        console.error("タスクデータ更新エラー:", error);
      } finally {
        router.refresh(); // バックアップとしてのrefresh
      }
    })();
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
      statusCombobox: true,
      sortable: true,
    },
    {
      key: "action" as keyof Task,
      header: "アクション",
      editTask: true,
    },
  ];

  return (
    <DataTable
      dataTableProps={{
        data: tasks,
        columns,
        onDataChange: (data) => setTasks(data as Task[]),
        editTask: {
          canEdit: canEditTask,
          onEdit: handleTaskEdited,
          users: users,
        },
      }}
    />
  );
}
