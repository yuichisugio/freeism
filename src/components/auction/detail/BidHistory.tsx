"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

  useEffect(() => {
    // 初期データがあれば、それを使用
    if (initialBids.length > 0) {
      setBids(initialBids);
      setIsLoading(false);
    }

    // SSE接続を設定
    let eventSource: EventSource | null = null;
    let retryCount = 0;
    const maxRetries = 5;
    const retryTimeout = 3000; // 3秒後に再接続

    function setupEventSource() {
      if (!auctionId) return;

      try {
        // 既存の接続をクローズ
        if (eventSource) {
          eventSource.close();
        }

        // SSE接続を確立
        eventSource = new EventSource(`/api/auctions/${auctionId}/sse-server-sent-events`);

        // 接続開始時のイベントハンドラ
        eventSource.onopen = () => {
          console.log("SSE接続が確立されました");
          retryCount = 0; // 接続成功したらリトライカウントをリセット
        };

        // 初期データ受信時のイベントハンドラ
        eventSource.addEventListener("initial", (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.bids && Array.isArray(data.bids)) {
              setBids(data.bids);
              setIsLoading(false);
            }
          } catch (err) {
            console.error("初期データの解析エラー:", err);
          }
        });

        // 新しい入札受信時のイベントハンドラ
        eventSource.addEventListener("new_bid", (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.bid) {
              setBids((prev) => [data.bid, ...prev]);
            }
          } catch (err) {
            console.error("新規入札データの解析エラー:", err);
          }
        });

        // オークション更新時のイベントハンドラ
        eventSource.addEventListener("auction_update", (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.bids && Array.isArray(data.bids)) {
              setBids(data.bids);
            }
          } catch (err) {
            console.error("オークション更新データの解析エラー:", err);
          }
        });

        // エラー発生時のイベントハンドラ
        eventSource.addEventListener("error", (event) => {
          console.error("SSE接続エラー:", event);

          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }

          // 接続が切断された場合は、再接続を試みる
          if (retryCount < maxRetries) {
            retryCount++;
            const timeout = retryTimeout * Math.pow(2, retryCount - 1); // 指数バックオフ
            console.log(`${timeout}ms後に再接続を試みます (${retryCount}/${maxRetries})`);

            setTimeout(() => {
              setupEventSource();
            }, timeout);
          } else {
            setError("サーバーとの接続が切断されました。ページを更新してください。");
          }
        });
      } catch (err) {
        console.error("SSE接続エラー:", err);
        setError("入札履歴の更新接続に失敗しました");
        setIsLoading(false);
      }
    }

    // SSE接続を開始
    setupEventSource();

    // クリーンアップ関数
    return () => {
      if (eventSource) {
        console.log("SSE接続を終了します");
        eventSource.close();
        eventSource = null;
      }
    };
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
