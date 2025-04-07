"use client";

import type { Column, DataTableProps } from "@/components/share/data-table";
import Link from "next/link";
import { DataTable } from "@/components/share/data-table";
import { useGroupLeaver, useGroupPoints } from "@/hooks/table/use-group-actions";
import { LogOut } from "lucide-react";

type GroupMembership = {
  id: string;
  group: {
    id: string;
    name: string;
    goal: string;
    evaluationMethod: string;
    maxParticipants: number;
    tasks: {
      fixedContributionPoint: number | null;
    }[];
  };
};

type MyGroupsTableProps = {
  memberships: GroupMembership[];
};

export function MyGroupsTable({ memberships: initialMemberships }: MyGroupsTableProps) {
  // カスタムフックを使用してグループ脱退機能を実装
  const { memberships, setMemberships, handleLeave } = useGroupLeaver<GroupMembership>(initialMemberships);

  // カスタムフックを使用してグループポイント計算を実装
  const { calculateTotalPointsByGroup } = useGroupPoints<GroupMembership>(memberships);

  // ポイントを計算
  const totalContributionPointsByGroup = calculateTotalPointsByGroup();

  const columns: Column<GroupMembership>[] = [
    {
      key: "id" as keyof GroupMembership,
      header: "操作",
      sortable: true,
      modalList: [
        {
          title: "グループから脱退しますか？",
          description: "グループから脱退すると、再度参加するまでグループの活動に参加できなくなります。",
          action: handleLeave,
          actionLabel: "脱退する",
          triggerClassName: "button-danger-custom",
          triggerIcon: <LogOut className="h-4 w-4" />,
          triggerContent: ["脱退"],
        },
      ],
    },
    {
      key: "group" as keyof GroupMembership,
      header: "GROUP NAME",
      sortable: true,
      cell: (row: GroupMembership) => (
        <Link href={`/dashboard/group/${row.group.id}`} className="text-app hover:underline">
          {row.group.name}
        </Link>
      ),
    },
    {
      key: "group" as keyof GroupMembership,
      header: "保有ポイント",
      sortable: true,
      cell: (row: GroupMembership) => totalContributionPointsByGroup[row.group.id],
    },
    {
      key: "group" as keyof GroupMembership,
      header: "参加人数",
      sortable: true,
      cell: (row: GroupMembership) => `${row.group.maxParticipants}人`,
    },
    {
      key: "group" as keyof GroupMembership,
      header: "KPI",
      sortable: true,
      cell: (row: GroupMembership) => row.group.evaluationMethod,
    },
    {
      key: "group" as keyof GroupMembership,
      header: "DESCRIPTION",
      sortable: true,
      cell: (row: GroupMembership) => row.group.goal,
    },
  ];

  const dataTableProps: DataTableProps<GroupMembership> = {
    data: memberships,
    columns: columns,
    pagination: true,
    onDataChange: setMemberships,
  };

  return <DataTable dataTableProps={dataTableProps} />;
}
