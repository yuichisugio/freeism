"use client";

import { memo, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAutoBid } from "@/hooks/auction/bid/use-auto-bid";
import { formatCurrency } from "@/lib/utils";
import { motion } from "framer-motion";
import { Bot, HelpCircle, Info } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 自動入札フォームの型
 */
type AutoBidFormProps = {
  auctionId: string;
  currentHighestBid: number;
  currentHighestBidderId: string | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 自動入札フォーム
 * @param auctionId オークションID
 * @param currentHighestBid 現在の最高入札額
 * @param currentHighestBidderId 現在の最高入札者ID
 * @returns 自動入札フォーム
 */
export const AutoBidForm = memo(function AutoBidForm({ auctionId, currentHighestBid, currentHighestBidderId }: AutoBidFormProps): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 最大入札額の入力値
  const [maxBidAmount, setMaxBidAmount] = useState<number>(currentHighestBid + 1);

  // 入札単位の入力値（デフォルト100ポイント）
  const [bidIncrement, setBidIncrement] = useState<number>(100);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 自動入札のカスタムフック
  const { autoBidSettings, loading, error, isAutoBidding, setupAutoBid, cancelAutoBidding } = useAutoBid(
    auctionId,
    currentHighestBid,
    currentHighestBidderId,
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 自動入札の設定を保存
  const handleSetupAutoBid = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (maxBidAmount <= currentHighestBid) {
        return; // バリデーションエラー
      }

      // 自動入札を設定
      await setupAutoBid(maxBidAmount, bidIncrement);
    },
    [maxBidAmount, bidIncrement, setupAutoBid, currentHighestBid],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 自動入札のキャンセル
  const handleCancelAutoBid = useCallback(async () => {
    await cancelAutoBidding();
  }, [cancelAutoBidding]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 自動入札が設定されている場合の表示
  if (isAutoBidding && autoBidSettings) {
    return (
      <Card className="border-secondary/30 bg-secondary/5 overflow-hidden">
        <CardHeader className="bg-secondary/10 pb-3">
          <CardTitle className="flex items-center text-lg font-medium">
            <Bot className="text-secondary mr-2 h-5 w-5" />
            自動入札設定中
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">上限入札額:</p>
              <p className="text-secondary font-bold">{formatCurrency(autoBidSettings.maxBidAmount)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">入札単位:</p>
              <p className="font-medium">{formatCurrency(autoBidSettings.bidIncrement)}</p>
            </div>
            <div className="text-muted-foreground mt-2 text-xs">他のユーザーが入札すると自動的に入札されます</div>
          </div>
        </CardContent>
        <CardFooter className="bg-secondary/5 flex justify-center pt-2 pb-3">
          <Button
            variant="outline"
            size="sm"
            className="text-secondary hover:bg-secondary/20 border-secondary/30"
            onClick={handleCancelAutoBid}
            disabled={loading}
          >
            自動入札を取り消す
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 自動入札フォーム
  return (
    <Card className="overflow-hidden border-indigo-200">
      {/* 自動入札フォームのヘッダー */}
      <CardHeader className="bg-gradient-to-r from-indigo-50 to-indigo-100/50 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-lg font-medium">
            <Bot className="mr-2 h-5 w-5 text-indigo-500" />
            自動入札
          </CardTitle>
        </div>
        <CardDescription>あなたの代わりに自動的に入札します</CardDescription>
      </CardHeader>

      {/* 自動入札フォームのコンテンツ */}
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3 }}
      >
        <form onSubmit={handleSetupAutoBid}>
          <CardContent className="pt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="maxBidAmount">最大入札額</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="text-muted-foreground h-4 w-4" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="w-60 text-xs">
                          あなたが入札してもよいと考える最大金額を設定します。他のユーザーが入札した場合、この金額まで自動的に入札が行われます。
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="maxBidAmount"
                  type="number"
                  min={currentHighestBid + 1}
                  step={1}
                  value={maxBidAmount}
                  onChange={(e) => setMaxBidAmount(Number(e.target.value))}
                  required
                  className="h-10"
                />
                {maxBidAmount <= currentHighestBid && <p className="text-xs text-red-500">最大入札額は現在の最高入札額より大きい必要があります</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="bidIncrement">入札単位</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="text-muted-foreground h-4 w-4" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="w-60 text-xs">他のユーザーの入札を上回るために加算するポイント数です。 最小は1ポイントです。</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="bidIncrement"
                  type="number"
                  min={1}
                  step={1}
                  value={bidIncrement}
                  onChange={(e) => setBidIncrement(Number(e.target.value))}
                  required
                  className="h-10"
                />
              </div>

              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
                  <div>
                    <p>他のユーザーが入札すると、最大入札額まであなたの代わりに自動的に入札します。</p>
                  </div>
                </div>
              </div>

              {error && <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-xs text-red-800">{error}</div>}
            </div>
          </CardContent>

          <CardFooter className="flex justify-end gap-2 pb-4">
            <Button type="submit" size="sm" disabled={loading || maxBidAmount <= currentHighestBid}>
              {loading ? "処理中..." : "自動入札を設定"}
            </Button>
          </CardFooter>
        </form>
      </motion.div>
    </Card>
  );
});
