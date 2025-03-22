"use client";

import { type CountdownState } from "@/hooks/auction/useCountdown";

export type CountdownDisplayProps = {
  countdownState: CountdownState;
  formattedCountdown: string;
};

function CountdownDisplay({ countdownState, formattedCountdown }: CountdownDisplayProps) {
  // カウントダウンの状態に基づいて表示を変更
  if (countdownState.isExpired) {
    return <p className="font-medium text-red-500">オークション終了</p>;
  }

  // 残り時間が24時間以内の場合
  if (countdownState.days === 0 && countdownState.hours < 24) {
    return <p className="font-medium text-red-500">{formattedCountdown}</p>;
  }

  // 通常表示
  return <p className="text-muted-foreground">{formattedCountdown}</p>;
}

export default CountdownDisplay;
