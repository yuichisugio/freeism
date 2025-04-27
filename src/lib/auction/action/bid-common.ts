"use server";

import type { Session } from "next-auth";
import { sendAuctionNotification } from "@/lib/actions/notification/auction-notification";
import { getAuctionUpdateSelect } from "@/lib/auction/constants";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/utils";
import { BidStatus, NotificationSendMethod, NotificationSendTiming, AuctionEventType as PrismaAuctionEventType } from "@prisma/client";

import type { UpdateAuctionWithDetails } from "../type/types";
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
export type ValidateAuctionResult = {
  success: boolean;
  message: string;
  userId?: string;
  auction?: AuctionValidationData;
  session?: Session | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * バリデーション用のオークションデータ型
 */
export type AuctionValidationData = {
  status: string;
  currentHighestBid: number;
  currentHighestBidderId: string | null;
  endTime: Date;
  taskId?: string;
  task?: {
    creator: {
      id: string;
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
  }>;
  version?: number;
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
    executeBid?: boolean;
  } = {},
): Promise<ValidateAuctionResult> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 認証チェック
     */
    const session = await getAuthSession();
    const userId = session?.user?.id;

    if (!userId) {
      return {
        success: false,
        message: `操作するには、ログインが必要です`,
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // オークション情報を取得するためのクエリを構築
    let auctionData: AuctionValidationData | null = null;

    // executeBid()の場合
    if (options.executeBid) {
      auctionData = await prisma.auction.findUnique({
        where: { id: auctionId },
        select: {
          endTime: true,
          status: true,
          currentHighestBid: true,
          currentHighestBidderId: true,
          task: {
            select: {
              task: true,
              creator: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      });
    } else {
      // 基本情報のみを取得する場合はselectを使用
      auctionData = await prisma.auction.findUnique({
        where: { id: auctionId },
        select: {
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

    if (!auctionData) {
      return {
        success: false,
        message: "オークションが見つかりません",
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 自分の出品のチェック
    if ((options.checkSelfListing || options.executeBid) && auctionData.task?.creator?.id === userId) {
      return {
        success: false,
        message: "自分の出品に対して操作はできません",
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 終了時間のチェック
    if ((options.checkEndTime || options.executeBid) && auctionData.endTime < new Date()) {
      return {
        success: false,
        message: "このオークションは終了しています",
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // アクティブ状態のチェック
    if ((options.requireActive || options.executeBid) && auctionData.status !== "ACTIVE") {
      return {
        success: false,
        message: "このオークションはアクティブではありません",
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 現在の最高入札額チェック
    if ((options.checkCurrentBid || options.executeBid) && options.currentBid !== undefined && auctionData.currentHighestBid >= options.currentBid) {
      return {
        success: false,
        message: `現在の最高入札額（${auctionData.currentHighestBid}ポイント）より高い額で入札してください`,
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    return {
      success: true,
      message: "オークションの検証が完了しました",
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

    /**
     * バリデーションとオークションのデータ取得
     */
    const validation = await validateAuction(auctionId, { executeBid: true, currentBid: amount });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * バリデーションエラーチェック
     */
    if (!validation.success || !validation.userId) {
      return {
        success: false,
        message: validation.message ?? "入札に失敗しました",
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ユーザーIDを取得
     */
    const userId = validation.userId;

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
      // 通知で使用
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
          version: initialVersion, // 楽観的ロックのために取得時点のバージョンを指定
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

      // オークション情報を更新できない場合
      if (!updatedAuctionVersion) {
        throw new Error("オークション情報を更新できませんでした");
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 更新後の最新情報を取得
      const updatedAuction: UpdateAuctionWithDetails | null = await tx.auction.findUnique({
        where: { id: auctionId },
        select: getAuctionUpdateSelect(1),
      });

      if (!updatedAuction) {
        throw new Error("更新されたオークション情報を取得できませんでした");
      }

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
            first: validation.auction?.task?.task ?? "",
            second: updatedAuction.currentHighestBid.toString(),
          },
          auctionEventType: PrismaAuctionEventType.OUTBID,
          auctionId,
          recipientUserId: [initialHighestBidderId],
          sendMethods: [NotificationSendMethod.EMAIL, NotificationSendMethod.WEB_PUSH, NotificationSendMethod.IN_APP],
          actionUrl: `https://${process.env.DOMAIN}/dashboard/auction/${auctionId}`,
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
      await sendEventToAuctionSubscribers(auctionId, updatedAuction);
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
          validationDone: true,
          paramsValidationResult: validation,
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
