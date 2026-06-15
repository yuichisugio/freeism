"use client";

import type { MyGroupTable, TableConditions } from "@/types/group-types";
import { useCallback, useEffect, useMemo } from "react";
import { getUserJoinGroup, getUserJoinGroupCount, leaveGroup } from "@/actions/group/my-group";
import { TABLE_CONSTANTS } from "@/lib/constants";
import { queryCacheKeys } from "@/library-setting/tanstack-query";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useQueryState } from "nuqs";

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
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * セッション取得
   */
  const { data: session } = useSession();
  const userId = session?.user?.id;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * クエリクライアント
   */
  const queryClient = useQueryClient();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * nuqsでURLパラメータを管理
   */
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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * tableConditionsをuseMemoで生成
   */
  const tableConditions = useMemo(
    () => ({
      sort: sortField && sortDirection ? { field: sortField as keyof MyGroupTable, direction: sortDirection } : null,
      page,
      searchQuery,
      itemPerPage,
      isJoined: "all" as const,
    }),
    [page, sortField, sortDirection, searchQuery, itemPerPage],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * changeTableConditionsでset関数を呼ぶ
   */
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
  const { data, isPending: isUserJoinGroupPending } = useQuery({
    queryKey: queryCacheKeys.table.myGroupConditions({ ...tableConditions }, userId ?? ""),
    queryFn: async () =>
      await getUserJoinGroup({
        userId: userId ?? "",
        page: tableConditions.page,
        sortField: tableConditions.sort?.field ?? "createdAt",
        sortDirection: tableConditions.sort?.direction ?? "desc",
        searchQuery: tableConditions.searchQuery ?? "",
        itemPerPage: tableConditions.itemPerPage,
      }),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 60 * 1, // 1 hour
    enabled: !!tableConditions && !!userId,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーが参加しているグループ数を取得
   * 件数とデータを別々に取得することで、ページを跨ぐごとに件数を取得しないので、サーバー負荷を少なくする
   */
  const { data: userJoinGroupCount, isPending: isUserJoinGroupCountPending } = useQuery({
    queryKey: queryCacheKeys.table.myGroupCount(tableConditions.searchQuery ?? "", userId ?? ""),
    queryFn: async () => await getUserJoinGroupCount(tableConditions.searchQuery ?? "", userId ?? ""),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 60 * 1, // 1 hour
    enabled: !!tableConditions && !!userId,
  });

  /// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  useEffect(() => {
    // 現在のページ数
    const currentPage = tableConditions.page;
    // 総ページ数
    const totalPages = Math.ceil((userJoinGroupCount?.data ?? 0) / tableConditions.itemPerPage);

    // データが取得されていて、かつ、現在のページ数が総ページ数より小さい場合
    if (!isUserJoinGroupCountPending && userJoinGroupCount && currentPage < totalPages) {
      // 次のページ数
      const nextPage = currentPage + 1;

      // 次のページをprefetch
      void queryClient.prefetchQuery({
        queryKey: queryCacheKeys.table.myGroupConditions({ ...tableConditions, page: nextPage }, userId ?? ""),
        queryFn: async () =>
          await getUserJoinGroup({
            userId: userId ?? "",
            page: nextPage,
            sortField: tableConditions.sort?.field ?? "createdAt",
            sortDirection: tableConditions.sort?.direction ?? "desc",
            searchQuery: tableConditions.searchQuery ?? "",
            itemPerPage: tableConditions.itemPerPage,
          }),
      });
    }
  }, [tableConditions, isUserJoinGroupCountPending, userJoinGroupCount, queryClient, userId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループから脱退する
   */
  const { mutate: leaveGroupMutation, isPending: isLeaveLoading } = useMutation({
    mutationFn: async (groupId: string) => await leaveGroup(groupId, userId ?? ""),
    meta: {
      invalidateCacheKeys: [
        { queryKey: queryCacheKeys.table.myGroupConditions({ ...tableConditions }, userId ?? ""), exact: true },
        { queryKey: queryCacheKeys.users.joinedGroupIds(userId ?? ""), exact: true },
      ],
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
    groups: data?.data ?? [],
    totalGroupCount: userJoinGroupCount?.data ?? 0,
    isLoading: isUserJoinGroupPending || isUserJoinGroupCountPending || isLeaveLoading,
    tableConditions,
    // function
    changeTableConditions,
    handleLeave: leaveGroupMutation,
    resetFilters,
    resetSort,
  };
}
