"use server";

import { sendAuctionNotification } from "@/lib/actions/notification/auction-notification";
import { getAuctionUpdateSelect } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import {
  BidStatus,
  NotificationSendMethod,
  NotificationSendTiming,
  AuctionEventType as PrismaAuctionEventType,
} from "@prisma/client";
import { toast } from "sonner";

import type { UpdateAuctionWithDetails } from "../../../../types/auction-types";
import type { ExecuteAutoBidParams } from "../auto-bid/auto-bid";
import { validateAuction } from "../bid-validation";
import { sendEventToAuctionSubscribers } from "../server-sent-events-broadcast";
import { processAuctionExtension } from "./extend-auction-time";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 共通入札処理の結果型
 */
type ExecuteBidReturn = {
  success: boolean;
  message: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * UpdateAuctionWithDetails型に変換するための型
 */
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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入札処理の共通部分を実装した関数
 * @param auctionId オークションID
 * @param amount 入札金額
 * @param isAutoBid 自動入札かどうか
 * @param autoBidUserId 自動入札で入札する場合の、自動入札の最高入札額の設定者のユーザーID（自動入札の場合は必須）
 * @returns 入札処理の結果
 */
export async function executeBid(
  auctionId: string,
  amount: number,
  isAutoBid = false,
  autoBidUserId?: string,
): Promise<ExecuteBidReturn> {
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
     * 自動入札の場合は引数で渡されたuserIdを使用、手動入札の場合はvalidationから取得
     */
    const bidderUserId = autoBidUserId ?? validation.userId;

    // ユーザーIDが取得できない場合はエラー
    if (!bidderUserId) {
      return {
        success: false,
        message: "入札者の情報を取得できませんでした",
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // すべての処理をトランザクションで実行
    await prisma.$transaction(async (tx) => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 楽観的ロックのためのバージョン取得
       */
      // 楽観的ロックのためのバージョン取得
      const auctionWithVersion = await tx.auction.findUnique({
        where: { id: auctionId },
        select: {
          version: true,
          currentHighestBidderId: true,
        },
      });

      // 楽観的ロックのためのバージョン取得できない場合
      if (!auctionWithVersion) {
        throw new Error("入札対象のオークションが見つかりません");
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * versionを取得
       */
      const initialVersion = auctionWithVersion.version;

      /**
       * 通知で使用
       */
      const initialHighestBidderId: string | null = auctionWithVersion.currentHighestBidderId;

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 入札履歴を作成（楽観的ロックを使用）
       */
      await tx.bidHistory.create({
        data: {
          auctionId,
          userId: bidderUserId, // 修正: 正しい入札者のユーザーIDを使用
          amount: amount,
          status: BidStatus.BIDDING,
          isAutoBid: isAutoBid,
        },
      });

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * オークション情報を更新
       */
      const updatedAuctionVersion = await tx.auction.update({
        where: {
          id: auctionId,
          version: initialVersion, // 楽観的ロックのために取得時点のバージョンを指定
        },
        data: {
          currentHighestBid: amount,
          currentHighestBidderId: bidderUserId, // 修正: 正しい入札者のユーザーIDを使用
          version: { increment: 1 }, // バージョンをインクリメント
        },
        select: {
          version: true,
        },
      });

      // オークション情報を更新できない場合は、エラーを投げてロールバックする
      if (!updatedAuctionVersion) {
        throw new Error("オークション情報を更新できませんでした");
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * オークション延長処理を実行
       */
      const { success, message } = await processAuctionExtension({
        auctionId,
        auction: validation.auction!,
        tx,
      });
      if (success) {
        toast.info(message);
      }
      if (!success) {
        throw new Error(message);
      }

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

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 更新後の最新情報をUpdateAuctionWithDetails型に変換
       */
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
          user: history.user?.settings?.username
            ? { settings: { username: history.user.settings.username } }
            : { settings: null },
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

      // バージョン取得できない場合は、エラーを投げてロールバックする
      if (!auctionWithEndVersion) {
        throw new Error("バージョン確認用のオークションが見つかりません");
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
      if (initialHighestBidderId !== bidderUserId && initialHighestBidderId !== null) {
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
        const { executeAutoBid: processAutoBid } = await import("../auto-bid/auto-bid");
        const params: ExecuteAutoBidParams = {
          auctionId,
          currentHighestBid: amount,
          currentHighestBidderId: bidderUserId, // 修正: 正しい入札者のユーザーIDを使用
          validationDone: true,
          paramsValidationResult: validation,
        };
        await processAutoBid(params);
      } catch {
        console.error("入札後の自動入札処理でエラーが発生しました");
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
      message: `${error instanceof Error ? error.message : "不明なエラーが発生しました"}`,
    };
  }
}
