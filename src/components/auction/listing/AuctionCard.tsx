"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AuctionStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { Heart } from "lucide-react";

// オークション情報の型定義
type AuctionProps = {
  auction: {
    id: string;
    taskId: string;
    title: string;
    description?: string;
    imageUrl?: string;
    currentBid: number;
    bidToBeatAmount: number;
    endTime: Date;
    startTime: Date;
    status: AuctionStatus;
    isWatched: boolean;
    bidsCount: number;
    seller: {
      id: string;
      name: string | null;
      image: string | null;
      rating: number | null;
    };
    group: {
      id: string;
      name: string;
    };
  };
  onToggleWatchlistAction: (auctionId: string) => Promise<void>;
};

export default function AuctionCard({ auction, onToggleWatchlistAction }: AuctionProps) {
  // ウォッチリスト更新中の状態
  const [isUpdating, setIsUpdating] = useState(false);

  // 現在時刻とオークションの開始・終了時刻を比較
  const now = new Date();
  const isStarted = new Date(auction.startTime) <= now;
  const isEnded = new Date(auction.endTime) <= now || auction.status === AuctionStatus.ENDED;

  // 残り時間またはその他のステータスメッセージ
  const getTimeStatus = () => {
    if (!isStarted) {
      return `開始まで${formatDistanceToNow(new Date(auction.startTime), { locale: ja })}`;
    }

    if (isEnded) {
      return "終了しました";
    }

    return `残り${formatDistanceToNow(new Date(auction.endTime), { locale: ja })}`;
  };

  // ウォッチリストの切り替え
  const handleToggleWatchlist = async () => {
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      await onToggleWatchlistAction(auction.id);
    } finally {
      setIsUpdating(false);
    }
  };

  // 出品者の評価表示
  const renderRating = () => {
    if (auction.seller.rating === null) {
      return <span className="text-gray-400">未評価</span>;
    }

    return (
      <span className="flex items-center gap-1">
        <span className="text-yellow-500">★</span>
        <span>{auction.seller.rating}</span>
      </span>
    );
  };

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-md transition-shadow duration-300 hover:shadow-lg">
      <Link href={`/dashboard/auction/${auction.taskId}`}>
        <div className="relative h-48 bg-gray-100">
          {auction.imageUrl ? (
            <Image src={auction.imageUrl} alt={auction.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-400">
              <span>画像なし</span>
            </div>
          )}

          {/* 状態表示バッジ */}
          <div className={cn("absolute top-2 right-2 rounded px-2 py-1 text-xs font-medium text-white", isEnded ? "bg-red-500" : !isStarted ? "bg-blue-500" : "bg-green-500")}>{getTimeStatus()}</div>
        </div>
      </Link>

      <div className="p-4">
        <div className="flex items-start justify-between">
          <Link href={`/dashboard/auction/${auction.taskId}`} className="w-full">
            <h3 className="hover:text-primary line-clamp-2 text-lg font-semibold transition-colors">{auction.title}</h3>
          </Link>

          {/* ウォッチリストボタン */}
          <button
            className="ml-2 flex-shrink-0 rounded-full p-1 transition-colors hover:bg-gray-100"
            onClick={(e) => {
              e.preventDefault();
              handleToggleWatchlist();
            }}
            disabled={isUpdating}
          >
            <Heart className={cn("h-5 w-5 transition-colors", auction.isWatched ? "fill-red-500 text-red-500" : "text-gray-400")} />
          </button>
        </div>

        {/* 現在価格と入札数 */}
        <div className="mt-2 flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500">現在価格</div>
            <div className="text-lg font-bold">{auction.currentBid.toLocaleString()} ポイント</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">入札数</div>
            <div className="font-medium">{auction.bidsCount}件</div>
          </div>
        </div>

        {/* 出品者情報 */}
        <div className="mt-3 flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={auction.seller.image || ""} alt={auction.seller.name || "出品者"} />
            <AvatarFallback>{auction.seller.name?.[0] || "U"}</AvatarFallback>
          </Avatar>
          <span className="text-sm text-gray-600">{auction.seller.name || "Unknown"}</span>
          <span className="ml-auto text-sm">{renderRating()}</span>
        </div>

        {/* グループ名 */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="mt-2 inline-block max-w-full truncate rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">{auction.group.name}</div>
            </TooltipTrigger>
            <TooltipContent>
              <p>出品グループ: {auction.group.name}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
