"use server";

import type { Session } from "next-auth";
import { sendAuctionNotification } from "@/lib/actions/notification/auction-notification";
import { AUCTION_CONSTANTS } from "@/lib/auction/constants";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/utils";
import { BidStatus, NotificationSendMethod, NotificationSendTiming, AuctionEventType as PrismaAuctionEventType, TaskStatus } from "@prisma/client";

import type { AuctionWithDetails } from "../type/types";
import type { ProcessAutoBidParams } from "./auto-bid";
import { sendEventToAuctionSubscribers } from "./server-sent-events-broadcast";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 共通入札処理の結果型
 */
export type ExecuteBidReturn = {
  success: boolean;
  message: string;
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
 * バリデーション用のオークションデータ型
 */
type AuctionValidationData = {
  id: string;
  status: string;
  currentHighestBid: number;
  currentHighestBidderId: string | null;
  endTime: Date;
  taskId?: string;
  task?: {
    creator: {
      id: string;
      name?: string | null;
      image?: string | null;
    };
    task?: string | null;
    detail?: string | null;
  };
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
 * 入札処理の共通部分を実装した関数
 * @param auctionId オークションID
 * @param amount 入札金額
 * @param isAutoBid 自動入札かどうか
 * @returns 入札処理の結果
 */
export async function executeBid(auctionId: string, amount: number, isAutoBid = false): Promise<ExecuteBidReturn> {
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
    let validationError: ExecuteBidReturn | null = null;
    if (!validation.success || !validation.userId) {
      validationError = {
        success: false,
        message: validation.message ?? "入札に失敗しました",
      };
    }
    if (validationError) return validationError;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // この時点でuserIdは必ず存在する
    const userId = validation.userId!;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // すべての処理をトランザクションで実行
    await prisma.$transaction(async (tx) => {
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
      await tx.bidHistory.create({
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
            take: AUCTION_CONSTANTS.DISPLAY.BID_HISTORY_LIMIT + 1, // 1件多く取得して、２５＋１にしたい
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

      // TypeScriptに型情報を教える
      const auctionData = updatedAuction as unknown as AuctionWithDetails;

      const task = auctionData.task;
      const creatorId = task?.creator?.id ?? "";
      const taskName = task?.task ?? "";
      const taskDetail = task?.detail ?? "";
      const taskGroup = task?.group;

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // AuctionWithDetails形式に変換
      const auctionWithDetails: AuctionWithDetails = {
        id: auctionData.id,
        status: auctionData.status,
        startTime: auctionData.startTime,
        endTime: auctionData.endTime,
        currentHighestBid: auctionData.currentHighestBid,
        currentHighestBidderId: auctionData.currentHighestBidderId,
        bidHistories: auctionData.bidHistories.map((bid) => ({
          id: bid.id,
          amount: bid.amount,
          createdAt: bid.createdAt,
          isAutoBid: bid.isAutoBid,
          user: {
            name: bid.user.name ?? "不明なユーザー",
          },
        })),
        extensionTotalCount: auctionData.extensionTotalCount,
        extensionLimitCount: auctionData.extensionLimitCount,
        extensionTotalTime: auctionData.extensionTotalTime,
        extensionLimitTime: auctionData.extensionLimitTime,
        task: {
          task: taskName ?? "",
          detail: taskDetail ?? "",
          imageUrl: null,
          status: TaskStatus.PENDING,
          category: task?.category ?? null,
          group: {
            id: taskGroup.id,
            name: taskGroup.name,
            depositPeriod: taskGroup.depositPeriod,
          },
          creator: {
            id: creatorId,
            name: task?.creator?.name ?? "不明なユーザー",
          },
        },
        watchlists: auctionData.watchlists,
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

      /**
       * 以前の最高入札者が自分以外の場合は、以前の最高入札者に、AuctionEventType.OUTBIDの通知を送信
       */
      if (initialHighestBidderId !== userId && initialHighestBidderId !== null) {
        await sendAuctionNotification({
          text: {
            first: auctionWithDetails.task.task,
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

      /**
       * SSEでリアルタイム更新を通知。
       * $transaction内で実行したい
       */
      await sendEventToAuctionSubscribers(auctionId, auctionWithDetails);
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // パスの再検証
    // App Router でクライアント側からサーバーアクションを呼び出した場合は、キャッシュが無効化された直後に Next.js が ソフトリフレッシュ（router.refresh() と同等のルート再取得）を自動で実行する挙動 になっているため、コンポーネントツリーは描画し直され、ローカル state は失われる—そのため 見かけ上は「ページが更新された」ように感じる ことがあります
    // なので、revalidatePathは使用してはダメ
    // revalidatePath(`/auctions/${auctionId}`);

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
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("入札処理中にエラーが発生しました", error);
    return {
      success: false,
      message: `入札処理中にエラーが発生しました`,
    };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
