"use client";

import type { EditableReviewData, SearchSuggestion } from "@/components/review-search/review-search";
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
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * レビューデータとその操作を管理するカスタムフック
 */
export function useReviewSearch() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * URLパタメータ・条件の管理
   */
  const [searchParams, setSearchParams] = useQueryStates({
    tab: parseAsStringLiteral(REVIEW_SEARCH_CONSTANTS.TAB_TYPES).withDefault("search"),
    page: parseAsInteger.withDefault(1),
    q: parseAsString.withDefault(""),
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * state
   */
  // 検索欄に入力中の検索ワードを保持するstate。debouncedSuggestionQueryとは別に管理する。
  const [suggestionQuery, setSuggestionQuery] = useState<string>(searchParams.q);

  // サジェストを表示するかどうかを管理するstate
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  // debounce用の経過時間を保持するref
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // debounce用時に、サジェストを検索するための検索ワードを保持するstate
  const [debouncedSuggestionQuery, setDebouncedSuggestionQuery] = useState<string>("");

  // 編集状態の管理
  const [editingReviews, setEditingReviews] = useState<Set<string>>(new Set<string>());

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Hydration対策：クライアント側でマウント状態を管理
   */
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * debounce処理
   * 検索ワードが入ってから400ms後にdebouncedSuggestionQueryを更新する
   * それにより、連続的な入力の際に、入力途中でサジェストの検索を何度も行わないようにする。
   */
  useEffect(() => {
    // 以前のタイムアウトがあればクリア
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
    }

    // 空の文字列の場合は即座に更新（削除時の高速レスポンス）
    if (suggestionQuery === "") {
      setDebouncedSuggestionQuery("");
      return;
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
   * メインのレビューデータを取得するクエリ
   */
  const {
    data: reviewData,
    isPending: isReviewPending,
    refetch,
  } = useQuery({
    queryKey: queryCacheKeys.review.searchAndTab(searchParams),
    queryFn: () => {
      switch (searchParams.tab) {
        case "edit":
          return getMyReviews(searchParams);
        case "received":
          return getUserReviews(searchParams);
        default:
          return getAllReviews(searchParams);
      }
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * サジェストデータを取得するクエリ
   * Strict Modeにより、レンダリング後すぐに検索欄の文字を削除すると、削除前に戻るが大きな問題ではない。
   */
  const { data: suggestionsResponse } = useQuery({
    queryKey: queryCacheKeys.review.suggestions(debouncedSuggestionQuery),
    queryFn: () => getSearchSuggestions(debouncedSuggestionQuery),
    enabled: debouncedSuggestionQuery.length >= 2 && showSuggestions && debouncedSuggestionQuery.trim() !== "",
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビュー更新のミューテーション
   */
  const { mutate: updateReviewMutate, isPending: isUpdateReviewPending } = useMutation({
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
      invalidateCacheKeys: [
        { queryKey: queryCacheKeys.review.searchAndTab(searchParams), exact: false },
        { queryKey: queryCacheKeys.review.suggestions(searchParams.q), exact: false },
      ],
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 検索クエリを更新する関数（入力フィールド用）
   */
  const updateSearchQuery = useCallback(
    (query: string) => {
      // 入力中の検索ワードを更新。常に呼ぶ必要がある。Formのvalueと同期させる必要があるため。
      setSuggestionQuery(query);
      // 入力中はサジェストを表示（空白文字のみでない場合）
      if (query.length >= 2 && query.trim() !== "") {
        setShowSuggestions(true);
        // executeSearchを呼ぶときにURLパラメータに入れるため、↓ではqを指定しない
        void setSearchParams({ ...searchParams, page: 1 });
      } else {
        setShowSuggestions(false);
      }
    },
    [setSearchParams, searchParams],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 検索をクリアする関数
   * 検索欄のバツボタンを押した時に呼ばれる
   */
  const clearSearch = useCallback(() => {
    // debounceタイムアウトをクリア
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
    }
    // 同期して全ての状態をクリア
    setSuggestionQuery("");
    setDebouncedSuggestionQuery("");
    void setSearchParams({ ...searchParams, q: "", page: 1 });
    setShowSuggestions(false);
  }, [setSearchParams, searchParams, setShowSuggestions]);

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
    activeTab: searchParams.tab,
    suggestionQuery,
    isLoading: isReviewPending,
    showSuggestions,
    isUpdating: isUpdateReviewPending,
    isMounted,

    // アクション
    updateSearchQuery,
    clearSearch,
    setShowSuggestions,
    toggleEditMode,
    handleUpdateReview: updateReviewMutate,
    refetch,
    executeSearch: useCallback(() => {
      void setSearchParams({ ...searchParams, q: suggestionQuery, page: 1 });
      setShowSuggestions(false);
    }, [setSearchParams, searchParams, setShowSuggestions, suggestionQuery]),
    changeTab: useCallback(
      (tab: ReviewSearchTab) => {
        void setSearchParams({ ...searchParams, tab, page: 1 });
        setShowSuggestions(false);
      },
      [setSearchParams, searchParams, setShowSuggestions],
    ),
    changePage: useCallback(
      (newPage: number) => {
        void setSearchParams({ ...searchParams, page: newPage });
        setShowSuggestions(false);
      },
      [setSearchParams, searchParams, setShowSuggestions],
    ),
    selectSuggestion: useCallback(
      (suggestion: SearchSuggestion) => {
        setSuggestionQuery(suggestion.value);
        void setSearchParams({ ...searchParams, q: suggestion.value, page: 1 });
        setShowSuggestions(false);
      },
      [setSearchParams, searchParams, setShowSuggestions],
    ),
  };
}
