"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { type AuctionCreatedTabFilter, type CreatedAuctionItem, type FilterCondition } from "@/types/auction-types";
import { TaskStatus } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 出品したオークション履歴の条件を設定
 */
export async function getUserCreatedAuctionsWhereCondition(
  userId: string,
  filter: AuctionCreatedTabFilter[],
  filterCondition: FilterCondition,
): Promise<Prisma.AuctionWhereInput> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメータの型と値の検証
   */
  if (!userId || !filter || !filterCondition) {
    throw new Error("userId, filter, and filterCondition are required");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ロール条件の構築
   */
  const taskRoleConditions: Prisma.TaskWhereInput[] = [];
  if (filter.includes("creator")) taskRoleConditions.push({ creatorId: userId });
  if (filter.includes("executor")) taskRoleConditions.push({ executors: { some: { userId: userId } } });
  if (filter.includes("reporter")) taskRoleConditions.push({ reporters: { some: { userId: userId } } });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ロール条件が空なら全ロール対象
   */
  const roleCondition: Prisma.AuctionWhereInput | null =
    taskRoleConditions.length > 0
      ? { task: filterCondition === "and" ? { AND: taskRoleConditions } : { OR: taskRoleConditions } }
      : {
          task: {
            OR: [
              { creatorId: userId },
              { executors: { some: { userId: userId } } },
              { reporters: { some: { userId: userId } } },
            ],
          },
        };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ステータス条件の構築
   */
  const statusFilters: TaskStatus[] = [];
  if (filter.includes("active")) statusFilters.push(TaskStatus.AUCTION_ACTIVE);
  if (filter.includes("ended")) {
    statusFilters.push(TaskStatus.AUCTION_ENDED, TaskStatus.POINTS_DEPOSITED);
  }
  if (filter.includes("pending")) statusFilters.push(TaskStatus.PENDING);
  if (filter.includes("supplier_done")) {
    statusFilters.push(
      TaskStatus.SUPPLIER_DONE,
      TaskStatus.TASK_COMPLETED,
      TaskStatus.FIXED_EVALUATED,
      TaskStatus.POINTS_AWARDED,
    );
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ステータス条件
   */
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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * AND/ORの組み立て
   */
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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 条件を返却
   */
  return whereCondition;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの出品したオークション履歴を取得
 * @param page ページ番号
 * @param userId ユーザーID
 * @param itemPerPage 1ページあたりのアイテム数
 * @param filter フィルター条件
 * @param filterCondition フィルター条件のAND/OR
 * @returns 出品したオークション履歴
 */
export async function getUserCreatedAuctions(
  page = 1,
  userId: string,
  itemPerPage: number,
  filter: AuctionCreatedTabFilter[],
  filterCondition: FilterCondition,
): Promise<CreatedAuctionItem[]> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメータが不足している場合はエラーを返却
   */
  if (!userId || !itemPerPage || !page || !filter || !filterCondition) {
    throw new Error("userId, itemPerPage, page, filter, and filterCondition are required");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 条件を作成
   */
  const whereCondition = await getUserCreatedAuctionsWhereCondition(userId, filter, filterCondition);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データを取得
   */
  const createdAuctionsData = await prisma.auction.findMany({
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
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データがない場合は空配列を返却
   */
  if (createdAuctionsData.length === 0) {
    return [];
  }

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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データを返却
   */
  return returnCreatedAuctions;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの出品したオークションの件数を取得
 * getUserCreatedAuctions内で↓の処理は入れない。ページを跨ぐごとに全体の件数を取得しなくないため
 * @param userId ユーザーID
 * @param filter フィルター条件
 * @param filterCondition フィルター条件のAND/OR
 * @returns 出品したオークションの件数
 */
export async function getUserCreatedAuctionsCount(
  userId: string,
  filter: AuctionCreatedTabFilter[],
  filterCondition: FilterCondition,
): Promise<number> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメータが不足している場合はエラーを返却
   */
  if (!userId || !filter || !filterCondition) {
    throw new Error("userId, filter, and filterCondition are required");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 条件を作成
   */
  const whereCondition = await getUserCreatedAuctionsWhereCondition(userId, filter, filterCondition);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データの件数を取得
   */
  const count = await prisma.auction.count({ where: whereCondition });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データがない場合は0を返却
   */
  if (count === 0) {
    return 0;
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データを返却
   */
  return count;
}
