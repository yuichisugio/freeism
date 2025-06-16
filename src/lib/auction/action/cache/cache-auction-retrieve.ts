"use cache";

import { AUCTION_CONSTANTS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { type AuctionWithDetails } from "@/types/auction-types";

/**
 * オークションIDに関連するオークション情報を取得
 * @param auctionId オークションID
 * @returns オークション情報
 */
export async function getCachedAuctionByAuctionId(auctionId: string): Promise<AuctionWithDetails | null> {
  try {
    // オークションIDが指定されていない場合はエラーを返す
    if (!auctionId) {
      console.error("src/lib/auction/action/cache/cache-auction-retrieve.ts_getCachedAuctionByAuctionId_error_auctionId_not_specified");
      return null;
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // オークション情報を取得
    const auctionRaw = await prisma.auction.findUnique({
      where: { id: auctionId },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        currentHighestBid: true,
        currentHighestBidderId: true,
        extensionTotalCount: true,
        extensionLimitCount: true,
        extensionTime: true,
        remainingTimeForExtension: true,
        bidHistories: {
          select: {
            id: true,
            amount: true,
            createdAt: true,
            isAutoBid: true,
            user: {
              select: {
                settings: {
                  select: {
                    username: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: AUCTION_CONSTANTS.DISPLAY.BID_HISTORY_LIMIT + 1, // 1件多く取得して、２５＋１にしたい
        },
        task: {
          select: {
            task: true,
            detail: true,
            imageUrl: true,
            status: true,
            category: true,
            group: {
              select: {
                id: true,
                name: true,
                depositPeriod: true,
              },
            },
            creator: {
              select: {
                id: true,
                image: true,
                settings: {
                  select: {
                    username: true,
                  },
                },
              },
            },
            executors: {
              select: {
                id: true,
                user: {
                  select: {
                    id: true,
                    image: true,
                    settings: {
                      select: {
                        username: true,
                      },
                    },
                  },
                },
              },
            },
            reporters: {
              select: {
                id: true,
                user: {
                  select: {
                    id: true,
                    image: true,
                    settings: {
                      select: {
                        username: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    if (!auctionRaw) return null;
    // task.status を auction.status としてマージ
    const auction: AuctionWithDetails = {
      ...auctionRaw,
      status: auctionRaw.task.status,
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    return auction;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("src/lib/auction/action/cache/cache-auction-retrieve.ts_getCachedAuctionByAuctionId_error", error);
    return null;
  }
}
