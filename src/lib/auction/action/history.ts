"use server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { type ReviewPosition } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションレビューを追加するアクション
 * @param auctionId オークションID
 * @param revieweeId レビュー対象者ID
 * @param rating 評価
 * @param comment コメント
 * @param reviewPosition レビューポジション (SELLER_TO_BUYER または BUYER_TO_SELLER)
 */
export async function createAuctionReview(
  auctionId: string,
  revieweeId: string,
  rating: number,
  comment: string | null,
  reviewPosition: ReviewPosition,
) {
  const userId = await getAuthenticatedSessionUserId();

  const review = await prisma.auctionReview.create({
    data: {
      auctionId,
      reviewerId: userId,
      revieweeId,
      rating,
      comment,
      reviewPosition,
    },
  });

  return review;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク完了処理アクション
 * @param taskId タスクID
 */
export async function completeTaskDelivery(taskId: string) {
  const userId = await getAuthenticatedSessionUserId();

  const task = await prisma.task.findUnique({
    where: {
      id: taskId,
    },
    include: {
      auction: true,
    },
  });

  if (!task) {
    throw new Error("タスクが見つかりません");
  }

  // 自分が作成者か落札者か確認
  const isCreator = task.creatorId === userId;
  const isWinner = task.auction?.winnerId === userId;

  if (!isCreator && !isWinner) {
    throw new Error("このタスクを完了する権限がありません");
  }

  // タスク完了ステータスに更新
  const updatedTask = await prisma.task.update({
    where: {
      id: taskId,
    },
    data: {
      status: "TASK_COMPLETED",
    },
  });

  return updatedTask;
}

/**
 * メッセージデータの型定義
 */
export type AuctionMessage = {
  id: string;
  auctionId: string;
  senderId: string;
  message: string;
  createdAt: Date;
  sender: {
    id: string;
    name?: string | null;
    image?: string | null;
  };
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションに関連するメッセージを取得する
 * @param auctionId オークションID
 * @returns メッセージの配列
 */
export async function getAuctionMessages(auctionId: string): Promise<AuctionMessage[]> {
  // 認証
  const userId = await getAuthenticatedSessionUserId();

  // オークション情報を取得して権限を確認
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      task: {
        select: {
          creatorId: true,
        },
      },
    },
  });

  if (!auction) {
    throw new Error("オークションが見つかりません");
  }

  // 出品者またはオークションの落札者のみがメッセージを閲覧できる
  const isCreator = auction.task.creatorId === userId;
  const isWinner = auction.winnerId === userId;

  if (!isCreator && !isWinner) {
    throw new Error("このオークションのメッセージを閲覧する権限がありません");
  }

  // 自分が送信者または受信者のメッセージを取得
  const messages = await prisma.auctionMessage.findMany({
    where: {
      auctionId,
      senderId: userId,
    },
    orderBy: {
      createdAt: "asc",
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  });

  /**
   * データを整形
   */

  return messages;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションに関するメッセージを送信する
 * @param auctionId オークションID
 * @param recipientId 受信者ID
 * @param message メッセージ内容
 * @returns 送信したメッセージ
 */
export async function sendAuctionMessage(auctionId: string, recipientId: string, message: string): Promise<AuctionMessage> {
  // 認証
  const userId = await getAuthenticatedSessionUserId();

  // メッセージ内容の検証
  if (!message.trim()) {
    throw new Error("メッセージを入力してください");
  }

  // オークション情報を取得して権限を確認
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      task: {
        select: {
          creatorId: true,
        },
      },
    },
  });

  if (!auction) {
    throw new Error("オークションが見つかりません");
  }

  // 出品者またはオークションの落札者のみがメッセージを送信できる
  const isCreator = auction.task.creatorId === userId;
  const isWinner = auction.winnerId === userId;

  if (!isCreator && !isWinner) {
    throw new Error("このオークションにメッセージを送信する権限がありません");
  }

  // 受信者が出品者または落札者かを確認
  const isRecipientCreator = auction.task.creatorId === recipientId;
  const isRecipientWinner = auction.winnerId === recipientId;

  if (!isRecipientCreator && !isRecipientWinner) {
    throw new Error("指定された受信者は無効です");
  }

  // メッセージを作成
  const newMessage = await prisma.auctionMessage.create({
    data: {
      auctionId,
      senderId: userId,
      message,
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  });

  return newMessage as AuctionMessage;
}
