"use client";

import type { Column, DataTableProps, GroupDetailTask } from "@/types/group-types";
import type { TaskStatus } from "@prisma/client";
import { memo, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loading } from "@/components/share/loading";
import { ShareTable } from "@/components/share/share-table";
import { Button } from "@/components/ui/button";
import { useGroupDetailTable } from "@/hooks/group/group-detail/use-group-detail-table";
import { contributionType } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ詳細ページのコンポーネントのprops
 * useGroupTasksフックから必要なものを渡すため、propsはシンプルに
 */
type GroupDetailTableProps = {
  groupId: string;
  isGroupOwner: boolean;
  isAppOwner: boolean;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ詳細ページのコンポーネント
 * @param tasks {Task[]} タスクデータ
 * @returns {JSX.Element} グループ詳細ページのコンポーネント
 */
export const GroupDetailTable = memo(function GroupDetailTable({ groupId, isGroupOwner, isAppOwner }: GroupDetailTableProps): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ルーター
   */
  const router = useRouter();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクデータ
   */
  const {
    // state
    tasks,
    isLoading,
    tableConditions,
    totalTaskCount,
    editingTaskId,
    isTaskEditModalOpen,

    // functions
    canDeleteTask,
    handleDeleteTask,
    canEditTask,
    handleTaskEdited,
    openTaskEditModal,
    closeTaskEditModal,
    changeTableConditions,
    resetFilters,
    resetSort,
  } = useGroupDetailTable({ groupId, isGroupOwner, isAppOwner });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクテーブルのカラム
   */
  const columns: Column<GroupDetailTask>[] = useMemo(
    () => [
      {
        key: "taskName" as keyof GroupDetailTask,
        header: "タスク名",
        cell: (row: GroupDetailTask) => row.taskName ?? "不明",
        sortable: false,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "taskCreator" as keyof GroupDetailTask,
        header: "作成者",
        cell: (row: GroupDetailTask) => row.taskCreator ?? "-",
        sortable: false,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "reporters" as keyof GroupDetailTask,
        header: "報告者",
        cell: (row: GroupDetailTask) => row.taskReporterUserNames,
        sortable: false,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "executors" as keyof GroupDetailTask,
        header: "実行者",
        cell: (row: GroupDetailTask) => row.taskExecutorUserNames,
        sortable: false,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "taskFixedContributionPoint" as keyof GroupDetailTask,
        header: "貢献P / 入札額",
        cell: (row: GroupDetailTask) => {
          if (row.taskContributionType === contributionType.REWARD) {
            return `${row.taskFixedContributionPoint ?? 0}p`;
          }
          return row.taskFixedContributionPoint ? `${row.taskFixedContributionPoint}p` : "評価待ち";
        },
        sortable: true,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: "text-center",
      },
      {
        key: "taskStatus" as keyof GroupDetailTask,
        header: "ステータス",
        cell: (row: GroupDetailTask) => row.taskStatus,
        sortable: false,
        statusCombobox: true,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "auction" as keyof GroupDetailTask,
        header: "オークション",
        cell: (row: GroupDetailTask) => {
          if (row.auctionId) {
            return (
              <Button onClick={() => router.push(`/dashboard/auction/${row.auctionId}`)} className="button-default-custom" size="sm">
                オークションに参加
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
        key: "action" as keyof GroupDetailTask,
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
        key: "delete" as keyof GroupDetailTask,
        header: "削除",
        cell: () => null,
        sortable: false,
        statusCombobox: false,
        editTask: false,
        deleteTask: {
          canDelete: (row: GroupDetailTask) => canDeleteTask(row),
          onDelete: async (rowId: string) => await handleDeleteTask(rowId),
        },
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        cellClassName: null,
      },
      {
        key: "detail" as keyof GroupDetailTask,
        header: "詳細",
        cell: (row: GroupDetailTask) => row.taskDetail ?? "-",
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
    [router, canDeleteTask, handleDeleteTask],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * DataTableコンポーネントのpropsを設定
   */
  const taskDataTableProps: DataTableProps<GroupDetailTask> = useMemo(
    () => ({
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
        onPageChange: (page: number) => changeTableConditions({ ...tableConditions, page }),
        itemPerPage: tableConditions.itemPerPage,
        onItemPerPageChange: (itemPerPage: number) => changeTableConditions({ ...tableConditions, itemPerPage }),
      },
      sort: {
        onSortChange: (field: keyof GroupDetailTask) =>
          changeTableConditions({
            ...tableConditions,
            sort: { field, direction: tableConditions.sort?.direction === "asc" ? "desc" : "asc" },
          }),
        sortDirection: tableConditions.sort?.direction ?? "desc",
        sortField: tableConditions.sort?.field ?? ("createdAt" as keyof GroupDetailTask),
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
            filterText: tableConditions.status ?? "ALL",
            onFilterChange: (value: string) => changeTableConditions({ ...tableConditions, status: value as "ALL" | TaskStatus }),
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
    }),
    [
      tasks,
      columns,
      totalTaskCount,
      tableConditions,
      changeTableConditions,
      resetFilters,
      resetSort,
      canEditTask,
      openTaskEditModal,
      editingTaskId,
      isTaskEditModalOpen,
      closeTaskEditModal,
      handleTaskEdited,
    ],
  );

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
   * タスクテーブルの表示
   */
  return (
    <>
      <div className="mb-4 flex items-center">
        <h2 className="text-xl font-semibold text-gray-900">タスク一覧</h2>
      </div>
      {loadingOverlay}
      <ShareTable dataTableProps={taskDataTableProps} />
    </>
  );
});
