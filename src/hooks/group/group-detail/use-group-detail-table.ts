"use client";

import type { SortDirection } from "@/types/auction-types";
import type { GroupDetailTableConditions, GroupDetailTask, TaskParticipant } from "@/types/group-types";
import type { TaskStatus } from "@prisma/client";
import type { UseQueryResult } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { redirect, useRouter } from "next/navigation";
import { getGroupTaskAndCount } from "@/lib/actions/task/group-detail-table";
import { deleteTask } from "@/lib/actions/task/task";
import { getAllUsers } from "@/lib/actions/user";
import { TABLE_CONSTANTS } from "@/lib/constants";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { type contributionType } from "@prisma/client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useQueryState } from "nuqs";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループタスク用のカスタムフックの引数の型
 */
type UseGroupDetailTableProps = {
  groupId: string;
  isOwner: boolean;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループタスク用のカスタムフックの戻り値の型
 */
type UseGroupDetailTableReturn = {
  // state
  isLoading: boolean;
  tasks: GroupDetailTask[];
  users: TaskParticipant[];
  tableConditions: GroupDetailTableConditions;
  totalTaskCount: number;
  editingTaskId: string | null;
  isTaskEditModalOpen: boolean;

  // functions
  handleDeleteTask: (taskId: string) => Promise<void>;
  canDeleteTask: (task: GroupDetailTask) => boolean;
  canEditTask: (task: GroupDetailTask) => boolean;
  handleTaskEdited: () => void;
  openTaskEditModal: (task: GroupDetailTask) => void;
  closeTaskEditModal: () => void;
  changeTableConditions: (newTableConditions: GroupDetailTableConditions) => void;
  resetFilters: () => void;
  resetSort: () => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループタスク用のカスタムフック
 * @param groupId {string} グループID
 * @param isOwner {boolean} オーナーかどうか
 */
export function useGroupDetailTable({ groupId, isOwner }: UseGroupDetailTableProps): UseGroupDetailTableReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ルーター
   */
  const router = useRouter();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * クエリクライアント
   */
  const queryClient = useQueryClient();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * nuqsでURLパラメータを管理
   */
  const [page, setPage] = useQueryState("page", { history: "push", defaultValue: 1, parse: Number, serialize: String });
  const [sortField, setSortField] = useQueryState("sort_field", { history: "push", defaultValue: "createdAt" });
  const [sortDirection, setSortDirection] = useQueryState("sort_direction", { history: "push", defaultValue: "desc" });
  const [searchQuery, setSearchQuery] = useQueryState("q", { history: "push", clearOnDefault: true, defaultValue: "" });
  const [contributionType, setContributionType] = useQueryState("contribution_type", { history: "push", defaultValue: "ALL" });
  const [status, setStatus] = useQueryState("status", { history: "push", defaultValue: "ALL" });
  const [itemPerPage, setItemPerPage] = useQueryState("item_per_page", {
    history: "push",
    defaultValue: TABLE_CONSTANTS.ITEMS_PER_PAGE,
    parse: Number,
    serialize: String,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テーブル条件の生成
   */
  const tableConditions = useMemo(
    () => ({
      sort: sortField && sortDirection ? { field: sortField as keyof GroupDetailTask, direction: sortDirection as SortDirection } : null,
      page,
      isJoined: "all" as const,
      searchQuery,
      contributionType: contributionType as "ALL" | contributionType,
      status: status as TaskStatus | "ALL",
      itemPerPage,
    }),
    [page, sortField, sortDirection, searchQuery, contributionType, status, itemPerPage],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テーブル条件の状態の更新
   */
  const changeTableConditions = useCallback(
    (newTableConditions: GroupDetailTableConditions) => {
      void setPage(newTableConditions.page);
      void setSortField(newTableConditions.sort?.field ?? null);
      void setSortDirection(newTableConditions.sort?.direction ?? "desc");
      void setSearchQuery(newTableConditions.searchQuery ?? null);
      void setContributionType(newTableConditions.contributionType ?? "ALL");
      void setStatus(newTableConditions.status ?? "ALL");
      void setItemPerPage(newTableConditions.itemPerPage ?? 16);
    },
    [setPage, setSortField, setSortDirection, setSearchQuery, setContributionType, setStatus, setItemPerPage],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * セッションのuserIdを取得
   */
  const { data: session } = useSession();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/auth/signin");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクデータの取得
   */
  type TasksQueryResult = Awaited<ReturnType<typeof getGroupTaskAndCount>>;

  const {
    data: tasksResult,
    isPending: isLoadingTasks,
    isPlaceholderData,
  }: UseQueryResult<TasksQueryResult, Error> = useQuery({
    queryKey: queryCacheKeys.tasks.byGroupIdWithConditions<GroupDetailTask>(groupId, {
      ...tableConditions,
      searchQuery,
      itemPerPage,
    }),
    queryFn: async (): Promise<TasksQueryResult> => {
      const { page, sort, searchQuery, contributionType: contributionTypeFilter, status: statusFilter, itemPerPage } = tableConditions;
      return await getGroupTaskAndCount({
        groupId,
        page,
        sortField: (sort?.field as string) ?? "createdAt",
        sortDirection: sort?.direction ?? "desc",
        searchQuery: searchQuery ?? "",
        contributionTypeFilter: contributionTypeFilter ?? "ALL",
        statusFilter: statusFilter ?? "ALL",
        itemPerPage,
      });
    },
    enabled: !!groupId,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 30,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 次のページをprefetch
   */
  useEffect(() => {
    if (!isPlaceholderData && tasksResult?.returnTasks.length) {
      const currentPage = tableConditions.page;
      const totalPages = Math.ceil((tasksResult?.totalTaskCount ?? 0) / tableConditions.itemPerPage);
      if (currentPage < totalPages) {
        const nextPage = currentPage + 1;
        const { sort, searchQuery, contributionType: contributionTypeFilter, status: statusFilter, itemPerPage } = tableConditions;
        void queryClient.prefetchQuery<
          TasksQueryResult,
          Error,
          TasksQueryResult,
          ReturnType<typeof queryCacheKeys.tasks.byGroupIdWithConditions<GroupDetailTask>>
        >({
          queryKey: queryCacheKeys.tasks.byGroupIdWithConditions<GroupDetailTask>(groupId, {
            ...tableConditions,
            page: nextPage,
            searchQuery,
            itemPerPage,
          }),
          queryFn: async () =>
            await getGroupTaskAndCount({
              groupId,
              page: nextPage,
              sortField: (sort?.field as string) ?? "createdAt",
              sortDirection: sort?.direction ?? "desc",
              searchQuery: searchQuery ?? "",
              contributionTypeFilter: contributionTypeFilter ?? "ALL",
              statusFilter: statusFilter ?? "ALL",
              itemPerPage,
            }),
        });
      }
    }
  }, [tasksResult, tableConditions, isPlaceholderData, queryClient, groupId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーデータの取得
   */
  const { data: usersData, isPending: isLoadingUsers } = useQuery({
    queryKey: queryCacheKeys.users.all(),
    queryFn: getAllUsers,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク削除処理
   */
  const { mutateAsync: deleteTaskMutateAsync, isPending: isDeletingTask } = useMutation({
    mutationFn: deleteTask,
    onSuccess: async () => {
      toast.success("タスクを削除しました");
      // 条件関係なく、キャッシュを無効化する
      await queryClient.invalidateQueries({ queryKey: queryCacheKeys.tasks.byGroupId(groupId), exact: false });
      router.refresh();
    },
    onError: (error) => {
      console.error("タスク削除エラー:", error);
      toast.error("タスクの削除中にエラーが発生しました");
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク削除処理
   * @param taskId {string} タスクID
   */
  const handleDeleteTask = useCallback(
    async (taskId: string): Promise<void> => {
      try {
        await deleteTaskMutateAsync(taskId);
      } catch (error) {
        console.error("handleDeleteTask でエラーハンドリング:", error);
      }
    },
    [deleteTaskMutateAsync],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク削除可能かどうかの判定
   * @param task {Task} タスクデータ
   * @returns {boolean} 削除可能かどうか
   */
  const canDeleteTask = useCallback(
    (task: GroupDetailTask): boolean => {
      // 権限チェック - 報告者、実行者、グループオーナーのみ削除可能
      if (!userId) return false;

      // 報告者チェック
      const isReporter = task.taskReporterUserIds?.some((id: string) => id === userId) ?? false;

      // 実行者チェック
      const isExecutor = task.taskExecutorUserIds?.some((id: string) => id === userId) ?? false;

      // ステータスチェック
      if (task.taskContributionType === "REWARD") {
        // 報酬タスクは、AuctionがPENDINGの場合のみ削除可能
        // 注: ここではAuction情報を持っていないため、ステータスでPENDINGかどうかを判断
        return (isOwner || isReporter || isExecutor) && task.taskStatus === "PENDING";
      } else {
        // 非報酬タスクは、TaskStatusがPENDINGの場合のみ削除可能
        return (isOwner || isReporter || isExecutor) && task.taskStatus === "PENDING";
      }
    },
    [isOwner, userId],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク編集可能かどうかの判定
   * @param task {Task} タスクデータ
   * @returns {boolean} 編集可能かどうか
   */
  const canEditTask = useCallback(
    (task: GroupDetailTask): boolean => {
      // 変更不可のステータスチェック
      const immutableStatuses = ["FIXED_EVALUATED", "POINTS_AWARDED", "ARCHIVED"];
      if (immutableStatuses.includes(task.taskStatus)) {
        return false;
      }

      // 権限チェック - 報告者、実行者、アプリオーナー、グループオーナーのみ編集可能
      if (!userId) return false;

      // 報告者チェック
      const isReporter = task.taskReporterUserIds?.some((id: string) => id === userId) ?? false;

      // 実行者チェック
      const isExecutor = task.taskExecutorUserIds?.some((id: string) => id === userId) ?? false;

      // オーナーの場合は編集可能
      return isOwner || isReporter || isExecutor;
    },
    [isOwner, userId],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク編集モーダルのための状態
   */
  const [isTaskEditModalOpen, setIsTaskEditModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク編集モーダルを開く関数
   * @param task {GroupDetailTask} 編集対象のタスク
   */
  const openTaskEditModal = useCallback((task: GroupDetailTask) => {
    setEditingTaskId(task.id);
    setIsTaskEditModalOpen(true);
  }, []);

  /**
   * タスク編集モーダルを閉じる関数
   */
  const closeTaskEditModal = useCallback(() => {
    setIsTaskEditModalOpen(false);
    setEditingTaskId(null);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク編集後の更新処理
   */
  const handleTaskEdited = useCallback(() => {
    // 条件関係なく、キャッシュを無効化する
    void queryClient.invalidateQueries({ queryKey: queryCacheKeys.tasks.byGroupId(groupId), exact: false });
    toast.success("タスクデータを更新しました");
    router.refresh();
    closeTaskEditModal();
  }, [groupId, router, queryClient, closeTaskEditModal]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルターのリセット
   */
  const resetFilters = useCallback(() => {
    changeTableConditions({
      ...tableConditions,
      searchQuery: null,
      contributionType: "ALL",
      status: "ALL",
      isJoined: "all" as const,
      page: 1,
    });
  }, [changeTableConditions, tableConditions]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ソートのリセット
   */
  const resetSort = useCallback(() => {
    changeTableConditions({
      ...tableConditions,
      sort: { field: "createdAt" as keyof GroupDetailTask, direction: "desc" },
      isJoined: "all" as const,
      page: 1,
    });
  }, [changeTableConditions, tableConditions]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 戻り値
   */
  return {
    // state
    isLoading: isLoadingTasks || isLoadingUsers || isDeletingTask || isPlaceholderData,
    tasks: tasksResult?.returnTasks ?? [],
    users: usersData ?? [],
    tableConditions,
    totalTaskCount: tasksResult?.totalTaskCount ?? 0,
    editingTaskId,
    isTaskEditModalOpen,

    // functions
    handleDeleteTask,
    canDeleteTask,
    canEditTask,
    handleTaskEdited,
    openTaskEditModal,
    closeTaskEditModal,
    changeTableConditions,
    resetFilters,
    resetSort,
  };
}
