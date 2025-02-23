"use client";

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

  const columns = [
    {
      key: "id" as keyof GroupMembership,
      header: "脱退",
      sortable: false,
      cell: (row: GroupMembership) => (
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" className="button-danger-custom">
            <LogOut className="mr-1 h-4 w-4" />
            脱退
          </Button>
        </AlertDialogTrigger>
      ),
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

  return (
    <AlertDialog>
      <DataTable data={memberships} columns={columns} pagination onDataChange={setMemberships} />

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-app">グループから脱退しますか？</AlertDialogTitle>
          <AlertDialogDescription className="text-app">グループから脱退すると、再度参加するまでグループの活動に参加できなくなります。</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="text-app">キャンセル</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={() => handleLeave(memberships[0]?.group.id)} className="button-default-custom">
              脱退する
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
