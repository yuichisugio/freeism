"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useReviewSuggest } from "@/hooks/review-search/use-review-suggest";
import { Search, X } from "lucide-react";

import type { ReviewSearchParams, SearchSuggestion } from "./review-search";

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
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * サジェスト機能用のフック
   */
  const { inputRef, suggestionRef, selectedIndex, handleKeyDown, handleSubmit } = useReviewSuggest({
    onSuggestionsToggleAction: onSuggestionsToggle,
    suggestions,
    onSuggestionSelectAction: onSuggestionSelect,
    onSearchExecuteAction: onSearchExecute,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
