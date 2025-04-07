"use client";

import type { AuctionFilterParams, UseAuctionFiltersProps } from "@/lib/auction/type/types";
import { useCallback, useEffect, useState } from "react";
import { getUserGroups } from "@/lib/auction/action/user";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションフィルター用カスタムフックの型定義
 */
type UseAuctionFiltersReturn = {
  priceRange: [number, number];
  timeRange: [number, number];
  groups: { id: string; name: string }[];
  showFilters: boolean;
  activeFilterCount: number;
  openGroupCombobox: boolean;
  setOpenGroupCombobox: (open: boolean) => void;
  handlePriceRangeChange: (value: [number, number]) => void;
  handlePriceRangeApply: () => void;
  handleTimeRangeChange: (value: [number, number]) => void;
  handleTimeRangeApply: () => void;
  toggleFilterDisplay: () => void;
  setPricePreset: (min: number, max: number) => void;
  setTimePreset: (min: number, max: number) => void;
  resetPriceRange: () => void;
  resetTimeRange: () => void;
};

/**
 * オークションフィルター用カスタムフック
 * @param props フィルターのprops
 * @param filters フィルターの状態
 * @param onFilterChangeAction フィルターの変更アクション
 * @param sortOption ソートオプション
 * @param onSortChangeAction ソートオプションの変更アクション
 * @param onResetFilters フィルターのリセットアクション
 * @returns フィルターの状態とハンドラー
 */
export function useAuctionFilters({ filters, onFilterChangeAction, sortOption: _sortOption, onSortChangeAction: _onSortChangeAction, onResetFilters: _onResetFilters }: UseAuctionFiltersProps): UseAuctionFiltersReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 価格範囲フィルター
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);

  // 残り時間範囲フィルター (時間単位: 0-720時間 = 0-30日)
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 720]);

  // グループリスト
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);

  // フィルターパネルの表示状態
  const [showFilters, setShowFilters] = useState(false);

  // グループコンボボックス状態
  const [openGroupCombobox, setOpenGroupCombobox] = useState(false);

  // アクティブなフィルターの数をカウント
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // グループ情報を取得
  useEffect(() => {
    async function fetchGroups() {
      const userGroups = await getUserGroups();
      const groupData = userGroups.map((membership) => ({
        id: membership.group.id,
        name: membership.group.name,
      }));
      setGroups(groupData);
    }

    void fetchGroups();
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // アクティブなフィルターの数を計算
  useEffect(() => {
    let count = 0;
    if (filters.category && filters.category !== "すべて") count++;
    if (filters.status && filters.status !== "all") count++;
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) count++;
    if (filters.remainingTime && filters.remainingTime !== "all") count++;
    if (filters.groupId) count++;
    if (filters.searchQuery) count++;

    setActiveFilterCount(count);
  }, [filters]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 価格範囲変更時のハンドラー
  const handlePriceRangeChange = useCallback((value: [number, number]) => {
    setPriceRange(value);
  }, []);

  // 残り時間範囲変更時のハンドラー
  const handleTimeRangeChange = useCallback((value: [number, number]) => {
    setTimeRange(value);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 残り時間範囲適用時のハンドラー
  const handleTimeRangeApply = useCallback(() => {
    // timeRange[0]が0で、timeRange[1]が720(max)の場合は全期間=allとする
    if (timeRange[0] === 0 && timeRange[1] === 720) {
      onFilterChangeAction({ remainingTime: "all" });
      return;
    }

    // 残り時間の上限値に応じて適切なフィルターを設定
    let remainingTime: AuctionFilterParams["remainingTime"] = "all";

    if (timeRange[1] <= 1) {
      remainingTime = "1h";
    } else if (timeRange[1] <= 24) {
      remainingTime = "1d";
    } else if (timeRange[1] <= 168) {
      remainingTime = "1w";
    } else {
      remainingTime = "1m";
    }

    onFilterChangeAction({ remainingTime });
  }, [onFilterChangeAction, timeRange]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 残り時間範囲のプリセット設定
  const setTimePreset = useCallback((min: number, max: number) => {
    setTimeRange([min, max]);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 残り時間範囲をリセット
  const resetTimeRange = useCallback(() => {
    setTimeRange([0, 720]);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 価格範囲適用時のハンドラー
  const handlePriceRangeApply = useCallback(() => {
    onFilterChangeAction({
      minPrice: priceRange[0],
      maxPrice: priceRange[1],
    });
  }, [onFilterChangeAction, priceRange]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // フィルター表示切り替え
  const toggleFilterDisplay = useCallback(() => {
    setShowFilters(!showFilters);
  }, [showFilters]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 価格範囲のプリセット設定
  const setPricePreset = useCallback((min: number, max: number) => {
    setPriceRange([min, max]);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 価格範囲をリセット
  const resetPriceRange = useCallback(() => {
    setPriceRange([0, 10000]);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    priceRange,
    timeRange,
    groups,
    showFilters,
    activeFilterCount,
    openGroupCombobox,
    setOpenGroupCombobox,
    handlePriceRangeChange,
    handlePriceRangeApply,
    handleTimeRangeChange,
    handleTimeRangeApply,
    toggleFilterDisplay,
    setPricePreset,
    setTimePreset,
    resetPriceRange,
    resetTimeRange,
  };
}
