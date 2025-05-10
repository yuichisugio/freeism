"use server";

/**
 * オークション一覧のキャッシュデータを取得する関数
 * use cacheとuse serverを併用できないため、別ファイルとして作成
 */
import type { GetAuctionListingsParams } from "@/lib/auction/action/cache/cache-auction-listing";
import type { AuctionListingResult, Suggestion } from "@/types/auction-types";
import { cache } from "react";
import { cachedGetAuctionListingsAndCount, cachedGetSearchSuggestions } from "@/lib/auction/action/cache/cache-auction-listing";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション一覧と総件数を取得する関数
 * @param listingsConditions オークション一覧の条件
 * @param userId ユーザーID
 * @returns オークション一覧と総件数
 */
export const getAuctionListingsAndCount = cache(
  async ({ listingsConditions, userId }: GetAuctionListingsParams): Promise<{ listings: AuctionListingResult; count: number }> => {
    console.log("src/lib/auction/action/auction-listing.ts_getAuctionListingsAndCount_start");
    const cachedData = await cachedGetAuctionListingsAndCount({ listingsConditions, userId });
    console.log("src/lib/auction/action/auction-listing.ts_getAuctionListingsAndCount_cachedData", cachedData);
    if (cachedData) {
      return cachedData;
    } else {
      throw new Error("オークション一覧と件数の取得中に予期せぬエラーが発生しました。");
    }
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
  const cachedData = await cachedGetSearchSuggestions(query, userId);
  if (cachedData) {
    return cachedData;
  } else {
    throw new Error("検索サジェストのキャッシュデータがありません");
  }
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
