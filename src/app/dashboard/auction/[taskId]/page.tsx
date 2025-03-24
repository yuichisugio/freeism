import React from "react";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { MainTemplate } from "@/components/layout/maintemplate";
import { getAuctionWithTask } from "@/lib/auction/auction-service";

import AuctionDetailWrapper from "./client";

/**
 * 動的なメタデータを生成
 * @param params タスクID
 * @returns メタデータ
 */
export async function generateMetadata({ params }: { params: Promise<{ taskId: string }> }): Promise<Metadata> {
  const { taskId } = await params;
  try {
    const auction = await getAuctionWithTask(taskId);
    if (!auction) return notFound();

    return {
      title: `${auction.task.task} | オークション | Freeism`,
      description: auction.task.detail || `オークション商品: ${auction.task.task}`,
    };
  } catch (error) {
    console.error("メタデータ生成エラー:", error);
    return {
      title: "オークション詳細 | Freeism",
      description: "オークション商品の詳細情報",
    };
  }
}

/**
 * オークション詳細ページ
 * @param params タスクID
 * @returns オークション詳細ページ
 */
export default async function AuctionDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  // タスクIDを取得
  const { taskId } = await params;

  // オークションデータを取得
  const auctionData = await getAuctionWithTask(taskId);
  if (!auctionData) {
    notFound();
  }

  // 現在のユーザー情報を取得
  const session = await auth();
  if (!session || !session.user) {
    notFound();
  }

  return (
    <MainTemplate title={auctionData.task.task} description={auctionData.task.detail || ""}>
      <AuctionDetailWrapper initialAuction={auctionData} />
    </MainTemplate>
  );
}
