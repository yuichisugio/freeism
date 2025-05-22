"use client";

import type { SortDirection } from "@/types/auction-types";
import type { MyGroupTable, TableConditions } from "@/types/group-types";
import { useCallback, useEffect, useMemo } from "react";
import { getUserJoinGroupAndCount, leaveGroup } from "@/lib/actions/group/my-group";
import { TABLE_CONSTANTS } from "@/lib/constants";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * useMyGroupTableの戻り値の型
 */
type UseMyGroupTableReturn = {
  // state
  groups: MyGroupTable[];
  isLoading: boolean;
  tableConditions: TableConditions<MyGroupTable>;
  totalGroupCount: number;
  // function
  changeTableConditions: (newTableConditions: TableConditions<MyGroupTable>) => void;
  handleLeave: (groupId: string) => void;
  resetFilters: () => void;
  resetSort: () => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * マイグループテーブルのためのカスタムフック
 * @returns マイグループテーブル関連機能
 */
export function useMyGroupTable(): UseMyGroupTableReturn {
  /**
   * クエリクライアント
   */
  const queryClient = useQueryClient();

  // nuqsでURLパラメータを管理
  const [page, setPage] = useQueryState("page", { history: "push", defaultValue: 1, parse: Number, serialize: String });
  const [sortField, setSortField] = useQueryState("sort_field", { history: "push", defaultValue: "createdAt" });
  const [sortDirection, setSortDirection] = useQueryState("sort_direction", { history: "push", defaultValue: "desc" });
  const [searchQuery, setSearchQuery] = useQueryState("q", { history: "push" });
  const [itemPerPage, setItemPerPage] = useQueryState("item_per_page", {
    history: "push",
    defaultValue: TABLE_CONSTANTS.ITEMS_PER_PAGE,
    parse: Number,
    serialize: String,
  });

  // tableConditionsをuseMemoで生成
  const tableConditions = useMemo(
    () => ({
      sort: sortField && sortDirection ? { field: sortField as keyof MyGroupTable, direction: sortDirection as SortDirection } : null,
      page,
      searchQuery,
      itemPerPage,
      isJoined: "all" as const,
    }),
    [page, sortField, sortDirection, searchQuery, itemPerPage],
  );

  // changeTableConditionsでset関数を呼ぶ
  const changeTableConditions = useCallback(
    (newTableConditions: TableConditions<MyGroupTable>) => {
      void setPage(newTableConditions.page);
      void setSortField(newTableConditions.sort?.field ?? null);
      void setSortDirection(newTableConditions.sort?.direction ?? "desc");
      void setSearchQuery(newTableConditions.searchQuery ?? null);
      void setItemPerPage(newTableConditions.itemPerPage ?? 10);
    },
    [setPage, setSortField, setSortDirection, setSearchQuery, setItemPerPage],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データ取得
   */
  const { data, isFetching, isPending, isPlaceholderData } = useQuery({
    queryKey: queryCacheKeys.table.myGroupConditions(tableConditions),
    queryFn: async () =>
      await getUserJoinGroupAndCount({
        page: tableConditions.page,
        sortField: tableConditions.sort?.field ?? "createdAt",
        sortDirection: tableConditions.sort?.direction ?? "desc",
        searchQuery: tableConditions.searchQuery ?? "",
        itemPerPage: tableConditions.itemPerPage,
      }),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 60 * 1, // 1 hour
    enabled: !!tableConditions,
  });

  /// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  useEffect(() => {
    // 現在のページ数
    const currentPage = tableConditions.page;
    // 総ページ数
    const totalPages = Math.ceil((data?.userJoinGroupTotalCount ?? 0) / tableConditions.itemPerPage);

    // データが取得されていて、かつ、現在のページ数が総ページ数より小さい場合
    if (!isPlaceholderData && data?.returnUserJoinGroupList.length && currentPage < totalPages) {
      // 次のページ数
      const nextPage = currentPage + 1;

      // 次のページをprefetch
      void queryClient.prefetchQuery({
        queryKey: queryCacheKeys.table.myGroupConditions({ ...tableConditions, page: nextPage }),
        queryFn: async () =>
          await getUserJoinGroupAndCount({
            page: nextPage,
            sortField: tableConditions.sort?.field ?? "createdAt",
            sortDirection: tableConditions.sort?.direction ?? "desc",
            searchQuery: tableConditions.searchQuery ?? "",
            itemPerPage: tableConditions.itemPerPage,
          }),
      });
    }
  }, [data, tableConditions, isPlaceholderData, queryClient]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループから脱退する
   */
  const { mutate: leaveGroupMutation, isPending: isLeaveLoading } = useMutation({
    mutationFn: async (groupId: string) => await leaveGroup(groupId),
    onSuccess: () => {
      toast.success("グループから脱退しました");
    },
    onError: () => {
      toast.error("エラーが発生しました");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryCacheKeys.table.myGroupConditions(tableConditions) });
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルターをリセットする関数
   */
  const resetFilters = useCallback(() => {
    changeTableConditions({
      ...tableConditions,
      searchQuery: null,
      page: 1,
      isJoined: "all" as const,
    });
  }, [changeTableConditions, tableConditions]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ソートをリセットする関数
   */
  const resetSort = useCallback(() => {
    changeTableConditions({
      ...tableConditions,
      sort: null,
      page: 1,
      isJoined: "all" as const,
    });
  }, [changeTableConditions, tableConditions]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * マイグループテーブル関連機能
   */
  return {
    // state
    groups: data?.returnUserJoinGroupList ?? [],
    totalGroupCount: data?.userJoinGroupTotalCount ?? 0,
    isLoading: isFetching || isPending || isLeaveLoading,
    tableConditions,
    // function
    changeTableConditions,
    handleLeave: leaveGroupMutation,
    resetFilters,
    resetSort,
  };
}
