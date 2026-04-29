"use client";

import type { AllUserGroupTable, Column, DataTableProps } from "@/types/group-types";
import { memo, useMemo } from "react";
import Link from "next/link";
import { Loading } from "@/components/share/share-loading";
import { ShareTable } from "@/components/share/table/share-table";
import { useAllUserGroupTable } from "@/hooks/group/use-all-user-group-table";
import { UserPlus } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループのデータの型
 */
export const AllUserGroupTableComponent = memo(function AllUserGroupTableComponent(): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * カスタムフックを使用してグループ参加機能を実装
   */
  const {
    // state
    groups,
    tableConditions,
    isLoading,
    totalGroupCount,

    // function
    changeTableConditions,
    handleJoin,
    resetFilters,
    resetSort,
  } = useAllUserGroupTable();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループリストのテーブルの列を定義
   */
  const columns: Column<AllUserGroupTable>[] = useMemo(
    () => [
      {
        key: "isJoined" as keyof AllUserGroupTable,
        header: "参加Flag",
        sortable: false,
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
        cellClassName: null,
      },
      {
        key: "name" as keyof AllUserGroupTable,
        header: "グループ名",
        statusCombobox: false,
        sortable: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        editTask: false,
        deleteTask: null,
        modalList: null,
        cell: (row: AllUserGroupTable) => (
          <Link href={`/dashboard/group/${row.id}`} className="text-app hover:underline">
            {row.name}
          </Link>
        ),
        cellClassName: null,
      },
      {
        key: "currentParticipants" as keyof AllUserGroupTable,
        header: "参加人数",
        statusCombobox: false,
        sortable: true,
        joinGroupModal: false,
        leaveGroupModal: false,
        editTask: false,
        deleteTask: null,
        modalList: null,
        cell: (row: AllUserGroupTable) => `${row.joinMembersCount}人`,
        cellClassName: "text-center",
      },
      {
        key: "maxParticipants" as keyof AllUserGroupTable,
        header: "参加可能上限数",
        statusCombobox: false,
        sortable: true,
        joinGroupModal: false,
        leaveGroupModal: false,
        editTask: false,
        deleteTask: null,
        modalList: null,
        cell: (row: AllUserGroupTable) => `${row.maxParticipants}人`,
        cellClassName: "text-center",
      },
      {
        key: "evaluationMethod" as keyof AllUserGroupTable,
        header: "評価方法",
        statusCombobox: false,
        sortable: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        editTask: false,
        deleteTask: null,
        modalList: null,
        cell: (row: AllUserGroupTable) => row.evaluationMethod,
        cellClassName: null,
      },
      {
        key: "goal" as keyof AllUserGroupTable,
        header: "グループ目標",
        statusCombobox: false,
        sortable: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        editTask: false,
        deleteTask: null,
        modalList: null,
        cell: (row: AllUserGroupTable) => row.goal,
        cellClassName: null,
      },
      {
        key: "depositPeriod" as keyof AllUserGroupTable,
        header: "デポジット期間",
        statusCombobox: false,
        sortable: true,
        joinGroupModal: false,
        leaveGroupModal: false,
        editTask: false,
        deleteTask: null,
        modalList: null,
        cell: (row: AllUserGroupTable) => `${row.depositPeriod}日`,
        cellClassName: "text-center",
      },
      {
        key: "createdBy" as keyof AllUserGroupTable,
        header: "作成者",
        statusCombobox: false,
        sortable: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        editTask: false,
        deleteTask: null,
        modalList: null,
        cell: (row: AllUserGroupTable) => row.createdBy,
        cellClassName: null,
      },
    ],
    [handleJoin],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループリストのテーブルのプロップスを定義
   */
  const dataTableProps: DataTableProps<AllUserGroupTable> = useMemo(
    () => ({
      initialData: groups,
      columns: columns,
      onDataChange: () => null,
      editTask: null,
      pagination: {
        totalRowCount: totalGroupCount,
        currentPage: tableConditions.page,
        onPageChange: (page: number) => changeTableConditions({ ...tableConditions, page }),
        itemPerPage: tableConditions.itemPerPage,
        onItemPerPageChange: (itemPerPage: number) => changeTableConditions({ ...tableConditions, itemPerPage }),
      },
      sort: {
        onSortChange: (field: keyof AllUserGroupTable) =>
          changeTableConditions({
            ...tableConditions,
            sort: { field, direction: tableConditions.sort?.direction === "asc" ? "desc" : "asc" },
          }),
        sortDirection: tableConditions.sort?.direction ?? "desc",
        sortField: tableConditions.sort?.field ?? ("isJoined" as keyof AllUserGroupTable),
      },
      filter: {
        filterContents: [
          {
            filterType: "input",
            filterText: tableConditions.searchQuery ?? "",
            onFilterChange: (value: string) => changeTableConditions({ ...tableConditions, searchQuery: value }),
            placeholder: "グループ名で絞り込み...",
            radioOptions: null,
          },
          {
            filterType: "radio",
            filterText: tableConditions.isJoined,
            onFilterChange: (value: string) =>
              changeTableConditions({ ...tableConditions, isJoined: value as "isJoined" | "notJoined" | "all" }),
            placeholder: "グループ参加状態で絞り込み...",
            radioOptions: [
              { value: "isJoined", label: "グループ参加中" },
              { value: "notJoined", label: "グループ未参加" },
              { value: "all", label: "全て" },
            ],
          },
        ],
        onResetFilters: resetFilters,
        onResetSort: resetSort,
      },
    }),
    [groups, columns, totalGroupCount, tableConditions, changeTableConditions, resetFilters, resetSort],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ローディング中は、ローディング中の表示を返す
   * groups.length === 0より先に記載して、Loading中ならLoading中の表示を返す
   * コンポーネントを直接表示せず、オーバーレイで上に表示する理由
   * -コンポーネントにすると、ShareTableと置き換えるため、fullScreenの状態維持のrefが削除されて、sort/filterのたびに、fullScreenの状態が解除されてしまうため
   * -オーバーレイで上に表示することで、ShareTableと置き換えずに済む
   */
  const loadingOverlay = isLoading ? (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm">
      <Loading />
    </div>
  ) : null;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * DataTableコンポーネントを返す。
   */
  return (
    <>
      {loadingOverlay}
      <ShareTable dataTableProps={dataTableProps} />
    </>
  );
});
