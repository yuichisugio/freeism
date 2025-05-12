"use client";

import type { Group, TableConditions } from "@/types/group-types";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { joinGroup } from "@/lib/actions/group";
import { getAllUserGroupsAndCount } from "@/lib/actions/group/all-user-group";
import { type SortDirection } from "@/types/auction-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
   * URLからパラメータを取得
   */
  const searchParams = useSearchParams();

  const getListingsConditionsFromParams = useCallback((): TableConditions => {
    // ページ数のURLパラメータ
    const currentPage = Number(searchParams.get("page") ?? 1);

    // ソートのURLパラメータ
    const currentSortField = searchParams.get("sort_field") as keyof Group | null;

    // ソートの降順/昇順の方向のURLパラメータ
    const currentSortDirection = searchParams.get("sort_direction") as SortDirection | null;

    // 検索クエリのURLパラメータ
    const currentQuery = searchParams.get("q");

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
    };
  }, [searchParams]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テーブルの条件を管理する
   */
  const [tableConditions, setTableConditions] = useState<TableConditions>(getListingsConditionsFromParams());

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * URLパラメータが変更された際に、listingsConditionsを更新
   * ブラウザの戻るボタンを押してURLが変わった場合に、データを反映させるために必要
   */
  useEffect(() => {
    setTableConditions(getListingsConditionsFromParams());
  }, [searchParams, getListingsConditionsFromParams]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * URLパラメータを更新する関数
   * 必要なパラメータのみURLに含める（デフォルト値は含めない）
   */
  const updateUrlParams = useCallback((newListingsConditions: TableConditions) => {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    console.log("src/hooks/group/use-all-user-group-table.ts_updateUrlParams_start", newListingsConditions);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // URLパラメータを作成
    const params = new URLSearchParams();

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // ページ数
    if (newListingsConditions.page > 1) {
      params.set("page", String(newListingsConditions.page));
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // ソート - 複数選択可能になったため、最初のソート条件のみ使用
    if (newListingsConditions.sort) {
      console.log("src/hooks/group/use-all-user-group-table.ts_updateUrlParams_listingsConditions.sort_start");

      // ソートする列
      if (newListingsConditions.sort.field) {
        params.set("sort_field", newListingsConditions.sort.field);
        console.log("src/hooks/group/use-all-user-group-table.ts_updateUrlParams_firstSort.field", newListingsConditions.sort.field);
      }

      // ソート方向
      if (newListingsConditions.sort.direction) {
        params.set("sort_direction", newListingsConditions.sort.direction);
        console.log("src/hooks/group/use-all-user-group-table.ts_updateUrlParams_firstSort.direction", newListingsConditions.sort.direction);
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 検索クエリ
    if (newListingsConditions.searchQuery) {
      params.set("q", newListingsConditions.searchQuery);
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // URLパラメータを作成
    const newUrl = `/dashboard/grouplist${params.toString() ? `?${params.toString()}` : ""}`;

    console.log("src/hooks/group/use-all-user-group-table.ts_updateUrlParams_newUrl", newUrl);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 指定URLに画面遷移。scroll: false を追加してページスクロールを防止
    window.history.pushState({}, "", newUrl);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データ取得
   * TODO: searchQueryの検索は未実装
   */
  const {
    data,
    isFetching: isGroupsFetching,
    isPending: isGroupsPending,
  } = useQuery({
    queryKey: ["all-user-group-table", tableConditions],
    queryFn: async () =>
      await getAllUserGroupsAndCount(
        tableConditions.page,
        tableConditions.sort?.field ?? "createdAt",
        tableConditions.sort?.direction ?? "desc",
        tableConditions.searchQuery ?? "",
      ),
    staleTime: 1000 * 60 * 60 * 1, // 1時間
    gcTime: 1000 * 60 * 60 * 1, // 1時間
    enabled: !!tableConditions,
  });

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
  const queryClient = useQueryClient();
  const { mutate: handleJoin, isPending: isJoinLoading } = useMutation({
    mutationFn: async (groupId: string) => await joinGroup(groupId),
    onSuccess: () => {
      toast.success("グループに参加しました");
    },
    onError: () => {
      toast.error("エラーが発生しました");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["all-user-group-table"], exact: false }); //TableConditionsの条件関係なしに、全てのキャッシュを無効化
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
