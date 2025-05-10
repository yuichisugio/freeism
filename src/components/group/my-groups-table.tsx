"use client";

import type { BaseRecord, Column, DataTableProps } from "@/components/share/data-table";
import { memo, useMemo } from "react";
import Link from "next/link";
import { DataTable } from "@/components/share/data-table";
import { useGroupLeaver, useGroupPoints } from "@/hooks/group/use-my-group-list";
import { LogOut } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループメンバーシップの型
 */
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
  // インデックスシグネチャを追加して、Record<string, unknown>と互換性を持たせる
  [key: string]: unknown;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * マイグループテーブル
 * @param memberships グループメンバーシップ
 * @returns マイグループテーブル
 */
export const MyGroupsTable = memo(function MyGroupsTable({ memberships: initialMemberships }: { memberships: GroupMembership[] }): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // カスタムフックを使用してグループ脱退機能を実装
  const { memberships, setMemberships, handleLeave } = useGroupLeaver<GroupMembership>(initialMemberships);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // カスタムフックを使用してグループポイント計算を実装
  const { calculateTotalPointsByGroup } = useGroupPoints<GroupMembership>(memberships);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ポイントを計算
  const totalContributionPointsByGroup = useMemo(() => calculateTotalPointsByGroup(), [calculateTotalPointsByGroup]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const columns: Column<GroupMembership>[] = useMemo(
    () => [
      {
        key: "id" as keyof GroupMembership,
        header: "操作",
        cell: () => null,
        className: null,
        statusCombobox: false,
        sortable: true,
        joinGroupModal: false,
        leaveGroupModal: true,
        editTask: false,
        deleteTask: null,
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
        className: null,
        statusCombobox: false,
        sortable: true,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
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
        className: null,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cell: (row: GroupMembership) => totalContributionPointsByGroup[row.group.id],
      },
      {
        key: "group" as keyof GroupMembership,
        header: "参加人数",
        sortable: true,
        className: null,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cell: (row: GroupMembership) => `${row.group.maxParticipants}人`,
      },
      {
        key: "group" as keyof GroupMembership,
        header: "KPI",
        sortable: true,
        className: null,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cell: (row: GroupMembership) => row.group.evaluationMethod,
      },
      {
        key: "group" as keyof GroupMembership,
        header: "DESCRIPTION",
        sortable: true,
        className: null,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cell: (row: GroupMembership) => row.group.goal,
      },
    ],
    [handleLeave, totalContributionPointsByGroup],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const dataTableProps: DataTableProps<GroupMembership> = useMemo(
    () => ({
      initialData: memberships,
      columns: columns,
      pagination: true,
      onDataChange: setMemberships,
    }),
    [memberships, setMemberships, columns],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return <DataTable dataTableProps={dataTableProps as unknown as DataTableProps<BaseRecord>} />;
});
