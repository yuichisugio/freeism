"use client";

import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type AuctionWithDetails } from "@/lib/auction/type/types";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import { motion } from "framer-motion";
import { Activity, AlertCircle, HandCoins } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入札履歴
 * @param initialBids 初期の入札履歴
 * @returns 入札履歴
 */
export const BidHistory = memo(function BidHistory({ initialBids = [] }: { initialBids: AuctionWithDetails["bidHistories"] }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 入札履歴がない場合
   * @returns 入札履歴がない場合の表示
   */
  if (initialBids.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-muted/30 flex flex-col items-center justify-center gap-3 rounded-lg py-12 text-center"
      >
        <AlertCircle className="text-muted-foreground/50 h-12 w-12" />
        <p className="text-muted-foreground">まだ入札がありません</p>
      </motion.div>
    );
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Activity className="text-primary h-5 w-5" />
        <h3 className="text-lg font-semibold">入札アクティビティ</h3>
      </div>

      <div className="overflow-hidden rounded-xl border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="font-medium">入札者</TableHead>
              <TableHead className="font-medium">入札方法</TableHead>
              <TableHead className="font-medium">入札額</TableHead>
              <TableHead className="text-right font-medium">入札日時</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialBids.map((bid, index) => (
              <motion.tr
                key={bid.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className={`${index === 0 ? "bg-primary/5" : index % 2 === 1 ? "bg-muted/30" : ""} hover:bg-muted/50 transition-colors duration-200`}
              >
                <TableCell className="py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{bid?.user?.name ?? "不明なユーザー"}</span>
                    {index === 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        現在の最高額
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {bid.isAutoBid ? (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      <Activity className="mr-1 h-3 w-3" />
                      自動入札
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      <HandCoins className="mr-1 h-3 w-3" />
                      手動入札
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-primary text-lg font-bold">{formatCurrency(bid.amount)}</TableCell>
                <TableCell className="text-muted-foreground text-right text-sm">{`${formatRelativeTime(bid.createdAt)}`}</TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
});
