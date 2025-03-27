"use server";

// Next.jsのリクエスト型とレスポンス用のインポートを追加
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { bidSchema } from "@/lib/auction/zod-schema";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

import type { AuctionWithDetails, BidFormData, BidHistoryWithUser } from "../types";
import { AuctionEventType } from "../types";
import { sendEventToAuctionSubscribers } from "./connection";

/**
 * サーバーサイドでの入札処理
 * @param auctionId オークションID
 * @param bidData 入札データ
 * @param userId ユーザーID
 * @returns 入札処理の結果
 */
export async function serverPlaceBid(auctionId: string, bidData: BidFormData, userId: string): Promise<{ success: boolean; message?: string; bid?: any }> {
  try {
    console.log("serverPlaceBid_start", auctionId, bidData, userId);
    // オークション情報を取得
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: { bidHistories: true },
    });

    if (!auction) {
      return { success: false, message: "オークションが見つかりません" };
    }

    // 終了したオークションには入札できない
    if (auction.endTime < new Date()) {
      return { success: false, message: "このオークションは既に終了しています" };
    }

    // 自分の出品したタスクには入札できない
    const task = await prisma.task.findUnique({
      where: { id: auction.taskId },
    });

    if (task && task.creatorId === userId) {
      return { success: false, message: "自分の出品したタスクには入札できません" };
    }

    // 最低入札額のチェック
    const minimumBid = auction.currentHighestBid > 0 ? auction.currentHighestBid : 0;
    if (bidData.amount < minimumBid) {
      return {
        success: false,
        message: `最低入札額（${minimumBid}ポイント）以上で入札してください`,
      };
    }

    // 現在の最高入札額より高い額でなければならない
    if (auction.currentHighestBid >= bidData.amount) {
      return {
        success: false,
        message: `現在の最高入札額（${auction.currentHighestBid}ポイント）より高い額で入札してください`,
      };
    }

    // 入札履歴を作成
    const bidHistory = await prisma.bidHistory.create({
      data: {
        auctionId,
        userId,
        amount: bidData.amount,
        isAutoBid: bidData.isAutoBid || false,
      },
    });

    // オークションの現在の最高入札額と最高入札者を更新
    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        currentHighestBid: bidData.amount,
        currentHighestBidderId: userId,
      },
    });

    // 入札成功
    return {
      success: true,
      message: "入札が完了しました",
      bid: bidHistory,
    };
  } catch (error) {
    console.error("入札処理エラー:", error);
    return { success: false, message: "入札処理中にエラーが発生しました" };
  }
}

/**
 * オークションの入札履歴を取得
 * @param auctionId オークションID
 * @param limit 取得する入札履歴の上限数
 * @returns 入札履歴
 */
