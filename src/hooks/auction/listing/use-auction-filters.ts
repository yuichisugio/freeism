"use client";

import type { AUCTION_CONSTANTS } from "@/lib/auction/constants";
import type {
  AuctionFilterTypes,
  AuctionListingsConditions,
  AuctionSortField,
  SortDirection,
  UseAuctionFiltersProps,
} from "@/lib/auction/type/types";
import { useCallback, useEffect, useState } from "react";
import { getUserGroups } from "@/lib/auction/action/user";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションフィルター用カスタムフックの型定義
 */
type UseAuctionFiltersReturn = {
  // state
  listingsConditions: AuctionListingsConditions;
  draftConditions: AuctionListingsConditions;
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
  handleStatusSelect: (status: AuctionFilterTypes) => void;
  handleStatusJoinTypeChange: (joinType: "OR" | "AND") => void;
  handleGroupSelect: (groupId: string | null) => void;
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
  handleSortDirectionToggle: () => void;
  handleResetAllFilters: () => void;
  applyAllFilters: () => void;
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

  // 一時的なフィルター状態（ドラフト状態）
  const [draftConditions, setDraftConditions] = useState<AuctionListingsConditions>({ ...listingsConditions });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 一時的なフィルター状態を更新
  useEffect(() => {
    setDraftConditions({ ...listingsConditions });
  }, [listingsConditions]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 価格範囲をリセット
  const resetPriceRange = useCallback(() => {
    setDraftConditions({
      ...draftConditions,
      minBid: null,
      maxBid: null,
    });
  }, [draftConditions]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 残り時間範囲をリセット
  const resetTimeRange = useCallback(() => {
    setDraftConditions({
      ...draftConditions,
      minRemainingTime: null,
      maxRemainingTime: null,
    });
  }, [draftConditions]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // グループ情報を取得
  useEffect(() => {
    async function fetchGroups() {
      try {
        const userGroups = await getUserGroups();

        // グループIDのリストを作成
        const groupData = userGroups.map((membership) => membership.group.id);

        // ドラフト状態のみ更新し、実際のフィルターには適用しない
        setDraftConditions({
          ...draftConditions,
          groupIds: groupData,
        });
      } catch (error) {
        console.error("グループ情報の取得に失敗しました", error);
      }
    }

    void fetchGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 依存配列を空にして初回レンダリング時のみ実行

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // アクティブなフィルターの数を計算
  useEffect(() => {
    let count = 0;
    if (
      listingsConditions.categories &&
      listingsConditions.categories.length > 0 &&
      !(listingsConditions.categories.length === 1 && listingsConditions.categories[0] === "すべて")
    )
      count++;
    if (listingsConditions.status && listingsConditions.status.length > 0 && listingsConditions.status[0] !== "all") count++;
    if (listingsConditions.minBid !== null || listingsConditions.maxBid !== null) count++;
    if (listingsConditions.minRemainingTime !== null || listingsConditions.maxRemainingTime !== null) count++;
    if (listingsConditions.groupIds && listingsConditions.groupIds.length > 0) count++;
    if (listingsConditions.searchQuery) count++;

    setActiveFilterCount(count);
  }, [listingsConditions]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 複数選択可能なフィルターの選択を処理する共通関数
   * @param field フィールド名
   * @param value 選択値
   * @param defaultValue デフォルト値（単一アイテムの配列）
   * @param isExclusive 排他的選択かどうか（例：「すべて」と他の選択肢）
   */
  const handleMultiSelect = useCallback(
    <T extends string>(field: keyof AuctionListingsConditions, value: T, defaultValue: T[], isExclusive = false, exclusiveValue?: T) => {
      const currentValues = Array.isArray(draftConditions[field]) ? [...(draftConditions[field] as T[])] : [];

      // 排他的な値が選択された場合
      if (isExclusive && value === exclusiveValue) {
        setDraftConditions({
          ...draftConditions,
          [field]: [value],
        });
        return;
      }

      // 排他的な値が現在選択されている場合、それを除外する
      let newValues = isExclusive ? currentValues.filter((v) => v !== exclusiveValue) : [...currentValues];

      // 値が既に存在する場合は削除、存在しない場合は追加
      const valueExists = newValues.includes(value);
      if (valueExists) {
        // 最低1つの値は維持する必要がある場合
        if (newValues.length > 1) {
          newValues = newValues.filter((v) => v !== value);
        }
      } else {
        newValues.push(value);
      }

      // 選択がなくなった場合、デフォルト値を設定
      if (newValues.length === 0 && defaultValue) {
        newValues = [...defaultValue];
      }

      setDraftConditions({
        ...draftConditions,
        [field]: newValues,
      });
    },
    [draftConditions],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // カテゴリ選択時のハンドラ
  const handleCategorySelect = useCallback(
    (category: string) => {
      // カテゴリ型を明示的に宣言して型安全性を確保
      const categoryValue = category;
      const defaultCategory = "すべて";

      handleMultiSelect<(typeof AUCTION_CONSTANTS.AUCTION_CATEGORIES)[number]>("categories", categoryValue, [defaultCategory], true, defaultCategory);
    },
    [handleMultiSelect],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ステータス選択時のハンドラ
   * @param status 選択されたステータス
   */
  const handleStatusSelect = useCallback(
    (status: AuctionFilterTypes) => {
      handleMultiSelect<AuctionFilterTypes>("status", status, ["all"], true, "all");
    },
    [handleMultiSelect],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ステータス結合タイプの変更ハンドラ
   * @param joinType 選択された結合タイプ
   */
  const handleStatusJoinTypeChange = useCallback(
    (joinType: "OR" | "AND") => {
      setDraftConditions({
        ...draftConditions,
        statusConditionJoinType: joinType,
      });
    },
    [draftConditions],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ選択時のハンドラ
   * @param groupId 選択されたグループID
   */
  const handleGroupSelect = useCallback(
    (groupId: string | null) => {
      if (groupId === null) {
        // グループの選択を解除する場合
        setDraftConditions({
          ...draftConditions,
          groupIds: null,
        });
      } else {
        // 現在のグループIDリスト
        const currentGroupIds = draftConditions.groupIds ? [...draftConditions.groupIds] : [];

        // グループIDが既に存在するか確認
        const groupExists = currentGroupIds.includes(groupId);

        // グループの追加/削除
        let newGroupIds;
        if (groupExists) {
          // 最低1つのグループは必要な場合、最小数チェック
          if (currentGroupIds.length > 1) {
            newGroupIds = currentGroupIds.filter((id) => id !== groupId);
          } else {
            newGroupIds = [...currentGroupIds];
          }
        } else {
          newGroupIds = [...currentGroupIds, groupId];
        }

        setDraftConditions({
          ...draftConditions,
          groupIds: newGroupIds,
        });
      }
    },
    [draftConditions],
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
      setDraftConditions({
        ...draftConditions,
        ...newFilters,
      });
    },
    [draftConditions],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ソート変更ハンドラ
   * @param newSort 新しいソートオプション
   * @returns Promise<void>
   */
  const handleSortChange = useCallback(
    (newSort: { field: AuctionSortField; direction: SortDirection }) => {
      // ソートを常に新しいオプションで置き換える（1つのソートオプションのみ適用）
      setDraftConditions({
        ...draftConditions,
        sort: [newSort], // 常に配列の先頭に1つだけセット
      });
    },
    [draftConditions],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 価格範囲変更時のハンドラー
  const handlePriceRangeChange = useCallback(
    (value: [number, number]) => {
      setDraftConditions({
        ...draftConditions,
        minBid: value[0],
        maxBid: value[1],
      });
    },
    [draftConditions],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 残り時間範囲変更時のハンドラー
  const handleTimeRangeChange = useCallback(
    (value: [number, number]) => {
      setDraftConditions({
        ...draftConditions,
        minRemainingTime: value[0],
        maxRemainingTime: value[1],
      });
    },
    [draftConditions],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 全フィルターリセットハンドラ
   */
  const handleResetAllFilters = useCallback(() => {
    const initialConditions: AuctionListingsConditions = {
      categories: null,
      status: null,
      minBid: null,
      maxBid: null,
      minRemainingTime: null,
      maxRemainingTime: null,
      groupIds: null,
      searchQuery: null,
      sort: null,
      page: 1,
    };

    setDraftConditions(initialConditions);
    setListingsConditionsAction(initialConditions);
  }, [setListingsConditionsAction]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 残り時間範囲適用時のハンドラー
  const handleTimeRangeApply = useCallback(() => {
    // 残り時間範囲を指定
    handleFilterChange({
      minRemainingTime: draftConditions.minRemainingTime,
      maxRemainingTime: draftConditions.maxRemainingTime,
    });
  }, [handleFilterChange, draftConditions.minRemainingTime, draftConditions.maxRemainingTime]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 残り時間範囲のプリセット設定
  const setTimePreset = useCallback(
    (min: number, max: number) => {
      setDraftConditions({
        ...draftConditions,
        minRemainingTime: min,
        maxRemainingTime: max,
      });
    },
    [draftConditions],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 価格範囲適用時のハンドラー
  const handlePriceRangeApply = useCallback(() => {
    handleFilterChange({
      minBid: draftConditions.minBid,
      maxBid: draftConditions.maxBid,
    });
  }, [handleFilterChange, draftConditions]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // フィルター表示切り替え
  const toggleFilterDisplay = useCallback(() => {
    setShowFilters(!showFilters);
  }, [showFilters]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 価格範囲のプリセット設定
  const setPricePreset = useCallback(
    (min: number, max: number) => {
      setDraftConditions({
        ...draftConditions,
        minBid: min,
        maxBid: max,
      });
    },
    [draftConditions],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * すべてのフィルターを適用するハンドラー
   */
  const applyAllFilters = useCallback(() => {
    console.log("src/hooks/auction/listing/use-auction-filters.ts_applyAllFilters_start");
    console.log("src/hooks/auction/listing/use-auction-filters.ts_applyAllFilters_draftConditions", draftConditions);

    // ソート情報を確認
    const sortInfo = draftConditions.sort && draftConditions.sort.length > 0 ? draftConditions.sort[0] : null;
    console.log("src/hooks/auction/listing/use-auction-filters.ts_applyAllFilters_sortInfo", sortInfo);

    // 完全なコピーを作成して参照を切り替える
    const updatedConditions: AuctionListingsConditions = {
      categories: draftConditions.categories ? [...draftConditions.categories] : null,
      status: draftConditions.status ? [...draftConditions.status] : null,
      statusConditionJoinType: draftConditions.statusConditionJoinType,
      minBid: draftConditions.minBid,
      maxBid: draftConditions.maxBid,
      minRemainingTime: draftConditions.minRemainingTime,
      maxRemainingTime: draftConditions.maxRemainingTime,
      groupIds: draftConditions.groupIds ? [...draftConditions.groupIds] : null,
      searchQuery: draftConditions.searchQuery,
      sort: sortInfo
        ? [
            {
              field: sortInfo.field,
              direction: sortInfo.direction,
            },
          ]
        : null,
      page: draftConditions.page,
    };

    console.log("src/hooks/auction/listing/use-auction-filters.ts_applyAllFilters_updatedConditions", updatedConditions);

    // 親コンポーネントの状態を更新
    setListingsConditionsAction(updatedConditions);
    console.log("src/hooks/auction/listing/use-auction-filters.ts_applyAllFilters_applied");
  }, [draftConditions, setListingsConditionsAction]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ソート方向をトグルするハンドラー
   */
  const handleSortDirectionToggle = useCallback(() => {
    const currentField = Array.isArray(draftConditions.sort) && draftConditions.sort.length > 0 ? draftConditions.sort[0].field : "newest";

    const currentDirection = Array.isArray(draftConditions.sort) && draftConditions.sort.length > 0 ? draftConditions.sort[0].direction : "asc";

    const newDirection = currentDirection === "asc" ? "desc" : "asc";

    setDraftConditions({
      ...draftConditions,
      sort: [{ field: currentField, direction: newDirection }],
    });
  }, [draftConditions]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    // state
    listingsConditions,
    draftConditions,
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
    handleStatusSelect,
    handleStatusJoinTypeChange,
    handleGroupSelect,
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
    handleSortDirectionToggle,
    handleResetAllFilters,
    applyAllFilters,
  };
}
