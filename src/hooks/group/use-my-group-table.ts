"use client";

import type { SortDirection } from "@/types/auction-types";
import type { MyGroupTable, TableConditions } from "@/types/group-types";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getUserJoinGroupAndCount, leaveGroup } from "@/lib/actions/group/my-group";
import { TABLE_CONSTANTS } from "@/lib/constants";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * URLからパラメータを取得
   */
  const searchParams = useSearchParams();

  const getTableConditionsFromParams = useCallback((): TableConditions<MyGroupTable> => {
    // ページ数のURLパラメータ
    const currentPage = Number(searchParams.get("page") ?? 1);

    // ソートのURLパラメータ
    const currentSortField = searchParams.get("sort_field") as keyof MyGroupTable | null;

    // ソートの降順/昇順の方向のURLパラメータ
    const currentSortDirection = searchParams.get("sort_direction") as SortDirection | null;

    // 検索クエリのURLパラメータ
    const currentQuery = searchParams.get("q");

    // 1ページあたりの表示件数
    const currentItemPerPage = Number(searchParams.get("item_per_page") ?? TABLE_CONSTANTS.ITEMS_PER_PAGE);

    // データ取得のためのパラメータを返す
    return {
      sort:
        currentSortField && currentSortDirection
          ? {
              field: currentSortField,
              direction: currentSortDirection,
            }
          : null,
      page: currentPage,
      searchQuery: currentQuery,
      itemPerPage: currentItemPerPage,
      isJoined: "all",
    };
  }, [searchParams]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テーブルの状態を管理
   */
  const [tableConditions, setTableConditions] = useState<TableConditions<MyGroupTable>>(getTableConditionsFromParams());

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * URLパラメータが変更された際に、listingsConditionsを更新
   * ブラウザの戻るボタンを押してURLが変わった場合に、データを反映させるために必要
   */
  useEffect(() => {
    setTableConditions(getTableConditionsFromParams());
  }, [searchParams, getTableConditionsFromParams]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * URLパラメータを更新する関数
   */
  const updateUrlParams = useCallback(
    (newTableConditions: TableConditions<MyGroupTable>) => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      console.log("src/hooks/group/use-my-group-table.ts_updateUrlParams_start", newTableConditions);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      const mutableTableConditions = { ...newTableConditions };

      // ページ以外の条件が変更された場合は、ページを1に戻す
      if (
        tableConditions.sort?.field !== mutableTableConditions.sort?.field ||
        tableConditions.sort?.direction !== mutableTableConditions.sort?.direction ||
        tableConditions.searchQuery !== mutableTableConditions.searchQuery
      ) {
        mutableTableConditions.page = 1;
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // URLパラメータを作成
      const params = new URLSearchParams();

      // ページ数
      if (mutableTableConditions.page > 1) {
        params.set("page", String(mutableTableConditions.page));
      }

      // ソート
      if (mutableTableConditions.sort) {
        if (mutableTableConditions.sort.field) {
          params.set("sort_field", mutableTableConditions.sort.field);
        }
        if (mutableTableConditions.sort.direction) {
          params.set("sort_direction", mutableTableConditions.sort.direction);
        }
      }

      // 検索クエリ
      if (mutableTableConditions.searchQuery) {
        params.set("q", mutableTableConditions.searchQuery);
      }

      // 1ページあたりの表示件数
      if (mutableTableConditions.itemPerPage !== TABLE_CONSTANTS.ITEMS_PER_PAGE) {
        params.set("item_per_page", String(mutableTableConditions.itemPerPage));
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // URLを更新
      const newUrl = `/dashboard/my-group${params.toString() ? `?${params.toString()}` : ""}`;

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 指定URLに画面遷移。scroll: false を追加してページスクロールを防止
      window.history.pushState({}, "", newUrl);
    },
    [tableConditions],
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
   * テーブルの条件を変更する関数
   */
  const changeTableConditions = useCallback(
    (newTableConditions: TableConditions<MyGroupTable>) => {
      updateUrlParams(newTableConditions);
      setTableConditions(newTableConditions);
    },
    [updateUrlParams],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルターをリセットする関数
   */
  const resetFilters = useCallback(() => {
    changeTableConditions({
      ...tableConditions,
      searchQuery: null,
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
