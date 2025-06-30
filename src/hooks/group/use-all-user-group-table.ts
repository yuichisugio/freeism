"use client";

import type { AllUserGroupTable, TableConditions } from "@/types/group-types";
import { useCallback, useEffect, useMemo } from "react";
import { getAllUserGroupsAndCount } from "@/actions/group/all-user-group";
import { joinGroup } from "@/actions/group/group";
import { TABLE_CONSTANTS } from "@/lib/constants";
import { queryCacheKeys } from "@/library-setting/tanstack-query";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useQueryState } from "nuqs";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * useAllUserGroupTableの戻り値の型
 */
type UseAllUserGroupTableReturn = {
  // state
  groups: AllUserGroupTable[];
  isLoading: boolean;
  tableConditions: TableConditions<AllUserGroupTable>;
  totalGroupCount: number;
  // function
  changeTableConditions: (tableConditions: TableConditions<AllUserGroupTable>) => void;
  handleJoin: (groupId: string) => void;
  resetFilters: () => void;
  resetSort: () => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ参加処理のためのカスタムフック
 * @returns グループ参加関連機能
 */
export function useAllUserGroupTable(): UseAllUserGroupTableReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * クエリクライアント
   */
  const queryClient = useQueryClient();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * セッション取得
   */
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "";

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * nuqsでURLパラメータを管理
   */
  const [page, setPage] = useQueryState("page", { history: "push", defaultValue: 1, parse: Number, serialize: String });
  const [sortField, setSortField] = useQueryState("sort_field", { history: "push", defaultValue: "createdAt" });
  const [sortDirection, setSortDirection] = useQueryState("sort_direction", { history: "push", defaultValue: "desc" });
  const [searchQuery, setSearchQuery] = useQueryState("q", { history: "push", clearOnDefault: true, defaultValue: "" });
  const [isJoined, setIsJoined] = useQueryState("is_joined", { history: "push", defaultValue: "all" });
  const [itemPerPage, setItemPerPage] = useQueryState("item_per_page", {
    history: "push",
    defaultValue: TABLE_CONSTANTS.ITEMS_PER_PAGE,
    parse: Number,
    serialize: String,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テーブル条件の生成
   */
  const tableConditions = useMemo(
    () => ({
      sort:
        sortField && sortDirection ? { field: sortField as keyof AllUserGroupTable, direction: sortDirection } : null,
      page,
      searchQuery,
      isJoined: isJoined as "all" | "isJoined" | "notJoined",
      itemPerPage,
    }),
    [sortField, sortDirection, page, searchQuery, isJoined, itemPerPage],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テーブルの条件を変更する関数
   */
  const changeTableConditions = useCallback(
    (newTableConditions: TableConditions<AllUserGroupTable>) => {
      void setPage(newTableConditions.page);
      void setSortField(newTableConditions.sort?.field ?? null);
      void setSortDirection(newTableConditions.sort?.direction ?? "desc");
      void setSearchQuery(newTableConditions.searchQuery ?? null);
      void setIsJoined(newTableConditions.isJoined ?? "all");
      void setItemPerPage(newTableConditions.itemPerPage ?? TABLE_CONSTANTS.ITEMS_PER_PAGE);
    },
    [setPage, setSortField, setSortDirection, setSearchQuery, setIsJoined, setItemPerPage],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データ取得
   */
  const {
    data,
    isFetching: isGroupsFetching,
    isPending: isGroupsPending,
    isPlaceholderData,
  } = useQuery({
    queryKey: queryCacheKeys.table.allGroupConditions(tableConditions, userId),
    queryFn: async () =>
      await getAllUserGroupsAndCount({
        page: tableConditions.page,
        sortField: tableConditions.sort?.field ?? "createdAt",
        sortDirection: tableConditions.sort?.direction ?? "desc",
        searchQuery: tableConditions.searchQuery ?? "",
        isJoined: tableConditions.isJoined,
        itemPerPage: tableConditions.itemPerPage,
        userId,
      }),
    placeholderData: keepPreviousData, // 前のデータを保持して、新しいデータが取得されるまで表示。Loading状態を表示しないことで、チラつきをなくす
    staleTime: 1000 * 60 * 60 * 1, // 1時間
    gcTime: 1000 * 60 * 60 * 1, // 1時間
    enabled: !!tableConditions,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 次のページをprefetch
   */
  useEffect(() => {
    // 現在のページ数
    const currentPage = tableConditions.page;

    // 総ページ数
    const totalPages = Math.ceil((data?.AllUserGroupTotalCount ?? 0) / TABLE_CONSTANTS.ITEMS_PER_PAGE);

    // データが取得されていて、かつ、現在のページ数が総ページ数より小さい場合
    if (!isPlaceholderData && data?.AllUserGroupList.length && currentPage < totalPages) {
      // 次のページ数
      const nextPage = currentPage + 1;

      // 次のページをprefetch
      void queryClient.prefetchQuery({
        queryKey: queryCacheKeys.table.allGroupConditions({ ...tableConditions, page: nextPage }, userId),
        queryFn: async () =>
          await getAllUserGroupsAndCount({
            page: nextPage,
            sortField: tableConditions.sort?.field ?? "createdAt",
            sortDirection: tableConditions.sort?.direction ?? "desc",
            searchQuery: tableConditions.searchQuery ?? "",
            isJoined: tableConditions.isJoined,
            itemPerPage: tableConditions.itemPerPage,
            userId: userId ?? "",
          }),
      });
    }
  }, [data, tableConditions, isPlaceholderData, queryClient, userId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ参加処理
   * @param groupId - 参加するグループID
   */
  const { mutate: handleJoin, isPending: isJoinLoading } = useMutation({
    mutationFn: async (groupId: string) => await joinGroup(groupId),
    onSuccess: () => {
      toast.success("グループに参加しました");
    },
    onError: () => {
      toast.error("エラーが発生しました");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryCacheKeys.table.allGroupConditions(tableConditions, userId),
      }); //TableConditionsの条件関係なしに、全てのキャッシュを無効化
      await queryClient.invalidateQueries({ queryKey: queryCacheKeys.users.joinedGroupIds(userId ?? "") });
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルターをリセットする関数
   */
  const resetFilters = useCallback(() => {
    changeTableConditions({
      ...tableConditions,
      searchQuery: null,
      isJoined: "all",
      page: 1,
    });
  }, [changeTableConditions, tableConditions]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ソートをリセットする関数
   */
  const resetSort = useCallback(() => {
    changeTableConditions({
      ...tableConditions,
      sort: { field: "createdAt" as keyof AllUserGroupTable, direction: "desc" },
      page: 1,
    });
  }, [changeTableConditions, tableConditions]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ参加関連機能
   */
  return {
    // state
    groups: data?.AllUserGroupList ?? [],
    totalGroupCount: data?.AllUserGroupTotalCount ?? 0,
    isLoading: isGroupsFetching || isJoinLoading || isGroupsPending,
    tableConditions,

    // function
    changeTableConditions,
    handleJoin,
    resetFilters,
    resetSort,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
