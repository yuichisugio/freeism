"use client";

import type { AuctionWithDetails } from "@/lib/auction/type/types";
import dynamic from "next/dynamic";

// 動的インポートされたコンポーネント
const AuctionDetailClient = dynamic(() => import("@/components/auction/bid/auction-detail").then((mod) => ({ default: mod.AuctionDetail })), {
  ssr: false,
  loading: () => <div className="p-8 text-center">オークション情報を読み込み中...</div>,
});

/**
 * オークション詳細ページのクライアントコンポーネント
 * @param props コンポーネントのプロパティ
 * @returns オークション詳細ページ
 */
// eslint-disable-next-line import/no-default-export
export default function AuctionDetailWrapper({ initialAuction }: { initialAuction: AuctionWithDetails }) {
  return <AuctionDetailClient initialAuction={initialAuction} />;
}
