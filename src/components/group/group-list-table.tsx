"use client";

import type { Column, DataTableProps } from "@/components/ui/data-table";
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
  const [groups, setGroups] = useState<Group[]>(initialGroups);

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

  // 編集処理の関数を追加
  async function handleEdit(groupId: string) {
    router.push(`/dashboard/edit-group/${groupId}`);
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

  // グループリストのテーブルの列を定義
  const columns: Column<Group>[] = [
    {
      key: "id" as keyof Group,
      header: "Group操作",
      sortable: true,
      modalList: [
        {
          title: "グループに参加しますか？",
          description: "グループに参加すると、グループのメンバーとして参加できます。",
          action: handleJoin,
          actionLabel: "参加する",
          triggerClassName: "button-join-custom",
          triggerContent: ["参加中", "参加"],
          triggerIcon: <UserPlus className="h-4 w-4" />,
          joinModal: true,
        },
        {
          title: "グループを編集しますか？",
          description: "グループを編集すると、グループの名前や目標などを変更できます。",
          action: handleEdit,
          actionLabel: "編集する",
          triggerClassName: "button-edit-custom",
          triggerContent: ["編集"],
          triggerIcon: <Edit className="h-4 w-4" />,
        },
        {
          title: "グループを削除しますか？",
          description: "この操作は取り消せません。グループを削除すると、すべてのデータが完全に削除されます。",
          action: handleDelete,
          actionLabel: "削除する",
          triggerClassName: "button-danger-custom",
          triggerIcon: <Trash2 className="h-4 w-4" />,
          triggerContent: ["削除"],
        },
      ],
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

  const dataTableProps: DataTableProps<Group> = {
    data: groups,
    columns: columns,
    pagination: true,
    onDataChange: setGroups,
  };

  // DataTableコンポーネントを返す。onDataChangeは、データが更新されたときに呼び出される関数で、DataTable内でデータ更新したらsetGroupsをDataTable内で呼び出し、↑のgroupsのStateを使用している部分も更新できるようにする。
  return <DataTable dataTableProps={dataTableProps} />;
}
