"use server";

import type { AuctionWonDetail } from "@/types/auction-types";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 落札したオークションの詳細を取得
 * @param auctionId 落札したオークションのID
 * @returns 落札したオークションの詳細
 */
export async function getAuctionWonDetail(auctionId: string): Promise<AuctionWonDetail> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーID
   */
  const userId = await getAuthenticatedSessionUserId();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札したオークションの詳細を取得
   */
  const auction = await prisma.auction.findUnique({
    where: {
      id: auctionId,
      winnerId: userId,
    },
    select: {
      id: true,
      endTime: true,
      startTime: true,
      currentHighestBid: true,
      winnerId: true,
      status: true,
      reviews: {
        where: {
          OR: [{ reviewerId: userId }, { revieweeId: userId }],
        },
        select: {
          id: true,
          reviewerId: true,
          rating: true,
          comment: true,
        },
      },
      task: {
        select: {
          id: true,
          task: true,
          detail: true,
          status: true,
          creatorId: true,
          deliveryMethod: true,
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
          reporters: {
            select: {
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
          executors: {
            select: {
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

  /**
   * 落札したオークションが見つからない場合
   */
  if (!auction) {
    throw new Error("落札したオークションが見つかりません");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札したオークションの詳細を整形
   */
  const returnAuctionWonData: AuctionWonDetail = {
    auctionId: auction.id,
    auctionStatus: auction.status,
    auctionEndTime: auction.endTime,
    auctionStartTime: auction.startTime,
    currentHighestBid: auction.currentHighestBid,
    winnerId: userId,
    reviews: auction.reviews,
    taskId: auction.task.id,
    taskName: auction.task.task,
    taskDetail: auction.task.detail,
    taskStatus: auction.task.status,
    taskDeliveryMethod: auction.task.deliveryMethod,
    creator: {
      creatorUserId: auction.task.creatorId,
      creatorAppUserName: auction.task.creator?.settings?.username ?? "未設定",
      creatorUserImage: auction.task.creator?.image ?? null,
    },
    reporters: auction.task.reporters.map((reporter) => ({
      reporterUserId: reporter.user?.id ?? "未設定",
      reporterAppUserName: reporter.user?.settings?.username ?? "未設定",
      reporterUserImage: reporter.user?.image ?? null,
    })),
    executors: auction.task.executors.map((executor) => ({
      executorUserId: executor.user?.id ?? "未設定",
      executorAppUserName: executor.user?.settings?.username ?? "未設定",
      executorUserImage: executor.user?.image ?? null,
    })),
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札したオークションの詳細を返す
   */
  return returnAuctionWonData;
}
