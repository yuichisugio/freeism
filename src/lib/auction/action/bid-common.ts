"use server";

import type { Session } from "next-auth";
import { revalidatePath } from "next/cache";
import { sendAuctionNotification } from "@/lib/actions/notification/auction-notification";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/utils";
import { BidStatus, NotificationSendMethod, NotificationSendTiming, AuctionEventType as PrismaAuctionEventType, TaskStatus } from "@prisma/client";

import type { AuctionWithDetails, BidHistory, WatchlistItem } from "../type/types";
import type { ProcessAutoBidParams } from "./auto-bid";
import { SSEAuctionEventType } from "../type/types";
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
  taskId?: string;
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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
export async function validateAuction(
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
    const session = await getAuthSession();
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
          taskId: true,
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
    let validationError: BidActionResult | null = null;
    if (!validation.success || !validation.userId) {
      validationError = {
        success: false,
        message: validation.message,
        isAutoBid,
      };
    }
    if (validationError) return validationError;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // この時点でuserIdは必ず存在する
    const userId = validation.userId!;
    const session = validation.session;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // すべての処理をトランザクションで実行
    const result: BidTransactionResult = await prisma.$transaction(async (tx) => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 楽観的ロックのためのバージョン取得
      const auctionWithVersion = await tx.auction.findUnique({
        where: { id: auctionId },
        select: {
          version: true,
          currentHighestBidderId: true,
        },
      });

      // バージョン取得できない場合
      if (!auctionWithVersion) {
        throw new Error("オークションが見つかりません");
      }

      // versionを取得
      const initialVersion = auctionWithVersion.version;
      const initialHighestBidderId: string | null = auctionWithVersion.currentHighestBidderId;

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
      const userInfo = {
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

      // TypeScriptに型情報を教える
      const auctionData = updatedAuction as unknown as AuctionWithRelations;

      const task = auctionData.task;
      const creatorId = getProperty(task?.creator, "id", "");
      const taskName = getProperty(task, "task", "");
      const taskDetail = getProperty(task, "detail", "");
      const taskGroup = task?.group ?? getDefaultTaskGroup();

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
        creatorId: creatorId,
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

      // 以前の最高入札者が自分以外の場合は、以前の最高入札者に、AuctionEventType.OUTBIDの通知を送信
      if (initialHighestBidderId !== userId && initialHighestBidderId !== null) {
        await sendAuctionNotification({
          text: {
            first: auctionWithDetails.title,
            second: auctionWithDetails.currentHighestBid.toString(),
          },
          auctionEventType: PrismaAuctionEventType.OUTBID,
          auctionId,
          recipientUserId: [initialHighestBidderId],
          sendMethods: [NotificationSendMethod.EMAIL, NotificationSendMethod.WEB_PUSH, NotificationSendMethod.IN_APP],
          actionUrl: null,
          sendTiming: NotificationSendTiming.NOW,
          sendScheduledDate: null,
          expiresAt: null,
        });
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // SSEでリアルタイム更新を通知。$transaction内で実行したい
      await sendEventToAuctionSubscribers(auctionId, SSEAuctionEventType.NEW_BID, auctionWithDetails);

      return { bidHistory, updatedAuction, auctionWithDetails };
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // パスの再検証
    revalidatePath(`/auctions/${auctionId}`);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 手動入札（自動入札でない場合）の場合、他の自動入札者のための自動入札処理を実行
    if (!isAutoBid) {
      try {
        // 動的インポートを使用して循環依存を回避
        const { processAutoBid } = await import("./auto-bid");
        const params: ProcessAutoBidParams = {
          auctionId,
          currentHighestBid: amount,
          currentHighestBidderId: userId,
        };
        const autoBidResult = await processAutoBid(params);
        if (autoBidResult) {
          console.log("入札後の自動入札処理が実行されました", autoBidResult);
        }
      } catch (autoBidError) {
        console.error("入札後の自動入札処理でエラーが発生しました", autoBidError);
        // エラーが発生しても入札自体は成功しているので、成功結果を返す
      }
    }

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
    console.error("入札処理中にエラーが発生しました", error);
    return {
      success: false,
      message: `入札処理中にエラーが発生しました`,
      isAutoBid,
    } as BidActionResult;
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
