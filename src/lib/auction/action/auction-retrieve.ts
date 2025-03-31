"use server";

import { prisma } from "@/lib/prisma";

import { AUCTION_CONSTANTS } from "../constants";
import { type Auction, type AuctionWithDetails } from "../type/types";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
/**
 * オークションIDに関連するオークション情報を取得
 * @param auctionId オークションID
 * @returns オークション情報
 */
export async function getAuctionByAuctionId(auctionId: string): Promise<AuctionWithDetails | null> {
  try {
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        task: {
          include: {
            group: true,
            creator: true,
            executors: true,
          },
        },
        currentHighestBidder: true,
        winner: true,
        bidHistories: {
          include: {
            user: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 10,
        },
      },
    });

    if (!auction) return null;

    // 必要なプロパティを持つオブジェクトとして返す
    return auction as unknown as AuctionWithDetails;
  } catch (error) {
    console.error("オークション取得エラー:", error);
    return null;
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクIDに関連するオークション情報を取得
 * @param taskId タスクID
 * @returns オークション情報
 */
export async function getAuctionWithTask(taskId: string): Promise<AuctionWithDetails | null> {
  try {
    const auction = await prisma.auction.findUnique({
      where: { taskId },
      include: {
        task: {
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            group: true,
          },
        },
        bidHistories: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
        watchlists: true,
      },
    });

    if (!auction) return null;

    // 必要なプロパティを持つオブジェクトとして返す
    return auction as unknown as AuctionWithDetails;
  } catch (error) {
    console.error("オークション取得エラー:", error);
    return null;
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Prismaモデルから@/types/auctionで定義されたAuction型に変換
 * @param auctionData Prismaモデルのオークションデータ
 * @returns @/types/auctionで定義されたAuction型のオークションデータ
 */
export async function convertAuctionToAuctionType(auctionData: AuctionWithDetails): Promise<Auction> {
  return {
    id: auctionData.id,
    title: auctionData.task.task,
    description: auctionData.task.detail ?? "",
    imageUrl: auctionData.task.imageUrl ?? AUCTION_CONSTANTS.DEFAULT_AUCTION_IMAGE_URL,
    currentHighestBid: auctionData.currentHighestBid,
    startTime: auctionData.startTime.toISOString(),
    endTime: auctionData.endTime.toISOString(),
    sellerId: auctionData.task.creatorId,
    seller: {
      id: auctionData.task.creator.id,
      username: auctionData.task.creator.name ?? "不明なユーザー",
      email: auctionData.task.creator.email,
      createdAt:
        typeof auctionData.task.creator.createdAt === "object" && auctionData.task.creator.createdAt !== null
          ? (auctionData.task.creator.createdAt as Date).toISOString()
          : String(auctionData.task.creator.createdAt),
      avatarUrl: auctionData.task.creator.image ?? undefined,
    },
    bidCount: auctionData.bidHistories?.length ?? 0,
    categories: [],
    watchCount: 0,
    depositPeriod: 7, // デフォルトの預かり期間を7日に設定
  };
}
