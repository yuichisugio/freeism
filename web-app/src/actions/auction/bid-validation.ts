import type { TaskStatus } from "@prisma/client";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prisma } from "@/library-setting/prisma";
import { type PromiseResult } from "@/types/general-types";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション検証結果の型
 */
export type ValidateAuctionResult = {
  userId: string;
  auction: AuctionValidationData | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * バリデーション用のオークションデータ型
 */
export type AuctionValidationData = {
  status: TaskStatus;
  currentHighestBid: number;
  currentHighestBidderId: string | null;
  endTime: Date;
  startTime: Date;
  taskId: string;
  task: {
    creator: {
      id: string;
    };
    executors: Array<{
      userId: string | null;
    }>;
    task: string;
    detail: string | null;
    status: TaskStatus;
  };
  bidHistories: Array<{
    user: {
      id: string;
      name: string | null;
      image: string | null;
    };
  }> | null;
  version: number | null;
  // 延長関連フィールド
  isExtension: boolean;
  extensionTotalCount: number;
  extensionLimitCount: number;
  extensionTime: number;
  remainingTimeForExtension: number;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションの基本的な検証を行う共通関数
 * @param auctionId オークションID
 * @param options 検証オプション
 * @returns 検証結果
 */
export async function validateAuction(
  auctionId: string,
  options: {
    checkSelfListing: boolean | null;
    checkEndTime: boolean | null;
    checkCurrentBid: boolean | null;
    currentBid: number | null;
    requireActive: boolean | null;
    executeBid: boolean | null;
  },
): PromiseResult<ValidateAuctionResult> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 認証チェック
   */
  const userId = await getAuthenticatedSessionUserId();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークション情報を取得するためのクエリを構築
   */
  let auctionData: AuctionValidationData | null = null;

  // executeBid()の場合
  if (options.executeBid) {
    const result = await prisma.auction.findUnique({
      where: { id: auctionId },
      select: {
        endTime: true,
        startTime: true,
        currentHighestBid: true,
        currentHighestBidderId: true,
        isExtension: true,
        extensionTotalCount: true,
        extensionLimitCount: true,
        extensionTime: true,
        remainingTimeForExtension: true,
        task: {
          select: {
            task: true,
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
            status: true,
            detail: true,
          },
        },
      },
    });

    // 型を合わせるために不足しているプロパティを追加
    if (result) {
      auctionData = {
        status: result.task.status,
        currentHighestBid: result.currentHighestBid,
        currentHighestBidderId: result.currentHighestBidderId,
        endTime: result.endTime,
        startTime: result.startTime,
        taskId: result.task.creator.id,
        bidHistories: null,
        version: null,
        isExtension: result.isExtension,
        extensionTotalCount: result.extensionTotalCount,
        extensionLimitCount: result.extensionLimitCount,
        extensionTime: result.extensionTime,
        remainingTimeForExtension: result.remainingTimeForExtension,
        task: {
          ...result.task,
          executors: result.task.executors,
        },
      };
    }
  } else {
    // 基本情報のみを取得する場合はselectを使用
    const result = await prisma.auction.findUnique({
      where: { id: auctionId },
      select: {
        currentHighestBid: true,
        currentHighestBidderId: true,
        endTime: true,
        startTime: true,
        taskId: true,
        isExtension: true,
        extensionTotalCount: true,
        extensionLimitCount: true,
        extensionTime: true,
        remainingTimeForExtension: true,
        task: {
          select: {
            creator: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            executors: {
              select: {
                userId: true,
              },
            },
            task: true,
            status: true,
            detail: true,
          },
        },
      },
    });

    // 型を合わせるために不足しているプロパティを追加
    if (result) {
      auctionData = {
        status: result.task.status,
        currentHighestBid: result.currentHighestBid,
        currentHighestBidderId: result.currentHighestBidderId,
        endTime: result.endTime,
        startTime: result.startTime,
        taskId: result.taskId,
        bidHistories: null,
        version: null,
        isExtension: result.isExtension,
        extensionTotalCount: result.extensionTotalCount,
        extensionLimitCount: result.extensionLimitCount,
        extensionTime: result.extensionTime,
        remainingTimeForExtension: result.remainingTimeForExtension,
        task: {
          ...result.task,
          executors: result.task.executors,
        },
      };
    }
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークションが見つからない場合
   */
  if (!auctionData) {
    return {
      success: false,
      message: "オークションが見つかりません",
      data: {
        userId,
        auction: null,
      },
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自分がexecutorかどうかのチェック
   */
  const isExecutor = auctionData.task?.executors?.some((executor) => executor.userId === userId);
  if ((options.checkSelfListing || options.executeBid) && isExecutor) {
    return {
      success: false,
      message: "自分の出品に対して操作はできません",
      data: {
        userId,
        auction: null,
      },
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 終了時間のチェック
   */
  if ((options.checkEndTime || options.executeBid) && auctionData.endTime < new Date()) {
    return {
      success: false,
      message: "このオークションは終了しています",
      data: {
        userId,
        auction: null,
      },
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * アクティブ状態のチェック
   */
  if ((options.requireActive || options.executeBid) && auctionData.task?.status !== "AUCTION_ACTIVE") {
    return {
      success: false,
      message: "このオークションはアクティブではありません",
      data: {
        userId,
        auction: null,
      },
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 現在の最高入札額チェック
   */
  if (
    (options.checkCurrentBid || options.executeBid) &&
    options.currentBid !== null &&
    auctionData.currentHighestBid >= options.currentBid
  ) {
    return {
      success: false,
      message: `現在の最高入札額（${auctionData.currentHighestBid}ポイント）より高い額で入札してください`,
      data: {
        userId,
        auction: null,
      },
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 検証が完了した場合
   */
  return {
    success: true,
    message: "オークションの検証が完了しました",
    data: {
      userId,
      auction: auctionData,
    },
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
