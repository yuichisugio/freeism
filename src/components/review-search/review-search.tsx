"use client";

import type { ReviewSearchTab } from "@/lib/constants";
import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReviewSearch } from "@/hooks/review-search/use-review-search";

import { ReviewCard } from "./review-search-card";
import { ReviewSearchForm } from "./review-search-form";
import { ReviewPagination } from "./review-search-pagination";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * レビュー編集用の型定義
 */
export type EditableReviewData = ReviewData & {
  isEditing?: boolean; // 編集モード中かどうか
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * レビューデータの型定義
 */
export type ReviewData = {
  id: string; // レビューの一意識別子
  rating: number; // 1-5の評価（5段階評価）
  comment: string | null; // レビューコメント（任意）
  createdAt: Date; // レビュー作成日時
  updatedAt: Date; // レビュー最終更新日時
  reviewPosition: "SELLER_TO_BUYER" | "BUYER_TO_SELLER"; // レビューの立場（売り手→買い手、買い手→売り手）
  // レビューの送信者と受信者の情報
  reviewer: {
    id: string; // レビュー送信者のID
    username: string; // レビュー送信者のユーザー名
  } | null; // 編集タブでは不要なのでnull許可
  reviewee: {
    id: string; // レビュー受信者のID
    username: string; // レビュー受信者のユーザー名
  } | null; // 安全性のためnull許可
  auction: {
    id: string; // オークションID
    task: {
      id: string; // タスクID
      task: string; // タスクの内容
      category: string | null; // タスクのカテゴリ
      group: {
        id: string; // グループID
        name: string; // グループ名
      };
    };
  };
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 検索条件の型定義
 */
export type ReviewSearchParams = {
  searchQuery: string; // 検索クエリ文字列
  page: number; // ページネーション用のページ番号
  tab: ReviewSearchTab; // タブの種類
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 検索結果の型定義
 */
export type ReviewSearchResult = {
  reviews: ReviewData[]; // レビューデータの配列
  totalCount: number; // 検索結果の総件数
  totalPages: number; // 総ページ数
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * サジェスト機能用の型定義
 */
export type SearchSuggestion = {
  value: string; // 実際の値（IDなど）
  label: string; // 表示用のラベル
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * レビューリストを表示するコンポーネント
 */
export const ReviewSearchList = memo(function ReviewSearchList({
  reviews,
  activeTab,
  searchParams,
  isLoading,
  isUpdating,
  toggleEditMode,
  handleUpdateReview,
}: {
  reviews: ReviewData[];
  activeTab: ReviewSearchTab;
  searchParams: ReviewSearchParams;
  isLoading: boolean;
  isUpdating: boolean;
  toggleEditMode: (reviewId: string) => void;
  handleUpdateReview: (reviewId: string, rating: number, comment: string | null) => void;
}) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ローディング状態。スケルトンUI
   */
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-1/4 rounded bg-gray-200"></div>
                <div className="h-4 w-3/4 rounded bg-gray-200"></div>
                <div className="h-16 rounded bg-gray-200"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビューが存在しない場合
   */
  if (reviews.length === 0) {
    // 空のメッセージ
    let emptyMessage: string;

    // 検索条件に一致するレビューが見つからない場合
    if (searchParams.searchQuery) {
      emptyMessage = "検索条件に一致するレビューが見つかりませんでした。";
    }

    // タブによってメッセージを変える
    switch (activeTab) {
      case "search":
        emptyMessage = "まだレビューが投稿されていません。";
        break;
      case "edit":
        emptyMessage = "まだレビューを書いていません。";
        break;
      case "received":
        emptyMessage = "まだレビューを受け取っていません。";
        break;
      default:
        emptyMessage = "まだレビューがありません。";
    }

    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">{emptyMessage}</CardContent>
      </Card>
    );
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビューリストの表示
   */
  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <ReviewCard
          key={review.id}
          review={review}
          editable={activeTab === "edit"}
          onToggleEdit={toggleEditMode}
          onUpdateReview={handleUpdateReview}
          isUpdating={isUpdating}
        />
      ))}
    </div>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーレビュー表示のメインコンポーネント
 */
export const ReviewSearch = memo(function ReviewSearch() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビュー検索のフック
   */
  const {
    // state
    reviews,
    totalPages,
    searchParams,
    activeTab,
    suggestionQuery,
    isLoading,
    suggestions,
    showSuggestions,
    isUpdating,

    // function
    updateSearchQuery,
    changeTab,
    changePage,
    selectSuggestion,
    setShowSuggestions,
    toggleEditMode,
    handleUpdateReview,
    executeSearch,
    clearSearch,
  } = useReviewSearch();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビュー検索のメインコンポーネント
   */
  return (
    <div className="space-y-6">
      {/* 検索フォーム */}
      <ReviewSearchForm
        searchParams={searchParams}
        suggestionQuery={suggestionQuery}
        suggestions={suggestions}
        showSuggestions={showSuggestions}
        onSearchQueryChange={updateSearchQuery}
        onSuggestionSelect={selectSuggestion}
        onSuggestionsToggle={setShowSuggestions}
        onSearchExecute={executeSearch}
        onClearSearch={clearSearch}
      />

      {/* タブ機能 */}
      <Tabs value={activeTab} onValueChange={(value) => changeTab(value as ReviewSearchTab)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="search">レビュー検索</TabsTrigger>
          <TabsTrigger value="edit">レビュー編集</TabsTrigger>
          <TabsTrigger value="received">自身へのレビュー</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-4">
          <div className="text-sm text-gray-600">他のユーザーのレビューを検索・閲覧できます。</div>
          <ReviewSearchList
            reviews={reviews}
            activeTab={activeTab as ReviewSearchTab}
            searchParams={searchParams}
            isLoading={isLoading}
            isUpdating={isUpdating}
            toggleEditMode={toggleEditMode}
            handleUpdateReview={handleUpdateReview}
          />
        </TabsContent>

        <TabsContent value="edit" className="space-y-4">
          <div className="text-sm text-gray-600">
            あなたが書いたレビューを編集できます。評価やコメントを変更することができます。
            <br />
            <span className="text-amber-600">
              ※
              データは15分間隔でキャッシュされており、他のユーザーからの最新の変更が反映されるまで最大15分かかる場合があります。
            </span>
          </div>
          <ReviewSearchList
            reviews={reviews}
            activeTab={activeTab as ReviewSearchTab}
            searchParams={searchParams}
            isLoading={isLoading}
            isUpdating={isUpdating}
            toggleEditMode={toggleEditMode}
            handleUpdateReview={handleUpdateReview}
          />
        </TabsContent>

        <TabsContent value="received" className="space-y-4">
          <div className="text-sm text-gray-600">あなたが受け取ったレビューを確認できます。</div>
          <ReviewSearchList
            reviews={reviews}
            activeTab={activeTab as ReviewSearchTab}
            searchParams={searchParams}
            isLoading={isLoading}
            isUpdating={isUpdating}
            toggleEditMode={toggleEditMode}
            handleUpdateReview={handleUpdateReview}
          />
        </TabsContent>
      </Tabs>

      {/* ページネーション */}
      <ReviewPagination currentPage={searchParams.page ?? 1} totalPages={totalPages} onPageChange={changePage} />
    </div>
  );
});
