"use cache";

import { type Metadata } from "next";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { AuctionHistory } from "@/components/auction/auction-history/auction-history";
import { MainTemplate } from "@/components/layout/maintemplate";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入札・落札履歴ページのメタデータ
 */
export const metadata: Metadata = {
  title: "入札・落札履歴 | Freeism",
  description: "入札した商品・落札した商品・出品した商品の履歴です",
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入札・落札履歴ページ
 */
export default async function AuctionHistoryPage() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュの有効期間を設定
   */
  cacheLife("max");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 入札・落札履歴ページを返す
   */
  return (
    <MainTemplate title="入札・落札履歴" description="入札した商品・落札した商品・出品した商品の履歴です">
      <AuctionHistory />
    </MainTemplate>
  );
}
