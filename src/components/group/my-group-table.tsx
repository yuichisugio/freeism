"use client";

import type { Column, DataTableProps, MyGroupTable } from "@/types/group-types";
import { memo, useMemo } from "react";
import Link from "next/link";
import { Loading } from "@/components/share/loading";
import { ShareTable } from "@/components/share/share-table";
import { useMyGroupTable } from "@/hooks/group/use-my-group-table";
import { LogOut } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * マイグループテーブル
 * @returns マイグループテーブル
 */
export const MyGroupTableComponent = memo(function MyGroupTableComponent(): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * カスタムフックを使用してマイグループテーブルの機能を取得
   */
  const {
    // state
    groups,
    tableConditions,
    isLoading,
    totalGroupCount,

    // function
    changeTableConditions,
    handleLeave,
    resetFilters,
    resetSort,
  } = useMyGroupTable();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループテーブルの列
   */
  const columns: Column<MyGroupTable>[] = useMemo(
    () => [
      {
        key: "groupId" as keyof MyGroupTable,
        header: "脱退",
        cell: () => null,
        sortable: false,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: true,
        modalList: [
          {
            title: "グループから脱退しますか？",
            description: "グループから脱退すると、再度参加するまでグループの活動に参加できなくなります。",
            action: async (rowId: string) => {
              const group = groups.find((g) => g.id === rowId);
              if (group) {
                handleLeave(group.id);
              }
            },
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
        key: "groupName" as keyof MyGroupTable,
        header: "グループ名",
        statusCombobox: false,
        sortable: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cell: (row: MyGroupTable) => (
          <Link href={`/dashboard/group/${row.id}`} className="text-app hover:underline">
            {row.groupName}
          </Link>
        ),
        cellClassName: null,
      },
      {
        key: "groupDepositPeriod" as keyof MyGroupTable,
        header: "デポジット期間",
        sortable: true,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cell: (row: MyGroupTable) => `${row.groupDepositPeriod}日`,
        cellClassName: "text-center",
      },
      {
        key: "groupEvaluationMethod" as keyof MyGroupTable,
        header: "評価方法",
        sortable: false,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cell: (row: MyGroupTable) => row.groupEvaluationMethod,
        cellClassName: null,
      },
      {
        key: "groupPointFixedTotalPoints" as keyof MyGroupTable,
        header: "保有ポイント",
        sortable: true,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cell: (row: MyGroupTable) => row.groupPointFixedTotalPoints,
        cellClassName: "text-center",
      },
      {
        key: "groupPointBalance" as keyof MyGroupTable,
        header: "ポイント残高",
        sortable: true,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cell: (row: MyGroupTable) => row.groupPointBalance,
        cellClassName: "text-center",
      },
      {
        key: "groupGoal" as keyof MyGroupTable,
        header: "グループ目標",
        sortable: false,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cell: (row: MyGroupTable) => row.groupGoal,
        cellClassName: null,
      },
      {
        key: "isGroupOwner" as keyof MyGroupTable,
        header: "オーナー",
        sortable: false,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cell: (row: MyGroupTable) => (row.isGroupOwner ? "オーナー" : "メンバー"),
        cellClassName: "text-center",
      },
    ],
    [handleLeave, groups],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データテーブルのプロパティ
   */
  const dataTableProps: DataTableProps<MyGroupTable> = useMemo(
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
        onItemPerPageChange: (itemPerPage: number) => changeTableConditions({ ...tableConditions, itemPerPage, page: 1 }),
      },
      sort: {
        onSortChange: (field) =>
          changeTableConditions({
            ...tableConditions,
            sort: { field: field, direction: tableConditions.sort?.direction === "asc" ? "desc" : "asc" },
          }),
        sortDirection: tableConditions.sort?.direction ?? "desc",
        sortField: tableConditions.sort?.field ?? "groupName",
      },
      filter: {
        filterContents: [
          {
            filterType: "input",
            filterText: tableConditions.searchQuery ?? "",
            onFilterChange: (value: string) => changeTableConditions({ ...tableConditions, searchQuery: value, page: 1 }),
            placeholder: "グループ名で絞り込み...",
            radioOptions: null,
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
   * データテーブル
   */
  return (
    <>
      {loadingOverlay}
      <ShareTable dataTableProps={dataTableProps} />
    </>
  );
});
