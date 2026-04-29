import { type ReviewSearchParams } from "@/components/review-search/review-search";
import { type ReviewPosition } from "@prisma/client";

/**
 * Next.jsの"use cache"のキャッシュキーのファクトリー関数
 * オブジェクトは順序が異なることがあり、キャッシュキーが一致しない場合があるため、文字列にしている
 */
export const useCacheKeys = {
  groupDetailTable: {
    groupByGroupId: (groupId: string): string => `groupDetailTable_groupByGroupId_${groupId}`,
  },
  auctionCreatedDetail: {
    auctionByAuctionId: (auctionId: string): string => `auctionCreatedDetail_auctionByAuctionId_${auctionId}`,
  },
  auctionHistory: {
    auctionByAuctionId: (auctionId: string): string => `auctionHistory_auctionByAuctionId_${auctionId}`,
  },
  auctionRating: {
    auctionByAuctionId: (auctionId: string, reviewPosition: ReviewPosition): string =>
      `auctionRating_auctionByAuctionId_${auctionId}_${reviewPosition}`,
  },
  auctionQa: {
    auctionByAuctionId: (auctionId: string): string => `auctionQa_auctionByAuctionId_${auctionId}`,
  },
  notification: {
    notificationByUserId: (userId: string): string => `notification_notificationByUserId_${userId}`,
  },
  reviewSearch: {
    reviews: (userId: string, searchParams: ReviewSearchParams): string =>
      `reviewSearch_reviews_${userId}_${JSON.stringify(searchParams)}`,
  },
};
