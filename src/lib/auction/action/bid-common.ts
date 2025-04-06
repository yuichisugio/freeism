"use server";

import type { Session } from "next-auth";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { sendAuctionNotification } from "@/lib/actions/notification/auction-notification";
import { prisma } from "@/lib/prisma";
import { BidStatus, NotificationSendMethod, NotificationSendTiming, AuctionEventType as PrismaAuctionEventType, TaskStatus } from "@prisma/client";

import type { AuctionWithDetails, BidHistory, User, WatchlistItem } from "../type/types";
import { AUCTION_CONSTANTS } from "../constants";
import { AuctionEventType } from "../type/types";
import { sendEventToAuctionSubscribers } from "./server-sent-events-broadcast";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 共通入札処理の結果型
 */
export type BidActionResult = {
  success: boolean;
  message?: string;
  bid?: BidHistory;
  isAutoBid?: boolean;
  auction?: AuctionWithDetails;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 自動入札処理の応答型
 */
export type AutoBidResponse = {
  success: boolean;
  message: string;
  autoBid?: {
    id: string;
    maxBidAmount: number;
    bidIncrement: number;
  };
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション検証結果の型
 */
type ValidateAuctionResult = {
  success: boolean;
  message?: string;
  userId?: string;
  auction?: AuctionValidationData;
  session?: Session | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクの基本情報型
 */
type TaskBasicInfo = {
  creator?: {
    id: string;
    name?: string | null;
    image?: string | null;
  };
  task?: string | null;
  detail?: string | null;
  group?: TaskGroup;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクグループの型
 */
type TaskGroup = {
  id: string;
  name: string;
  depositPeriod?: number;
  createdAt?: Date;
  updatedAt?: Date;
  goal?: string;
  evaluationMethod?: string;
  maxParticipants?: number;
  createdBy?: string;
  isBlackList?: unknown;
  [key: string]: unknown;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * バリデーション用のオークションデータ型
 */
type AuctionValidationData = {
  id: string;
  status: string;
  currentHighestBid: number;
  currentHighestBidderId: string | null;
  endTime: Date;
  task?: TaskBasicInfo;
  bidHistories?: Array<{
    user?: {
      id: string;
      name?: string | null;
      image?: string | null;
    };
    [key: string]: unknown;
  }>;
  version?: number;
  [key: string]: unknown;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Prismaクエリの型
 */
type PrismaQueryOptions = {
  where: { id: string };
  select?: Record<string, unknown>;
  include?: Record<string, unknown>;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * トランザクション内で実行する入札処理の結果型
 */
type BidTransactionResult = {
  bidHistory: {
    id: string;
    auctionId: string;
    userId: string;
    amount: number;
    createdAt: Date;
    isAutoBid: boolean;
    status: BidStatus;
  };
  updatedAuction: unknown;
  auctionWithDetails?: AuctionWithDetails;
};

/**
 * tx.auction.findUniqueの結果の厳密な型定義
 */
type AuctionWithRelations = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  status: string;
  taskId: string;
  startTime: Date;
  endTime: Date;
  currentHighestBid: number;
  currentHighestBidderId: string | null;
  winnerId: string | null;
  extensionCount: number;
  version: number;
  task: {
    task: string | null;
    detail: string | null;
    creator: {
      id: string;
      name: string | null;
      image: string | null;
    };
    group: TaskGroup;
  };
  bidHistories: Array<{
    id: string;
    amount: number;
    createdAt: Date;
    isAutoBid: boolean;
    status: string;
    user: {
      id: string;
      name: string | null;
      image: string | null;
    };
  }>;
  watchlists: Array<{
    id: string;
    userId: string;
  }>;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションの基本的な検証を行う共通関数
 * @param auctionId オークションID
 * @param options 検証オプション
 * @returns 検証結果
 */
async function validateAuction(
  auctionId: string,
  options: {
    checkSelfListing?: boolean;
    checkEndTime?: boolean;
    checkCurrentBid?: boolean;
    currentBid?: number;
    requireActive?: boolean;
    includeTask?: boolean;
    includeBidHistories?: boolean;
    messagePrefix?: string;
  } = {},
): Promise<ValidateAuctionResult> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 認証チェック
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return {
        success: false,
        message: `${options.messagePrefix ?? "操作"}するには、ログインが必要です`,
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // オークション情報を取得するためのクエリを構築
    let auction;

    // タスク情報やBidHistoriesを含める場合はincludeを使用
    if (options.includeTask || options.includeBidHistories) {
      const includeQuery: Record<string, unknown> = {};

      if (options.includeTask) {
        includeQuery.task = {
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
        };
      }

      if (options.includeBidHistories) {
        includeQuery.bidHistories = {
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
        };
      }

      auction = await prisma.auction.findUnique({
        where: { id: auctionId },
        include: includeQuery,
      });
    } else {
      // 基本情報のみを取得する場合はselectを使用
      auction = await prisma.auction.findUnique({
        where: { id: auctionId },
        select: {
          id: true,
          status: true,
          currentHighestBid: true,
          currentHighestBidderId: true,
          endTime: true,
          task: {
            select: {
              creator: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
              task: true,
            },
          },
        },
      });
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    if (!auction) {
      return {
        success: false,
        message: "オークションが見つかりません",
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 自分の出品のチェック
    const auctionData = auction as unknown as AuctionValidationData;
    if (options.checkSelfListing && auctionData.task?.creator?.id === userId) {
      return {
        success: false,
        message: "自分の出品に対して操作はできません",
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 終了時間のチェック
    if (options.checkEndTime && auctionData.endTime < new Date()) {
      return {
        success: false,
        message: "このオークションは終了しています",
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // アクティブ状態のチェック
    if (options.requireActive && auctionData.status !== "ACTIVE") {
      return {
        success: false,
        message: "このオークションはアクティブではありません",
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 現在の最高入札額チェック
    if (options.checkCurrentBid && options.currentBid !== undefined && auctionData.currentHighestBid >= options.currentBid) {
      return {
        success: false,
        message: `現在の最高入札額（${auctionData.currentHighestBid}ポイント）より高い額で入札してください`,
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    return {
      success: true,
      userId,
      auction: auctionData,
      session,
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("オークション検証エラー:", error);
    return {
      success: false,
      message: "オークションの検証中にエラーが発生しました",
    };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 共通エラーハンドリング関数
 * @param error エラーオブジェクト
 * @param prefix エラーメッセージのプレフィックス
 * @param isAutoBid 自動入札かどうか
 * @returns 処理結果
 */
function handleBidError(error: unknown, prefix: string, isAutoBid = false): BidActionResult {
  console.error(`${prefix}エラー:`, error);
  return {
    success: false,
    message: `${prefix}中にエラーが発生しました`,
    isAutoBid,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * バリデーション結果を処理する共通関数
 * @param validation バリデーション結果
 * @param isAutoBid 自動入札かどうか
 * @returns 処理結果（エラー時）またはnull（成功時）
 */
function processValidationResult(validation: ValidateAuctionResult, isAutoBid = false): BidActionResult | null {
  if (!validation.success || !validation.userId) {
    return {
      success: false,
      message: validation.message,
      isAutoBid,
    };
  }
  return null;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザー情報を安全に取得するヘルパー関数
 * @param session セッション情報
 * @param userId ユーザーID
 * @returns 安全なユーザー情報
 */
function getSafeUserInfo(session: Session | null | undefined, userId: string): User {
  return {
    id: userId,
    username: session?.user?.name ?? "",
    email: "",
    createdAt: new Date().toISOString(),
    name: session?.user?.name ?? null,
    image: session?.user?.image ?? null,
    emailVerified: null,
    isAppOwner: false,
    updatedAt: new Date(),
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * プロパティを安全に取得するヘルパー関数
 */
function getProperty<T, K extends keyof T>(obj: T | undefined | null, key: K, defaultValue: T[K]): T[K] {
  return obj ? obj[key] : defaultValue;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 安全なTaskGroupのデフォルト値を提供する
 */
function getDefaultTaskGroup(): TaskGroup {
  return {
    id: "",
    name: "",
    depositPeriod: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    goal: "",
    evaluationMethod: "",
    maxParticipants: 0,
    createdBy: "",
    isBlackList: null,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入札処理の共通部分を実装した関数
 * @param auctionId オークションID
 * @param amount 入札金額
 * @param isAutoBid 自動入札かどうか
 * @returns 入札処理の結果
 */
export async function executeBid(auctionId: string, amount: number, isAutoBid = false): Promise<BidActionResult> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // オークションの検証
    const validation = await validateAuction(auctionId, {
      checkSelfListing: true,
      checkEndTime: true,
      checkCurrentBid: true,
      currentBid: amount,
      includeTask: true,
      includeBidHistories: true,
      messagePrefix: "入札",
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // バリデーションエラーチェック
    const validationError = processValidationResult(validation, isAutoBid);
    if (validationError) return validationError;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // この時点でuserIdは必ず存在する
    const userId = validation.userId!;
    const session = validation.session;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // すべての処理をトランザクションで実行
    const result: BidTransactionResult = await prisma.$transaction(async (tx) => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 楽観的ロックのためのバージョン取得
      const auctionWithVersion = await tx.auction.findUnique({
        where: { id: auctionId },
        select: { version: true },
      });

      // バージョン取得できない場合
      if (!auctionWithVersion) {
        throw new Error("オークションが見つかりません");
      }

      // versionを取得
      const initialVersion = auctionWithVersion.version;

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 入札履歴を作成
      const bidHistory = await tx.bidHistory.create({
        data: {
          auctionId,
          userId,
          amount: amount,
          status: BidStatus.BIDDING,
          isAutoBid: isAutoBid,
        },
      });

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // オークション情報を更新（楽観的ロックを使用）
      const updatedAuctionVersion = await tx.auction.update({
        where: {
          id: auctionId,
          version: initialVersion, // 楽観的ロック
        },
        data: {
          currentHighestBid: amount,
          currentHighestBidderId: userId,
          version: { increment: 1 }, // バージョンをインクリメント
        },
        select: {
          version: true,
        },
      });

      if (!updatedAuctionVersion) {
        throw new Error("オークション情報を更新できませんでした");
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 更新後の最新情報を取得
      const updatedAuction = await tx.auction.findUnique({
        where: { id: auctionId },
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

      if (!updatedAuction) {
        throw new Error("更新されたオークション情報を取得できませんでした");
      }

      // 安全にアクセスするためのヘルパー変数を用意
      const userInfo = getSafeUserInfo(session, userId);

      // TypeScriptに型情報を教える
      const auctionData = updatedAuction as unknown as AuctionWithRelations;

      const task = auctionData.task;
      const creatorId = getProperty(task?.creator, "id", "");
      const taskName = getProperty(task, "task", "");
      const taskDetail = getProperty(task, "detail", "");
      const taskGroup = task?.group ?? getDefaultTaskGroup();

      // AuctionWithDetails形式に変換
      const auctionWithDetails: AuctionWithDetails = {
        id: auctionData.id,
        createdAt: auctionData.createdAt,
        updatedAt: auctionData.updatedAt,
        status: auctionData.status,
        taskId: auctionData.taskId,
        startTime: auctionData.startTime,
        endTime: auctionData.endTime,
        currentHighestBid: auctionData.currentHighestBid,
        currentHighestBidderId: auctionData.currentHighestBidderId,
        bidHistories: auctionData.bidHistories.map((bid) => ({
          id: bid.id,
          auctionId: auctionId,
          userId: bid.user?.id ?? userId,
          amount: bid.amount,
          createdAt: bid.createdAt.toISOString(),
          isAutoBid: bid.isAutoBid,
          status: bid.status,
        })),
        winnerId: auctionData.winnerId,
        extensionCount: auctionData.extensionCount,
        version: auctionData.version,
        title: taskName ?? "",
        description: taskDetail ?? "",
        currentPrice: auctionData.currentHighestBid,
        sellerId: creatorId,
        task: {
          id: auctionData.taskId,
          createdAt: new Date(),
          updatedAt: new Date(),
          creatorId: creatorId,
          task: taskName ?? "",
          groupId: taskGroup.id,
          detail: taskDetail,
          status: TaskStatus.PENDING,
          reference: null,
          category: null,
          imageUrl: null,
          deliveryMethod: null,
          info: null,
          fixedContributionPoint: null,
          fixedEvaluator: null,
          fixedEvaluationLogic: null,
          fixedEvaluationDate: null,
          userFixedSubmitterId: null,
          contributionType: "NON_REWARD",
          creator: {
            id: creatorId,
            username: getProperty(task?.creator, "name", "") ?? "",
            email: "",
            createdAt: new Date().toISOString(),
            name: getProperty(task?.creator, "name", null),
            image: getProperty(task?.creator, "image", null),
            emailVerified: null,
            isAppOwner: false,
            updatedAt: new Date(),
          },
          group: taskGroup,
        },
        depositPeriod: taskGroup.depositPeriod ?? 0,
        currentHighestBidder: null,
        winner: null,
        watchlists: auctionData.watchlists.map(
          (w) =>
            ({
              id: w.id,
              userId: w.userId,
              auctionId: auctionId,
            }) as WatchlistItem,
        ),
        bid: {
          id: bidHistory.id,
          auctionId: bidHistory.auctionId,
          userId: bidHistory.userId,
          amount: bidHistory.amount,
          createdAt: bidHistory.createdAt.toISOString(),
          isAutoBid: bidHistory.isAutoBid,
          status: bidHistory.status,
          user: userInfo,
        },
      };

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 楽観的ロックのためのバージョン取得
      const auctionWithEndVersion = await tx.auction.findUnique({
        where: { id: auctionId },
        select: { version: true },
      });

      // バージョン取得できない場合
      if (!auctionWithEndVersion) {
        throw new Error("オークションが見つかりません");
      }

      // 楽観的ロックのためのバージョンで、データ更新後にインクリメントしているので、開始時と同じ値になるように-1する
      const endVersion = auctionWithEndVersion.version - 1;

      // 楽観的ロックのためのバージョンが開始時と同じ値になっていない場合は、エラーを投げてロールバックする
      if (endVersion !== initialVersion) {
        throw new Error("他者によってオークション情報が変更されています");
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // SSEでリアルタイム更新を通知。$transaction内で実行したい
      await sendEventToAuctionSubscribers(auctionId, AuctionEventType.NEW_BID, auctionWithDetails);

      return { bidHistory, updatedAuction, auctionWithDetails };
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // パスの再検証
    revalidatePath(`/auctions/${auctionId}`);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    return {
      success: true,
      message: isAutoBid ? `${amount}ポイントで自動入札しました` : "入札が完了しました",
      bid: {
        id: result.bidHistory.id,
        auctionId: result.bidHistory.auctionId,
        userId: result.bidHistory.userId,
        amount: result.bidHistory.amount,
        createdAt: result.bidHistory.createdAt.toISOString(),
        isAutoBid: result.bidHistory.isAutoBid,
        status: result.bidHistory.status,
      },
      isAutoBid,
      auction: result.auctionWithDetails,
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    return handleBidError(error, "入札処理", isAutoBid);
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 自動入札を設定する
 * @param auctionId オークションID
 * @param limitBidAmount 自動入札の上限入札額
 * @param bidIncrement 自動入札の入札単位
 * @returns 処理結果
 */
export async function setAutoBid(auctionId: string, limitBidAmount: number, bidIncrement: number): Promise<AutoBidResponse> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // オークションの検証
    const validation = await validateAuction(auctionId, {
      checkSelfListing: true,
      checkEndTime: true,
      messagePrefix: "自動入札を設定",
    });

    if (!validation.success || !validation.userId) {
      console.log("bid-common_setAutoBid_validation_error_!validation.success || !validation.userId", validation);
      return {
        success: false,
        message: validation.message ?? "検証エラー",
      };
    }

    const userId = validation.userId;
    const auction = validation.auction;

    if (!auction) {
      console.log("bid-common_setAutoBid_error_!auction", !auction);
      return {
        success: false,
        message: "オークション情報が取得できませんでした",
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 自動入札の上限入札額が現在の最高入札額より高いか確認
    if (limitBidAmount <= auction.currentHighestBid) {
      console.log("bid-common_setAutoBid_error_limitBidAmount <= auction.currentHighestBid", limitBidAmount, auction.currentHighestBid);
      return {
        success: false,
        message: "最大入札額は現在の最高入札額より高く設定してください",
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 入札単位が正の整数か確認
    if (bidIncrement < 1) {
      console.log("bid-common_setAutoBid_error_bidIncrement < 1", bidIncrement);
      return {
        success: false,
        message: "入札単位は1以上の整数で設定してください",
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // トランザクションで自動入札の設定を保存
    const result = await prisma.$transaction(async (tx) => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 既存の自動入札設定を確認
      const existingAutoBid = await tx.autoBid.findFirst({
        where: {
          auctionId,
          userId,
        },
      });

      console.log("bid-common_setAutoBid_existingAutoBid", existingAutoBid);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      let autoBid;

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 既存の自動入札設定が存在する場合
      if (existingAutoBid) {
        console.log("bid-common_setAutoBid_existingAutoBid_if_update");
        // 既存の設定を更新
        autoBid = await tx.autoBid.update({
          where: { id: existingAutoBid.id },
          data: {
            maxBidAmount: limitBidAmount,
            bidIncrement,
            isActive: true,
            updatedAt: new Date(),
          },
        });
      } else {
        console.log("bid-common_setAutoBid_existingAutoBid_else_create");
        // 新規設定を作成
        autoBid = await tx.autoBid.create({
          data: {
            auctionId,
            userId,
            maxBidAmount: limitBidAmount,
            bidIncrement,
            isActive: true,
          },
        });
      }

      console.log("bid-common_setAutoBid_autoBid", autoBid);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      return autoBid;
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // パスの再検証
    revalidatePath(`/auctions/${auctionId}`);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    return {
      success: true,
      message: "自動入札を設定しました",
      autoBid: {
        id: result.id,
        maxBidAmount: result.maxBidAmount,
        bidIncrement: result.bidIncrement,
      },
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("自動入札設定エラー:", error);
    console.log("setAutoBid_error_stack", new Error().stack);
    return {
      success: false,
      message: "自動入札の設定中にエラーが発生しました",
    };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 自動入札設定を取得する
 * @param auctionId オークションID
 * @returns 処理結果
 */
export async function getAutoBid(auctionId: string): Promise<AutoBidResponse> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // オークションの検証（最小限のチェック）
    const validation = await validateAuction(auctionId, {
      messagePrefix: "自動入札設定を取得",
    });

    // バリデーションエラーチェック
    if (!validation.success || !validation.userId) {
      return {
        success: false,
        message: validation.message ?? "検証エラー",
      };
    }

    // この時点でuserIdは必ず存在する
    const userId = validation.userId;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // トランザクションで自動入札設定を取得
    const autoBid = await prisma.$transaction(async (tx) => {
      return await tx.autoBid.findFirst({
        where: {
          auctionId,
          userId,
          isActive: true,
        },
      });
    });

    if (!autoBid) {
      return {
        success: false,
        message: "自動入札設定がありません",
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    return {
      success: true,
      message: "自動入札設定を取得しました",
      autoBid: {
        id: autoBid.id,
        maxBidAmount: autoBid.maxBidAmount,
        bidIncrement: autoBid.bidIncrement,
      },
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("自動入札設定取得エラー:", error);
    return {
      success: false,
      message: "自動入札設定の取得中にエラーが発生しました",
    };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 自動入札をキャンセルする
 * @param auctionId オークションID
 * @returns 処理結果
 */
export async function cancelAutoBid(auctionId: string): Promise<AutoBidResponse> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // オークションの検証（最小限のチェック）
    const validation = await validateAuction(auctionId, { messagePrefix: "自動入札をキャンセル" });

    // バリデーションエラーチェック
    if (!validation.success || !validation.userId) {
      return {
        success: false,
        message: validation.message ?? "検証エラー",
      };
    }

    // この時点でuserIdは必ず存在する
    const userId = validation.userId;

    // トランザクションで自動入札キャンセル処理を実行
    const result = await prisma.$transaction(async (tx) => {
      // 自動入札設定を取得
      const autoBid = await tx.autoBid.findFirst({
        where: {
          auctionId,
          userId,
          isActive: true,
        },
      });

      if (!autoBid) {
        return { success: false, message: "自動入札設定がありません" };
      }

      // 自動入札を非アクティブに設定
      await tx.autoBid.update({
        where: { id: autoBid.id },
        data: { isActive: false },
      });

      return { success: true };
    });

    // 処理結果をチェック
    if (!result.success) {
      return {
        success: false,
        message: result.message ?? "自動入札のキャンセル中にエラーが発生しました",
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // パスの再検証
    revalidatePath(`/auctions/${auctionId}`);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    return {
      success: true,
      message: "自動入札をキャンセルしました",
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("自動入札キャンセルエラー:", error);
    return {
      success: false,
      message: "自動入札のキャンセル中にエラーが発生しました",
    };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 自動入札の前処理を行う関数
 * @param auctionId オークションID
 * @param currentHighestBid 現在の最高入札額
 * @param currentHighestBidderId 現在の最高入札者ID
 * @param userId ユーザーID
 * @param auction オークション情報
 * @returns 前処理結果
 */
async function prepareAutoBid(
  auctionId: string,
  currentHighestBid: number,
  currentHighestBidderId: string | null,
  userId: string,
  auction: AuctionValidationData,
): Promise<{
  success: boolean;
  message?: string;
  nextBidAmount?: number;
  autoBid?: {
    id: string;
    maxBidAmount: number;
    bidIncrement: number;
  };
  autoBidLimitReached?: boolean;
}> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // すべての処理をトランザクションで実行
    return await prisma.$transaction(async (tx) => {
      // 自分が現在の最高入札者の場合は実行しない
      if (currentHighestBidderId === userId) {
        return { success: false, message: "あなたが現在の最高入札者です" };
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 自動入札設定を取得
      const autoBid = await tx.autoBid.findFirst({
        where: {
          auctionId,
          userId,
          isActive: true,
        },
      });

      if (!autoBid) {
        return { success: false, message: "自動入札設定がありません" };
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // オークションが終了していないか確認
      if (auction.endTime < new Date() || auction.status !== "ACTIVE") {
        // 自動入札を無効化
        await tx.autoBid.update({
          where: { id: autoBid.id },
          data: { isActive: false },
        });

        return { success: false, message: "このオークションは終了しています" };
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 入札履歴を取得して最後の入札時間をチェック
      const lastBid = await tx.bidHistory.findFirst({
        where: {
          auctionId,
          userId,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 前回の入札から指定時間経過していない場合は実行しない
      if (lastBid) {
        const MIN_BID_INTERVAL_MS = AUCTION_CONSTANTS.AUTO_BID_MIN_INTERVAL_MS;
        const timeSinceLastBid = Date.now() - lastBid.createdAt.getTime();

        if (timeSinceLastBid < MIN_BID_INTERVAL_MS) {
          return { success: false, message: `前回の入札から${AUCTION_CONSTANTS.AUTO_BID_MIN_INTERVAL_MINUTES}分経過していないため、自動入札できません` };
        }
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 次の入札額を計算
      const nextBidAmount = currentHighestBid + autoBid.bidIncrement;

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 上限額を超える場合
      if (nextBidAmount > autoBid.maxBidAmount) {
        // 自動入札を無効化
        await tx.autoBid.update({
          where: { id: autoBid.id },
          data: { isActive: false },
        });

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

        // 上限到達の通知を送信
        const notification = {
          text: {
            first: getSafeTaskText(auction),
            second: `${autoBid.maxBidAmount}`,
          },
          auctionEventType: PrismaAuctionEventType.AUTO_BID_LIMIT_REACHED,
          auctionId,
          recipientUserId: [userId],
          sendMethod: [NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL, NotificationSendMethod.WEB_PUSH],
          actionUrl: `/auctions/${auctionId}`,
          sendTiming: NotificationSendTiming.NOW,
          sendScheduledDate: null,
          expiresAt: null,
        };

        await sendAuctionNotification(notification);

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

        return {
          success: false,
          message: "自動入札の上限金額に達しました",
          autoBidLimitReached: true,
          autoBid: {
            id: autoBid.id,
            maxBidAmount: autoBid.maxBidAmount,
            bidIncrement: autoBid.bidIncrement,
          },
        };
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      return {
        success: true,
        nextBidAmount,
        autoBid: {
          id: autoBid.id,
          maxBidAmount: autoBid.maxBidAmount,
          bidIncrement: autoBid.bidIncrement,
        },
      };
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("自動入札前処理エラー:", error);
    return {
      success: false,
      message: "自動入札の前処理中にエラーが発生しました",
    };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 自動入札を実行する
 * @param auctionId オークションID
 * @param currentHighestBid 現在の最高入札額
 * @param currentHighestBidderId 現在の最高入札者ID
 * @returns 処理結果
 */
export async function executeAutoBid(auctionId: string, currentHighestBid: number, currentHighestBidderId: string | null): Promise<AutoBidResponse> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // オークションの検証
    const validation = await validateAuction(auctionId, {
      requireActive: true,
      includeTask: true,
      messagePrefix: "自動入札を実行",
    });

    // バリデーションエラーチェック
    if (!validation.success || !validation.userId) {
      return {
        success: false,
        message: validation.message ?? "検証エラー",
      };
    }

    // この時点でuserIdは必ず存在する
    const userId = validation.userId;
    const auction = validation.auction;

    if (!auction) {
      return {
        success: false,
        message: "オークション情報が取得できませんでした",
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 自動入札の前処理を実行
    const preparationResult = await prepareAutoBid(auctionId, currentHighestBid, currentHighestBidderId, userId, auction);

    // 前処理の結果をチェック
    if (!preparationResult.success) {
      return {
        success: false,
        message: preparationResult.message ?? "自動入札の前処理中にエラーが発生しました",
        autoBid: preparationResult.autoBid,
      };
    }

    // この時点でnextBidAmountとautoBidは必ず存在する
    if (!preparationResult.nextBidAmount || !preparationResult.autoBid) {
      return {
        success: false,
        message: "自動入札の処理中にエラーが発生しました",
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 共通入札処理を実行
    const bidResult = await executeBid(auctionId, preparationResult.nextBidAmount, true);

    // 処理結果をチェック
    if (!bidResult.success) {
      return {
        success: false,
        message: bidResult.message ?? "自動入札に失敗しました",
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    return {
      success: true,
      message: `${preparationResult.nextBidAmount}ポイントで自動入札しました`,
      autoBid: preparationResult.autoBid,
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("executeAutoBid_自動入札実行エラー", error);
    console.log("executeAutoBid_エラースタック", new Error().stack);
    return {
      success: false,
      message: "自動入札の実行中にエラーが発生しました",
    };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 自動入札実行時にタスク情報が存在するか確認し、通知用テキストを取得する
 * @param auction オークション情報
 * @returns テキスト
 */
function getSafeTaskText(auction: AuctionValidationData): string {
  if (auction.task?.task) {
    return auction.task.task;
  }
  return "オークション";
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
