"use client";

import type { AuctionFilterParams, AuctionSortOption, UseAuctionFiltersProps } from "@/lib/auction/types";
import { useCallback, useEffect, useState } from "react";
import { getUserGroups } from "@/lib/auction/action/user";

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
export function useAuctionFilters({ filters, onFilterChangeAction, sortOption, onSortChangeAction, onResetFilters }: UseAuctionFiltersProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 価格範囲フィルター
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);

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

    fetchGroups();
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
    groups,
    activeFilterCount,
    openGroupCombobox,
    setOpenGroupCombobox,
    handlePriceRangeChange,
    handlePriceRangeApply,
    setPricePreset,
    resetPriceRange,
  };
}
