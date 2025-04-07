"use client";

import type { Column, DataTableProps } from "@/components/share/data-table";
import Link from "next/link";
import { DataTable } from "@/components/share/data-table";
import { useGroupJoiner } from "@/hooks/table/use-group-actions";
import { UserPlus } from "lucide-react";

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
  // カスタムフックを使用してグループ参加機能を実装
  const { groups, setGroups, handleJoin } = useGroupJoiner<Group>(initialGroups);

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
