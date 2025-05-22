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
export async function getUserWonAuctions(page = 1, userId: string, itemPerPage: number, wonStatus?: string): Promise<WonAuctionItem[]> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ログ
   */
  console.log("getUserWonAuctions_start_page:", page, "wonStatus:", wonStatus);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * wonStatusに応じたstatus配列
   */
  let statusIn: TaskStatus[] = [
    TaskStatus.AUCTION_ENDED,
    TaskStatus.SUPPLIER_DONE,
    TaskStatus.POINTS_DEPOSITED,
    TaskStatus.TASK_COMPLETED,
    TaskStatus.FIXED_EVALUATED,
    TaskStatus.POINTS_AWARDED,
  ];
  if (wonStatus === "completed") {
    statusIn = [TaskStatus.TASK_COMPLETED, TaskStatus.FIXED_EVALUATED, TaskStatus.POINTS_AWARDED];
  } else if (wonStatus === "incomplete") {
    statusIn = [TaskStatus.PENDING, TaskStatus.AUCTION_ACTIVE, TaskStatus.AUCTION_ENDED, TaskStatus.POINTS_DEPOSITED, TaskStatus.SUPPLIER_DONE];
  }

  /**
   * 落札したオークション履歴を取得
   */
  const wonAuctionsData = await prisma.auction.findMany({
    where: {
      winnerId: userId,
      task: {
        status: {
          in: statusIn,
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
export async function getUserWonAuctionsCount(userId: string, wonStatus?: string): Promise<number> {
  let statusIn: TaskStatus[] = [
    TaskStatus.AUCTION_ENDED,
    TaskStatus.SUPPLIER_DONE,
    TaskStatus.POINTS_DEPOSITED,
    TaskStatus.TASK_COMPLETED,
    TaskStatus.FIXED_EVALUATED,
    TaskStatus.POINTS_AWARDED,
  ];
  if (wonStatus === "completed") {
    statusIn = [TaskStatus.TASK_COMPLETED, TaskStatus.FIXED_EVALUATED, TaskStatus.POINTS_AWARDED];
  } else if (wonStatus === "incomplete") {
    statusIn = [TaskStatus.PENDING, TaskStatus.AUCTION_ACTIVE, TaskStatus.AUCTION_ENDED, TaskStatus.POINTS_DEPOSITED, TaskStatus.SUPPLIER_DONE];
  }
  const count = await prisma.auction.count({
    where: {
      winnerId: userId,
      task: {
        status: {
          in: statusIn,
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

  // --- ロール条件の構築 ---
  const taskRoleConditions: Prisma.TaskWhereInput[] = [];
  if (filter.includes("creator")) taskRoleConditions.push({ creatorId: userId });
  if (filter.includes("executor")) taskRoleConditions.push({ executors: { some: { userId: userId } } });
  if (filter.includes("reporter")) taskRoleConditions.push({ reporters: { some: { userId: userId } } });
  // ロール条件が空なら全ロール対象
  const roleCondition: Prisma.AuctionWhereInput | null =
    taskRoleConditions.length > 0
      ? { task: filterCondition === "and" ? { AND: taskRoleConditions } : { OR: taskRoleConditions } }
      : { task: { OR: [{ creatorId: userId }, { executors: { some: { userId: userId } } }, { reporters: { some: { userId: userId } } }] } };

  // --- ステータス条件の構築 ---
  const statusFilters: TaskStatus[] = [];
  if (filter.includes("active")) statusFilters.push(TaskStatus.AUCTION_ACTIVE);
  if (filter.includes("ended")) {
    statusFilters.push(TaskStatus.AUCTION_ENDED, TaskStatus.POINTS_DEPOSITED);
  }
  if (filter.includes("pending")) statusFilters.push(TaskStatus.PENDING);
  if (filter.includes("supplier_done")) {
    statusFilters.push(TaskStatus.SUPPLIER_DONE, TaskStatus.TASK_COMPLETED, TaskStatus.FIXED_EVALUATED, TaskStatus.POINTS_AWARDED);
  }

  // ステータス条件
  const statusCondition: Prisma.AuctionWhereInput | null =
    statusFilters.length > 0
      ? {
          task: {
            status: {
              in: statusFilters,
            },
          },
        }
      : null;

  // --- AND/ORの組み立て ---
  let whereCondition: Prisma.AuctionWhereInput = {};
  if (filterCondition === "and") {
    // AND検索: 両方条件があればANDでつなぐ
    const andArr: Prisma.AuctionWhereInput[] = [];
    if (roleCondition) andArr.push(roleCondition);
    if (statusCondition) andArr.push(statusCondition);
    if (andArr.length === 1) whereCondition = andArr[0];
    else if (andArr.length > 1) whereCondition.AND = andArr;
  } else {
    // OR検索: いずれかの条件を満たすもの
    const orArr: Prisma.AuctionWhereInput[] = [];
    if (roleCondition) orArr.push(roleCondition);
    if (statusCondition) orArr.push(statusCondition);
    if (orArr.length === 1) whereCondition = orArr[0];
    else if (orArr.length > 1) whereCondition.OR = orArr;
  }

  console.dir(whereCondition, { depth: null });

  return whereCondition;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの出品したオークション履歴と件数を同時に取得
 */
export async function getUserCreatedAuctionsWithCount(
  page = 1,
  userId: string,
  itemPerPage: number,
  filter: AuctionCreatedTabFilter[],
  filterCondition: FilterCondition,
): Promise<{ data: CreatedAuctionItem[]; count: number }> {
  // 条件を1回だけ作成
  const whereCondition = await getUserCreatedAuctionsWhereCondition(userId, filter, filterCondition);

  // データと件数を同時取得
  const [createdAuctionsData, count] = await Promise.all([
    prisma.auction.findMany({
      where: whereCondition,
      orderBy: { createdAt: "desc" },
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
            creator: { select: { id: true } },
            executors: { select: { userId: true } },
            reporters: { select: { userId: true } },
          },
        },
        winner: { select: { id: true, name: true } },
      },
    }),
    prisma.auction.count({ where: whereCondition }),
  ]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データを整形
   */
  const returnCreatedAuctions: CreatedAuctionItem[] = createdAuctionsData.map((auction) => {
    const isCreator = auction.task.creator.id === userId;
    const isExecutor = auction.task.executors.some((executor) => executor.userId === userId);
    const isReporter = auction.task.reporters.some((reporter) => reporter.userId === userId);
    const taskRole: ("SUPPLIER" | "EXECUTOR" | "REPORTER")[] = [];
    if (isCreator) taskRole.push("SUPPLIER");
    if (isExecutor) taskRole.push("EXECUTOR");
    if (isReporter) taskRole.push("REPORTER");
    return {
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
      isCreator,
      isExecutor,
      isReporter,
      taskRole,
    };
  });

  return { data: returnCreatedAuctions, count };
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

/**
 * ユーザーの入札履歴と件数を同時に取得
 */
export async function getUserBidHistoriesWithCount(
  page = 1,
  userId: string,
  itemPerPage: number,
): Promise<{ data: BidHistoryItem[]; count: number }> {
  // データと件数を同時取得
  const [allBids, count] = await Promise.all([
    prisma.bidHistory.findMany({
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
    }),
    prisma.bidHistory
      .findMany({
        where: { userId: userId },
        distinct: ["auctionId"],
        select: { auctionId: true },
      })
      .then((distinctBids) => distinctBids.length),
  ]);

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

  return { data: returnBidedAuctionPerPage, count };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの落札履歴と件数を同時に取得
 */
export async function getUserWonAuctionsWithCount(
  page = 1,
  userId: string,
  itemPerPage: number,
  wonStatus?: string,
): Promise<{ data: WonAuctionItem[]; count: number }> {
  // wonStatusに応じたstatus配列
  let statusIn: TaskStatus[] = [
    TaskStatus.AUCTION_ENDED,
    TaskStatus.SUPPLIER_DONE,
    TaskStatus.POINTS_DEPOSITED,
    TaskStatus.TASK_COMPLETED,
    TaskStatus.FIXED_EVALUATED,
    TaskStatus.POINTS_AWARDED,
  ];
  if (wonStatus === "completed") {
    statusIn = [TaskStatus.TASK_COMPLETED, TaskStatus.FIXED_EVALUATED, TaskStatus.POINTS_AWARDED];
  } else if (wonStatus === "incomplete") {
    statusIn = [TaskStatus.PENDING, TaskStatus.AUCTION_ACTIVE, TaskStatus.AUCTION_ENDED, TaskStatus.POINTS_DEPOSITED, TaskStatus.SUPPLIER_DONE];
  }

  // データと件数を同時取得
  const [wonAuctionsData, count] = await Promise.all([
    prisma.auction.findMany({
      where: {
        winnerId: userId,
        task: { status: { in: statusIn } },
      },
      orderBy: { endTime: "desc" },
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
          select: { rating: true },
        },
      },
    }),
    prisma.auction.count({
      where: {
        winnerId: userId,
        task: { status: { in: statusIn } },
      },
    }),
  ]);

  const returnWonAuctions: WonAuctionItem[] = wonAuctionsData.map((auction) => ({
    auctionId: auction.id,
    currentHighestBid: auction.currentHighestBid,
    auctionEndTime: auction.endTime,
    auctionCreatedAt: auction.createdAt,
    taskId: auction.task.id,
    taskName: auction.task.task,
    taskStatus: auction.task.status,
    deliveryMethod: auction.task.deliveryMethod,
    rating: auction.reviews.length > 0 ? auction.reviews.reduce((acc, review) => acc + review.rating, 0) / auction.reviews.length : null,
  }));

  return { data: returnWonAuctions, count };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
