"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatRelativeTime } from "@/lib/formatters";
import { GetInitialsFromName } from "@/lib/utils";
import { type BidHistoryWithUser } from "@/types/auction";

type BidHistoryProps = {
  auctionId: string;
  initialBids?: BidHistoryWithUser[];
};

function BidHistory({ auctionId, initialBids = [] }: BidHistoryProps) {
  const [bids, setBids] = useState<BidHistoryWithUser[]>(initialBids);
  const [isLoading, setIsLoading] = useState(!initialBids.length);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialBids.length > 0) {
      return; // 初期データがある場合は読み込みをスキップ
    }

    const fetchBidHistory = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/auctions/${auctionId}/bids`);

        if (!response.ok) {
          throw new Error("入札履歴の取得に失敗しました");
        }

        const data = await response.json();
        setBids(data.bids);
      } catch (err) {
        console.error("入札履歴取得エラー:", err);
        setError("入札履歴を読み込めませんでした");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBidHistory();
  }, [auctionId, initialBids]);

  if (isLoading) {
    return <BidHistorySkeleton />;
  }

  if (error) {
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
                  <AvatarImage src={bid.user?.avatarUrl || ""} alt={bid.user?.username || "ユーザー"} />
                  <AvatarFallback>{GetInitialsFromName(bid.user?.username || "U")}</AvatarFallback>
                </Avatar>
                <span>{bid.user?.username || "不明なユーザー"}</span>
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
