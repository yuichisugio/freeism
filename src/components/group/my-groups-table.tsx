"use client";

import type { Column, DataTableProps } from "@/components/share/data-table";
import { useState } from "react";
import Link from "next/link";
import { leaveGroup } from "@/app/actions/group";
import { DataTable } from "@/components/share/data-table";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

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
  // グループ一覧を取得
  const [memberships, setMemberships] = useState(initialMemberships);

  // グループごとの自分の保有ポイントを計算。グループごとに保有ポイントを計算して、グループIDをキーとして保有ポイントをオブジェクトに格納する。
  const totalContributionPointsByGroup = memberships.reduce(
    (acc, membership) => {
      const groupId = membership.group.id;
      const groupContributionPoints = membership.group.tasks.reduce((sum, task) => sum + (task.fixedContributionPoint ?? 0), 0);
      acc[groupId] = groupContributionPoints;
      return acc;
    },
    {} as Record<string, number>,
  );

  // グループ脱退処理
  async function handleLeave(groupId: string) {
    try {
      const result = await leaveGroup(groupId);

      if (result.success) {
        toast.success("グループから脱退しました");
        // 脱退したグループを一覧から削除
        setMemberships((prev) => prev.filter((membership) => membership.group.id !== groupId));
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("エラーが発生しました");
      console.error(error);
    }
  }

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
