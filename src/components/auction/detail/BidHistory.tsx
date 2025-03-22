"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type BidHistoryWithUser } from "@/lib/auction/types";
import { formatCurrency, formatRelativeTime } from "@/lib/formatters";
import { GetInitialsFromName } from "@/lib/utils";

type BidHistoryProps = {
  auctionId: string;
  initialBids?: BidHistoryWithUser[];
};

// SSEからの更新を確認するためのポーリング間隔を30秒に設定（1秒未満にしない）
const POLLING_INTERVAL = 30000; // 30秒

function BidHistory({ auctionId, initialBids = [] }: BidHistoryProps) {
  const [bids, setBids] = useState<BidHistoryWithUser[]>(initialBids);
  const [isLoading, setIsLoading] = useState(!initialBids.length);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(Date.now());

  // ユーザー名を安全に取得するヘルパー関数
  const getUserName = (user: any): string => {
    if (!user) return "不明なユーザー";
    return user.username || user.name || "不明なユーザー";
  };

  // ユーザーアバターを安全に取得するヘルパー関数
  const getUserAvatar = (user: any): string => {
    if (!user) return "";
    return user.avatarUrl || user.image || "";
  };

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

  // 入札履歴を取得する関数
  const fetchBidHistory = async () => {
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
  };

  if (isLoading && !initialBids.length) {
    return <BidHistorySkeleton />;
  }

  if (error && !bids.length) {
    return <div className="text-destructive">{error}</div>;
  }

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

// スケルトンローダー
function BidHistorySkeleton() {
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
          {Array(3)
            .fill(0)
            .map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-4 w-20" />
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default BidHistory;
