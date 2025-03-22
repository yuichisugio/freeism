import React from "react";
import { type Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { MainTemplate } from "@/components/layout/maintemplate";
import { prisma } from "@/lib/prisma";
import { type Auction } from "@/types/auction";

// クライアントコンポーネントを動的にインポート
const AuctionDetailClient = dynamic(() => import("@/components/auction/detail/AuctionDetail"), { ssr: false }) as any; // 型エラーを回避するために一時的にany型で対応

// オークション情報を取得する関数
async function getAuctionWithTask(taskId: string) {
  try {
    const auction = await prisma.auction.findUnique({
      where: { taskId },
      include: {
        task: {
          include: {
            group: true,
            creator: true,
          },
        },
        currentHighestBidder: true,
        winner: true,
        bids: {
          include: {
            user: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 10,
        },
      },
    });

    return auction;
  } catch (error) {
    console.error("オークション取得エラー:", error);
    return null;
  }
}

// 動的なメタデータを生成
export async function generateMetadata({ params }: { params: { taskId: string } }): Promise<Metadata> {
  const { taskId } = params;
  try {
    const auction = await getAuctionWithTask(taskId);
    if (!auction) return notFound();

    return {
      title: `${auction.task.task} | オークション | Freeism`,
      description: auction.task.detail || `オークション商品: ${auction.task.task}`,
    };
  } catch (error) {
    console.error("メタデータ生成エラー:", error);
    return {
      title: "オークション詳細 | Freeism",
      description: "オークション商品の詳細情報",
    };
  }
}

export default async function AuctionDetailPage({ params }: { params: { taskId: string } }) {
  const { taskId } = params;
  const auctionData = await getAuctionWithTask(taskId);

  if (!auctionData) {
    notFound();
  }

  // 現在のユーザー情報を取得
  const session = await auth();
  const currentUserId = session?.user?.id;

  // 出品者かどうかを確認
  const isOwnAuction = auctionData.task.creatorId === currentUserId;

  // Prismaモデルから@/types/auctionで定義されたAuction型に変換
  const auction: Auction = {
    id: auctionData.id,
    title: auctionData.task.task,
    description: auctionData.task.detail || "",
    imageUrl: auctionData.task.imageUrl || "/images/placeholder.jpg",
    startingPrice: auctionData.task.fixedContributionPoint || 0,
    currentPrice: auctionData.currentHighestBid,
    bidCount: auctionData.bids.length,
    startTime: auctionData.startTime.toISOString(),
    endTime: auctionData.endTime.toISOString(),
    sellerId: auctionData.task.creatorId,
    seller: {
      id: auctionData.task.creator.id,
      username: auctionData.task.creator.name || "不明なユーザー",
      email: auctionData.task.creator.email,
      createdAt: auctionData.task.creator.createdAt.toISOString(),
      avatarUrl: auctionData.task.creator.image || undefined,
    },
  };

  return (
    <MainTemplate title={auctionData.task.task} description={auctionData.task.detail || ""}>
      <AuctionDetailClient auction={auction} isOwnAuction={isOwnAuction} />
    </MainTemplate>
  );
}
