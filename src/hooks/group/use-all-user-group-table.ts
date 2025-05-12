"use client";

import type { Group, TableConditions } from "@/types/group-types";
import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getGroupList, joinGroup } from "@/lib/actions/group";
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

  // ページ数のURLパラメータ
  const currentPage = Number(searchParams.get("page") ?? 1);

  // ソートのURLパラメータ
  const currentSort = searchParams.get("sort") as keyof Group | null;

  // ソートの降順/昇順の方向のURLパラメータ
  const currentSortDirection = searchParams.get("sort_direction") as SortDirection | null;

  // 検索クエリのURLパラメータ
  const currentQuery = searchParams.get("q");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テーブルの条件を管理する
   */
  const [tableConditions, setTableConditions] = useState<TableConditions>({
    sort:
      currentSort && currentSortDirection
        ? {
            field: currentSort,
            direction: currentSortDirection,
          }
        : null,
    page: currentPage,
    searchQuery: currentQuery,
  });

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
        params.set("sort", newListingsConditions.sort.field);
        console.log("src/hooks/group/use-all-user-group-table.ts_updateUrlParams_firstSort.field", newListingsConditions.sort.field);
      }

      // ソート方向
      if (newListingsConditions.sort.direction && newListingsConditions.sort.direction !== "desc") {
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
      await getGroupList(tableConditions.page, tableConditions.sort?.field ?? "createdAt", tableConditions.sort?.direction ?? "desc"),
    staleTime: 1000 * 60 * 60 * 1, // 1時間
    gcTime: 1000 * 60 * 60 * 1, // 1時間
    enabled: !!tableConditions,
  });

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
    groups: data?.GroupList ?? [],
    totalGroupCount: data?.totalGroupCount ?? 0,
    isLoading: isGroupsFetching || isJoinLoading || isGroupsPending,
    tableConditions,

    // function
    changeTableConditions,
    handleJoin,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
