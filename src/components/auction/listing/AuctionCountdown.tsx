"use client";

import { useCountdown } from "@/hooks/auction/listing/useCountdown";
import { type CardCountdownProps } from "@/lib/auction/types";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

/**
 * オークションカード用シンプルなカウントダウンコンポーネント
 * @param endTime 終了時間
 * @param className クラス名
 * @param onExpire 終了時のコールバック関数
 */
export default function CardCountdown({ endTime, className, onExpire }: CardCountdownProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // カスタムフックからロジックを取得
  const { timeRemaining, formatTimeRemaining } = useCountdown({ endTime, onExpire });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div
      className={cn(
        "flex items-center gap-1 font-medium whitespace-nowrap",
        timeRemaining.isCritical ? "animate-pulse text-red-500" : timeRemaining.isUrgent ? "text-orange-500" : timeRemaining.isExpired ? "text-red-500" : "text-gray-700",
        className,
      )}
    >
      {!timeRemaining.isExpired && <Clock className="h-3.5 w-3.5" />}
      <span>{formatTimeRemaining()}</span>
    </div>
  );
}
