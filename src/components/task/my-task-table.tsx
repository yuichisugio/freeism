"use client";

import type { Column, DataTableProps, MyTaskTable } from "@/types/group-types";
import type { TaskStatus } from "@prisma/client";
import { memo, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loading } from "@/components/share/loading";
import { ShareTable } from "@/components/share/share-table";
import { Button } from "@/components/ui/button";
import { useMyTaskTable } from "@/hooks/task/use-my-task-table";
import { contributionType } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * マイタスクテーブルコンポーネント
 */
export const MyTaskTableComponent = memo(function MyTaskTableComponent(): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ルーター
   */
  const router = useRouter();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * マイタスクテーブルの状態
   */
  const {
    // state
    tasks,
    tableConditions,
    totalTaskCount,
    editingTaskId,
    isTaskEditModalOpen,
    isLoading,

    // functions
    canEditTask,
    handleTaskEdited,
    canDeleteTask,
    handleDeleteTask,
    openTaskEditModal,
    closeTaskEditModal,
    changeTableConditions,
    resetFilters,
    resetSort,
  } = useMyTaskTable();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テーブルのカラム
   */
  const columns: Column<MyTaskTable>[] = useMemo<Column<MyTaskTable>[]>(
    () => [
      {
        key: "groupName" as keyof MyTaskTable,
        header: "GROUP名",
        sortable: false,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cell: (row) => (
          <Link href={`/dashboard/group/${row.groupId}`} className="text-app hover:underline">
            {row.groupName}
          </Link>
        ),
        cellClassName: null,
      },
      {
        key: "taskName" as keyof MyTaskTable,
        header: "タスク名",
        sortable: false,
        cell: (row) => row.taskName,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "taskDetail" as keyof MyTaskTable,
        header: "タスク詳細",
        sortable: false,
        cell: (row) => row.taskDetail ?? "-",
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "taskReporterUserNames" as keyof MyTaskTable,
        header: "報告者",
        sortable: false,
        cell: (row) => row.taskReporterUserNames ?? "未設定",
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "taskExecutorUserNames" as keyof MyTaskTable,
        header: "実行者",
        sortable: false,
        cell: (row) => row.taskExecutorUserNames ?? "未設定",
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "taskFixedContributionPoint" as keyof MyTaskTable,
        header: "貢献度",
        sortable: true,
        cell: (row) => (row.taskFixedContributionPoint ? `${row.taskFixedContributionPoint}p` : "評価待ち"),
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: "text-center",
      },
      {
        key: "taskFixedEvaluator" as keyof MyTaskTable,
        header: "算出者",
        sortable: false,
        cell: (row) => row.taskFixedEvaluator ?? "未設定",
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "taskFixedEvaluationLogic" as keyof MyTaskTable,
        header: "算出ロジック",
        sortable: false,
        cell: (row) => row.taskFixedEvaluationLogic ?? "-",
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "taskStatus" as keyof MyTaskTable,
        header: "ステータス",
        statusCombobox: true,
        cell: () => null,
        sortable: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "id" as keyof MyTaskTable,
        header: "アクション",
        cell: () => null,
        sortable: false,
        editTask: true,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        cellClassName: null,
      },
      {
        key: "auctionId" as keyof MyTaskTable,
        header: "オークション",
        cell: (row: MyTaskTable) => {
          if (row.auctionId) {
            return (
              <Button onClick={() => router.push(`/dashboard/auction/${row.auctionId}`)} className="button-default-custom" size="sm">
                {row.auctionId}
              </Button>
            );
          }
          return "-";
        },
        sortable: false,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: "text-center",
      },
      {
        key: "id" as keyof MyTaskTable,
        header: "編集",
        cell: () => null,
        sortable: false,
        statusCombobox: false,
        editTask: true,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "delete" as keyof MyTaskTable,
        header: "削除",
        cell: () => null,
        sortable: false,
        statusCombobox: false,
        editTask: false,
        deleteTask: {
          canDelete: (row: MyTaskTable) => canDeleteTask(row),
          onDelete: async (rowId: string) => await handleDeleteTask(rowId),
        },
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        cellClassName: null,
      },
      {
        key: "detail" as keyof MyTaskTable,
        header: "詳細",
        cell: (row: MyTaskTable) => row.taskDetail ?? "-",
        sortable: false,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
    ],
    [canDeleteTask, handleDeleteTask, router],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テーブルのプロパティ
   */
  const dataTableProps: DataTableProps<MyTaskTable> = {
    initialData: tasks,
    columns: columns,
    onDataChange: () => null,
    editTask: {
      canEdit: canEditTask,
      onEdit: openTaskEditModal,
      editingTaskId: editingTaskId,
      isTaskEditModalOpen: isTaskEditModalOpen,
      onCloseTaskEditModal: closeTaskEditModal,
      onTaskEdited: handleTaskEdited,
    },
    pagination: {
      totalRowCount: totalTaskCount,
      currentPage: tableConditions.page,
      onPageChange: (page: number) => {
        changeTableConditions({ ...tableConditions, page: page });
      },
      itemPerPage: tableConditions.itemPerPage,
      onItemPerPageChange: (itemPerPage: number) => {
        changeTableConditions({ ...tableConditions, itemPerPage: itemPerPage });
      },
    },
    sort: {
      onSortChange: (field: keyof MyTaskTable) => {
        changeTableConditions({ ...tableConditions, sort: { field: field, direction: tableConditions.sort?.direction === "asc" ? "desc" : "asc" } });
      },
      sortDirection: tableConditions.sort?.direction ?? "desc",
      sortField: tableConditions.sort?.field ?? "id",
    },
    filter: {
      filterContents: [
        {
          filterType: "input",
          filterText: tableConditions.searchQuery ?? "",
          onFilterChange: (value: string) => changeTableConditions({ ...tableConditions, searchQuery: value }),
          placeholder: "タスク名で絞り込み...",
          radioOptions: null,
        },
        {
          filterType: "radio",
          filterText: tableConditions.contributionType ?? "ALL",
          onFilterChange: (value: string) => changeTableConditions({ ...tableConditions, contributionType: value as "ALL" | contributionType }),
          placeholder: "タスクタイプで絞り込み...",
          radioOptions: [
            { value: "ALL", label: "全て" },
            { value: contributionType.NON_REWARD, label: "通常タスク" },
            { value: contributionType.REWARD, label: "報酬タスク" },
          ],
        },
        {
          filterType: "radio",
          filterText: tableConditions.taskStatus ?? "ALL",
          onFilterChange: (value: string) => changeTableConditions({ ...tableConditions, taskStatus: value as "ALL" | TaskStatus }),
          placeholder: "ステータスで絞り込み...",
          radioOptions: [
            { value: "ALL", label: "全て" },
            { value: "PENDING", label: "ペンディング" },
            { value: "POINTS_DEPOSITED", label: "ポイントデポジット済" },
            { value: "TASK_COMPLETED", label: "タスク完了" },
            { value: "FIXED_EVALUATED", label: "評価確定" },
            { value: "POINTS_AWARDED", label: "ポイント付与済" },
            { value: "ARCHIVED", label: "アーカイブ済" },
          ],
        },
      ],
      onResetFilters: resetFilters,
      onResetSort: resetSort,
    },
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ローディング中は、ローディング中の表示を返す
   */
  const loadingOverlay = isLoading ? (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm">
      <Loading />
    </div>
  ) : null;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクテーブルを表示
   */
  return (
    <>
      {loadingOverlay}
      <ShareTable dataTableProps={dataTableProps} />
    </>
  );
});
