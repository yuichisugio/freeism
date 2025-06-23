"use server";

import type { AuctionWonDetail } from "@/types/auction-types";
import { prisma } from "@/lib/prisma";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 落札したオークションの詳細を取得するための戻り値の型
 */
export type GetAuctionWonDetailReturn = {
  success: boolean;
  message: string;
  auctionWonDetail: AuctionWonDetail | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 落札したオークションの詳細を取得
 * @param auctionId 落札したオークションのID
 * @returns 落札したオークションの詳細
 */
export async function getAuctionWonDetail(auctionId: string, userId: string): Promise<GetAuctionWonDetailReturn> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * オークションIDまたはユーザーIDが無効な場合
     */
    if (!auctionId || !userId) {
      throw new Error("オークションIDまたはユーザーIDが無効です");
    }

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
            imageUrl: true,
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
     * 落札したオークションがないのも正常なため、成功とする
     */
    if (!auction) {
      return {
        success: true,
        message: "落札したオークションが見つかりません",
        auctionWonDetail: null,
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 落札したオークションの詳細を整形
     */
    const returnAuctionWonData: AuctionWonDetail = {
      auctionId: auction.id,
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
      taskImageUrl: auction.task.imageUrl,
      creator: {
        creatorUserId: auction.task.creatorId,
        creatorAppUserName: auction.task.creator?.settings?.username ?? "未設定",
        creatorUserImage: auction.task.creator?.image ?? null,
      },
      reporters: auction.task.reporters.map((reporter) => ({
        reporterUserId: reporter.user?.id ?? "未登録ユーザー",
        reporterAppUserName: reporter.user?.settings?.username ?? "未設定",
        reporterUserImage: reporter.user?.image ?? null,
      })),
      executors: auction.task.executors.map((executor) => ({
        executorUserId: executor.user?.id ?? "未登録ユーザー",
        executorAppUserName: executor.user?.settings?.username ?? "未設定",
        executorUserImage: executor.user?.image ?? null,
      })),
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 落札したオークションの詳細を返す
     */
    return {
      success: true,
      message: "落札したオークションの詳細を取得しました",
      auctionWonDetail: returnAuctionWonData,
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    return {
      success: false,
      message: `${error instanceof Error ? error.message : "不明なエラーが発生しました"}`,
      auctionWonDetail: null,
    };
  }
}
