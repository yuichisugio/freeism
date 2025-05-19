"use server";

import { notFound } from "next/navigation";
import { AuctionWonDetail } from "@/components/auction/auction-history/won-detail";
import { MainTemplate } from "@/components/layout/maintemplate";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 落札商品詳細ページのProps
 */
type WonAuctionPageProps = {
  params: Promise<{ auctionId: string }>;
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
  const { auctionId } = await params;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札IDがない場合
   */
  if (!auctionId) {
    return notFound();
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札商品詳細ページ
   */
  return (
    <MainTemplate title="落札商品詳細" description="落札した商品の詳細情報です">
      <AuctionWonDetail auctionId={auctionId} />
    </MainTemplate>
  );
}
