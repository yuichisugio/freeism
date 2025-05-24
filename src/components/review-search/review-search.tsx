"use client";

import { memo } from "react";
import { Error } from "@/components/share/share-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useReviewSearch } from "@/hooks/review-search/use-review-search";
import { useReviewSuggest } from "@/hooks/review-search/use-review-suggest";
import { Calendar, ChevronLeft, ChevronRight, Hash, MoreHorizontal, Package, Search, Star, Users, X } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

type ReviewPaginationProps = {
  currentPage: number; // 現在のページ番号
  totalPages: number; // 総ページ数
  onPageChange: (page: number) => void; // ページ変更時のコールバック
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

export type ReviewData = {
  id: string; // レビューの一意識別子
  rating: number; // 1-5の評価（5段階評価）
  comment: string | null; // レビューコメント（任意）
  createdAt: Date; // レビュー作成日時
  updatedAt: Date; // レビュー最終更新日時
  reviewPosition: "SELLER_TO_BUYER" | "BUYER_TO_SELLER"; // レビューの立場（売り手→買い手、買い手→売り手）
  // 匿名性のため、reviewer情報は含めない
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

// 検索条件の型定義
export type ReviewSearchParams = {
  searchType: "username" | "userId" | "auctionId" | "groupId" | "taskId"; // 検索対象を指定
  searchQuery: string; // 検索クエリ文字列
  page?: number; // ページネーション用のページ番号
  limit?: number; // 1ページあたりの取得件数
};

// 検索結果の型定義
export type ReviewSearchResult = {
  reviews: ReviewData[]; // レビューデータの配列
  totalCount: number; // 検索結果の総件数
  averageRating: number; // 平均評価（全レビューの評価平均）
  totalPages: number; // 総ページ数
};

// サジェスト機能用の型定義
export type SearchSuggestion = {
  value: string; // 実際の値（IDなど）
  label: string; // 表示用のラベル
  type: ReviewSearchParams["searchType"]; // サジェストの種類
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

type ReviewSearchFormProps = {
  searchParams: ReviewSearchParams; // 現在の検索パラメータ
  suggestions: SearchSuggestion[]; // サジェスト候補
  showSuggestions: boolean; // サジェスト表示状態
  onSearchQueryChange: (query: string) => void; // 検索クエリ変更時のコールバック
  onSearchTypeChange: (type: ReviewSearchParams["searchType"]) => void; // 検索タイプ変更時のコールバック
  onSuggestionSelect: (suggestion: SearchSuggestion) => void; // サジェスト選択時のコールバック
  onSuggestionsToggle: (show: boolean) => void; // サジェスト表示切り替えのコールバック
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * レビュー検索フォームコンポーネント
 * ラジオボタンで検索対象を選択し、入力フィールドで検索を行う
 * リアルタイムサジェスト機能も提供
 */
export const ReviewSearchForm = memo(function ReviewSearchForm({
  searchParams,
  suggestions,
  showSuggestions,
  onSearchQueryChange,
  onSearchTypeChange,
  onSuggestionSelect,
  onSuggestionsToggle,
}: ReviewSearchFormProps) {
  const { inputRef, suggestionRef, searchTypeLabels, getPlaceholder } = useReviewSuggest({
    searchParams,
    onSuggestionsToggleAction: onSuggestionsToggle,
  });

  return (
    <div className="space-y-4">
      {/* 検索対象選択用のラジオボタン */}
      <div>
        <Label className="mb-3 block text-sm font-medium">検索対象を選択</Label>
        <RadioGroup
          value={searchParams.searchType}
          onValueChange={(value) => onSearchTypeChange(value as ReviewSearchParams["searchType"])}
          className="flex flex-wrap gap-4"
        >
          {/* 各検索タイプのラジオボタンを動的に生成 */}
          {Object.entries(searchTypeLabels).map(([value, label]) => (
            <div key={value} className="flex items-center space-x-2">
              <RadioGroupItem value={value} id={value} className="h-4 w-4" />
              <Label htmlFor={value} className="cursor-pointer text-sm transition-colors hover:text-blue-600">
                {label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* 検索入力フィールドとサジェスト */}
      <div className="relative">
        <div className="relative">
          {/* 検索アイコン付きの入力フィールド */}
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-500" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={getPlaceholder()}
            value={searchParams.searchQuery}
            onChange={(e) => {
              onSearchQueryChange(e.target.value);
              // 入力が2文字以上の場合にサジェストを表示
              onSuggestionsToggle(e.target.value.length >= 2);
            }}
            onFocus={() => {
              // フォーカス時、既に2文字以上入力されていればサジェストを表示
              if (searchParams.searchQuery.length >= 2) {
                onSuggestionsToggle(true);
              }
            }}
            className="pr-10 pl-10"
          />
          {/* クリアボタン：検索クエリが入力されている場合のみ表示 */}
          {searchParams.searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onSearchQueryChange("");
                onSuggestionsToggle(false);
                inputRef.current?.focus();
              }}
              className="absolute top-1/2 right-1 h-8 w-8 -translate-y-1/2 transform p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* サジェストリスト */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionRef}
            className="absolute top-full right-0 left-0 z-10 mt-1 max-h-60 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg"
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.type}-${suggestion.value}-${index}`}
                onClick={() => onSuggestionSelect(suggestion)}
                className="w-full border-b border-gray-100 px-4 py-2 text-left transition-colors last:border-b-0 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
              >
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm text-gray-900">{suggestion.label}</span>
                  <span className="ml-2 text-xs text-gray-500">{searchTypeLabels[suggestion.type]}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
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
  const getVisiblePageNumbers = () => {
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
  };

  const visiblePages = getVisiblePageNumbers();
  const showFirstPage = visiblePages[0] > 1; // 最初のページを個別表示するか
  const showLastPage = visiblePages[visiblePages.length - 1] < totalPages; // 最後のページを個別表示するか
  const showStartEllipsis = visiblePages[0] > 2; // 開始省略記号を表示するか
  const showEndEllipsis = visiblePages[visiblePages.length - 1] < totalPages - 1; // 終了省略記号を表示するか

  return (
    <div className="flex items-center justify-center gap-2">
      {/* 前のページボタン */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="flex items-center gap-1"
      >
        <ChevronLeft className="h-4 w-4" />
        前へ
      </Button>

      {/* 最初のページ（1ページ目）*/}
      {showFirstPage && (
        <>
          <Button variant={currentPage === 1 ? "default" : "outline"} size="sm" onClick={() => onPageChange(1)} className="min-w-[40px]">
            1
          </Button>
          {showStartEllipsis && (
            <span className="flex items-center">
              <MoreHorizontal className="h-4 w-4 text-gray-500" />
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
          className="min-w-[40px]"
        >
          {pageNum}
        </Button>
      ))}

      {/* 最後のページ */}
      {showLastPage && (
        <>
          {showEndEllipsis && (
            <span className="flex items-center">
              <MoreHorizontal className="h-4 w-4 text-gray-500" />
            </span>
          )}
          <Button
            variant={currentPage === totalPages ? "default" : "outline"}
            size="sm"
            onClick={() => onPageChange(totalPages)}
            className="min-w-[40px]"
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
        className="flex items-center gap-1"
      >
        次へ
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 個別レビューを表示するカードコンポーネント
 */
const ReviewCard = memo(function ReviewCard({ review }: { review: ReviewData }) {
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
    isLoading,
    error,
    suggestions,
    showSuggestions,

    // function
    updateSearchQuery,
    updateSearchType,
    changePage,
    selectSuggestion,
    setShowSuggestions,
  } = useReviewSearch();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * エラー表示
   */
  if (error) {
    return (
      <Error
        error="レビューの読み込みでエラーが発生しました。"
        previousPageURL={`/dashboard/review-search?searchType=${searchParams.searchType}&searchQuery=${searchParams.searchQuery}`}
      />
    );
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビュー検索のメインコンポーネント
   */
  return (
    <div className="space-y-6">
      {/* 検索フォーム */}
      <ReviewSearchForm
        searchParams={searchParams}
        suggestions={suggestions}
        showSuggestions={showSuggestions}
        onSearchQueryChange={updateSearchQuery}
        onSearchTypeChange={updateSearchType}
        onSuggestionSelect={selectSuggestion}
        onSuggestionsToggle={setShowSuggestions}
      />

      {/* レビュー一覧 */}
      <div className="space-y-4">
        {isLoading ? (
          // ローディング状態。スケルトン
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
        ) : reviews.length === 0 ? (
          // レビューが存在しない場合。カードを表示
          <Card>
            <CardContent className="p-6 text-center text-gray-500">
              {searchParams.searchQuery ? "検索条件に一致するレビューが見つかりませんでした。" : "まだレビューがありません。"}
            </CardContent>
          </Card>
        ) : (
          // レビューリストの表示。レビューカードを表示
          reviews.map((review) => <ReviewCard key={review.id} review={review} />)
        )}
      </div>

      {/* ページネーション */}
      {totalPages > 1 && <ReviewPagination currentPage={searchParams.page ?? 1} totalPages={totalPages} onPageChange={changePage} />}
    </div>
  );
});
