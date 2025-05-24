"use client";

import type { ReviewSearchParams, SearchSuggestion } from "@/components/review-search/review-search";
import { useMemo, useState } from "react";
import { getSearchSuggestions, getUserReviews } from "@/lib/actions/review-search/review-search";
import { useQuery } from "@tanstack/react-query";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * レビューデータとその操作を管理するカスタムフック
 * @param userId - 対象ユーザーのID
 */
export function useReviewSearch() {
  // 検索状態の管理
  const [searchParams, setSearchParams] = useState<ReviewSearchParams>({
    searchType: "username", // デフォルトはユーザー名検索
    searchQuery: "",
    page: 1,
    limit: 10,
  });

  // サジェスト機能の状態管理
  const [suggestionQuery, setSuggestionQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // メインのレビューデータを取得するクエリ
  // TanStack Query でキャッシングと再フェッチを管理
  const {
    data: reviewData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["user-reviews", searchParams], // キャッシュキー
    queryFn: () => getUserReviews(searchParams), // データ取得関数
    staleTime: 5 * 60 * 1000, // 5分間はキャッシュを新鮮とみなす
    gcTime: 10 * 60 * 1000, // 10分間キャッシュを保持
  });

  // サジェストデータを取得するクエリ
  const { data: suggestions = [] } = useQuery({
    queryKey: ["search-suggestions", suggestionQuery, searchParams.searchType],
    queryFn: () => getSearchSuggestions(suggestionQuery, searchParams.searchType),
    enabled: suggestionQuery.length >= 2 && showSuggestions, // 2文字以上かつサジェスト表示中のみ実行
    staleTime: 30 * 1000, // 30秒間はキャッシュを新鮮とみなす
  });

  // 検索パラメータを更新する関数
  const updateSearchParams = (newParams: Partial<ReviewSearchParams>) => {
    setSearchParams((prev) => ({
      ...prev,
      ...newParams,
      page: newParams.page ?? 1, // ページはリセット（検索条件変更時）
    }));
  };

  // 検索クエリを更新する関数
  const updateSearchQuery = (query: string) => {
    setSuggestionQuery(query);
    updateSearchParams({ searchQuery: query });
  };

  // 検索タイプを変更する関数
  const updateSearchType = (type: ReviewSearchParams["searchType"]) => {
    updateSearchParams({
      searchType: type,
      searchQuery: "", // 検索タイプ変更時はクエリをリセット
    });
    setSuggestionQuery("");
  };

  // ページを変更する関数
  const changePage = (page: number) => {
    updateSearchParams({ page });
  };

  // サジェストを選択した時の処理
  const selectSuggestion = (suggestion: SearchSuggestion) => {
    updateSearchQuery(suggestion.value);
    setShowSuggestions(false);
  };

  // 平均評価の星表示用の計算
  const averageRatingStars = useMemo(() => {
    if (!reviewData?.averageRating) return { full: 0, half: false, empty: 5 };

    const rating = reviewData.averageRating;
    const full = Math.floor(rating); // 満点の星の数
    const half = rating % 1 >= 0.5; // 半分の星が必要かどうか
    const empty = 5 - full - (half ? 1 : 0); // 空の星の数

    return { full, half, empty };
  }, [reviewData?.averageRating]);

  return {
    // データ
    reviews: reviewData?.reviews ?? [],
    totalCount: reviewData?.totalCount ?? 0,
    averageRating: reviewData?.averageRating ?? 0,
    totalPages: reviewData?.totalPages ?? 0,
    suggestions,
    averageRatingStars,

    // 状態
    searchParams,
    isLoading,
    error,
    showSuggestions,

    // アクション
    updateSearchQuery,
    updateSearchType,
    changePage,
    selectSuggestion,
    setShowSuggestions,
    refetch,
  };
}
