"use client";

import type { BaseRecord, Column, DataTableProps } from "@/components/share/data-table";
import { memo, useMemo } from "react";
import Link from "next/link";
import { DataTable } from "@/components/share/data-table";
import { useGroupJoiner } from "@/hooks/group/use-group-actions";
import { UserPlus } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループのデータの型
 */
type Group = BaseRecord & {
  name: string;
  goal: string;
  evaluationMethod: string;
  maxParticipants: number;
  members: { id: string }[];
  createdBy: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループのデータの型
 */
type GroupListTableProps = {
  groups: Group[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループのデータの型
 */
export const GroupListTable = memo(function GroupListTable({ groups: initialGroups }: GroupListTableProps): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  // カスタムフックを使用してグループ参加機能を実装
  const { groups, setGroups, handleJoin } = useGroupJoiner<Group>(initialGroups);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // グループリストのテーブルの列を定義
  const columns: Column<Group>[] = useMemo(
    () => [
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
    ],
    [handleJoin],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const dataTableProps: DataTableProps<BaseRecord> = useMemo(
    () => ({
      data: groups as unknown as BaseRecord[],
      columns: columns as unknown as Column<BaseRecord>[],
      pagination: true,
      onDataChange: (data) => setGroups(data as unknown as Group[]),
    }),
    [groups, setGroups, columns],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // DataTableコンポーネントを返す。onDataChangeは、データが更新されたときに呼び出される関数で、DataTable内でデータ更新したらsetGroupsをDataTable内で呼び出し、↑のgroupsのStateを使用している部分も更新できるようにする。
  return <DataTable dataTableProps={dataTableProps} />;
});