export async function getAuctionBidHistory(auctionId: string, limit = 20): Promise<BidHistoryWithUser[]> {
  const bids = await prisma.bidHistory.findMany({
    where: { auctionId },
    include: {
      user: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });

  return bids.map((bid) => ({
    ...bid,
    id: bid.id,
    auctionId: bid.auctionId,
    userId: bid.userId,
    amount: bid.amount,
    createdAt: bid.createdAt.toISOString(),
    isAutoBid: bid.isAutoBid,
    user: bid.user
      ? {
          id: bid.user.id,
          username: bid.user.name || "",
          email: bid.user.email,
          createdAt: bid.user.createdAt.toISOString(),
          avatarUrl: bid.user.image || undefined,
          name: bid.user.name,
          emailVerified: bid.user.emailVerified,
          image: bid.user.image,
          isAppOwner: bid.user.isAppOwner,
          updatedAt: bid.user.updatedAt,
        }
      : undefined,
  }));
}

/**
 * 入札を行うサーバーアクション
 * @param auctionId オークションID
 * @param bidData 入札データ
 * @returns 入札結果（成功/失敗、メッセージ、入札履歴）
 */
export async function placeBidAction(auctionId: string, bidData: BidFormData) {
  console.log("placeBidAction_start", auctionId, bidData);
  // 認証セッションを取得
  const session = await auth();
  if (!session || !session.user) {
    return {
      success: false,
      message: "ログインが必要です",
    };
  }

  const userId = session.user.id;
  if (!userId) {
    return {
      success: false,
      message: "ユーザーIDが取得できません",
    };
  }

  try {
    // bidDataにuser_idを追加
    const updatedBidData = {
      ...bidData,
      user_id: userId,
    };

    // サーバー側の入札処理を実行
    const result = await serverPlaceBid(auctionId, updatedBidData, userId);

    // 入札成功時にオークション情報を取得して通知データに追加
    if (result.success && result.bid) {
      // 最新のオークション情報を取得
      const updatedAuction = await prisma.auction.findUnique({
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

      // オークション情報を通知データに追加
      if (updatedAuction) {
        const auctionWithDetails: AuctionWithDetails = {
          id: updatedAuction.id,
          createdAt: updatedAuction.createdAt,
          updatedAt: updatedAuction.updatedAt,
          status: updatedAuction.status,
          taskId: updatedAuction.taskId,
          startTime: updatedAuction.startTime,
          endTime: updatedAuction.endTime,
          currentHighestBid: updatedAuction.currentHighestBid,
          currentHighestBidderId: updatedAuction.currentHighestBidderId,
          bidHistories: updatedAuction.bidHistories.map((bid) => ({
            ...bid,
            createdAt: bid.createdAt.toISOString(),
          })),
          winnerId: updatedAuction.winnerId,
          extensionCount: updatedAuction.extensionCount,
          version: updatedAuction.version,
          title: updatedAuction.task.task || "",
          description: updatedAuction.task.detail || "",
          currentPrice: updatedAuction.currentHighestBid,
          sellerId: updatedAuction.task.creator.id,
          task: updatedAuction.task,
          depositPeriod: updatedAuction.task.group.depositPeriod,
          currentHighestBidder: null,
          winner: null,
          watchlists: updatedAuction.watchlists,
          bid: result.bid,
        };

        await sendEventToAuctionSubscribers(auctionId, AuctionEventType.NEW_BID, auctionWithDetails as AuctionWithDetails);
      } else {
        // 通常の通知（オークション情報なし）
        console.error("オークション情報が取得できませんでした");
        return {
          success: false,
          message: "オークション情報の取得に失敗しました",
        };
      }

      // 結果にオークション情報を追加して返す
      return {
        ...result,
        auction: updatedAuction,
      };
    }

    // 入札失敗時は元の結果をそのまま返す
    return result;
  } catch (error) {
    console.error("入札サーバーアクションエラー:", error);
    return {
      success: false,
      message: "サーバーでエラーが発生しました",
    };
  }
}

/**
 * 入札処理を行うAPI
 * @param request リクエスト
 * @param params パラメータ
 * @returns 入札処理の結果
 */
export async function handleBidRequest(request: NextRequest, { params }: { params: Promise<{ auctionId: string }> }) {
  // セッションからユーザー情報を取得
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    // リクエストボディを取得
    const body = await request.json();
    // パラメータを取得
    const { auctionId } = await params;

    // バリデーション
    const validatedData = bidSchema.parse(body);

    // 入札処理
    const result = await serverPlaceBid(
      auctionId,
      {
        auctionId: auctionId,
        amount: validatedData.amount,
        isAutoBid: validatedData.isAutoBid || false,
        maxAmount: validatedData.maxAmount,
      },
      session.user.id,
    );

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    // 入札成功時に接続中のクライアントに通知
    if (result.bid) {
      // 最新のオークション情報を取得
      const updatedAuction = await prisma.auction.findUnique({
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

      // SSEイベント送信
      if (updatedAuction) {
        const auctionWithDetails: AuctionWithDetails = {
          id: updatedAuction.id,
          createdAt: updatedAuction.createdAt,
          updatedAt: updatedAuction.updatedAt,
          status: updatedAuction.status,
          taskId: updatedAuction.taskId,
          startTime: updatedAuction.startTime,
          endTime: updatedAuction.endTime,
          currentHighestBid: updatedAuction.currentHighestBid,
          currentHighestBidderId: updatedAuction.currentHighestBidderId,
          bidHistories: updatedAuction.bidHistories.map((bid) => ({
            ...bid,
            createdAt: bid.createdAt.toISOString(),
          })),
          winnerId: updatedAuction.winnerId,
          extensionCount: updatedAuction.extensionCount,
          version: updatedAuction.version,
          title: updatedAuction.task.task || "",
          description: updatedAuction.task.detail || "",
          currentPrice: updatedAuction.currentHighestBid,
          sellerId: updatedAuction.task.creator.id,
          task: updatedAuction.task,
          depositPeriod: updatedAuction.task.group.depositPeriod,
          currentHighestBidder: null,
          winner: null,
          watchlists: updatedAuction.watchlists,
          bid: {
            ...result.bid,
            user: {
              id: session.user.id,
              name: session.user.name || null,
              email: "",
              emailVerified: null,
              image: session.user.image || null,
              isAppOwner: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        };

        await sendEventToAuctionSubscribers(auctionId, AuctionEventType.NEW_BID, auctionWithDetails);
      }
    }

    // 入札保護のために、レスポンスヘッダーを設定
    const response = NextResponse.json({
      success: true,
      bid: result.bid,
      message: result.message,
    });

    return response;
  } catch (error) {
    console.error("入札エラー:", error);

    // バリデーションエラー
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "入力データが不正です", details: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: "入札処理中にエラーが発生しました" }, { status: 500 });
  }
}
