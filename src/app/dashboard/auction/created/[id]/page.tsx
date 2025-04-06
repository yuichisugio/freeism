import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { AuctionCreatedDetail } from "@/components/auction/auction-history/auction-created-detail";
import { MainTemplate } from "@/components/layout/maintemplate";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/utils";
import { type AuctionReview } from "@prisma/client";

type CreatedAuctionPageProps = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: "出品商品詳細 | Freeism",
  description: "出品した商品の詳細や落札状況を確認できます",
};

export default async function CreatedAuctionPage({ params }: CreatedAuctionPageProps) {
  const { id } = await params;
  const session = await getAuthSession();

  if (!session?.user?.id) {
    notFound();
  }

  // 自分が出品したオークションの詳細を取得
  const auction = await prisma.auction.findUnique({
    where: {
      id,
      task: {
        creatorId: session.user.id,
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
          OR: [{ reviewerId: session.user.id }, { revieweeId: session.user.id }],
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

  // 落札者の他のレビューを取得（落札者がいる場合のみ）
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
      take: 5,
      orderBy: {
        createdAt: "desc",
      },
    });

    // 落札者の平均評価を計算
    winnerRating = winnerReviews.length > 0 ? winnerReviews.reduce((sum, review) => sum + review.rating, 0) / winnerReviews.length : 0;
  }

  return (
    <MainTemplate title="出品商品詳細" description="出品した商品の詳細情報です">
      <AuctionCreatedDetail auction={auction} winnerRating={winnerRating} winnerReviews={winnerReviews} />
    </MainTemplate>
  );
}
