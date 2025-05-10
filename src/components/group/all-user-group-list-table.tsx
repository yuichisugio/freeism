"use client";

import type { BaseRecord, Column, DataTableProps } from "@/components/share/data-table";
import { memo, useMemo } from "react";
import Link from "next/link";
import { DataTable } from "@/components/share/data-table";
import { useGroupJoiner } from "@/hooks/group/use-all-user-group-list";
import { type Group } from "@/types/group-types";
import { UserPlus } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループのデータの型
 */
export const AllUserGroupListTable = memo(function AllUserGroupListTable(): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * カスタムフックを使用してグループ参加機能を実装
   */
  const { groups, setGroups, handleJoin } = useGroupJoiner();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループリストのテーブルの列を定義
   */
  const columns: Column<Group>[] = useMemo(
    () => [
      {
        key: "id" as keyof Group,
        header: "Group操作",
        cell: () => null,
        className: null,
        statusCombobox: false,
        sortable: true,
        joinGroupModal: true,
        leaveGroupModal: false,
        editTask: false,
        deleteTask: null,
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
        header: "グループ名",
        className: null,
        statusCombobox: false,
        sortable: true,
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
      },
      {
        key: "maxParticipants" as keyof Group,
        header: "参加人数",
        className: null,
        statusCombobox: false,
        sortable: true,
        joinGroupModal: false,
        leaveGroupModal: false,
        editTask: false,
        deleteTask: null,
        modalList: null,
        cell: (row: Group) => `${row.joinMembersCount}人`,
      },
      {
        key: "maxParticipants" as keyof Group,
        header: "参加可能上限数",
        className: null,
        statusCombobox: false,
        sortable: true,
        joinGroupModal: false,
        leaveGroupModal: false,
        editTask: false,
        deleteTask: null,
        modalList: null,
        cell: (row: Group) => `${row.maxParticipants}人`,
      },
      {
        key: "evaluationMethod" as keyof Group,
        header: "評価方法",
        className: null,
        statusCombobox: false,
        sortable: true,
        joinGroupModal: false,
        leaveGroupModal: false,
        editTask: false,
        deleteTask: null,
        modalList: null,
        cell: (row: Group) => row.evaluationMethod,
      },
      {
        key: "goal" as keyof Group,
        header: "グループ目標",
        className: null,
        statusCombobox: false,
        sortable: true,
        joinGroupModal: false,
        leaveGroupModal: false,
        editTask: false,
        deleteTask: null,
        modalList: null,
        cell: (row: Group) => row.goal,
      },
      {
        key: "depositPeriod" as keyof Group,
        header: "デポジット期間",
        className: null,
        statusCombobox: false,
        sortable: true,
        joinGroupModal: false,
        leaveGroupModal: false,
        editTask: false,
        deleteTask: null,
        modalList: null,
        cell: (row: Group) => `${row.depositPeriod}日`,
      },
      {
        key: "createdBy" as keyof Group,
        header: "作成者",
        className: null,
        statusCombobox: false,
        sortable: true,
        joinGroupModal: false,
        leaveGroupModal: false,
        editTask: false,
        deleteTask: null,
        modalList: null,
        cell: (row: Group) => row.createdBy,
      },
    ],
    [handleJoin],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループリストのテーブルのプロップスを定義
   */
  const dataTableProps: DataTableProps<BaseRecord> = useMemo(
    () => ({
      initialData: groups as unknown as BaseRecord[],
      columns: columns as unknown as Column<BaseRecord>[],
      pagination: true,
      onDataChange: (data) => setGroups(data as unknown as Group[]),
    }),
    [groups, setGroups, columns],
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
   * DataTableコンポーネントを返す。
   * onDataChangeは、データが更新されたときに呼び出される関数で、DataTable内でデータ更新したらsetGroupsをDataTable内で呼び出し、↑のgroupsのStateを使用している部分も更新できるようにする。
   */
  return <DataTable dataTableProps={dataTableProps} />;
});
