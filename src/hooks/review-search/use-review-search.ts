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
 *
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
  // サジェストを表示するかどうかを管理するstate
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  // 検索パラメータを固定するためのstate。useQueryのqueryKeyに使用する。searchParamsとは別に管理する。
  // searchParamsをuseQueryに、そのまま渡すと、キャッシュキー（searchParams）が変わるごとに、データ取得してしまう。
  // でも、searchParams(URLパラメータ)と、検索欄の入力値を同期させないと、途中で別のレンダリングが入ると、変更前の入力値が表示されてしまい、入力内容が戻るバグに見える。
  // なので、searchParamsとは別で、キャッシュキーの管理が必要で、入力値が変わるたびに変更するのではなく、データ取得をしたいタイミングに更新して、useQueryを実行する必要がある
  // 冗長的だけど、↓は必要。
  const [fixedSearchParams, setFixedSearchParams] = useState(searchParams);

  // 編集状態の管理
  const [editingReviews, setEditingReviews] = useState<Set<string>>(new Set<string>());

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Hydration対策
   * クライアント側でマウント状態を管理
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
  // タイムアウトの参照を保持するためのref
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // debounce用に、サジェストを検索するための検索ワードを保持するstate
  const [debouncedSuggestionQuery, setDebouncedSuggestionQuery] = useState<string>("");

  // 検索ワードが変更されたら、debounce処理を行う
  useEffect(() => {
    // 以前のタイムアウトがあればクリア
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
    }

    // 空の文字列の場合は即座に更新（削除時の高速レスポンス）
    if (searchParams.q === "") {
      setDebouncedSuggestionQuery("");
      return;
    }

    // 新しいタイムアウトを設定。500ミリ秒後にdebouncedSuggestionQueryを更新する
    suggestionTimeoutRef.current = setTimeout(() => {
      setDebouncedSuggestionQuery(searchParams.q);
    }, 500);

    // クリーンアップ関数
    return () => {
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current);
      }
    };
  }, [searchParams.q]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * メインのレビューデータを取得するクエリ
   */
  const { data: reviewData, isPending: isReviewPending } = useQuery({
    queryKey: queryCacheKeys.review.searchAndTab(fixedSearchParams),
    queryFn: () => {
      switch (fixedSearchParams.tab) {
        case "edit":
          return getMyReviews(fixedSearchParams);
        case "received":
          return getUserReviews(fixedSearchParams);
        default:
          return getAllReviews(fixedSearchParams);
      }
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * サジェストデータを取得するクエリ
   * Strict Modeにより、レンダリング後すぐに検索欄の文字を削除すると、削除前に戻るが大きな問題ではない。
   * useDeferredValueを使用すると、debouncedSuggestionQueryの更新が遅れるため、
   */
  const { data: suggestionsResponse } = useQuery({
    queryKey: queryCacheKeys.review.suggestions(debouncedSuggestionQuery),
    queryFn: () => getSearchSuggestions(debouncedSuggestionQuery),
    enabled: debouncedSuggestionQuery.trim().length >= 2,
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
    isLoading: isReviewPending,
    showSuggestions,
    isUpdating: isUpdateReviewPending,
    isMounted,

    // アクション
    setShowSuggestions,
    toggleEditMode,
    handleUpdateReview: updateReviewMutate,

    // 検索をクリアする関数
    clearSearch: useCallback(() => {
      setFixedSearchParams({ ...searchParams, q: "", page: 1 });
      void setSearchParams({ ...searchParams, q: "", page: 1 });
      setShowSuggestions(false);
    }, [setSearchParams, searchParams, setShowSuggestions]),

    // 検索ワードを更新する関数
    updateSearchQuery: useCallback(
      (query: string) => {
        // 入力中の検索ワードを更新。常に呼ぶ必要がある。Formのvalueと同期させる必要があるため。
        void setSearchParams({ ...searchParams, q: query });
        //! ここで、setFixedSearchParamsを呼ぶのはNG。useQueryのqueryKeyに使用している。呼ぶと、検索欄で入力するたびにデータ取得してしまう。
        // 入力中はサジェストを表示（空白文字のみでない場合）
        setShowSuggestions(query.trim().length >= 2);
      },
      [setSearchParams, searchParams, setShowSuggestions],
    ),

    // 検索を実行する関数
    executeSearch: useCallback(() => {
      setFixedSearchParams({ ...searchParams, q: searchParams.q, page: 1 });
      // nuqsのsearchParamsは、入力値と同期しているので、↓でqを渡す必要はない
      void setSearchParams({ ...searchParams, page: 1 });
      setShowSuggestions(false);
    }, [setSearchParams, searchParams, setShowSuggestions, setFixedSearchParams]),

    // タブを切り替える関数
    changeTab: useCallback(
      (tab: ReviewSearchTab) => {
        setFixedSearchParams({ ...searchParams, tab, page: 1 });
        void setSearchParams({ ...searchParams, tab, page: 1 });
        setShowSuggestions(false);
      },
      [setSearchParams, searchParams, setShowSuggestions, setFixedSearchParams],
    ),

    // ページを変更する関数
    changePage: useCallback(
      (newPage: number) => {
        setFixedSearchParams({ ...searchParams, page: newPage });
        void setSearchParams({ ...searchParams, page: newPage });
        setShowSuggestions(false);
      },
      [setSearchParams, searchParams, setShowSuggestions, setFixedSearchParams],
    ),

    // サジェストを選択する関数
    selectSuggestion: useCallback(
      (suggestion: SearchSuggestion) => {
        setFixedSearchParams({ ...searchParams, q: suggestion.value, page: 1 });
        void setSearchParams({ ...searchParams, q: suggestion.value, page: 1 });
        setShowSuggestions(false);
      },
      [setSearchParams, searchParams, setShowSuggestions, setFixedSearchParams],
    ),
  };
}
