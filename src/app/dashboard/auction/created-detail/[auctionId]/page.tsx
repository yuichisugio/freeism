"use cache";

import { type Metadata } from "next";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { AuctionHistoryCreatedDetail } from "@/components/auction/auction-history/created-detail";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 出品商品詳細ページのProps
 */
type AuctionHistoryCreatedDetailPageProps = {
  params: Promise<{ auctionId: string }>;
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
export default async function AuctionHistoryCreatedDetailPage({ params }: AuctionHistoryCreatedDetailPageProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュライフを最大に設定
   */
  cacheLife("max");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ログ
   */
  console.log("src/app/dashboard/auction/created/[id]/page.tsx_start");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメーター
   */
  const { auctionId } = await params;
  console.log("src/app/dashboard/auction/created-detail/[auctionId]/page.tsx_auctionId", auctionId);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品商品詳細ページを表示
   */
  return <AuctionHistoryCreatedDetail auctionId={auctionId} />;
}
