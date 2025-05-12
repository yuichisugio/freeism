"use client";

import type { MyGroupMembership } from "@/hooks/group/use-my-group-table";
import type { Column, DataTableProps } from "@/types/group-types";
import { memo, useMemo } from "react";
import Link from "next/link";
import { ShareTable } from "@/components/share/share-table";
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
        cellClassName: null,
      },
      {
        key: "group" as keyof MyGroupMembership,
        header: "GROUP NAME",
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
        cellClassName: null,
      },
      {
        key: "group" as keyof MyGroupMembership,
        header: "保有ポイント",
        sortable: true,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cell: (row: MyGroupMembership) => totalPointsByGroup[row.group.id] ?? 0,
        cellClassName: "text-center",
      },
      {
        key: "group" as keyof MyGroupMembership,
        header: "参加人数",
        sortable: true,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cell: (row: MyGroupMembership) => `${row.group.maxParticipants}人`,
        cellClassName: "text-center",
      },
      {
        key: "group" as keyof MyGroupMembership,
        header: "KPI",
        sortable: true,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cell: (row: MyGroupMembership) => row.group.evaluationMethod,
        cellClassName: null,
      },
      {
        key: "group" as keyof MyGroupMembership,
        header: "DESCRIPTION",
        sortable: true,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cell: (row: MyGroupMembership) => row.group.goal,
        cellClassName: null,
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
      pagination: {
        totalRowCount: memberships.length,
        currentPage: 1,
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        onPageChange: () => {},
      },
      sort: {
        field: "contributionPoint",
        direction: "desc",
        onSortChange: (field: keyof MyGroupMembership) => {
          console.log(field);
        },
      },
      filter: {
        filterText: "",
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        onFilterChange: () => {},
        placeholder: "グループ名で絞り込み...",
      },
    }),
    [memberships, setMemberships, columns],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データテーブル
   */
  return <ShareTable dataTableProps={dataTableProps} />;
});
