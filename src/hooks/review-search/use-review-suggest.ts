"use client";

import type { ReviewSearchParams } from "@/components/review-search/review-search";
import { useEffect, useRef } from "react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

type ReviewSuggestProps = {
  searchParams: ReviewSearchParams;
  onSuggestionsToggleAction: (show: boolean) => void;
};

export function useReviewSuggest({ searchParams, onSuggestionsToggleAction }: ReviewSuggestProps) {
  // 入力フィールドへの参照を保持（フォーカス制御用）
  const inputRef = useRef<HTMLInputElement>(null);

  // サジェストリストへの参照を保持（クリック外し検知用）
  const suggestionRef = useRef<HTMLDivElement>(null);

  // 検索タイプのラベル定義
  // ユーザーにわかりやすい日本語のラベルを提供
  const searchTypeLabels = {
    username: "ユーザー名",
    userId: "ユーザーID",
    auctionId: "オークションID",
    groupId: "グループID",
    taskId: "タスクID",
  } as const;

  // 入力フィールドのプレースホルダーテキスト
  const getPlaceholder = () => {
    switch (searchParams.searchType) {
      case "username":
        return "ユーザー名を入力してください";
      case "userId":
        return "ユーザーIDを入力してください";
      case "auctionId":
        return "オークションIDを入力してください";
      case "groupId":
        return "グループIDを入力してください";
      case "taskId":
        return "タスクIDを入力してください";
      default:
        return "検索キーワードを入力してください";
    }
  };

  // クリック外し検知：サジェストリスト以外をクリックした時にサジェストを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionRef.current &&
        !suggestionRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        onSuggestionsToggleAction(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onSuggestionsToggleAction]);

  return {
    inputRef,
    suggestionRef,
    searchTypeLabels,
    getPlaceholder,
  };
}
