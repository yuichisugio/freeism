"use client";

import { memo } from "react";
import { useCountdown } from "@/hooks/auction/bid/use-countdown";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

/**
 * オークションカード用シンプルなカウントダウンコンポーネント
 * @param endTime 終了時間
 * @param onExpire 終了時のコールバック関数
 */
export const CardCountdown = memo(function CardCountdown({ endTime, onExpire }: { endTime: Date | string; onExpire?: () => void }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // カスタムフックからロジックを取得
  const { countdownState, formatCountdown } = useCountdown(endTime, onExpire);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div
      className={cn(
        "flex items-center gap-1 font-medium whitespace-nowrap",
        countdownState.isCritical
          ? "animate-pulse text-red-500"
          : countdownState.isUrgent
            ? "text-orange-500"
            : countdownState.isExpired
              ? "text-red-500"
              : "text-gray-700",
      )}
    >
      {!countdownState.isExpired && <Clock className="h-3.5 w-3.5" />}
      <span>{formatCountdown()}</span>
    </div>
  );
});
