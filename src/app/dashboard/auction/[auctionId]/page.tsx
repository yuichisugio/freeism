"use cache";

import { type Metadata } from "next";
import { unstable_cacheLife as cacheLife } from "next/cache";

import AuctionDetailWrapper from "./client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 動的なメタデータを生成
 * @returns メタデータ
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "オークション詳細 | Freeism",
    description: "オークション商品の詳細情報",
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション詳細ページ
 * @param params タスクID
 * @returns オークション詳細ページ
 */
export default async function AuctionDetailPage({ params }: { params: Promise<{ auctionId: string }> }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  console.log("src/app/dashboard/auction/[auctionId]/page.tsx_AuctionDetailPage_start");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュの有効期間を設定
   */
  cacheLife("max");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークションIDを取得
   * */
  const { auctionId } = await params;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークション詳細ページを表示
   */
  return <AuctionDetailWrapper auctionId={auctionId} />;
}
