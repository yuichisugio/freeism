"use client";

import type { Column, DataTableProps } from "@/components/share/data-table";
import type { Group } from "@/types/group-types";
import { memo, useMemo } from "react";
import Link from "next/link";
import { DataTable } from "@/components/share/data-table";
import { useAllUserGroupTable } from "@/hooks/group/use-all-user-group-table";
import { UserPlus } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループのデータの型
 */
export const AllUserGroupTable = memo(function AllUserGroupTable(): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * カスタムフックを使用してグループ参加機能を実装
   */
  const {
    // state
    groups,
    tableConditions,
    isLoading,

    // function
    changeTableConditions,
    handleJoin,
  } = useAllUserGroupTable();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループリストのテーブルの列を定義
   */
  const columns: Column<Group>[] = useMemo(
    () => [
      {
        key: "id" as keyof Group,
        header: "Group操作",
        sortable: true,
        joinGroupModal: true,
        modalList: [
          {
            title: "グループに参加しますか？",
            description: "グループに参加すると、グループのメンバーとして参加できます。",
            action: async (groupId: string) => {
              handleJoin(groupId);
            },
            actionLabel: "参加する",
            triggerClassName: "button-join-custom",
            triggerContent: ["参加中", "参加"],
            triggerIcon: <UserPlus className="h-4 w-4" />,
          },
        ],
        cell: () => null,
        statusCombobox: false,
        leaveGroupModal: false,
        editTask: false,
        deleteTask: null,
        cellClassName: "text-center",
      },
      {
        key: "name" as keyof Group,
        header: "グループ名",
        statusCombobox: false,
        sortable: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        editTask: false,
        deleteTask: null,
        modalList: null,
        cell: (row: Group) => (
          <Link href={`/dashboard/group/${row.id}`} className="text-app hover:underline">
            {row.name}
          </Link>
        ),
        cellClassName: null,
      },
      {
        key: "maxParticipants" as keyof Group,
        header: "参加人数",
        statusCombobox: false,
        sortable: true,
        joinGroupModal: false,
        leaveGroupModal: false,
        editTask: false,
        deleteTask: null,
        modalList: null,
        cell: (row: Group) => `${row.joinMembersCount}人`,
        cellClassName: "text-center",
      },
      {
        key: "maxParticipants" as keyof Group,
        header: "参加可能上限数",
        statusCombobox: false,
        sortable: true,
        joinGroupModal: false,
        leaveGroupModal: false,
        editTask: false,
        deleteTask: null,
        modalList: null,
        cell: (row: Group) => `${row.maxParticipants}人`,
        cellClassName: "text-center",
      },
      {
        key: "evaluationMethod" as keyof Group,
        header: "評価方法",
        statusCombobox: false,
        sortable: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        editTask: false,
        deleteTask: null,
        modalList: null,
        cell: (row: Group) => row.evaluationMethod,
        cellClassName: null,
      },
      {
        key: "goal" as keyof Group,
        header: "グループ目標",
        statusCombobox: false,
        sortable: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        editTask: false,
        deleteTask: null,
        modalList: null,
        cell: (row: Group) => row.goal,
        cellClassName: null,
      },
      {
        key: "depositPeriod" as keyof Group,
        header: "デポジット期間",
        statusCombobox: false,
        sortable: true,
        joinGroupModal: false,
        leaveGroupModal: false,
        editTask: false,
        deleteTask: null,
        modalList: null,
        cell: (row: Group) => `${row.depositPeriod}日`,
        cellClassName: "text-center",
      },
      {
        key: "createdBy" as keyof Group,
        header: "作成者",
        statusCombobox: false,
        sortable: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        editTask: false,
        deleteTask: null,
        modalList: null,
        cell: (row: Group) => row.createdBy,
        cellClassName: null,
      },
    ],
    [handleJoin],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループリストのテーブルのプロップスを定義
   */
  const dataTableProps: DataTableProps<Group> = useMemo(
    () => ({
      initialData: groups,
      columns: columns,
      onDataChange: () => null,
      editTask: null,
    }),
    [groups, columns],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループがない場合は、グループがない旨を表示
   */
  if (groups.length === 0) {
    return <div>グループがありません</div>;
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ローディング中は、ローディング中の表示を返す
   */
  if (isLoading) {
    return <div>Loading...</div>;
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * DataTableコンポーネントを返す。
   */
  return <DataTable dataTableProps={dataTableProps} />;
});
