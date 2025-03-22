"use client";

import { useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Auction } from "@/lib/auction/types";

import AuctionDetail from "./AuctionDetail";
import BidHistory from "./BidHistory";

type AuctionDetailPageProps = {
  auction: Auction;
  isOwnAuction: boolean;
};

function AuctionDetailPage({ auction, isOwnAuction }: AuctionDetailPageProps) {
  const [activeTab, setActiveTab] = useState("details");

  // ユーザーが入札または出品者の場合、入札履歴タブを選択中に自動更新
  useEffect(() => {
    if (activeTab !== "bidHistory") return;

    const intervalId = setInterval(() => {
      // タブがアクティブな場合のみ更新
      if (document.visibilityState === "visible" && activeTab === "bidHistory") {
        // 必要に応じて入札履歴を再取得する処理をここに追加
      }
    }, 30000); // 30秒ごとに更新

    return () => clearInterval(intervalId);
  }, [activeTab, auction.id]);

  return (
    <div className="space-y-8">
      <AuctionDetail auction={auction} isOwnAuction={isOwnAuction} />

      <Separator />

      <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="details">商品詳細</TabsTrigger>
          <TabsTrigger value="bidHistory">入札履歴</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <div>
            <h2 className="mb-3 text-xl font-semibold">商品詳細</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">カテゴリー</h3>
                <p>{auction.categories?.map((cat) => cat.name).join(", ") || "設定なし"}</p>
              </div>

              <div>
                <h3 className="font-medium">出品者</h3>
                <p>{auction.seller?.username || "不明なユーザー"}</p>
              </div>

              <div>
                <h3 className="font-medium">開始日時</h3>
                <p>{new Date(auction.startTime).toLocaleString("ja-JP")}</p>
              </div>

              <div>
                <h3 className="font-medium">終了日時</h3>
                <p>{new Date(auction.endTime).toLocaleString("ja-JP")}</p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-xl font-semibold">商品説明</h2>
            <p className="whitespace-pre-line">{auction.description}</p>
          </div>
        </TabsContent>

        <TabsContent value="bidHistory">
          <h2 className="mb-3 text-xl font-semibold">入札履歴</h2>
          <BidHistory auctionId={auction.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AuctionDetailPage;
