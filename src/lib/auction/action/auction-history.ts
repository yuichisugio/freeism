"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  type AuctionCreatedTabFilter,
  type BidHistoryItem,
  type CreatedAuctionItem,
  type FilterCondition,
  type WonAuctionItem,
} from "@/types/auction-types";
import { ReviewPosition, TaskStatus } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの各オークションに対する最新の入札情報のみを取得
 * @param page ページ番号
 * @returns 重複のないオークションごとの最新入札履歴の配列、次のページ番号、総件数
 */
export async function getUserBidHistories(page = 1, userId: string, itemPerPage: number, _condition?: FilterCondition): Promise<BidHistoryItem[]> {
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
    bidStatus: bid.status,
    lastBidAt: bid.auction.createdAt,
    taskId: bid.auction.task.id,
    taskName: bid.auction.task.task,
    taskStatus: bid.auction.task.status,
    currentHighestBid: bid.auction.currentHighestBid,
    auctionEndTime: bid.auction.endTime,
  }));

  console.log("getUserLatestBids_returnBidedAuctionPerPage:", returnBidedAuctionPerPage);

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
  const distinctBids = await prisma.bidHistory.findMany({
    where: {
      userId: userId,
    },
    distinct: ["auctionId"],
    select: {
      auctionId: true,
    },
  });
  return distinctBids.length;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの落札したオークション履歴を取得
 * @param page ページ番号
 * @returns 落札したオークション履歴の配列、次のページ番号、総件数
 */
