"use cache";

import type { AuctionMessage, AuctionPersonInfo } from "@/hooks/auction/bid/use-auction-qa";
import { unstable_cacheLife as cacheLife, unstable_cacheTag as cacheTag } from "next/cache";
import { prisma } from "@/library-setting/prisma";
import { type Prisma } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションに関連するメッセージを取得する
 * @param auctionId オークションID
 * @returns メッセージリスト
 */
export async function getCachedAuctionMessageContents(
  auctionId: string,
  isDisplayAfterEnd: boolean,
  auctionEndDate: Date,
): Promise<{ success: boolean; error: string; messages: AuctionMessage[] }> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュの設定
   */
  cacheTag(`auction-messages-${auctionId}`);
  cacheLife("hours");

  if (!auctionId || typeof isDisplayAfterEnd !== "boolean" || !auctionEndDate?.getTime()) {
    throw new Error("パラメータが不正です");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * メッセージの取得条件
   */
  const whereCondition: Prisma.AuctionMessageWhereInput = {
    auctionId,
  };
  if (isDisplayAfterEnd) {
    whereCondition.createdAt = { gte: new Date(auctionEndDate) };
  } else {
    whereCondition.createdAt = { lte: new Date(auctionEndDate) };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * メッセージを取得
   */
  const messages = await prisma.auctionMessage.findMany({
    where: whereCondition,
    select: {
      id: true,
      message: true,
      createdAt: true,
      sender: {
        select: {
          settings: {
            select: {
              username: true,
            },
          },
          id: true,
          image: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * メッセージを整形
   */
  const formattedMessages = messages.map((message) => ({
    messageId: message.id,
    messageContent: message.message,
    createdAt: message.createdAt,
    person: {
      sender: {
        id: message.sender.id,
        appUserName: message.sender.settings?.username ?? "未設定",
        image: message.sender.image,
      },
    },
  }));

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 成功
   */
  return { success: true, messages: formattedMessages, error: "" };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション情報を取得して、出品者IDを返す
 * @param auctionId オークションID
 * @returns 出品者ID
 */
export async function getCachedAuctionSellerInfo(
  auctionId: string,
): Promise<{ success: boolean; error: string; auctionPersonInfo: AuctionPersonInfo | null }> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  if (!auctionId) {
    throw new Error("パラメータが不正です");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークション情報を取得
   */
  const auctionPersonInfo = await prisma.auction.findUnique({
    where: {
      id: auctionId,
    },
    select: {
      task: {
        select: {
          creatorId: true,
          creator: {
            select: {
              id: true,
            },
          },
          reporters: {
            select: {
              user: {
                select: {
                  id: true,
                },
              },
            },
          },
          executors: {
            select: {
              user: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークションが見つからない場合
   */
  if (!auctionPersonInfo) {
    throw new Error("オークションが見つかりません");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品者情報を整形
   */
  const formattedAuctionPersonInfo = {
    creator: {
      id: auctionPersonInfo.task?.creatorId,
    },
    reporters: auctionPersonInfo.task?.reporters.map((reporter) => ({
      id: reporter.user?.id ?? null,
    })),
    executors: auctionPersonInfo.task?.executors.map((executor) => ({
      id: executor.user?.id ?? null,
    })),
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 成功
   */
  return { success: true, auctionPersonInfo: formattedAuctionPersonInfo, error: "" };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
}
