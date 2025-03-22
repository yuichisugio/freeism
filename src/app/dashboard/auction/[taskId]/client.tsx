"use client";

import dynamic from "next/dynamic";
import { type Auction } from "@/types/auction";

// クライアントコンポーネントでdynamicインポートを行う
const AuctionDetailClient = dynamic(() => import("@/components/auction/detail/AuctionDetail"), { ssr: false });

type AuctionDetailWrapperProps = {
  auction: Auction;
  isOwnAuction: boolean;
};

export default function AuctionDetailWrapper({ auction, isOwnAuction }: AuctionDetailWrapperProps) {
  return <AuctionDetailClient auction={auction} isOwnAuction={isOwnAuction} />;
}
