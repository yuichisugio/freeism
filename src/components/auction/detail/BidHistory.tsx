"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type BidHistoryProps, type BidHistoryWithUser } from "@/lib/auction/types";
import { formatCurrency, formatRelativeTime } from "@/lib/formatters";

/**
 * 入札履歴
 * @param initialBids 初期の入札履歴
 * @returns 入札履歴
 */
export default function BidHistory({ initialBids = [] }: BidHistoryProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  const [bids, setBids] = useState<BidHistoryWithUser[]>(initialBids);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ユーザー名を安全に取得するヘルパー関数
  function getUserName(user: any): string {
    if (!user) return "不明なユーザー";
    return user.username || user.name || "不明なユーザー";
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 入札履歴がない場合
  if (bids.length === 0) {
    return <div className="text-muted-foreground py-4 text-center">まだ入札がありません</div>;
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>入札者</TableHead>
            <TableHead>入札方法</TableHead>
            <TableHead>入札額</TableHead>
            <TableHead className="text-right">入札日時</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bids.map((bid) => (
            <TableRow key={bid.id}>
              <TableCell className="flex items-center gap-2">
                <span>{getUserName(bid.user)}</span>
              </TableCell>
              <TableCell>{bid.isAutoBid ? <span className="text-muted-foreground ml-1 text-xs">自動入札</span> : <span className="text-muted-foreground ml-1 text-xs">手動入札</span>}</TableCell>
              <TableCell>{formatCurrency(bid.amount)}</TableCell>
              <TableCell className="text-muted-foreground text-right">{`${formatRelativeTime(bid.createdAt)}`}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
