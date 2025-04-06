import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { AuctionWonDetail } from "@/components/auction/auction-history/auction-won-detail";
import { MainTemplate } from "@/components/layout/maintemplate";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/utils";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

type WonAuctionPageProps = {
  params: Promise<{ id: string }>;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

export const metadata: Metadata = {
  title: "落札商品詳細 | Freeism",
  description: "落札した商品の詳細や評価、配送状況を確認できます",
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 落札商品詳細ページ
 * @param params パラメータ
 * @returns 落札商品詳細ページ
 */
export default async function WonAuctionPage({ params }: WonAuctionPageProps) {
  const { id } = await params;
  const session = await getAuthSession();

  if (!session?.user?.id) {
    notFound();
  }

  // 落札したオークションの詳細を取得
  const auction = await prisma.auction.findUnique({
    where: {
      id,
      winnerId: session.user.id,
    },
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
        },
      },
      reviews: {
        where: {
          OR: [{ reviewerId: session.user.id }, { revieweeId: session.user.id }],
        },
      },
    },
  });

  if (!auction) {
    notFound();
  }

  // オークションが見つかったということは、winnerId は session.user.id と等しく、
  // つまり必ず string 型になるため、as string で型キャストしても安全
  const winnerIdAsString = auction.winnerId!;

  // 出品者の他のレビューを取得
  const sellerReviews = await prisma.auctionReview.findMany({
    where: {
      revieweeId: auction.task.creatorId,
      NOT: {
        auctionId: auction.id,
      },
    },
    take: 5,
    orderBy: {
      createdAt: "desc",
    },
  });

  // 出品者の平均評価を計算
  const sellerRating = sellerReviews.length > 0 ? sellerReviews.reduce((sum, review) => sum + review.rating, 0) / sellerReviews.length : 0;

  // オークションオブジェクトに必ず文字列の winnerId を設定
  const safeAuction = {
    ...auction,
    winnerId: winnerIdAsString,
  };

  return (
    <MainTemplate title="落札商品詳細" description="落札した商品の詳細情報です">
      <AuctionWonDetail auction={safeAuction} sellerRating={sellerRating} sellerReviews={sellerReviews} />
    </MainTemplate>
  );
}
