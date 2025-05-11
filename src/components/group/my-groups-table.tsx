"use client";

import type { Column, DataTableProps } from "@/components/share/data-table";
import type { MyGroupMembership } from "@/hooks/group/use-my-group-table";
import { memo, useMemo } from "react";
import Link from "next/link";
import { DataTable } from "@/components/share/data-table";
import { useMyGroupTable } from "@/hooks/group/use-my-group-table";
import { LogOut } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * マイグループテーブル
 * @returns マイグループテーブル
 */
export const MyGroupTable = memo(function MyGroupTable(): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ脱退処理のためのカスタムフック
   */
  const { memberships, setMemberships, handleLeave, calculateTotalPointsByGroup } = useMyGroupTable();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループごとの保有ポイントを計算
   */
  const totalPointsByGroup = useMemo(() => {
    return calculateTotalPointsByGroup();
  }, [calculateTotalPointsByGroup]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループテーブルの列
   */
  const columns: Column<MyGroupMembership>[] = useMemo(
    () => [
      {
        key: "id" as keyof MyGroupMembership,
        header: "操作",
        cell: () => null,
        sortable: true,
        className: null,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: true,
        modalList: [
          {
            title: "グループから脱退しますか？",
            description: "グループから脱退すると、再度参加するまでグループの活動に参加できなくなります。",
            action: handleLeave,
            actionLabel: "脱退する",
            triggerClassName: "button-danger-custom",
            triggerIcon: <LogOut className="h-4 w-4" />,
            triggerContent: ["脱退"],
            joinModal: false,
            isJoined: false,
          },
        ],
        editTask: false,
        deleteTask: null,
      },
      {
        key: "group" as keyof MyGroupMembership,
        header: "GROUP NAME",
        className: null,
        statusCombobox: false,
        sortable: true,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cell: (row: MyGroupMembership) => (
          <Link href={`/dashboard/group/${row.group.id}`} className="text-app hover:underline">
            {row.group.name}
          </Link>
        ),
      },
      {
        key: "group" as keyof MyGroupMembership,
        header: "保有ポイント",
        sortable: true,
        className: null,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cell: (row: MyGroupMembership) => totalPointsByGroup[row.group.id] ?? 0,
      },
      {
        key: "group" as keyof MyGroupMembership,
        header: "参加人数",
        sortable: true,
        className: null,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cell: (row: MyGroupMembership) => `${row.group.maxParticipants}人`,
      },
      {
        key: "group" as keyof MyGroupMembership,
        header: "KPI",
        sortable: true,
        className: null,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cell: (row: MyGroupMembership) => row.group.evaluationMethod,
      },
      {
        key: "group" as keyof MyGroupMembership,
        header: "DESCRIPTION",
        sortable: true,
        className: null,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cell: (row: MyGroupMembership) => row.group.goal,
      },
    ],
    [handleLeave, totalPointsByGroup],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データテーブルのプロパティ
   */
  const dataTableProps: DataTableProps<MyGroupMembership> = useMemo(
    () => ({
      initialData: memberships,
      columns: columns,
      onDataChange: setMemberships,
      editTask: null,
    }),
    [memberships, setMemberships, columns],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データテーブル
   */
  return <DataTable dataTableProps={dataTableProps} />;
});
