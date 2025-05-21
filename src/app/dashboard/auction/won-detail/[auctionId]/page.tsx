"use cache";

import type { Metadata } from "next";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { AuctionWonDetail } from "@/components/auction/auction-history/won-detail";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 落札商品詳細ページのProps
 */
type WonAuctionPageProps = {
  params: Promise<{ auctionId: string }>;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 落札商品詳細ページのパラメータ
 */
export const metadata: Metadata = {
  title: "落札商品詳細 | Freeism",
  description: "落札した商品の詳細情報です",
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 落札商品詳細ページ
 * @param params パラメータ
 * @returns 落札商品詳細ページ
 */
export default async function AuctionWonDetailPage({ params }: WonAuctionPageProps) {
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
   * 落札商品詳細ページ
   */
  return <AuctionWonDetail auctionId={auctionId} />;
}
