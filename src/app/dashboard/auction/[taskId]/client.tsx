"use client";

import dynamic from "next/dynamic";
import { type AuctionDetailProps } from "@/lib/auction/types";

// クライアントコンポーネントでdynamicインポートを行う
const AuctionDetailClient = dynamic(() => import("@/components/auction/detail/AuctionDetail"), { ssr: false });

export function AuctionDetailWrapper({ auction, isOwnAuction }: AuctionDetailProps) {
  return <AuctionDetailClient auction={auction} isOwnAuction={isOwnAuction} />;
}
