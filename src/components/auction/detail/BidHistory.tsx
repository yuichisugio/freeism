"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { POLLING_INTERVAL } from "@/lib/auction/constants";
import { type BidHistoryProps, type BidHistoryWithUser } from "@/lib/auction/types";
import { formatCurrency, formatRelativeTime } from "@/lib/formatters";
import { GetInitialsFromName } from "@/lib/utils";

import { BidHistorySkeleton } from "../skeleton/bid-history";

/**
 * 入札履歴
 * @param auctionId オークションID
 * @param initialBids 初期の入札履歴
 * @returns 入札履歴
 */
export default function BidHistory({ auctionId, initialBids = [] }: BidHistoryProps) {
  const [bids, setBids] = useState<BidHistoryWithUser[]>(initialBids);
  const [isLoading, setIsLoading] = useState(!initialBids.length);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(Date.now());

  // ユーザー名を安全に取得するヘルパー関数
  function getUserName(user: any): string {
    if (!user) return "不明なユーザー";
    return user.username || user.name || "不明なユーザー";
  }

  // ユーザーアバターを安全に取得するヘルパー関数
  function getUserAvatar(user: any): string {
    if (!user) return "";
    return user.avatarUrl || user.image || "";
  }

  // 入札履歴を取得する関数
  async function fetchBidHistory() {
    try {
      const response = await fetch(`/api/auctions/${auctionId}/bids`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      if (!response.ok) {
        throw new Error("入札履歴の取得に失敗しました");
      }

      const data = await response.json();

      // 新しいデータがある場合のみ更新
      if (data.bids && data.bids.length > bids.length) {
        setBids(data.bids);
      }

      setIsLoading(false);
      setLastFetchTime(Date.now());
    } catch (err) {
      console.error("入札履歴取得エラー:", err);
      setError("入札履歴を読み込めませんでした");
      setIsLoading(false);
    }
  }

  // 初回と定期的な更新のための入札データ取得
  useEffect(() => {
    // 初期データがあれば、それを使用
    if (initialBids.length > 0 && bids.length === initialBids.length) {
      setBids(initialBids);
      setIsLoading(false);
      setLastFetchTime(Date.now());
    }

    // 最初のデータ取得
    if (!initialBids.length) {
      fetchBidHistory();
    }

    // 定期的な更新（30秒ごと）
    const intervalId = setInterval(() => {
      fetchBidHistory();
    }, POLLING_INTERVAL);

    return () => clearInterval(intervalId);
  }, [auctionId, initialBids]);

  // ローディング中の場合
  if (isLoading && !initialBids.length) {
    return <BidHistorySkeleton />;
  }

  // エラーがある場合
  if (error && !bids.length) {
    return <div className="text-destructive">{error}</div>;
  }

  // 入札履歴がない場合
  if (bids.length === 0) {
    return <div className="text-muted-foreground py-4 text-center">まだ入札がありません</div>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>入札者</TableHead>
            <TableHead>入札額</TableHead>
            <TableHead className="text-right">入札日時</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bids.map((bid) => (
            <TableRow key={bid.id}>
              <TableCell className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={getUserAvatar(bid.user)} alt={getUserName(bid.user)} />
                  <AvatarFallback>{GetInitialsFromName(getUserName(bid.user))}</AvatarFallback>
                </Avatar>
                <span>{getUserName(bid.user)}</span>
                {bid.isAutoBid && <span className="text-muted-foreground ml-1 text-xs">(自動入札)</span>}
              </TableCell>
              <TableCell>{formatCurrency(bid.amount)}</TableCell>
              <TableCell className="text-muted-foreground text-right">{formatRelativeTime(bid.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
