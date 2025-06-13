"use client";

import type {
  AuctionFilterTypes,
  AuctionListingsConditions,
  AuctionSortField,
  SortDirection,
  Suggestion,
  UseAuctionFiltersProps,
} from "@/types/auction-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSearchSuggestions } from "@/lib/auction/action/auction-listing";
import { getUserGroups } from "@/lib/auction/action/user";
import { AUCTION_CONSTANTS } from "@/lib/constants";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

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
  categoriesList: string[];
  areAllGroupsSelected: boolean;
  joinTypeinedGroupList: Array<{ id: string; name: string }>;

  // loading states
  isSuggestionsLoading: boolean;
  isUserGroupsLoading: boolean;

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

  // サジェスト関連
  suggestions: Suggestion[];
  highlightedIndex: number;
  selectSuggestion: (suggestionText: string) => void;
  handleKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  closeSuggestions: () => void;

  // utilities
  isCategorySelected: (category: string) => boolean;
  isStatusSelected: (status: string) => boolean;
  isGroupSelected: (groupId: string | null) => boolean;
  getSortField: () => AuctionSortField;
  getSortDirection: () => SortDirection;
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

  /**
   * state
   */
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

  // サジェストのハイライトインデックス
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * セッション情報
   */
  const { data: session } = useSession();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("ユーザーIDが取得できませんでした");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * サジェスト関連
   * TanStack Query v5 を使用してサジェストを取得
   */
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string | null>(null);

  // デバウンス処理
  useEffect(() => {
    // 以前のタイムアウトがあればクリア
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
    }

    // 新しいタイムアウトを設定 (デバウンス)
    suggestionTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(changingSearchQuery);
    }, 400); // 400ミリ秒のデバウンス

    // クリーンアップ関数
    return () => {
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current);
      }
    };
  }, [changingSearchQuery]);

  // サジェスト取得用のuseQuery
  const {
    data: suggestions = [],
    error: suggestionsError,
    isLoading: isSuggestionsLoading,
  } = useQuery({
    queryKey: queryCacheKeys.auction.suggestions(debouncedSearchQuery ?? "", userId),
    queryFn: async () => {
      if (!debouncedSearchQuery?.trim() || !userId) {
        return [];
      }
      console.log("src/hooks/auction/listing/use-auction-filters.ts_useQuery_Fetching suggestions for:", debouncedSearchQuery);
      return await getSearchSuggestions(debouncedSearchQuery, userId);
    },
    enabled: !!debouncedSearchQuery?.trim() && !!userId,
    staleTime: 30 * 60 * 1000, // 30分間キャッシュ
    gcTime: 60 * 60 * 1000, // 1時間ガベージコレクション
  });

  useEffect(() => {
    if (suggestionsError) {
      console.error("src/hooks/auction/listing/use-auction-filters.ts_useQuery_Failed to fetch suggestions:", suggestionsError);
      setHighlightedIndex(-1);
    }
  }, [suggestionsError]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 一時的なフィルター状態を更新
   */
  useEffect(() => {
    setDraftConditions({ ...listingsConditions });
  }, [listingsConditions]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * カテゴリリスト
   */
  const categoriesList = useMemo(() => AUCTION_CONSTANTS.AUCTION_CATEGORIES, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * カテゴリが選択されているかチェック
   */
  const isCategorySelected = useCallback(
    (category: string) => {
      if (!draftConditions.categories || !Array.isArray(draftConditions.categories)) {
        return category === "すべて";
      }
      return draftConditions.categories.includes(category);
    },
    [draftConditions.categories],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ステータスが選択されているかチェック
   */
  const isStatusSelected = useCallback(
    (status: string) => {
      if (!draftConditions.status || !Array.isArray(draftConditions.status)) {
        return status === "all";
      }
      return draftConditions.status.includes(status as AuctionFilterTypes);
    },
    [draftConditions.status],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループが選択されているかチェック
   */
  const isGroupSelected = useCallback(
    (groupId: string | null) => {
      if (groupId === null) {
        return !draftConditions.groupIds || draftConditions.groupIds.length === 0;
      }
      return draftConditions.groupIds?.includes(groupId) ?? false;
    },
    [draftConditions.groupIds],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ソート値を安全に取得する関数
   */
  const getSortField = useCallback(() => {
    if (Array.isArray(draftConditions.sort) && draftConditions.sort.length > 0) {
      return draftConditions.sort[0].field;
    }
    return "newest";
  }, [draftConditions.sort]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ソート方向を安全に取得する関数
   */
  const getSortDirection = useCallback(() => {
    if (Array.isArray(draftConditions.sort) && draftConditions.sort.length > 0) {
      return draftConditions.sort[0].direction;
    }
    return "asc";
  }, [draftConditions.sort]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーグループ情報を取得（TanStack Query v5使用）
   */
  const {
    data: userGroups = [],
    error: userGroupsError,
    isLoading: isUserGroupsLoading,
  } = useQuery({
    queryKey: queryCacheKeys.users.groups(userId),
    queryFn: async () => {
      if (!userId) return [];
      return await getUserGroups(userId);
    },
    enabled: !!userId,
    staleTime: 30 * 60 * 1000, // 10分間キャッシュ
    gcTime: 30 * 60 * 1000, // 30分間ガベージコレクション
  });

  // ユーザーグループのエラーログ出力
  useEffect(() => {
    if (userGroupsError) {
      console.error("ユーザーグループ情報の取得に失敗しました", userGroupsError);
    }
  }, [userGroupsError]);

  // ユーザーグループデータの整形
  const joinTypeinedGroupList = useMemo(() => {
    return userGroups.map((membership) => ({
      id: membership.group.id,
      name: membership.group.name,
    }));
  }, [userGroups]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * すべてのグループが選択されているかを確認
   */
  const areAllGroupsSelected = useMemo(() => {
    // draftConditions.groupIdsがない場合、またはjoinTypeinedGroupListがない場合はtrue
    if (!draftConditions.groupIds || draftConditions.groupIds.length === 0 || joinTypeinedGroupList.length === 0) {
      return true;
    }

    console.log("use-auction-filters_draftConditions.groupIds", draftConditions.groupIds);
    console.log("use-auction-filters_joinTypeinedGroupList", joinTypeinedGroupList);

    // すべてのグループIDが選択されているかチェック
    // draftConditions.groupIdsは、ユーザーが参加している全てのGroupが常に入っている
    // そのため、joinTypeinedGroupList（参加している全てのGroupIDが入った配列）で、draftConditions.groupIdsをチェックする
    return joinTypeinedGroupList.every((group) => {
      return draftConditions.groupIds?.includes(group.id);
    });
  }, [draftConditions.groupIds, joinTypeinedGroupList]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * アクティブなフィルターの数を計算
   */
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
   * @param exclusiveValue 排他的選択値
   * @param isHandleCategorySelect カテゴリ選択時の処理かどうか
   */
  const handleMultiSelect = useCallback(
    <T extends string>(
      field: keyof AuctionListingsConditions,
      value: T,
      defaultValue: T[],
      isExclusive = false,
      exclusiveValue: T,
      isHandleCategorySelect = false,
    ) => {
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
      if (isHandleCategorySelect) {
        setListingsConditionsAction({
          ...listingsConditions,
          [field]: newValues,
        });
      }
    },
    [draftConditions, listingsConditions, setListingsConditionsAction],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * カテゴリ選択時のハンドラ
   * @param category 選択されたカテゴリ
   */
  const handleCategorySelect = useCallback(
    (category: string) => {
      // カテゴリ型を明示的に宣言して型安全性を確保
      const categoryValue = category;
      const defaultCategory = "すべて";

      handleMultiSelect<(typeof AUCTION_CONSTANTS.AUCTION_CATEGORIES)[number]>(
        "categories",
        categoryValue,
        [defaultCategory],
        true,
        defaultCategory,
        true,
      );
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
      console.log("src/hooks/auction/listing/use-auction-filters.ts_handleSearchQueryEnter_Executing search for:", searchQuery);
      // サジェストをクリア
      setHighlightedIndex(-1);
      // 入力値も確定させる
      setChangingSearchQuery(searchQuery);
      // 検索条件を更新。検索時は1ページ目に戻る
      setListingsConditionsAction({
        ...listingsConditions,
        searchQuery: searchQuery,
        page: 1,
      });
    },
    [listingsConditions, setListingsConditionsAction],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * サジェスト選択ハンドラ
   */
  const selectSuggestion = useCallback(
    (suggestionText: string) => {
      console.log("src/hooks/auction/listing/use-auction-filters.ts_selectSuggestion_Suggestion selected:", suggestionText);
      // listingsConditions を更新して検索を実行
      handleSearchQueryEnter(suggestionText); // 検索時は1ページ目に戻る
    },
    [handleSearchQueryEnter],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * サジェストを閉じる関数
   */
  const closeSuggestions = useCallback(() => {
    setHighlightedIndex(-1);
  }, []); // 依存配列は空でOK

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 検索入力欄でのキーダウンイベントハンドラ
   * ↓↑キーでサジェストのハイライトを移動
   * Enterキーでサジェストを選択
   * Command+Enter または Ctrl+Enter の場合 (通常のフォーム送信とは別)
   * Escapeキーでサジェストをクリア
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      // サジェストがある場合
      if (suggestions.length > 0) {
        switch (event.key) {
          // ↓キーでハイライトを下に移動
          case "ArrowDown":
            event.preventDefault(); // デフォルトのカーソル移動を防止
            setHighlightedIndex((prevIndex) => (prevIndex + 1) % suggestions.length);
            break;
          // ↑キーでハイライトを上に移動
          case "ArrowUp":
            event.preventDefault(); // デフォルトのカーソル移動を防止
            setHighlightedIndex((prevIndex) => (prevIndex - 1 + suggestions.length) % suggestions.length);
            break;
          // Enterキーでサジェストを選択
          case "Enter":
            if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
              event.preventDefault();
              selectSuggestion(suggestions[highlightedIndex].text);
            } else if (event.metaKey || event.ctrlKey) {
              event.preventDefault();
              handleSearchQueryEnter(changingSearchQuery ?? "");
            }
            break;
          case "Escape":
            event.preventDefault(); // 他の動作（例：モーダルを閉じる）を防止する場合
            closeSuggestions();
            break;
          default:
            break;
        }
      } else if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        // サジェストがない場合の Command/Ctrl + Enter
        event.preventDefault();
        handleSearchQueryEnter(changingSearchQuery ?? "");
      }
    },
    [suggestions, highlightedIndex, selectSuggestion, handleSearchQueryEnter, changingSearchQuery, closeSuggestions],
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

  /**
   * 価格範囲変更時のハンドラー
   */
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

  /**
   * 残り時間範囲変更時のハンドラー
   */
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
      statusConditionJoinType: "AND",
    };

    setDraftConditions(initialConditions);
    setListingsConditionsAction(initialConditions);
    setShowFilters(false);
  }, [setListingsConditionsAction, setShowFilters]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 残り時間範囲適用時のハンドラー
   */
  const handleTimeRangeApply = useCallback(() => {
    // 残り時間範囲を指定
    handleFilterChange({
      minRemainingTime: draftConditions.minRemainingTime,
      maxRemainingTime: draftConditions.maxRemainingTime,
    });
  }, [handleFilterChange, draftConditions.minRemainingTime, draftConditions.maxRemainingTime]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 残り時間範囲のプリセット設定
   */
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

  /**
   * 価格範囲適用時のハンドラー
   */
  const handlePriceRangeApply = useCallback(() => {
    handleFilterChange({
      minBid: draftConditions.minBid,
      maxBid: draftConditions.maxBid,
    });
  }, [handleFilterChange, draftConditions]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルター表示切り替え
   */
  const toggleFilterDisplay = useCallback(() => {
    setShowFilters(!showFilters);
  }, [showFilters]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 価格範囲のプリセット設定
   */
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
    setShowFilters(false);
  }, [draftConditions, setListingsConditionsAction, setShowFilters]);

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

  /**
   * 価格範囲をリセット
   */
  const resetPriceRange = useCallback(() => {
    setDraftConditions({
      ...draftConditions,
      minBid: null,
      maxBid: null,
    });
  }, [draftConditions]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 残り時間範囲をリセット
   */
  const resetTimeRange = useCallback(() => {
    setDraftConditions({
      ...draftConditions,
      minRemainingTime: null,
      maxRemainingTime: null,
    });
  }, [draftConditions]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 返す
   */
  return {
    // state
    listingsConditions,
    draftConditions,
    showFilters,
    activeFilterCount,
    openGroupCombobox,
    changingSearchQuery,
    categoriesList,
    areAllGroupsSelected,
    joinTypeinedGroupList,

    // loading states
    isSuggestionsLoading,
    isUserGroupsLoading,

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

    // サジェスト関連
    suggestions,
    highlightedIndex,
    selectSuggestion,
    handleKeyDown,
    closeSuggestions,

    // utilities
    isCategorySelected,
    isStatusSelected,
    isGroupSelected,
    getSortField,
    getSortDirection,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
