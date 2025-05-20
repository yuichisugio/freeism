"use cache";

import type { AuctionMessage, AuctionPersonInfo } from "@/hooks/auction/bid/use-auction-qa";
import { unstable_cacheLife as cacheLife, unstable_cacheTag as cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションに関連するメッセージを取得する
 * @param auctionId オークションID
 * @returns メッセージリスト
 */
export async function getCachedAuctionMessageContents(auctionId: string): Promise<{ success: boolean; error: string; messages: AuctionMessage[] }> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュの設定
   */
  cacheTag(`auction-messages-${auctionId}`);
  cacheLife("hours");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  try {
    const messages = await prisma.auctionMessage.findMany({
      where: {
        auctionId,
      },
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
     * メッセージが見つからない場合
     */
    if (!messages) {
      return { success: false, error: "メッセージが見つかりません", messages: [] };
    }

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

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("メッセージ取得エラー:", error);
    return { success: false, error: "メッセージの取得に失敗しました", messages: [] };
  }
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

  try {
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
      return { success: false, error: "オークションが見つかりません", auctionPersonInfo: null };
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
  } catch (error) {
    console.error("出品者情報取得エラー:", error);
    return { success: false, error: "出品者情報の取得に失敗しました", auctionPersonInfo: null };
  }
}
