"use client";

import type { SortDirection } from "@/types/auction-types";
import type { GroupDetailTableConditions, GroupDetailTask, User } from "@/types/group-types";
import type { TaskStatus } from "@prisma/client";
import type { UseQueryResult } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { getGroupTaskAndCount } from "@/lib/actions/task/group-detail-table";
import { deleteTask } from "@/lib/actions/task/task";
import { getAllUsers } from "@/lib/actions/user";
import { TABLE_CONSTANTS } from "@/lib/constants";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { contributionType } from "@prisma/client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループタスク用のカスタムフックの引数の型
 */
type UseGroupDetailTableProps = {
  groupId: string;
  isGroupOwner: boolean;
  isAppOwner: boolean;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループタスク用のカスタムフックの戻り値の型
 */
type UseGroupDetailTableReturn = {
  // state
  isLoading: boolean;
  tasks: GroupDetailTask[];
  users: User[];
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
 * @param isGroupOwner {boolean} グループオーナーかどうか
 * @param isAppOwner {boolean} アプリオーナーかどうか
 */
export function useGroupDetailTable({ groupId, isGroupOwner, isAppOwner }: UseGroupDetailTableProps): UseGroupDetailTableReturn {
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
   * クエリパラメータ
   */
  const searchParams = useSearchParams();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テーブル条件の取得
   */
  const getTableConditionsFromParams = useCallback((): GroupDetailTableConditions => {
    const currentPage = Number(searchParams.get("page") ?? 1);
    const currentSortField = searchParams.get("sort_field") as keyof GroupDetailTask | null;
    const currentSortDirection = searchParams.get("sort_direction") as SortDirection | null;
    const currentQuery = searchParams.get("q");
    const currentContributionType = (searchParams.get("contribution_type") ?? "ALL") as "ALL" | contributionType;
    const currentStatus = (searchParams.get("status") ?? "ALL") as TaskStatus | "ALL";
    const currentItemPerPage = Number(searchParams.get("item_per_page") ?? TABLE_CONSTANTS.ITEMS_PER_PAGE);

    return {
      sort: currentSortField && currentSortDirection ? { field: currentSortField, direction: currentSortDirection } : null,
      page: currentPage,
      isJoined: "all",
      searchQuery: currentQuery,
      contributionType: currentContributionType,
      status: currentStatus,
      itemPerPage: currentItemPerPage,
    };
  }, [searchParams]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テーブル条件の状態
   */
  const [tableConditions, setTableConditions] = useState<GroupDetailTableConditions>(getTableConditionsFromParams());

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テーブル条件の状態の更新
   */
  useEffect(() => {
    setTableConditions(getTableConditionsFromParams());
  }, [searchParams, getTableConditionsFromParams]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テーブル条件の状態の更新
   */
  const updateUrlParams = useCallback(
    (newTableConditions: GroupDetailTableConditions) => {
      const params = new URLSearchParams();

      if (newTableConditions.page > 1) params.set("page", String(newTableConditions.page));
      if (newTableConditions.sort?.field && newTableConditions.sort?.field !== "createdAt")
        params.set("sort_field", newTableConditions.sort.field as string);
      if (newTableConditions.sort?.direction && newTableConditions.sort?.direction !== "desc")
        params.set("sort_direction", newTableConditions.sort.direction);
      if (newTableConditions.searchQuery) params.set("q", newTableConditions.searchQuery);
      if (newTableConditions.contributionType && newTableConditions.contributionType !== "ALL")
        params.set("contribution_type", newTableConditions.contributionType);
      if (newTableConditions.status && newTableConditions.status !== "ALL") params.set("status", newTableConditions.status);
      if (newTableConditions.itemPerPage && newTableConditions.itemPerPage !== TABLE_CONSTANTS.ITEMS_PER_PAGE)
        params.set("item_per_page", String(newTableConditions.itemPerPage));
      const newUrl = `/dashboard/group/${groupId}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.pushState({}, "", newUrl);
    },
    [groupId],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テーブル条件の状態の更新
   */
  const changeTableConditions = useCallback(
    (newTableConditions: GroupDetailTableConditions) => {
      if (
        tableConditions.sort?.field !== newTableConditions.sort?.field ||
        tableConditions.sort?.direction !== newTableConditions.sort?.direction ||
        tableConditions.searchQuery !== newTableConditions.searchQuery ||
        tableConditions.contributionType !== newTableConditions.contributionType ||
        tableConditions.status !== newTableConditions.status ||
        tableConditions.itemPerPage !== newTableConditions.itemPerPage
      ) {
        newTableConditions.page = 1;
      }
      updateUrlParams(newTableConditions);
      setTableConditions(newTableConditions);
    },
    [updateUrlParams, tableConditions],
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
    queryKey: queryCacheKeys.tasks.byGroupIdWithConditions<GroupDetailTask>(groupId, tableConditions),
    queryFn: async (): Promise<TasksQueryResult> => {
      const { page, sort, searchQuery, contributionType: contributionTypeFilter, status: statusFilter, itemPerPage } = tableConditions;
      return await getGroupTaskAndCount({
        groupId,
        page,
        sortField: (sort?.field as string) ?? "createdAt",
        sortDirection: sort?.direction ?? "desc",
        searchQuery: searchQuery ?? "",
        contributionTypeFilter: contributionTypeFilter ?? "ALL",
        statusFilter: (statusFilter ?? "ALL") as TaskStatus | "ALL",
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
          queryKey: queryCacheKeys.tasks.byGroupIdWithConditions<GroupDetailTask>(groupId, { ...tableConditions, page: nextPage }),
          queryFn: async () =>
            await getGroupTaskAndCount({
              groupId,
              page: nextPage,
              sortField: (sort?.field as string) ?? "createdAt",
              sortDirection: sort?.direction ?? "desc",
              searchQuery: searchQuery ?? "",
              contributionTypeFilter: contributionTypeFilter ?? "ALL",
              statusFilter: (statusFilter ?? "ALL") as TaskStatus | "ALL",
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
      if (task.taskContributionType === contributionType.REWARD) {
        // 報酬タスクは、AuctionがPENDINGの場合のみ削除可能
        // 注: ここではAuction情報を持っていないため、ステータスでPENDINGかどうかを判断
        return (isGroupOwner || isReporter || isExecutor) && task.taskStatus === "PENDING";
      } else {
        // 非報酬タスクは、TaskStatusがPENDINGの場合のみ削除可能
        return (isGroupOwner || isReporter || isExecutor) && task.taskStatus === "PENDING";
      }
    },
    [isGroupOwner, userId],
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

      // アプリオーナーまたはグループオーナーの場合は編集可能
      return isAppOwner || isGroupOwner || isReporter || isExecutor;
    },
    [isAppOwner, isGroupOwner, userId],
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
