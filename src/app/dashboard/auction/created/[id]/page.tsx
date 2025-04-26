import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { AuctionCreatedDetail } from "@/components/auction/auction-history/auction-created-detail";
import { MainTemplate } from "@/components/layout/maintemplate";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { type AuctionReview } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 出品商品詳細ページのProps
 */
type CreatedAuctionPageProps = {
  params: Promise<{ id: string }>;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 出品商品詳細ページのメタデータ
 */
export const metadata: Metadata = {
  title: "出品商品詳細 | Freeism",
  description: "出品した商品の詳細や落札状況を確認できます",
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 出品商品詳細ページのメタデータ
 */
export default async function CreatedAuctionPage({ params }: CreatedAuctionPageProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ログ
   */
  console.log("src/app/dashboard/auction/created/[id]/page.tsx_start");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメーター
   */
  const { id } = await params;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーIDを取得
   */
  const userId = await getAuthenticatedSessionUserId();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自分が出品したオークションの詳細を取得
   */
  const auction = await prisma.auction.findUnique({
    where: {
      id,
      task: {
        creatorId: userId,
      },
    },
    include: {
      task: true,
      winner: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      reviews: {
        where: {
          OR: [{ reviewerId: userId }, { revieweeId: userId }],
        },
      },
      bidHistories: {
        orderBy: {
          amount: "desc",
        },
        take: 10,
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
    },
  });

  if (!auction) {
    notFound();
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札者の他のレビューを取得（落札者がいる場合のみ）
   */
  let winnerReviews: AuctionReview[] = [];
  let winnerRating = 0;

  if (auction.winner) {
    winnerReviews = await prisma.auctionReview.findMany({
      where: {
        revieweeId: auction.winner.id,
        NOT: {
          auctionId: auction.id,
        },
      },
      take: 100,
      orderBy: {
        createdAt: "desc",
      },
    });
    // 落札者の平均評価を計算
    winnerRating = winnerReviews.length > 0 ? winnerReviews.reduce((sum, review) => sum + review.rating, 0) / winnerReviews.length : 0;
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品商品詳細ページを表示
   */
  return (
    <MainTemplate title="出品商品詳細" description="出品した商品の詳細情報です">
      <AuctionCreatedDetail auction={auction} winnerRating={winnerRating} winnerReviews={winnerReviews} />
    </MainTemplate>
  );
}
