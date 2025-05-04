"use server";

/**
 * オークション一覧のキャッシュデータを取得する関数
 * use cacheとuse serverを併用できないため、別ファイルとして作成
 */
import { cache } from "react";

import type { AuctionListingResult, Suggestion } from "../type/types";
import type { GetAuctionListingsParams } from "./cache-auction-listing";
import { cachedGetAuctionCount, cachedGetAuctionListings, cachedGetSearchSuggestions } from "./cache-auction-listing";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション一覧を取得する関数
 * @param listingsConditions オークション一覧の条件
 * @param userId ユーザーID
 * @returns オークション一覧
 */
export const getAuctionListings = cache(async ({ listingsConditions, userId }: GetAuctionListingsParams): Promise<AuctionListingResult> => {
  const cachedData = await cachedGetAuctionListings({ listingsConditions, userId });
  if (cachedData) {
    return cachedData;
  } else {
    throw new Error("キャッシュデータがありません");
  }
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション一覧を取得する関数
 * @param query 検索クエリ
 * @param userId ユーザーID
 * @returns オークション一覧
 */
export const getSearchSuggestions = cache(async (query: string, userId: string): Promise<Suggestion[]> => {
  const cachedData = await cachedGetSearchSuggestions(query, userId);
  if (cachedData) {
    return cachedData;
  } else {
    throw new Error("キャッシュデータがありません");
  }
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション一覧を取得する関数
 * @param listingsConditions オークション一覧の条件
 * @param userId ユーザーID
 * @returns オークション一覧
 */
export const getAuctionCount = cache(async ({ listingsConditions, userId }: GetAuctionListingsParams): Promise<number> => {
  const cachedData = await cachedGetAuctionCount({ listingsConditions, userId });
  // キャッシュデータがundefinedまたはnullの場合はエラーを投げる。0が来た場合にエラーにならないようにしたい
  if (cachedData !== undefined && cachedData !== null) {
    return cachedData;
  } else {
    throw new Error("キャッシュデータがありません");
  }
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
