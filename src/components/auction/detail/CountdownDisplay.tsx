"use client";

import { type CountdownDisplayProps } from "@/lib/auction/types";

/**
 * カウントダウン表示
 * @param countdownState カウントダウンの状態
 * @param formattedCountdown カウントダウンの表示形式
 * @returns カウントダウン表示
 */
export function CountdownDisplay({ countdownState, countdownAction }: CountdownDisplayProps) {
  // カウントダウンの状態に基づいて表示を変更
  if (countdownState.isExpired) {
    return <p className="font-medium text-red-500">オークション終了</p>;
  }

  // 残り時間が24時間以内の場合
  if (countdownState.days === 0 && countdownState.hours < 24) {
    return <p className="font-medium text-red-500">{countdownAction()}</p>;
  }

  // 通常表示
  return <p className="text-muted-foreground">{countdownAction()}</p>;
}
