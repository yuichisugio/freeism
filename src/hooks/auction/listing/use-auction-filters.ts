"use client";

import type { AuctionListingsConditions, AuctionSortField, SortDirection, UseAuctionFiltersProps } from "@/lib/auction/type/types";
import { useCallback, useEffect, useState } from "react";
import { getUserGroups } from "@/lib/auction/action/user";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションフィルター用カスタムフックの型定義
 */
type UseAuctionFiltersReturn = {
  // state
  listingsConditions: AuctionListingsConditions;
  showFilters: boolean;
  activeFilterCount: number;
  openGroupCombobox: boolean;
  changingSearchQuery: string | null;

  // action
  setListingsConditionsAction: (newListingsConditions: AuctionListingsConditions) => void;
  handleSearchQueryEnter: (searchQuery: string) => void;
  setChangingSearchQuery: (searchQuery: string | null) => void;
  setOpenGroupCombobox: (open: boolean) => void;
  handleCategorySelect: (category: string) => void;
  handlePriceRangeChange: (value: [number, number]) => void;
  handlePriceRangeApply: () => void;
  handleTimeRangeChange: (value: [number, number]) => void;
  handleTimeRangeApply: () => void;
  toggleFilterDisplay: () => void;
  setPricePreset: (min: number, max: number) => void;
  setTimePreset: (min: number, max: number) => void;
  resetPriceRange: () => void;
  resetTimeRange: () => void;
  handleFilterChange: (newFilters: Partial<AuctionListingsConditions>) => void;
  handleSortChange: (newSort: { field: AuctionSortField; direction: SortDirection }) => void;
  handleResetAllFilters: () => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションフィルター用カスタムフック
 * @param listingsConditions フィルターの状態
 * @param setListingsConditions フィルターの変更アクション
 * @returns フィルターの状態とハンドラー
 */
export function useAuctionFilters({ listingsConditions, setListingsConditionsAction }: UseAuctionFiltersProps): UseAuctionFiltersReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // フィルターパネルの表示状態
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // グループコンボボックス状態
  const [openGroupCombobox, setOpenGroupCombobox] = useState<boolean>(false);

  // アクティブなフィルターの数をカウント
  const [activeFilterCount, setActiveFilterCount] = useState<number>(0);

  // searchQuery
  const [changingSearchQuery, setChangingSearchQuery] = useState<string | null>(null);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 価格範囲をリセット
  const resetPriceRange = useCallback(() => {
    setListingsConditionsAction({
      ...listingsConditions,
      minBid: null,
      maxBid: null,
    });
  }, [listingsConditions, setListingsConditionsAction]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 残り時間範囲をリセット
  const resetTimeRange = useCallback(() => {
    setListingsConditionsAction({
      ...listingsConditions,
      minRemainingTime: null,
      maxRemainingTime: null,
    });
  }, [listingsConditions, setListingsConditionsAction]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // グループ情報を取得
  useEffect(() => {
    async function fetchGroups() {
      const userGroups = await getUserGroups();
      const groupData = userGroups.map((membership) => membership.group.id);
      setListingsConditionsAction({
        ...listingsConditions,
        groupIds: groupData,
      });
    }

    void fetchGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 依存配列を空にして初回レンダリング時のみ実行（無限ループ防止）

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // アクティブなフィルターの数を計算
  useEffect(() => {
    let count = 0;
    if (listingsConditions.categories && listingsConditions.categories !== "すべて") count++;
    if (listingsConditions.status && listingsConditions.status[0] !== "all") count++;
    if (listingsConditions.minBid !== null || listingsConditions.maxBid !== null) count++;
    if (listingsConditions.minRemainingTime !== null || listingsConditions.maxRemainingTime !== null) count++;
    if (listingsConditions.groupIds) count++;
    if (listingsConditions.searchQuery) count++;

    setActiveFilterCount(count);
  }, [listingsConditions]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // カテゴリ選択時のハンドラ
  const handleCategorySelect = useCallback(
    (category: string) => {
      setListingsConditionsAction({
        ...listingsConditions,
        categories: category,
      });
    },
    [listingsConditions, setListingsConditionsAction],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 検索クエリ変更時に検索条件を更新
   */
  const handleSearchQueryEnter = useCallback(
    (searchQuery: string) => {
      setListingsConditionsAction({
        ...listingsConditions,
        searchQuery: searchQuery,
      });
    },
    [listingsConditions, setListingsConditionsAction],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルター変更ハンドラ
   * @param newFilters 新しいフィルター
   * @returns Promise<void>
   */
  const handleFilterChange = useCallback(
    (newFilters: Partial<AuctionListingsConditions>) => {
      setListingsConditionsAction({
        ...listingsConditions,
        ...newFilters,
      });
    },
    [listingsConditions, setListingsConditionsAction],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ソート変更ハンドラ
   * @param newSort 新しいソートオプション
   * @returns Promise<void>
   */
  const handleSortChange = useCallback(
    (newSort: { field: AuctionSortField; direction: SortDirection }) => {
      setListingsConditionsAction({
        ...listingsConditions,
        sort: newSort,
      });
    },
    [listingsConditions, setListingsConditionsAction],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 価格範囲変更時のハンドラー
  const handlePriceRangeChange = useCallback(
    (value: [number, number]) => {
      setListingsConditionsAction({
        ...listingsConditions,
        minBid: value[0],
        maxBid: value[1],
      });
    },
    [listingsConditions, setListingsConditionsAction],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 残り時間範囲変更時のハンドラー
  const handleTimeRangeChange = useCallback(
    (value: [number, number]) => {
      setListingsConditionsAction({
        ...listingsConditions,
        minRemainingTime: value[0],
        maxRemainingTime: value[1],
      });
    },
    [listingsConditions, setListingsConditionsAction],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 全フィルターリセットハンドラ
   */
  const handleResetAllFilters = useCallback(() => {
    setListingsConditionsAction({
      categories: "すべて",
      status: ["all"],
      minBid: null,
      maxBid: null,
      minRemainingTime: null,
      maxRemainingTime: null,
      groupIds: null,
      searchQuery: null,
      sort: null,
      page: 1,
    });
  }, [setListingsConditionsAction]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 残り時間範囲適用時のハンドラー
  const handleTimeRangeApply = useCallback(() => {
    // 残り時間範囲を指定
    handleFilterChange({
      minRemainingTime: listingsConditions.minRemainingTime,
      maxRemainingTime: listingsConditions.maxRemainingTime,
    });
  }, [handleFilterChange, listingsConditions.minRemainingTime, listingsConditions.maxRemainingTime]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 残り時間範囲のプリセット設定
  const setTimePreset = useCallback(
    (min: number, max: number) => {
      setListingsConditionsAction({
        ...listingsConditions,
        minRemainingTime: min,
        maxRemainingTime: max,
      });
    },
    [listingsConditions, setListingsConditionsAction],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 価格範囲適用時のハンドラー
  const handlePriceRangeApply = useCallback(() => {
    handleFilterChange({
      minBid: listingsConditions.minBid,
      maxBid: listingsConditions.maxBid,
    });
  }, [handleFilterChange, listingsConditions]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // フィルター表示切り替え
  const toggleFilterDisplay = useCallback(() => {
    setShowFilters(!showFilters);
  }, [showFilters]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 価格範囲のプリセット設定
  const setPricePreset = useCallback(
    (min: number, max: number) => {
      setListingsConditionsAction({
        ...listingsConditions,
        minBid: min,
        maxBid: max,
      });
    },
    [listingsConditions, setListingsConditionsAction],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    // state
    listingsConditions,
    showFilters,
    activeFilterCount,
    openGroupCombobox,
    changingSearchQuery,

    // action
    setListingsConditionsAction,
    handleSearchQueryEnter,
    setChangingSearchQuery,
    setOpenGroupCombobox,
    handleCategorySelect,
    handlePriceRangeChange,
    handlePriceRangeApply,
    handleTimeRangeChange,
    handleTimeRangeApply,
    toggleFilterDisplay,
    setPricePreset,
    setTimePreset,
    resetPriceRange,
    resetTimeRange,
    handleFilterChange,
    handleSortChange,
    handleResetAllFilters,
  };
}
