"use client";

import { useEffect, useRef, useState } from "react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * レビュー検索のサジェスト機能を管理するカスタムフック
 */
export function useReviewSuggest({
  onSuggestionsToggleAction,
  suggestions = [],
  onSuggestionSelectAction,
  onSearchExecuteAction,
}: {
  onSuggestionsToggleAction: (show: boolean) => void;
  suggestions: Array<{ value: string; label: string }>;
  onSuggestionSelectAction: (suggestion: { value: string; label: string }) => void;
  onSearchExecuteAction: () => void;
}) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 入力フィールドのref/state
   */
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 外部クリックでサジェストを閉じる処理
   */
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        suggestionRef.current &&
        !suggestionRef.current.contains(event.target as Node)
      ) {
        onSuggestionsToggleAction(false);
        setSelectedIndex(-1);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onSuggestionsToggleAction]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キーボードナビゲーション
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (suggestions.length === 0) return;
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        if (suggestions.length === 0) return;
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (suggestions.length > 0 && selectedIndex >= 0 && selectedIndex < suggestions.length) {
          // サジェストが選択されている場合：サジェストを選択
          onSuggestionSelectAction?.(suggestions[selectedIndex]);
        } else {
          // サジェストが選択されていない場合：現在の入力内容で検索を実行
          onSearchExecuteAction?.();
        }
        onSuggestionsToggleAction(false);
        setSelectedIndex(-1);
        break;
      case "Escape":
        onSuggestionsToggleAction(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * サジェストが変更された時に選択インデックスをリセット
   */
  useEffect(() => {
    setSelectedIndex(-1);
  }, [suggestions]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 検索フォームの送信
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchExecuteAction();
    onSuggestionsToggleAction(false);
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    inputRef,
    suggestionRef,
    selectedIndex,
    handleKeyDown,
    handleSubmit,
  };
}
