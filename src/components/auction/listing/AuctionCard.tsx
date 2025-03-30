"use client";

import Image from "next/image";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuctionCard } from "@/hooks/auction/listing/useAuctionCard";
import { type AuctionCardProps } from "@/lib/auction/types";
import { cn } from "@/lib/utils";
import { Clock, Eye, Heart, Star, Tag, Users } from "lucide-react";

import CardCountdown from "./AuctionCountdown";

/**
 * オークションカードコンポーネント
 * @param auction オークション
 * @param onToggleWatchlistAction ウォッチリスト更新アクション
 */
export default function AuctionCard({ auction, onToggleWatchlistAction }: AuctionCardProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // カスタムフックからロジックを取得
  const { isUpdating, isStarted, isEnded, isNew, isEndingSoon, setIsEnded, handleToggleWatchlist, getStartMessage, sellerRating } = useAuctionCard({ auction, onToggleWatchlistAction });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 出品者の評価表示
  const renderRating = () => {
    if (sellerRating.ratingValue === null) {
      return <span className="text-gray-400 dark:text-gray-500">未評価</span>;
    }

    return (
      <div className="flex items-center">
        {/* フルスター */}
        {Array.from({ length: sellerRating.fullStars }).map((_, i) => (
          <Star key={`full-${i}`} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
        ))}

        {/* ハーフスター */}
        {sellerRating.hasHalfStar && (
          <span className="relative">
            <Star className="h-3 w-3 text-gray-300 dark:text-gray-600" />
            <span className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            </span>
          </span>
        )}

        {/* 空スター */}
        {Array.from({ length: sellerRating.emptyStars }).map((_, i) => (
          <Star key={`empty-${i}`} className="h-3 w-3 text-gray-300 dark:text-gray-600" />
        ))}

        <span className="ml-1 text-xs text-gray-600 dark:text-gray-400">{sellerRating.ratingValue.toFixed(1)}</span>
      </div>
    );
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="group relative overflow-hidden rounded-lg bg-white shadow-md transition-all duration-300 hover:shadow-lg dark:bg-gray-800 dark:shadow-gray-900">
      {/* 新着バッジ（過去3日以内の出品） */}
      {isNew && <div className="absolute top-0 left-0 z-10 rounded-br-lg bg-blue-500 px-2 py-1 text-xs font-semibold text-white">NEW</div>}

      {/* ウォッチリストボタン - 絶対位置 */}
      <button
        className="absolute top-2 right-2 z-10 rounded-full bg-white/90 p-1.5 shadow-sm transition-colors hover:bg-gray-100 dark:bg-gray-800/90 dark:hover:bg-gray-700"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleToggleWatchlist();
        }}
        disabled={isUpdating}
        aria-label={auction.isWatched ? "ウォッチリストから削除" : "ウォッチリストに追加"}
      >
        <Heart className={cn("h-4 w-4 transition-colors", auction.isWatched ? "fill-red-500 text-red-500" : "text-gray-400 dark:text-gray-300")} />
      </button>

      <Link href={`/dashboard/auction/${auction.taskId}`} className="block">
        <div className="relative h-48 bg-gray-100 dark:bg-gray-700">
          {auction.imageUrl ? (
            <Image
              src={auction.imageUrl}
              alt={auction.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-200 text-gray-400 dark:bg-gray-600 dark:text-gray-300">
              <Tag className="h-12 w-12 opacity-50" />
            </div>
          )}

          {/* ステータスバッジとまもなく終了バッジを縦に配置 */}
          <div className="absolute bottom-2 left-2 z-10 flex flex-col gap-2">
            {!isStarted ? (
              <Badge className="bg-blue-500 text-white">{getStartMessage()}</Badge>
            ) : isEnded ? (
              <Badge variant="destructive">終了しました</Badge>
            ) : (
              <Badge variant="outline" className="bg-white/90 backdrop-blur-sm dark:bg-gray-800/90 dark:text-gray-100">
                <CardCountdown endTime={auction.endTime} onExpire={() => setIsEnded(true)} />
              </Badge>
            )}

            {/* まもなく終了バッジを左側に移動 */}
            {isEndingSoon && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                まもなく終了
              </Badge>
            )}
          </div>
        </div>
      </Link>

      <div className="p-3 sm:p-4">
        <Link href={`/dashboard/auction/${auction.taskId}`} className="block">
          <h3 className="hover:text-primary mb-2 line-clamp-2 text-base font-semibold transition-colors sm:text-lg dark:text-gray-100">{auction.title}</h3>
        </Link>

        {/* 現在価格 */}
        <div>
          <div className="text-base font-bold text-blue-600 sm:text-lg dark:text-blue-400">現在価格: {auction.currentBid.toLocaleString()} P</div>
          <div className="text-2xs mt-0.5 text-green-600 sm:text-xs dark:text-green-400">落札可能: {auction.bidToBeatAmount.toLocaleString()} P</div>

          {/* 入札数を落札可能の下に移動 */}
          <div className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Users className="h-3 w-3" />
            <span>入札数</span>
            <div className="text-sm font-medium">{auction.bidsCount}件</div>
          </div>
        </div>

        {/* 区切り線 */}
        <div className="my-3 border-t border-gray-100 dark:border-gray-700"></div>

        {/* 出品者情報とグループを縦に並べる */}
        <div className="flex flex-col space-y-2">
          {/* 出品者情報 */}
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src={auction.seller.image || ""} alt={auction.seller.name || "出品者"} />
              <AvatarFallback>{auction.seller.name?.[0] || "U"}</AvatarFallback>
            </Avatar>
            <span className="max-w-[120px] truncate text-xs text-gray-600 dark:text-gray-300">{auction.seller.name || "Unknown"}</span>
          </div>

          {/* 評価 */}
          <div className="text-xs">{renderRating()}</div>

          {/* グループ名 */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-2xs max-w-full truncate rounded bg-gray-100 px-2 py-1 text-gray-600 sm:text-xs dark:bg-gray-700 dark:text-gray-300">{auction.group.name}</div>
              </TooltipTrigger>
              <TooltipContent>
                <p>出品グループ: {auction.group.name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* カテゴリ表示（モック） */}
          <div className="text-2xs max-w-full truncate rounded bg-gray-50 px-2 py-1 text-gray-500 sm:text-xs dark:bg-gray-700/50 dark:text-gray-400">
            カテゴリ: {auction.group.name.includes("開発") ? "開発" : "その他"}
          </div>
        </div>
      </div>
    </div>
  );
}
