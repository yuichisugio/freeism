"use client";

import type { DataTableProps } from "@/components/ui/data-table";
import type { Column } from "@/components/ui/data-table";
import { useState } from "react";
import Link from "next/link";
import { leaveGroup } from "@/app/actions";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
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
  };
};

type MyGroupsTableProps = {
  memberships: GroupMembership[];
};

export function MyGroupsTable({ memberships: initialMemberships }: MyGroupsTableProps) {
  const [memberships, setMemberships] = useState(initialMemberships);

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
