"use server";

import type { ReviewSearchParams, ReviewSearchResult, SearchSuggestion } from "@/components/review-search/review-search";

import { getCachedSearchSuggestions, getCachedUserReviews } from "./cache-review-search";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 特定ユーザーのレビューを取得するサーバーアクション
 * @param userId - 対象ユーザーのID（被評価者）
 * @param searchParams - 検索パラメータ（オプション）
 * @returns レビューデータと統計情報
 */
export async function getUserReviews(searchParams: ReviewSearchParams | null): Promise<ReviewSearchResult> {
  return await getCachedUserReviews(searchParams);
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 検索サジェストを取得するサーバーアクション
 * Prismaの全文検索機能を活用して候補を提案
 * @param query - 検索クエリ
 * @param searchType - 検索対象の種類
 * @returns サジェスト候補の配列
 */
export async function getSearchSuggestions(query: string, searchType: ReviewSearchParams["searchType"]): Promise<SearchSuggestion[]> {
  return await getCachedSearchSuggestions(query, searchType);
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