export async function getUserWonAuctions(page = 1, userId: string, itemPerPage: number, _condition?: FilterCondition): Promise<WonAuctionItem[]> {
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
      task: {
        status: {
          in: [
            TaskStatus.AUCTION_ENDED,
            TaskStatus.SUPPLIER_DONE,
            TaskStatus.POINTS_DEPOSITED,
            TaskStatus.TASK_COMPLETED,
            TaskStatus.FIXED_EVALUATED,
            TaskStatus.POINTS_AWARDED,
          ],
        },
      },
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
  console.log("getUserWonAuctions_wonAuctionsData:", wonAuctionsData);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データを整形
   */
  const returnWonAuctions: WonAuctionItem[] = wonAuctionsData.map((auction) => ({
    auctionId: auction.id,
    currentHighestBid: auction.currentHighestBid,
    auctionEndTime: auction.endTime,
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
      task: {
        status: {
          in: [
            TaskStatus.AUCTION_ENDED,
            TaskStatus.SUPPLIER_DONE,
            TaskStatus.POINTS_DEPOSITED,
            TaskStatus.TASK_COMPLETED,
            TaskStatus.FIXED_EVALUATED,
            TaskStatus.POINTS_AWARDED,
          ],
        },
      },
    },
  });
  console.log("getUserWonAuctionsCount_count:", count);
  return count;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 出品したオークション履歴の条件を設定
 */
async function getUserCreatedAuctionsWhereCondition(
  userId: string,
  filter: AuctionCreatedTabFilter[],
  filterCondition: FilterCondition,
): Promise<Prisma.AuctionWhereInput> {
  console.log("getUserCreatedAuctionsWhereCondition_start_filter:", filter);
  console.log("getUserCreatedAuctionsWhereCondition_start_filterCondition:", filterCondition);

  const whereCondition: Prisma.AuctionWhereInput = {};
  const taskRoleConditions: Prisma.TaskWhereInput[] = [];

  // ロールフィルターの処理
  const hasCreatorFilter = filter.includes("creator");
  const hasExecutorFilter = filter.includes("executor");
  const hasReporterFilter = filter.includes("reporter");

  if (hasCreatorFilter) {
    taskRoleConditions.push({ creatorId: userId });
  }
  if (hasExecutorFilter) {
    taskRoleConditions.push({ executors: { some: { userId: userId } } });
  }
  if (hasReporterFilter) {
    taskRoleConditions.push({ reporters: { some: { userId: userId } } });
  }

  if (taskRoleConditions.length > 0) {
    if (filterCondition === "and") {
      whereCondition.task = { AND: taskRoleConditions };
    } else {
      whereCondition.task = { OR: taskRoleConditions };
    }
  } else {
    // ロールフィルターが何も選択されていない場合は、ユーザーが関与する全てのロールを対象 (これはOR条件が自然)
    whereCondition.task = {
      OR: [{ creatorId: userId }, { executors: { some: { userId: userId } } }, { reporters: { some: { userId: userId } } }],
    };
  }

  // ステータスフィルターの処理
  const statusFilters: TaskStatus[] = [];
  let supplierDoneFilter = false;
  if (filter.includes("active")) {
    statusFilters.push(TaskStatus.AUCTION_ACTIVE);
  }
  if (filter.includes("ended")) {
    statusFilters.push(TaskStatus.AUCTION_ENDED);
    statusFilters.push(TaskStatus.POINTS_DEPOSITED);
  }
  if (filter.includes("pending")) {
    statusFilters.push(TaskStatus.PENDING);
  }
  if (filter.includes("supplier_done")) {
    supplierDoneFilter = true;
  }

  if (statusFilters.length > 0 || supplierDoneFilter) {
    // ここでは、ロール条件とステータス条件はANDで結ぶのが一般的か。
    // filterCondition が AND の場合: (RoleA AND RoleB) AND (StatusA OR StatusB)
    // filterCondition が OR の場合: (RoleA OR RoleB) AND (StatusA OR StatusB) -> これは実質ロールフィルターのORに影響しない
    // filterCondition は主にロール間の条件に使われると想定。
    // ステータスは常にORで選択されたものを満たす、かつ、ロール条件を満たす。
    const andConditions: Prisma.AuctionWhereInput[] = [];
    if (whereCondition.task) {
      andConditions.push({ task: whereCondition.task });
      delete whereCondition.task;
    }
    if (statusFilters.length > 0) {
      andConditions.push({ task: { status: { in: statusFilters } } });
    }
    if (supplierDoneFilter) {
      andConditions.push({
        task: { status: { in: [TaskStatus.SUPPLIER_DONE, TaskStatus.TASK_COMPLETED, TaskStatus.FIXED_EVALUATED, TaskStatus.POINTS_AWARDED] } },
      });
    }
    if (andConditions.length > 0) {
      if (filterCondition === "and") {
        whereCondition.AND = andConditions;
      } else {
        whereCondition.OR = andConditions;
      }
    }
  }

  console.dir(whereCondition, { depth: null });

  return whereCondition;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの出品したオークション履歴を取得
 * @param page ページ番号
 * @returns 出品したオークション履歴の配列、次のページ番号、総件数
 */
export async function getUserCreatedAuctions(
  page = 1,
  userId: string,
  itemPerPage: number,
  filter: AuctionCreatedTabFilter[],
  filterCondition: FilterCondition,
): Promise<CreatedAuctionItem[]> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ログ
   */
  console.log("getUserCreatedAuctions_start_page:", page, "filter:", filter, "condition:", filterCondition);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 条件を設定
   */
  const whereCondition = await getUserCreatedAuctionsWhereCondition(userId, filter, filterCondition);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品したオークション履歴を取得
   */
  const createdAuctionsData = await prisma.auction.findMany({
    where: whereCondition,
    orderBy: {
      createdAt: "desc",
    },
    skip: (page - 1) * itemPerPage,
    take: itemPerPage,
    select: {
      id: true,
      createdAt: true,
      currentHighestBid: true,
      endTime: true,
      task: {
        select: {
          id: true,
          task: true,
          status: true,
          deliveryMethod: true,
          creator: {
            select: {
              id: true,
            },
          },
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
    auctionCreatedAt: auction.createdAt,
    taskId: auction.task.id,
    taskName: auction.task.task,
    taskStatus: auction.task.status,
    deliveryMethod: auction.task.deliveryMethod,
    winnerId: auction.winner?.id ?? null,
    winnerName: auction.winner?.name ?? null,
    isCreator: auction.task.creator.id === userId,
    isExecutor: auction.task.executors.some((executor) => executor.userId === userId),
    isReporter: auction.task.reporters.some((reporter) => reporter.userId === userId),
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
 * @param filter フィルター
 * @returns 出品履歴の件数
 */
export async function getUserCreatedAuctionsCount(
  userId: string,
  filter: AuctionCreatedTabFilter[],
  filterCondition: FilterCondition,
): Promise<number> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 条件を設定
   */
  const whereCondition = await getUserCreatedAuctionsWhereCondition(userId, filter, filterCondition);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品履歴の件数を取得
   */
  const count = await prisma.auction.count({
    where: whereCondition,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 件数を返却
   */
  return count;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
