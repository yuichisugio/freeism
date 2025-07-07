"use client";

import type {
  EditableReviewData,
  ReviewSearchParams,
  SearchSuggestion,
} from "@/components/review-search/review-search";
import type { ReviewSearchTab } from "@/lib/constants";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getAllReviews,
  getMyReviews,
  getSearchSuggestions,
  getUserReviews,
  updateReview,
} from "@/actions/review-search/review-search";
import { REVIEW_SEARCH_CONSTANTS } from "@/lib/constants";
import { queryCacheKeys } from "@/library-setting/tanstack-query";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * レビューデータとその操作を管理するカスタムフック
 */
export function useReviewSearch() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タブ
   */
  const [activeTab, setActiveTab] = useQueryState("tab", {
    defaultValue: "search" as ReviewSearchTab,
    parse: (value) => {
      if (REVIEW_SEARCH_CONSTANTS.TAB_TYPES.includes(value as ReviewSearchTab)) return value;
      return "search";
    },
    history: "push",
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 検索クエリ
   */
  const [searchQuery, setSearchQuery] = useQueryState("q", {
    defaultValue: "",
    history: "push",
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ページ
   */
  const [page, setPage] = useQueryState("page", {
    defaultValue: 1,
    parse: (value) => parseInt(value) || 1,
    history: "push",
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 検索状態の管理
   */
  const searchParams: ReviewSearchParams = useMemo(
    () => ({
      searchQuery,
      page,
      tab: activeTab as ReviewSearchTab,
    }),
    [searchQuery, page, activeTab],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * サジェスト機能の状態管理
   */
  const [suggestionQuery, setSuggestionQuery] = useState(searchQuery);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 編集状態の管理
   */
  const [editingReviews, setEditingReviews] = useState<Set<string>>(new Set());

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * debounce用のref
   */
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [debouncedSuggestionQuery, setDebouncedSuggestionQuery] = useState<string>("");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * debounce処理
   */
  useEffect(() => {
    // 以前のタイムアウトがあればクリア
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
    }

    // 新しいタイムアウトを設定
    suggestionTimeoutRef.current = setTimeout(() => {
      setDebouncedSuggestionQuery(suggestionQuery);
    }, 400); // 400ミリ秒のデバウンス

    // クリーンアップ関数
    return () => {
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current);
      }
    };
  }, [suggestionQuery]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * searchQueryが外部から変更された時のみsuggestQueryを同期（初期化時など）
   */
  useEffect(() => {
    // URLパラメータからの初期化やタブ切り替え時のみ同期
    // ユーザーが入力中の場合は同期しない
    if (suggestionQuery === "" || !showSuggestions) {
      setSuggestionQuery(searchQuery);
    }
  }, [searchQuery, showSuggestions, suggestionQuery]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * メインのレビューデータを取得するクエリ
   */
  const {
    data: reviewData,
    isPending: isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["reviews", activeTab, searchParams],
    queryFn: () => {
      switch (activeTab) {
        case "edit":
          return getMyReviews(searchParams);
        case "received":
          return getUserReviews(searchParams);
        default:
          return getAllReviews(searchParams);
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * サジェストデータを取得するクエリ
   */
  const { data: suggestionsResponse } = useQuery({
    queryKey: queryCacheKeys.review.suggestions(debouncedSuggestionQuery),
    queryFn: () => getSearchSuggestions(debouncedSuggestionQuery),
    enabled: debouncedSuggestionQuery.length >= 2 && showSuggestions,
    staleTime: 30 * 1000,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビュー更新のミューテーション
   */
  const { mutate: updateReviewMutate, isPending } = useMutation({
    mutationFn: ({ reviewId, rating, comment }: { reviewId: string; rating: number; comment: string | null }) =>
      updateReview(reviewId, rating, comment, searchParams),
    onSuccess: (_updatedReview, variables) => {
      // 編集モードを終了
      setEditingReviews((prev) => {
        const newSet = new Set(prev);
        newSet.delete(variables.reviewId);
        return newSet;
      });
    },
    meta: {
      invalidateCacheKeys: [{ queryKey: queryCacheKeys.review.all(), exact: false }],
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビュー更新のハンドラー関数
   */
  const handleUpdateReview = useCallback(
    (reviewId: string, rating: number, comment: string | null) => {
      updateReviewMutate({ reviewId, rating, comment });
    },
    [updateReviewMutate],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 検索クエリを更新する関数（入力フィールド用）
   */
  const updateSearchQuery = useCallback(
    (query: string) => {
      setSuggestionQuery(query);
      void setPage(1); // ページをリセット
      // 入力中はサジェストを表示
      if (query.length >= 2) {
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    },
    [setSuggestionQuery, setPage, setShowSuggestions],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 検索を実行する関数
   */
  const executeSearch = useCallback(() => {
    void setSearchQuery(suggestionQuery); // 検索実行時にsearchQueryを更新
    void setPage(1); // ページをリセット
    setShowSuggestions(false); // サジェストを閉じる
  }, [setSearchQuery, setPage, setShowSuggestions, suggestionQuery]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 検索をクリアする関数
   */
  const clearSearch = useCallback(() => {
    // debounceタイムアウトをクリア
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
    }
    setSuggestionQuery("");
    void setSearchQuery("");
    setDebouncedSuggestionQuery("");
    void setPage(1);
    setShowSuggestions(false);
  }, [setSuggestionQuery, setSearchQuery, setPage, setShowSuggestions]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タブを変更する関数
   */
  const changeTab = useCallback(
    (tab: ReviewSearchTab) => {
      void setActiveTab(tab);
      void setPage(1); // ページをリセット
    },
    [setActiveTab, setPage],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ページを変更する関数
   */
  const changePage = useCallback(
    (newPage: number) => {
      void setPage(newPage);
    },
    [setPage],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * サジェストを選択した時の処理
   */
  const selectSuggestion = useCallback(
    (suggestion: SearchSuggestion) => {
      // 入力フィールドの値を選択されたサジェストに設定
      setSuggestionQuery(suggestion.value);
      // 即座に検索を実行
      void setSearchQuery(suggestion.value);
      void setPage(1); // ページをリセット
      setShowSuggestions(false);
    },
    [setSuggestionQuery, setSearchQuery, setPage, setShowSuggestions],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビュー編集モードを切り替える関数
   */
  const toggleEditMode = useCallback(
    (reviewId: string) => {
      setEditingReviews((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(reviewId)) {
          newSet.delete(reviewId);
        } else {
          newSet.add(reviewId);
        }
        return newSet;
      });
    },
    [setEditingReviews],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * コンポーネントのアンマウント時のクリーンアップ
   */
  useEffect(() => {
    return () => {
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current);
      }
    };
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 編集可能なレビューデータを作成
   */
  const editableReviews: EditableReviewData[] = useMemo(() => {
    const reviews = reviewData?.data?.reviews ?? [];
    return reviews.map((review) => ({
      ...review,
      isEditing: editingReviews.has(review.id),
    }));
  }, [reviewData?.data?.reviews, editingReviews]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビュー検索フックの返り値
   */
  return {
    // データ
    reviews: editableReviews,
    totalCount: reviewData?.data?.totalCount ?? 0,
    totalPages: reviewData?.data?.totalPages ?? 0,
    suggestions: suggestionsResponse?.data ?? [],

    // 状態
    searchParams,
    activeTab,
    suggestionQuery,
    isLoading,
    error,
    showSuggestions,
    isUpdating: isPending,

    // アクション
    updateSearchQuery,
    executeSearch,
    clearSearch,
    changeTab,
    changePage,
    selectSuggestion,
    setShowSuggestions,
    toggleEditMode,
    handleUpdateReview,
    refetch,
  };
}
