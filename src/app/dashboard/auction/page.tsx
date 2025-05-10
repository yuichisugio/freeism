"use cache";

import { type Metadata } from "next";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { AuctionListings } from "@/components/auction/listing/auction-listings";
import { MainTemplate } from "@/components/layout/maintemplate";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * メタデータ
 */
export const metadata: Metadata = {
  title: "オークション商品一覧 | Freeism",
  description: "出品されているオークション商品一覧です",
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション商品一覧ページ
 */
export default async function AuctionPage() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  console.log("src/app/dashboard/auction/page.tsx_AuctionPage_start");

  /**
   * キャッシュの有効期間を設定
   */
  cacheLife("max");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <MainTemplate title="オークション商品一覧" description="出品されているオークション商品一覧です">
      <AuctionListings />
    </MainTemplate>
  );
}
