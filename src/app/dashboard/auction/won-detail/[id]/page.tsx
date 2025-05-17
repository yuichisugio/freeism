import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { AuctionWonDetail } from "@/components/auction/auction-history/auction-won-detail";
import { MainTemplate } from "@/components/layout/maintemplate";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 落札商品詳細ページのProps
 */
type WonAuctionPageProps = {
  params: Promise<{ id: string }>;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 落札商品詳細ページのメタデータ
 */
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
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ログ
   */
  console.log("src/app/dashboard/auction/won-detail/[id]/page.tsx_WonAuctionPage_start");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメーター
   */
  const { id } = await params;
  const userId = await getAuthenticatedSessionUserId();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 落札したオークションの詳細を取得
  const auction = await prisma.auction.findUnique({
    where: {
      id,
      winnerId: userId,
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
          OR: [{ reviewerId: userId }, { revieweeId: userId }],
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
