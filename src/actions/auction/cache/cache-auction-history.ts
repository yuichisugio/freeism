"use cache";

import type { AuctionHistoryCreatedDetail } from "@/types/auction-types";
import { unstable_cacheTag as cacheTag } from "next/cache";
import { prisma } from "@/library-setting/prisma";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 出品商品詳細を取得
 * @param auctionId 出品商品のID
 * @returns 出品商品の詳細
 */
export async function getCachedAuctionHistoryCreatedDetail(auctionId: string): Promise<AuctionHistoryCreatedDetail> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品商品のIDが存在しない場合はnullを返却
   */
  if (!auctionId || typeof auctionId !== "string") throw new Error("auctionId is required");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自分が出品or実行or報告したオークションの詳細を取得
   */
  const auction = await prisma.auction.findUnique({
    where: {
      id: auctionId,
    },
    select: {
      id: true,
      currentHighestBid: true,
      startTime: true,
      endTime: true,
      task: {
        select: {
          id: true,
          task: true,
          detail: true,
          imageUrl: true,
          status: true,
          deliveryMethod: true,
          creatorId: true,
          executors: {
            select: {
              userId: true,
            },
          },
          reporters: {
            select: {
              userId: true,
            },
          },
        },
      },
      winner: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      winnerId: true,
      bidHistories: {
        orderBy: {
          amount: "desc",
        },
        take: 100,
        select: {
          id: true,
          amount: true,
          isAutoBid: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      },
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品商品の詳細を返却
   */
  if (!auction) throw new Error("auction not found");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュにタグをつける
   */
  cacheTag(`auction-history-created-detail:${auction.task.id}`);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品商品の詳細を返却
   */
  return auction;
}
