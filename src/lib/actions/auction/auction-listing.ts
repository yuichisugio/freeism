"use server";

/**
 * オークション一覧のキャッシュデータを取得する関数
 * use cacheとuse serverを併用できないため、別ファイルとして作成
 */
import type { GetAuctionListingsParams } from "@/lib/actions/auction/cache/cache-auction-listing";
import type { GetSearchSuggestionsParams } from "@/lib/actions/auction/cache/cache-auction-suggestion";
import type { AuctionListingResult, Suggestion } from "@/types/auction-types";
import { cache } from "react";
import { cachedGetAuctionListingsAndCount } from "@/lib/actions/auction/cache/cache-auction-listing";
import { cachedGetSearchSuggestions } from "@/lib/actions/auction/cache/cache-auction-suggestion";

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
 * @param limit 取得件数
 * @returns オークション検索サジェスト
 */
export const getSearchSuggestions = cache(async (params: GetSearchSuggestionsParams): Promise<Suggestion[]> => {
  return await cachedGetSearchSuggestions(params);
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
