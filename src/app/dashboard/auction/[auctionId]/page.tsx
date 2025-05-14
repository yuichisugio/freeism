"use cache";

import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { MainTemplate } from "@/components/layout/maintemplate";
import { getAuctionByAuctionId } from "@/lib/auction/action/auction-retrieve";

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
  /**
   * オークションIDを取得
   * */
  const { auctionId } = await params;
  console.log("src/app/dashboard/auction/[auctionId]/page.tsx_auctionId", auctionId);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  try {
    // オークションデータを取得
    const auctionData = await getAuctionByAuctionId(auctionId);

    // オークションデータが存在しない場合は404エラーを返す
    if (!auctionData) {
      console.error(`オークションが見つかりません: auctionId=${auctionId}`);
      console.log("src/app/dashboard/auction/[auctionId]/page.tsx_stack", new Error().stack);
      return notFound();
    }

    console.log("src/app/dashboard/auction/[auctionId]/page.tsx_getAuctionByAuctionId_auctionData_success");

    return (
      <MainTemplate title={auctionData.task.task} description={auctionData.task.detail ?? ""}>
        <AuctionDetailWrapper initialAuction={auctionData} />
      </MainTemplate>
    );
  } catch (error) {
    console.error("オークション詳細ページエラー:", error);
    return notFound();
  }
}
