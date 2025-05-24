"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { RatingStar } from "@/components/auction/common/rating-star";
import { Error } from "@/components/share/share-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useReviewSearch } from "@/hooks/review-search/use-review-search";
import { useReviewSuggest } from "@/hooks/review-search/use-review-suggest";
import { Calendar, ChevronLeft, ChevronRight, Edit, Hash, MoreHorizontal, Package, Save, Search, Star, Users, X } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ページネーション用の型定義
 */
type ReviewPaginationProps = {
  currentPage: number; // 現在のページ番号
  totalPages: number; // 総ページ数
  onPageChange: (page: number) => void; // ページ変更時のコールバック
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
  tab?: "search" | "edit" | "received"; // タブの種類
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
 * レビュー編集用の型定義
 */
export type EditableReviewData = ReviewData & {
  isEditing?: boolean; // 編集モード中かどうか
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

type ReviewSearchFormProps = {
  searchParams: ReviewSearchParams; // 現在の検索パラメータ
  suggestionQuery: string; // サジェスト用のクエリ
  suggestions: SearchSuggestion[]; // サジェスト候補
  showSuggestions: boolean; // サジェスト表示状態
  onSearchQueryChange: (query: string) => void; // 検索クエリ変更時のコールバック
  onSuggestionSelect: (suggestion: SearchSuggestion) => void; // サジェスト選択時のコールバック
  onSuggestionsToggle: (show: boolean) => void; // サジェスト表示切り替えのコールバック
  onSearchExecute: () => void; // 検索実行時のコールバック
  onClearSearch: () => void; // 検索クリア時のコールバック
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * レビュー検索フォームコンポーネント
 * ラジオボタンで検索対象を選択し、入力フィールドで検索を行う
 * リアルタイムサジェスト機能も提供
 */
export const ReviewSearchForm = memo(function ReviewSearchForm({
  suggestionQuery,
  suggestions,
  showSuggestions,
  onSearchQueryChange,
  onSuggestionSelect,
  onSuggestionsToggle,
  onSearchExecute,
  onClearSearch,
}: ReviewSearchFormProps) {
  const { inputRef, suggestionRef, selectedIndex, handleKeyDown } = useReviewSuggest({
    onSuggestionsToggleAction: onSuggestionsToggle,
    suggestions,
    onSuggestionSelect,
    onSearchExecute,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchExecute();
    onSuggestionsToggle(false);
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          {/* 検索アイコン付きの入力フィールド */}
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-500" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={"検索キーワードを入力してください（ユーザー名、コメント、グループ名、タスク名等）"}
            value={suggestionQuery}
            onChange={(e) => {
              onSearchQueryChange(e.target.value);
            }}
            onFocus={() => {
              // フォーカス時、既に2文字以上入力されていればサジェストを表示
              if (suggestionQuery.length >= 2) {
                onSuggestionsToggle(true);
              }
            }}
            onKeyDown={handleKeyDown}
            className="pr-10 pl-10"
          />
          {/* クリアボタン：検索クエリが入力されている場合のみ表示 */}
          {suggestionQuery && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onClearSearch();
                inputRef.current?.focus();
              }}
              className="absolute top-1/2 right-1 h-8 w-8 -translate-y-1/2 transform p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* 検索ボタン */}
        <Button type="submit" className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700">
          <Search className="h-4 w-4" />
          検索
        </Button>
      </div>

      {/* サジェストリスト */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionRef}
          className="absolute top-full right-0 left-0 z-10 mt-1 max-h-60 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.value}-${index}`}
              type="button"
              onClick={() => onSuggestionSelect(suggestion)}
              className={`w-full border-b border-gray-100 px-4 py-2 text-left transition-colors last:border-b-0 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none ${
                index === selectedIndex ? "border-blue-200 bg-blue-50" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="truncate text-sm text-gray-900">{suggestion.label}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </form>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ページネーションコンポーネント
 * 大量のレビューデータを複数ページに分けて表示する際に使用
 * 現在のページ周辺のページ番号を表示し、効率的なナビゲーションを提供
 */
export const ReviewPagination = memo(function ReviewPagination({ currentPage, totalPages, onPageChange }: ReviewPaginationProps) {
  // 表示する最大ページ番号ボタン数
  const maxVisiblePages = 7;

  // 表示するページ番号の範囲を計算
  const getVisiblePageNumbers = useCallback(() => {
    if (totalPages <= maxVisiblePages) {
      // 総ページ数が最大表示数以下の場合、すべてのページを表示
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const halfVisible = Math.floor(maxVisiblePages / 2);
    let start = currentPage - halfVisible;
    let end = currentPage + halfVisible;

    // 開始ページが1未満にならないよう調整
    if (start < 1) {
      start = 1;
      end = Math.min(maxVisiblePages, totalPages);
    }

    // 終了ページが総ページ数を超えないよう調整
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, totalPages - maxVisiblePages + 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [currentPage, totalPages, maxVisiblePages]);

  const visiblePages = getVisiblePageNumbers();
  const showFirstPage = visiblePages[0] > 1; // 最初のページを個別表示するか
  const showLastPage = visiblePages[visiblePages.length - 1] < totalPages; // 最後のページを個別表示するか
  const showStartEllipsis = visiblePages[0] > 2; // 開始省略記号を表示するか
  const showEndEllipsis = visiblePages[visiblePages.length - 1] < totalPages - 1; // 終了省略記号を表示するか

  return (
    <div className="flex items-center justify-center gap-1">
      {/* 前のページボタン */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-gray-700"
      >
        <ChevronLeft className="h-4 w-4" />
        前へ
      </Button>

      {/* 最初のページ（1ページ目）*/}
      {showFirstPage && (
        <>
          <Button
            variant={currentPage === 1 ? "default" : "outline"}
            size="sm"
            onClick={() => onPageChange(1)}
            className={`min-w-[40px] rounded-md px-3 py-2 text-sm font-medium ${
              currentPage === 1
                ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            1
          </Button>
          {showStartEllipsis && (
            <span className="flex items-center px-2 text-gray-500">
              <MoreHorizontal className="h-4 w-4" />
            </span>
          )}
        </>
      )}

      {/* 表示範囲内のページ番号 */}
      {visiblePages.map((pageNum) => (
        <Button
          key={pageNum}
          variant={currentPage === pageNum ? "default" : "outline"}
          size="sm"
          onClick={() => onPageChange(pageNum)}
          className={`min-w-[40px] rounded-md px-3 py-2 text-sm font-medium ${
            currentPage === pageNum
              ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
              : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900"
          }`}
        >
          {pageNum}
        </Button>
      ))}

      {/* 最後のページ */}
      {showLastPage && (
        <>
          {showEndEllipsis && (
            <span className="flex items-center px-2 text-gray-500">
              <MoreHorizontal className="h-4 w-4" />
            </span>
          )}
          <Button
            variant={currentPage === totalPages ? "default" : "outline"}
            size="sm"
            onClick={() => onPageChange(totalPages)}
            className={`min-w-[40px] rounded-md px-3 py-2 text-sm font-medium ${
              currentPage === totalPages
                ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            {totalPages}
          </Button>
        </>
      )}

      {/* 次のページボタン */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-gray-700"
      >
        次へ
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 編集可能なレビューカードコンポーネント
 */
const EditableReviewCard = memo(function EditableReviewCard({
  review,
  onToggleEdit,
  onUpdateReview,
  isUpdating,
}: {
  review: EditableReviewData;
  onToggleEdit: (reviewId: string) => void;
  onUpdateReview: (reviewId: string, rating: number, comment: string | null) => void;
  isUpdating: boolean;
}) {
  const [editRating, setEditRating] = useState(review.rating);
  const [editComment, setEditComment] = useState(review.comment ?? "");

  // 編集モードが変更された時に初期値をリセット
  useEffect(() => {
    if (review.isEditing) {
      setEditRating(review.rating);
      setEditComment(review.comment ?? "");
    }
  }, [review.isEditing, review.rating, review.comment]);

  const handleSave = () => {
    onUpdateReview(review.id, editRating, editComment.trim() || null);
  };

  const handleCancel = () => {
    setEditRating(review.rating);
    setEditComment(review.comment ?? "");
    onToggleEdit(review.id);
  };

  const isUpdated = review.updatedAt.getTime() !== review.createdAt.getTime();

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* レビュー評価と日付 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* 星評価表示 */}
              {review.isEditing ? (
                <div className="flex items-center gap-2">
                  <RatingStar rating={editRating} readonly={false} onChange={setEditRating} size={20} />
                  <span className="font-medium">{editRating}.0</span>
                </div>
              ) : (
                <div className="flex items-center">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`h-4 w-4 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                  ))}
                  <span className="ml-2 font-medium">{review.rating}.0</span>
                </div>
              )}

              {/* レビューの立場を示すバッジ */}
              <Badge variant="secondary" className="text-xs">
                {review.reviewPosition === "SELLER_TO_BUYER" ? "売り手から" : "買い手から"}
              </Badge>
            </div>

            {/* 日付表示と編集ボタン */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="h-4 w-4" />
                <span>
                  {review.createdAt.toLocaleDateString("ja-JP")}
                  {isUpdated && <span className="ml-2 text-xs text-blue-600">(更新: {review.updatedAt.toLocaleDateString("ja-JP")})</span>}
                </span>
              </div>

              {/* 編集ボタン */}
              {review.isEditing ? (
                <div className="flex gap-1">
                  <Button size="sm" onClick={handleSave} disabled={isUpdating} className="h-8 w-8 bg-green-600 p-0 text-white hover:bg-green-700">
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isUpdating}
                    className="h-8 w-8 border-gray-300 p-0 hover:bg-gray-100"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onToggleEdit(review.id)}
                  className="h-8 w-8 border-blue-300 p-0 text-blue-600 hover:bg-blue-50"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* ユーザー情報 */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            {/* レビュー受信者（誰宛へのレビューか） */}
            {review.reviewee && (
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>宛先: {review.reviewee?.username ?? "未設定"}</span>
              </div>
            )}
          </div>

          {/* レビューコメント */}
          {review.isEditing ? (
            <div className="space-y-2">
              <label htmlFor={`comment-${review.id}`} className="text-sm font-medium">
                コメント
              </label>
              <Textarea
                id={`comment-${review.id}`}
                value={editComment}
                onChange={(e) => setEditComment(e.target.value)}
                placeholder="レビューコメントを入力してください..."
                className="min-h-[100px]"
              />
            </div>
          ) : (
            review.comment && (
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="leading-relaxed text-gray-800">{review.comment}</p>
              </div>
            )
          )}

          {/* 関連情報 */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Package className="h-4 w-4" />
              <span>タスク: {review.auction.task.task.substring(0, 50)}...</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>グループ: {review.auction.task.group.name}</span>
            </div>
            {review.auction.task.category && (
              <div className="flex items-center gap-1">
                <Hash className="h-4 w-4" />
                <span>カテゴリ: {review.auction.task.category}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 個別レビューを表示するカードコンポーネント
 */
const ReviewCard = memo(function ReviewCard({ review, showReviewer = false }: { review: ReviewData; showReviewer?: boolean }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビューカードのメインコンポーネント
   */
  // 更新日時を表示するかどうかの判定
  const isUpdated = review.updatedAt.getTime() !== review.createdAt.getTime();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビューカードのメインコンポーネント
   */
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* レビュー評価と日付 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* 星評価表示 */}
              <div className="flex items-center">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-4 w-4 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                ))}
              </div>
              <span className="font-medium">{review.rating}.0</span>
              {/* レビューの立場を示すバッジ */}
              <Badge variant="secondary" className="text-xs">
                {review.reviewPosition === "SELLER_TO_BUYER" ? "売り手から" : "買い手から"}
              </Badge>
            </div>

            {/* 日付表示 */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4" />
              <span>
                {review.createdAt.toLocaleDateString("ja-JP")}
                {isUpdated && <span className="ml-2 text-xs text-blue-600">(更新: {review.updatedAt.toLocaleDateString("ja-JP")})</span>}
              </span>
            </div>
          </div>

          {/* ユーザー情報 */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            {/* レビュー受信者（誰宛へのレビューか） */}
            {review.reviewee && (
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>宛先: {review.reviewee?.username ?? "未設定"}</span>
              </div>
            )}
            {/* レビュー送信者（自身へのレビュータブでのみ表示） */}
            {showReviewer && review.reviewer && (
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>送信者: {review.reviewer?.username ?? "未設定"}</span>
              </div>
            )}
          </div>

          {/* レビューコメント */}
          {review.comment && (
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="leading-relaxed text-gray-800">{review.comment}</p>
            </div>
          )}

          {/* 関連情報 */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Package className="h-4 w-4" />
              <span>タスク: {review.auction.task.task.substring(0, 50)}...</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>グループ: {review.auction.task.group.name}</span>
            </div>
            {review.auction.task.category && (
              <div className="flex items-center gap-1">
                <Hash className="h-4 w-4" />
                <span>カテゴリ: {review.auction.task.category}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
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
    error,
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
   * エラー表示
   */
  if (error) {
    return (
      <Error
        error="レビューの読み込みでエラーが発生しました。"
        previousPageURL={`/dashboard/review-search?tab=${activeTab}&q=${searchParams.searchQuery}`}
      />
    );
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビューリストを表示するコンポーネント
   */
  const renderReviewList = () => {
    if (isLoading) {
      // ローディング状態。スケルトン
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

    if (reviews.length === 0) {
      // レビューが存在しない場合
      const emptyMessage = (() => {
        if (activeTab === "search") {
          if (searchParams.searchQuery) {
            return "検索条件に一致するレビューが見つかりませんでした。";
          }
          return "まだレビューが投稿されていません。";
        }
        switch (activeTab) {
          case "edit":
            return "まだ書いたレビューがありません。";
          case "received":
            return "まだ受け取ったレビューがありません。";
          default:
            return "まだレビューがありません。";
        }
      })();

      return (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">{emptyMessage}</CardContent>
        </Card>
      );
    }

    // レビューリストの表示
    return (
      <div className="space-y-4">
        {reviews.map((review) =>
          activeTab === "edit" ? (
            <EditableReviewCard
              key={review.id}
              review={review}
              onToggleEdit={toggleEditMode}
              onUpdateReview={handleUpdateReview}
              isUpdating={isUpdating}
            />
          ) : (
            <ReviewCard key={review.id} review={review} showReviewer={activeTab === "received"} />
          ),
        )}
      </div>
    );
  };

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
      <Tabs value={activeTab} onValueChange={(value) => changeTab(value as "search" | "edit" | "received")}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="search">レビュー検索</TabsTrigger>
          <TabsTrigger value="edit">レビュー編集</TabsTrigger>
          <TabsTrigger value="received">自身へのレビュー</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-4">
          <div className="text-sm text-gray-600">他のユーザーのレビューを検索・閲覧できます。</div>
          {renderReviewList()}
        </TabsContent>

        <TabsContent value="edit" className="space-y-4">
          <div className="text-sm text-gray-600">
            あなたが書いたレビューを編集できます。評価やコメントを変更することができます。
            <br />
            <span className="text-amber-600">
              ※ データは15分間隔でキャッシュされており、他のユーザーからの最新の変更が反映されるまで最大15分かかる場合があります。
            </span>
          </div>
          {renderReviewList()}
        </TabsContent>

        <TabsContent value="received" className="space-y-4">
          <div className="text-sm text-gray-600">あなたが受け取ったレビューを確認できます。</div>
          {renderReviewList()}
        </TabsContent>
      </Tabs>

      {/* ページネーション */}
      {totalPages > 1 && <ReviewPagination currentPage={searchParams.page ?? 1} totalPages={totalPages} onPageChange={changePage} />}
    </div>
  );
});
