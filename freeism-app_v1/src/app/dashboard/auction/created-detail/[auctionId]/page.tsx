"use cache";

import { type Metadata } from "next";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { AuctionCreatedDetail } from "@/components/auction/auction-history/created-detail";

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
 * @param params パラメーター
 * @returns 詳細ページ
 */
export default async function AuctionCreatedDetailPage({ params }: AuctionHistoryCreatedDetailPageProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュライフを最大に設定
   */
  cacheLife("max");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメーター
   */
  const { auctionId } = await params;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札IDがない場合
   */
  if (!auctionId) {
    return notFound();
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品商品詳細ページを表示
   */
  return <AuctionCreatedDetail auctionId={auctionId} />;
}
