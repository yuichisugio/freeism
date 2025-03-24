"use client";

import type { AuctionWithDetails } from "@/lib/auction/types";
import dynamic from "next/dynamic";

// 動的インポートされたコンポーネント - any型を使用して型エラーを回避
const AuctionDetailClient = dynamic(() => import("@/components/auction/detail/AuctionDetail"), {
  ssr: false,
  loading: () => <div className="p-8 text-center">オークション情報を読み込み中...</div>,
}) as any;

/**
 * オークション詳細ページのクライアントコンポーネント
 * @param props コンポーネントのプロパティ
 * @returns オークション詳細ページ
 */
export default function AuctionDetailWrapper({ initialAuction }: { initialAuction: AuctionWithDetails }) {
  return <AuctionDetailClient initialAuction={initialAuction} />;
}
