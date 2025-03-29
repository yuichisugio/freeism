"use client";

import type { AuctionFilterParams, AuctionSortOption } from "@/lib/auction/types";
import { useEffect, useState } from "react";
import { getUserGroups } from "@/lib/auction/action/user";

// フィルターのprops
type UseAuctionFiltersProps = {
  filters: AuctionFilterParams;
  onFilterChangeAction: (filters: Partial<AuctionFilterParams>) => void;
  sortOption: AuctionSortOption;
  onSortChangeAction: (sort: AuctionSortOption) => void;
  categories?: string[];
  onResetFilters?: () => void;
};

export function useAuctionFilters({ filters, onFilterChangeAction, sortOption, onSortChangeAction, categories = [], onResetFilters }: UseAuctionFiltersProps) {
  // 価格範囲フィルター
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);

  // グループリスト
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);

  // フィルターパネルの表示状態
  const [showFilters, setShowFilters] = useState(false);

  // アクティブなフィルターの数をカウント
  const [activeFilterCount, setActiveFilterCount] = useState(0);

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

  // 価格範囲変更時のハンドラー
  const handlePriceRangeChange = (value: [number, number]) => {
    setPriceRange(value);
  };

  // 価格範囲適用時のハンドラー
  const handlePriceRangeApply = () => {
    onFilterChangeAction({
      minPrice: priceRange[0],
      maxPrice: priceRange[1],
    });
  };

  // フィルター表示切り替え
  const toggleFilterDisplay = () => {
    setShowFilters(!showFilters);
  };

  // 価格範囲のプリセット設定
  const setPricePreset = (min: number, max: number) => {
    setPriceRange([min, max]);
  };

  // 価格範囲をリセット
  const resetPriceRange = () => {
    setPriceRange([0, 10000]);
  };

  return {
    priceRange,
    groups,
    showFilters,
    activeFilterCount,
    handlePriceRangeChange,
    handlePriceRangeApply,
    toggleFilterDisplay,
    setPricePreset,
    resetPriceRange,
  };
}
