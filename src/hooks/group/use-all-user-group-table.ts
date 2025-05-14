"use client";

import type { Group, TableConditions } from "@/types/group-types";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { joinGroup } from "@/lib/actions/group";
import { getAllUserGroupsAndCount } from "@/lib/actions/group/all-user-group";
import { TABLE_CONSTANTS } from "@/lib/constants";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { type SortDirection } from "@/types/auction-types";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * useAllUserGroupTableの戻り値の型
 */
type UseAllUserGroupTableReturn = {
  // state
  groups: Group[];
  isLoading: boolean;
  tableConditions: TableConditions;
  totalGroupCount: number;
  // function
  changeTableConditions: (tableConditions: TableConditions) => void;
  handleJoin: (groupId: string) => void;
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
   * URLからパラメータを取得
   */
  const searchParams = useSearchParams();

  const getTableConditionsFromParams = useCallback((): TableConditions => {
    // ページ数のURLパラメータ
    const currentPage = Number(searchParams.get("page") ?? 1);

    // ソートのURLパラメータ
    const currentSortField = searchParams.get("sort_field") as keyof Group | null;

    // ソートの降順/昇順の方向のURLパラメータ
    const currentSortDirection = searchParams.get("sort_direction") as SortDirection | null;

    // 検索クエリのURLパラメータ
    const currentQuery = searchParams.get("q");

    // グループ参加状態のURLパラメータ
    const currentIsJoined = searchParams.get("is_joined") as "true" | "false";

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
      isJoined: currentIsJoined,
      itemPerPage: currentItemPerPage,
    };
  }, [searchParams]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テーブルの条件を管理する
   */
  const [tableConditions, setTableConditions] = useState<TableConditions>(getTableConditionsFromParams());

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
   * 必要なパラメータのみURLに含める（デフォルト値は含めない）
   */
  const updateUrlParams = useCallback(
    (newTableConditions: TableConditions) => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      console.log("src/hooks/group/use-all-user-group-table.ts_updateUrlParams_start", newTableConditions);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // ページ以外の条件が変更された場合は、ページを1に戻す
      if (
        tableConditions.sort?.field !== newTableConditions.sort?.field ||
        tableConditions.sort?.direction !== newTableConditions.sort?.direction ||
        tableConditions.searchQuery !== newTableConditions.searchQuery ||
        tableConditions.isJoined !== newTableConditions.isJoined
      ) {
        newTableConditions.page = 1;
      }

      // URLパラメータを作成
      const params = new URLSearchParams();

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // ページ数
      if (newTableConditions.page > 1) {
        params.set("page", String(newTableConditions.page));
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // ソート - 複数選択可能になったため、最初のソート条件のみ使用
      if (newTableConditions.sort) {
        console.log("src/hooks/group/use-all-user-group-table.ts_updateUrlParams_listingsConditions.sort_start");

        // ソートする列
        if (newTableConditions.sort.field) {
          params.set("sort_field", newTableConditions.sort.field);
          console.log("src/hooks/group/use-all-user-group-table.ts_updateUrlParams_firstSort.field", newTableConditions.sort.field);
        }

        // ソート方向
        if (newTableConditions.sort.direction) {
          params.set("sort_direction", newTableConditions.sort.direction);
          console.log("src/hooks/group/use-all-user-group-table.ts_updateUrlParams_firstSort.direction", newTableConditions.sort.direction);
        }
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 検索クエリ
      if (newTableConditions.searchQuery) {
        params.set("q", newTableConditions.searchQuery);
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // グループ参加状態
      if (newTableConditions.isJoined) {
        params.set("is_joined", newTableConditions.isJoined);
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 1ページあたりの表示件数
      if (newTableConditions.itemPerPage) {
        params.set("item_per_page", String(newTableConditions.itemPerPage));
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      // URLパラメータを作成
      const newUrl = `/dashboard/grouplist${params.toString() ? `?${params.toString()}` : ""}`;

      console.log("src/hooks/group/use-all-user-group-table.ts_updateUrlParams_newUrl", newUrl);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 指定URLに画面遷移。scroll: false を追加してページスクロールを防止
      window.history.pushState({}, "", newUrl);
    },
    [tableConditions.sort, tableConditions.searchQuery, tableConditions.isJoined],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データ取得
   */
  const {
    data,
    isFetching: isGroupsFetching,
    isPending: isGroupsPending,
    isPlaceholderData, // Loading中に代わりに前回の値を表示しているかのフラグ。つまりLoadingフラグと同じ
  } = useQuery({
    queryKey: queryCacheKeys.table.groupAllConditions(tableConditions),
    queryFn: async () =>
      await getAllUserGroupsAndCount({
        page: tableConditions.page,
        sortField: tableConditions.sort?.field ?? "createdAt",
        sortDirection: tableConditions.sort?.direction ?? "desc",
        searchQuery: tableConditions.searchQuery ?? "",
        isJoined: tableConditions.isJoined,
        itemPerPage: tableConditions.itemPerPage,
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
        queryKey: queryCacheKeys.table.groupAllConditions({ ...tableConditions, page: nextPage }),
        queryFn: async () =>
          await getAllUserGroupsAndCount({
            page: nextPage,
            sortField: tableConditions.sort?.field ?? "createdAt",
            sortDirection: tableConditions.sort?.direction ?? "desc",
            searchQuery: tableConditions.searchQuery ?? "",
            isJoined: tableConditions.isJoined,
            itemPerPage: tableConditions.itemPerPage,
          }),
      });
      console.log("src/hooks/group/use-all-user-group-table.ts_prefetchQuery_nextPage", nextPage);
      console.log("src/hooks/group/use-all-user-group-table.ts_prefetchQuery_executed");
    }
    console.log("src/hooks/group/use-all-user-group-table.ts_prefetchQuery_end");
  }, [data, tableConditions, isPlaceholderData, queryClient]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データ取得のデバッグ用
   */
  useEffect(() => {
    console.log("src/hooks/group/use-all-user-group-table.ts_data", data);
  }, [data]);

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
      await queryClient.invalidateQueries({ queryKey: queryCacheKeys.table.groupAll(), exact: false }); //TableConditionsの条件関係なしに、全てのキャッシュを無効化
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テーブルの条件を変更する関数
   */
  const changeTableConditions = useCallback(
    (newTableConditions: TableConditions) => {
      // URLパラメータを更新&ブラウザに履歴を登録
      updateUrlParams(newTableConditions);

      // テーブルの条件を更新&useQueryによって、指定条件で検索
      setTableConditions(newTableConditions);
    },
    [updateUrlParams],
  );

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
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
