"use client";

import { memo, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { CardCountdown } from "@/components/auction/listing/auction-countdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useWatchlist } from "@/hooks/auction/bid/use-watchlist";
import { useAuctionCard } from "@/hooks/auction/listing/use-auction-card";
import { cn } from "@/lib/utils";
import { type AuctionCard as AuctionCardType } from "@/types/auction-types";
import { Clock, Heart, Star, Tag, Users } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 出品者の評価表示
 * @param executorRating 出品者の評価
 * @returns 評価表示
 */
const getExecutorRatingComponent = (executorRating: number | null): JSX.Element => {
  // 評価がない場合
  if (executorRating === null) {
    return <span className="text-gray-400 dark:text-gray-500">未評価</span>;
  }

  // 5つ星評価の表示
  const fullStars = Math.floor(executorRating);
  // 半分の星の表示
  const hasHalfStar = executorRating % 1 >= 0.5;
  // 空の星の表示
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
          <Star className="h-3 w-3 text-gray-300 dark:text-gray-600" />
          <span className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          </span>
        </span>
      )}

      {/* 空スター */}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <Star key={`empty-${i}`} className="h-3 w-3 text-gray-300 dark:text-gray-600" />
      ))}

      <span className="ml-1 text-xs text-gray-600 dark:text-gray-400">{executorRating?.toFixed(1)}</span>
    </div>
  );
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションカードコンポーネント
 * @param auction オークション
 */
export const AuctionCard = memo(function AuctionCard({ auction }: { auction: AuctionCardType }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  console.log("src/components/auction/listing/auction-card.tsx_AuctionCard_start");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * カスタムフックからロジックを取得
   */
  // card
  const { isStarted, isEnded, isNew, isEndingSoon, setIsEnded, getStartMessage } = useAuctionCard({ auction });

  // watchlist
  const { isLoading, toggleWatchlist, isWatchlisted } = useWatchlist(auction.id, auction.is_watched);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクのタイトルにハイライトがあるかどうかを返す
   */
  const hasHighlight = useMemo(() => auction.task_highlighted ?? auction.detail_highlighted, [auction.task_highlighted, auction.detail_highlighted]);

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
          void toggleWatchlist();
        }}
        disabled={isLoading}
        aria-label={isWatchlisted ? "ウォッチリストから削除" : "ウォッチリストに追加"}
      >
        <Heart className={cn("h-4 w-4 transition-colors", isWatchlisted ? "fill-red-500 text-red-500" : "text-gray-400 dark:text-gray-300")} />
      </button>

      {/* オークション詳細ページへのリンク */}
      <Link href={`/dashboard/auction/${auction.id}`} className="block">
        <div className="relative h-48 bg-gray-100 dark:bg-gray-700">
          {auction.image_url ? (
            <Image
              src={auction.image_url}
              alt={auction.task}
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
          <div className="absolute bottom-2 left-2 z-10 flex flex-col items-start gap-1">
            {!isStarted ? (
              <Badge className="bg-blue-500 text-white shadow-md">{getStartMessage()}</Badge>
            ) : isEnded ? (
              <Badge variant="destructive" className="shadow-md">
                終了しました
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-gray-300 bg-white/80 text-gray-900 shadow-md backdrop-blur-sm dark:border-gray-600 dark:bg-gray-800/80 dark:text-gray-100"
              >
                <CardCountdown endTime={auction.end_time} onExpire={() => setIsEnded(true)} />
              </Badge>
            )}

            {hasHighlight && (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 shadow-sm">
                検索ヒット
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

      {/* オークションカードの内容 */}
      <div className="p-3 sm:p-4">
        {/* オークションタイトル */}
        <Link href={`/dashboard/auction/${auction.id}`} className="block">
          <h3
            className="hover:text-primary mb-2 line-clamp-2 text-base font-semibold transition-colors sm:text-lg dark:text-gray-100"
            dangerouslySetInnerHTML={{ __html: auction.task_highlighted ?? auction.task }}
          />
          {auction.detail_highlighted && (
            <p className="line-clamp-1 text-xs text-gray-500" dangerouslySetInnerHTML={{ __html: auction.detail_highlighted }} />
          )}
        </Link>

        {/* 現在価格 */}
        <div>
          <div className="text-base font-bold text-blue-600 sm:text-lg dark:text-blue-400">
            現在価格: {auction.current_highest_bid.toLocaleString()} P
          </div>

          {/* 入札数を落札可能の下に移動 */}
          <div className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Users className="h-3 w-3" />
            <span>入札数</span>
            <div className="text-sm font-medium">{auction.bids_count}件</div>
          </div>
        </div>

        {/* 区切り線 */}
        <div className="my-3 border-t border-gray-100 dark:border-gray-700"></div>

        {/* 出品者情報とグループを縦に並べる */}
        <div className="flex flex-col space-y-2">
          {/* 出品者情報 */}
          <div className="flex flex-col items-start gap-2">
            {typeof auction.executors_json === "string" ? (
              <div className="text-xs text-gray-500 dark:text-gray-400">出品者情報がありません</div>
            ) : (
              auction.executors_json.map((executor) => (
                <div key={executor.id} className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={executor.userImage ?? ""} alt={executor.userSettingsUsername ?? "出品者"} />
                    <AvatarFallback>{executor.userSettingsUsername?.[0] ?? "U"}</AvatarFallback>
                  </Avatar>
                  <div className="text-xs">{getExecutorRatingComponent(executor.rating)}</div>
                  <span className="max-w-[120px] truncate text-xs text-gray-600 dark:text-gray-300">
                    {executor.userSettingsUsername ?? "Unknown"}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* グループ名 */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-2xs max-w-full truncate rounded bg-gray-100 px-2 py-1 text-gray-600 sm:text-xs dark:bg-gray-700 dark:text-gray-300">
                  {auction.group_name}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>出品グループ: {auction.group_name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* カテゴリ表示（モック） */}
          <div className="text-2xs max-w-full truncate rounded bg-gray-50 px-2 py-1 text-gray-500 sm:text-xs dark:bg-gray-700/50 dark:text-gray-400">
            カテゴリ: {auction.category ?? "未設定"}
          </div>
        </div>
      </div>
    </div>
  );
});
