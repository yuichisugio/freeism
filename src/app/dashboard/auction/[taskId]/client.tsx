"use client";

import type { Auction, AuctionDetailProps } from "@/lib/auction/types";
import dynamic from "next/dynamic";
import { useAuctionEvent } from "@/hooks/auction/useAuctionEvent";
import { AuctionWithDetails } from "@/lib/auction/types";

/**
 * オークション詳細ページのクライアントコンポーネント
 * @param auction オークション情報
 * @param isOwnAuction 自分の出品したオークションかどうか
 * @returns オークション詳細ページ
 */
export default function AuctionDetailWrapper({ auction, isOwnAuction }: { auction: Auction; isOwnAuction: boolean }) {
  // useAuctionEventフックを使用してSSEからリアルタイムデータを取得
  const { auction: liveAuction, bidHistory, loading, error } = useAuctionEvent(auction.id, auction as any);

  // クライアントコンポーネントでdynamicインポートを行う
  const AuctionDetailClient = dynamic(() => import("@/components/auction/detail/AuctionDetail"), { ssr: false });

  // AuctionWithDetailsからAuctionへの変換を行う
  const normalizedAuction = liveAuction
    ? ({
        ...liveAuction,
        // Date型をstring型に変換
        startTime: typeof liveAuction.startTime === "object" ? liveAuction.startTime.toISOString() : liveAuction.startTime,
        endTime: typeof liveAuction.endTime === "object" ? liveAuction.endTime.toISOString() : liveAuction.endTime,
      } as Auction)
    : auction;

  // AuctionDetailPropsに従って明示的にプロパティを定義
  const props: AuctionDetailProps = {
    auction: normalizedAuction,
    bidHistory,
    isOwnAuction,
    isLoading: loading,
    error,
  };

  // 型付きのプロパティを渡す
  return <AuctionDetailClient {...props} />;
}
