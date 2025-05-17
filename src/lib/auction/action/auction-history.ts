"use server";

import { prisma } from "@/lib/prisma";
import { type BidHistoryItem, type CreatedAuctionItem, type WonAuctionItem } from "@/types/auction-types";
import { AuctionStatus, ReviewPosition } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの各オークションに対する最新の入札情報のみを取得
 * @param page ページ番号
 * @returns 重複のないオークションごとの最新入札履歴の配列、次のページ番号、総件数
 */
export async function getUserBidHistories(page = 1, userId: string, itemPerPage: number): Promise<BidHistoryItem[]> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ログ
   */
  console.log("getUserLatestBids_start_page:", page);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーの全入札履歴を取得
   */
  const allBids = await prisma.bidHistory.findMany({
    skip: (page - 1) * itemPerPage,
    take: itemPerPage,
    where: { userId: userId },
    distinct: ["auctionId"],
    orderBy: { createdAt: "desc" },
    select: {
      auctionId: true,
      status: true,
      auction: {
        select: {
          status: true,
          currentHighestBid: true,
          createdAt: true,
          endTime: true,
          task: {
            select: {
              id: true,
              task: true,
              status: true,
            },
          },
        },
      },
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データを整形
   */
  const returnBidedAuctionPerPage: BidHistoryItem[] = allBids.map((bid) => ({
    auctionId: bid.auctionId,
    status: bid.status,
    createdAt: bid.auction.createdAt,
    taskId: bid.auction.task.id,
    taskName: bid.auction.task.task,
    taskStatus: bid.auction.task.status,
    auctionStatus: bid.auction.status,
    currentHighestBid: bid.auction.currentHighestBid,
    auctionEndTime: bid.auction.endTime,
  }));

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データを返却
   */
  return returnBidedAuctionPerPage;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入札履歴の件数を取得
 * @param userId ユーザーID
 * @returns 入札履歴の件数
 */
export async function getUserBidHistoryCount(userId: string): Promise<number> {
  const count = await prisma.bidHistory.count({
    where: { userId: userId },
  });
  return count;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの落札したオークション履歴を取得
 * @param page ページ番号
 * @returns 落札したオークション履歴の配列、次のページ番号、総件数
 */
export async function getUserWonAuctions(page = 1, userId: string, itemPerPage: number): Promise<WonAuctionItem[]> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ログ
   */
  console.log("getUserWonAuctions_start_page:", page);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札したオークション履歴を取得
   */
  const wonAuctionsData = await prisma.auction.findMany({
    where: {
      winnerId: userId,
      status: AuctionStatus.ENDED,
    },
    orderBy: {
      endTime: "desc",
    },
    skip: (page - 1) * itemPerPage,
    take: itemPerPage,
    select: {
      id: true,
      endTime: true,
      currentHighestBid: true,
      status: true,
      createdAt: true,
      task: {
        select: {
          id: true,
          task: true,
          status: true,
          deliveryMethod: true,
        },
      },
      reviews: {
        where: {
          revieweeId: userId,
          reviewPosition: ReviewPosition.BUYER_TO_SELLER,
        },
        select: {
          rating: true,
        },
      },
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データを整形
   */
  const returnWonAuctions: WonAuctionItem[] = wonAuctionsData.map((auction) => ({
    auctionId: auction.id,
    currentHighestBid: auction.currentHighestBid,
    auctionEndTime: auction.endTime,
    auctionStatus: auction.status,
    auctionCreatedAt: auction.createdAt,
    taskId: auction.task.id,
    taskName: auction.task.task,
    taskStatus: auction.task.status,
    deliveryMethod: auction.task.deliveryMethod,
    rating: auction.reviews.length > 0 ? auction.reviews.reduce((acc, review) => acc + review.rating, 0) / auction.reviews.length : null, // レビューの平均値
  }));

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データを返却
   */
  return returnWonAuctions;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 落札履歴の件数を取得
 * @param userId ユーザーID
 * @returns 落札履歴の件数
 */
export async function getUserWonAuctionsCount(userId: string): Promise<number> {
  const count = await prisma.auction.count({
    where: {
      winnerId: userId,
      status: AuctionStatus.ENDED,
    },
  });
  return count;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの出品したオークション履歴を取得
 * @param page ページ番号
 * @returns 出品したオークション履歴の配列、次のページ番号、総件数
 */
export async function getUserCreatedAuctions(page = 1, userId: string, itemPerPage: number): Promise<CreatedAuctionItem[]> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ログ
   */
  console.log("getUserCreatedAuctions_start_page:", page);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品したオークション履歴を取得
   */
  const createdAuctionsData = await prisma.auction.findMany({
    where: {
      task: {
        creatorId: userId,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    skip: (page - 1) * itemPerPage,
    take: itemPerPage,
    select: {
      id: true,
      createdAt: true,
      currentHighestBid: true,
      status: true,
      endTime: true,
      task: {
        select: {
          id: true,
          task: true,
          status: true,
          deliveryMethod: true,
        },
      },
      winner: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データを整形
   */
  const returnCreatedAuctions: CreatedAuctionItem[] = createdAuctionsData.map((auction) => ({
    auctionId: auction.id,
    currentHighestBid: auction.currentHighestBid,
    auctionEndTime: auction.endTime,
    auctionStatus: auction.status,
    auctionCreatedAt: auction.createdAt,
    taskId: auction.task.id,
    taskName: auction.task.task,
    taskStatus: auction.task.status,
    deliveryMethod: auction.task.deliveryMethod,
    winnerId: auction.winner?.id ?? null,
    winnerName: auction.winner?.name ?? null,
  }));

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データを返却
   */
  return returnCreatedAuctions;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 出品履歴の件数を取得
 * @param userId ユーザーID
 * @returns 出品履歴の件数
 */
export async function getUserCreatedAuctionsCount(userId: string): Promise<number> {
  const count = await prisma.auction.count({
    where: {
      task: {
        creatorId: userId,
      },
    },
  });
  return count;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
