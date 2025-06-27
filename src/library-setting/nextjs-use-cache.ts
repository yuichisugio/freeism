import { type ReviewPosition } from "@prisma/client";

/**
 * Next.jsの"use cache"のキャッシュキーのファクトリー関数
 * オブジェクトは順序が異なることがあり、キャッシュキーが一致しない場合があるため、文字列にしている
 */
export const useCacheKeys = {
  groupDetailTable: {
    groupByGroupId: (groupId: string) => ["groupDetailTable", "groupByGroupId", groupId] as const,
  },
  auctionCreatedDetail: {
    auctionByAuctionId: (auctionId: string) => ["auctionCreatedDetail", "auctionByAuctionId", auctionId] as const,
  },
  auctionHistory: {
    auctionByAuctionId: (auctionId: string) => ["auctionHistory", "auctionByAuctionId", auctionId] as const,
  },
  auctionRating: {
    auctionByAuctionId: (auctionId: string, reviewPosition: ReviewPosition) =>
      ["auctionRating", "auctionByAuctionId", auctionId, reviewPosition] as const,
  },
  auctionQa: {
    auctionByAuctionId: (auctionId: string) => ["auctionQa", "auctionByAuctionId", auctionId] as const,
  },
  notification: {
    notificationByUserId: (userId: string) => ["notification", "notificationByUserId", userId] as const,
  },
};
