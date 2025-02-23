"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteGroup, joinGroup } from "@/app/actions";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Edit, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

// グループのデータの型を定義
type Group = {
  id: string;
  name: string;
  goal: string;
  evaluationMethod: string;
  maxParticipants: number;
  members: { id: string }[];
  createdBy: string;
};

// 各要素がグループのデータの配列を、groupsキーに格納したオブジェクトの型を定義
type GroupListTableProps = {
  groups: Group[];
};

// 各要素のデータとしてグループデータが入ったオブジェクトを引数として渡す
export function GroupListTable({ groups: initialGroups }: GroupListTableProps) {
  // ルーティング
  const router = useRouter();
  // 初期値としてpropsに渡したグループのデータ(groupsキーに配列で格納)を取得したグループデータを格納する
  const [groups, setGroups] = useState(initialGroups);

  // グループ参加処理
  async function handleJoin(groupId: string) {
    try {
      // グループに参加する。
      const result = await joinGroup(groupId);

      if (result.success) {
        toast.success("グループに参加しました");
        // 参加状態を更新。prevは現在のstate。
        setGroups((prev) =>
          // グループを一つずつチェック。
          prev.map((group) =>
            // チェックしたグループのidが、設定したハンドラーのgroupIdと同じ場合は、参加者を追加。
            group.id === groupId
              ? // 同じ場合は、参加者を追加。
                { ...group, members: [{ id: "temp" }] }
              : // 同じでない場合は、そのままのグループを返す。
                group,
          ),
        );
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("エラーが発生しました");
      console.error(error);
    }
  }

  // 削除処理の関数を追加
  async function handleDelete(groupId: string) {
    try {
      const result = await deleteGroup(groupId);

      if (result.success) {
        toast.success("グループを削除しました");
        // 削除したグループを除外
        setGroups((prev) => prev.filter((group) => group.id !== groupId));
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("エラーが発生しました");
      console.error(error);
    }
  }

  const columns = [
    {
      key: "id" as keyof Group,
      header: "参加",
      sortable: false,
      cell: (row: Group) => (
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="button-join-custom" disabled={row.members.length > 0}>
                <UserPlus className="mr-1 h-4 w-4" />
                {row.members.length > 0 ? "参加中" : "参加"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader className="text-app">
                <AlertDialogTitle>グループに参加しますか？</AlertDialogTitle>
                <AlertDialogDescription>グループに参加すると、グループのメンバーとして参加できます。</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction asChild>
                  <Button onClick={() => handleJoin(row.id)} className="button-default-custom">
                    参加する
                  </Button>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* 編集ボタン */}
          <Button variant="outline" size="sm" className="button-edit-custom" onClick={() => router.push(`/dashboard/edit-group/${row.id}`)}>
            <Edit className="h-4 w-4" />
          </Button>

          {/* 削除ボタン */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="button-danger-custom">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>グループを削除しますか？</AlertDialogTitle>
                <AlertDialogDescription>この操作は取り消せません。グループを削除すると、すべてのデータが完全に削除されます。</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction asChild>
                  <Button onClick={() => handleDelete(row.id)} className="bg-red-500 text-white hover:bg-red-600">
                    削除する
                  </Button>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ),
    },
    {
      key: "name" as keyof Group,
      header: "GROUP NAME",
      sortable: true,
      cell: (row: Group) => (
        <Link href={`/dashboard/group/${row.id}`} className="text-app hover:underline">
          {row.name}
        </Link>
      ),
    },
    {
      key: "maxParticipants" as keyof Group,
      header: "参加人数",
      sortable: true,
      cell: (row: Group) => `${row.maxParticipants}人`,
    },
    {
      key: "evaluationMethod" as keyof Group,
      header: "KPI",
      sortable: true,
      cell: (row: Group) => row.evaluationMethod,
    },
    {
      key: "goal" as keyof Group,
      header: "DESCRIPTION",
      sortable: true,
      cell: (row: Group) => row.goal,
    },
  ];

  return <DataTable data={groups} columns={columns} pagination onDataChange={setGroups} />;
}
