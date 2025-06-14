"use server";

import { sendAuctionNotification } from "@/lib/actions/notification/auction-notification";
import { getAuctionUpdateSelect } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { BidStatus, NotificationSendMethod, NotificationSendTiming, AuctionEventType as PrismaAuctionEventType } from "@prisma/client";

import type { UpdateAuctionWithDetails } from "../../../types/auction-types";
import type { ProcessAutoBidParams } from "./auto-bid";
import type { AuctionValidationData } from "./bid-validation";
import { validateAuction } from "./bid-validation";
import { sendEventToAuctionSubscribers } from "./server-sent-events-broadcast";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 共通入札処理の結果型
 */
type ExecuteBidReturn = {
  success: boolean;
  message: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
    const validation = await validateAuction(auctionId, {
      checkSelfListing: null,
      checkEndTime: null,
      checkCurrentBid: null,
      currentBid: amount,
      requireActive: null,
      executeBid: true,
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * バリデーションエラーチェック
     */
    if (!validation.success) {
      return {
        success: false,
        message: validation.message ?? "入札に失敗しました",
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ユーザーIDを取得
     * 必ずuserIdがある状態。ない場合はvalidateAuction()でエラーが発生している
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

      /**
       * 入札履歴を作成
       */
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

      /**
       * オークション情報を更新（楽観的ロックを使用）
       */
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

      /**
       * オークション延長処理を実行
       */
      await processAuctionExtension({
        auctionId,
        auction: validation.auction!,
        tx,
      });

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 更新後の最新情報を取得
       */
      const updatedAuctionRaw = await tx.auction.findUnique({
        where: { id: auctionId },
        select: getAuctionUpdateSelect(1),
      });

      if (!updatedAuctionRaw) {
        throw new Error("更新されたオークション情報を取得できませんでした");
      }

      // UpdateAuctionWithDetails型に変換（statusはtask.statusをセット）
      type BidHistorySelect = {
        id: string;
        amount: number;
        createdAt: Date | string;
        isAutoBid: boolean;
        user: {
          settings: {
            username: string;
          } | null;
        } | null;
      };
      const updatedAuction: UpdateAuctionWithDetails = {
        id: updatedAuctionRaw.id,
        currentHighestBid: updatedAuctionRaw.currentHighestBid,
        currentHighestBidderId: updatedAuctionRaw.currentHighestBidderId,
        status: updatedAuctionRaw.task.status,
        extensionTotalCount: updatedAuctionRaw.extensionTotalCount,
        extensionLimitCount: updatedAuctionRaw.extensionLimitCount,
        extensionTime: updatedAuctionRaw.extensionTime,
        remainingTimeForExtension: updatedAuctionRaw.remainingTimeForExtension,
        bidHistories: (updatedAuctionRaw.bidHistories as unknown as BidHistorySelect[]).map((history) => ({
          id: history.id,
          amount: history.amount,
          createdAt: history.createdAt,
          isAutoBid: history.isAutoBid,
          user: history.user?.settings?.username ? { settings: { username: history.user.settings.username } } : { settings: null },
        })),
      };

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 楽観的ロックのためのバージョン取得
       */
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

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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

    /**
     * 自動入札処理を実行
     * 手動入札（自動入札でない場合）の場合
     */
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
        await processAutoBid(params);
      } catch (autoBidError) {
        console.error("入札後の自動入札処理でエラーが発生しました", autoBidError);
        // エラーが発生しても入札自体は成功しているので、成功結果を返す
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 入札処理の結果を返す
     */
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

/**
 * オークション延長処理のパラメータ型
 */
type ProcessAuctionExtensionParams = {
  auctionId: string;
  auction: AuctionValidationData;
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]; // Prismaトランザクション型
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション延長処理の結果型
 */
type ProcessAuctionExtensionResult = {
  extended: boolean;
  newEndTime?: Date;
  message: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション延長処理を行う関数
 * @param params 延長処理のパラメータ
 * @returns 延長処理の結果
 */
async function processAuctionExtension(params: ProcessAuctionExtensionParams): Promise<ProcessAuctionExtensionResult> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  const { auctionId, auction, tx } = params;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  try {
    /**
     * 延長条件チェック：isExtensionがtrueのオークションのみ延長
     */
    if (!auction.isExtension) {
      return {
        extended: false,
        message: "延長設定されていないオークションです",
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 延長回数の制限チェック
     */
    // 延長回数の制限チェック
    if (auction.extensionTotalCount >= auction.extensionLimitCount) {
      return {
        extended: false,
        message: "延長回数の上限に達しています",
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 延長トリガーの条件チェック
     */
    // 現在時刻を取得
    const now = new Date();
    const endTime = auction.endTime;
    const startTime = auction.startTime;

    // 残り時間を計算（ミリ秒）
    const remainingTime = endTime.getTime() - now.getTime();

    // オークション期間全体の時間を計算（ミリ秒）
    const totalAuctionTime = endTime.getTime() - startTime.getTime();

    // 延長トリガーの時間を計算
    // 「endTimeとstartTimeの差分の5%の時間」or「extensionTime分」のどちらか長い時間
    const fivePercentTime = totalAuctionTime * 0.05;
    const extensionTimeMs = auction.extensionTime * 60 * 1000; // 分をミリ秒に変換
    const triggerTime = Math.max(fivePercentTime, extensionTimeMs);

    // 延長トリガーの条件チェック：残り時間が指定の条件以下の場合
    if (remainingTime > triggerTime) {
      return {
        extended: false,
        message: "延長トリガーの条件を満たしていません",
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 延長時間を計算
     */
    // 「endTimeとstartTimeの差分の5%」or「extensionTime分」のどちらか長い時間
    const extensionDuration = Math.max(fivePercentTime, extensionTimeMs);

    // 新しい終了時間を計算
    const newEndTime = new Date(endTime.getTime() + extensionDuration);

    // オークション情報を更新（endTimeを延長し、extensionTotalCountを1増加）
    await tx.auction.update({
      where: { id: auctionId },
      data: {
        endTime: newEndTime,
        extensionTotalCount: { increment: 1 },
      },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    return {
      extended: true,
      newEndTime,
      message: `オークションが${Math.round(extensionDuration / (60 * 1000))}分延長されました`,
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("オークション延長処理でエラーが発生しました:", error);
    return {
      extended: false,
      message: "延長処理中にエラーが発生しました",
    };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
