"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { type AuctionCardProps } from "@/lib/auction/types";
import { cn } from "@/lib/utils";
import { AuctionStatus } from "@prisma/client";
import { formatDistanceToNow, isWithinInterval, subDays } from "date-fns";
import { ja } from "date-fns/locale";
import { Clock, Eye, Heart, Star, Tag, Users } from "lucide-react";

import CardCountdown from "./AuctionCountdown";

export default function AuctionCard({ auction, onToggleWatchlistAction }: AuctionCardProps) {
  // ウォッチリスト更新中の状態
  const [isUpdating, setIsUpdating] = useState(false);

  // 現在時刻とオークションの開始・終了時刻を比較
  const now = new Date();
  const [isStarted] = useState(new Date(auction.startTime) <= now);
  const [isEnded, setIsEnded] = useState(new Date(auction.endTime) <= now || auction.status === AuctionStatus.ENDED);

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

  // 開始前の場合
  const getStartMessage = () => {
    return `開始まで${formatDistanceToNow(new Date(auction.startTime), { locale: ja })}`;
  };

  // 出品者の評価表示
  const renderRating = () => {
    if (auction.seller.rating === null) {
      return <span className="text-gray-400">未評価</span>;
    }

    // 5つ星評価の表示
    const fullStars = Math.floor(auction.seller.rating);
    const hasHalfStar = auction.seller.rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      <div className="flex items-center">
        {/* フルスター */}
        {Array.from({ length: fullStars }).map((_, i) => (
          <Star key={`full-${i}`} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
        ))}

        {/* ハーフスター */}
        {hasHalfStar && (
          <span className="relative">
            <Star className="h-3 w-3 text-gray-300" />
            <span className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            </span>
          </span>
        )}

        {/* 空スター */}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <Star key={`empty-${i}`} className="h-3 w-3 text-gray-300" />
        ))}

        <span className="ml-1 text-xs text-gray-600">{auction.seller.rating.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <div className="group relative overflow-hidden rounded-lg bg-white shadow-md transition-all duration-300 hover:shadow-lg">
      {/* 新着バッジ（過去3日以内の出品） */}
      {isWithinInterval(new Date(auction.startTime), {
        start: subDays(new Date(), 3),
        end: new Date(),
      }) && <div className="absolute top-0 left-0 z-10 rounded-br-lg bg-blue-500 px-2 py-1 text-xs font-semibold text-white">NEW</div>}

      {/* ウォッチリストボタン - 絶対位置 */}
      <button
        className="absolute top-2 right-2 z-10 rounded-full bg-white/90 p-1.5 shadow-sm transition-colors hover:bg-gray-100"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleToggleWatchlist();
        }}
        disabled={isUpdating}
        aria-label={auction.isWatched ? "ウォッチリストから削除" : "ウォッチリストに追加"}
      >
        <Heart className={cn("h-4 w-4 transition-colors", auction.isWatched ? "fill-red-500 text-red-500" : "text-gray-400")} />
      </button>

      <Link href={`/dashboard/auction/${auction.taskId}`} className="block">
        <div className="relative h-48 bg-gray-100">
          {auction.imageUrl ? (
            <Image
              src={auction.imageUrl}
              alt={auction.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-200 text-gray-400">
              <Tag className="h-12 w-12 opacity-50" />
            </div>
          )}

          {/* ステータスバッジ */}
          <div className="absolute bottom-2 left-2 z-10">
            {!isStarted ? (
              <Badge className="bg-blue-500 text-white">{getStartMessage()}</Badge>
            ) : isEnded ? (
              <Badge variant="destructive">終了しました</Badge>
            ) : (
              <Badge variant="outline" className="bg-white/90 backdrop-blur-sm">
                <CardCountdown endTime={auction.endTime} onExpire={() => setIsEnded(true)} />
              </Badge>
            )}
          </div>

          {/* まもなく終了バッジ */}
          {isStarted && !isEnded && new Date(auction.endTime).getTime() - now.getTime() < 24 * 60 * 60 * 1000 && (
            <Badge variant="destructive" className="absolute right-2 bottom-2 z-10 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              まもなく終了
            </Badge>
          )}
        </div>
      </Link>

      <div className="p-3 sm:p-4">
        <Link href={`/dashboard/auction/${auction.taskId}`} className="block">
          <h3 className="hover:text-primary mb-2 line-clamp-2 text-base font-semibold transition-colors sm:text-lg">{auction.title}</h3>
        </Link>

        {/* 現在価格と入札数 */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500">現在価格</div>
            <div className="text-base font-bold text-blue-600 sm:text-lg">{auction.currentBid.toLocaleString()} P</div>
            <div className="text-2xs mt-0.5 text-green-600 sm:text-xs">落札可能: {auction.bidToBeatAmount.toLocaleString()} P</div>
          </div>
          <div className="flex flex-col items-end text-right">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Users className="h-3 w-3" />
              <span>入札数</span>
            </div>
            <div className="text-sm font-medium">{auction.bidsCount}件</div>
          </div>
        </div>

        {/* 区切り線 */}
        <div className="my-3 border-t border-gray-100"></div>

        {/* 出品者情報とグループ */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Avatar className="h-5 w-5">
              <AvatarImage src={auction.seller.image || ""} alt={auction.seller.name || "出品者"} />
              <AvatarFallback>{auction.seller.name?.[0] || "U"}</AvatarFallback>
            </Avatar>
            <span className="max-w-[80px] truncate text-xs text-gray-600">{auction.seller.name || "Unknown"}</span>
            <span className="text-xs">{renderRating()}</span>
          </div>

          {/* グループ名 */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-2xs max-w-[120px] truncate rounded bg-gray-100 px-2 py-1 text-gray-600 sm:text-xs">{auction.group.name}</div>
              </TooltipTrigger>
              <TooltipContent>
                <p>出品グループ: {auction.group.name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* ウォッチ数 - 下部装飾 */}
      {auction.isWatched && (
        <div className="absolute right-0 bottom-0 flex items-center gap-1 rounded-tl-lg bg-red-50 px-2 py-1 text-xs text-red-500">
          <Eye className="h-3 w-3" />
          <span>ウォッチ中</span>
        </div>
      )}
    </div>
  );
}
