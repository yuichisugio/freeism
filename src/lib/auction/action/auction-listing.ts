"use server";

/**
 * オークション一覧のキャッシュデータを取得する関数
 * use cacheとuse serverを併用できないため、別ファイルとして作成
 */
import type { GetAuctionListingsParams } from "@/lib/auction/action/cache/cache-auction-listing";
import type { AuctionListingResult, Suggestion } from "@/types/auction-types";
import { cache } from "react";
import { cachedGetAuctionListingsAndCount } from "@/lib/auction/action/cache/cache-auction-listing";
import { cachedGetSearchSuggestions } from "@/lib/auction/action/cache/cache-auction-listing-suggestion";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション一覧と総件数を取得する関数
 * @param listingsConditions オークション一覧の条件
 * @param userId ユーザーID
 * @returns オークション一覧と総件数
 */
export const getAuctionListingsAndCount = cache(
  async (params: GetAuctionListingsParams): Promise<{ listings: AuctionListingResult; count: number }> => {
    return await cachedGetAuctionListingsAndCount(params);
  },
);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション検索サジェストを取得する関数
 * @param query 検索クエリ
 * @param userId ユーザーID
 * @returns オークション検索サジェスト
 */
export const getSearchSuggestions = cache(async (query: string, userId: string): Promise<Suggestion[]> => {
  return await cachedGetSearchSuggestions(query, userId);
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
