"use client";

import { useCallback, useEffect, useState } from "react";
import { type CountdownState } from "@/lib/auction/type/types";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * カウントダウンタイマー用カスタムフックの型
 */
type UseCountdownResult = {
  countdownState: CountdownState;
  countdown: () => string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * カウントダウンタイマー用カスタムフック
 * @param {Date | string} targetDate カウントダウンのターゲット日時
 * @returns {UseCountdownResult} カウントダウンの状態とフォーマットされたカウントダウン
 */
export function useCountdown(targetDate: Date | string): UseCountdownResult {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * カウントダウンの状態を計算する関数
   * @returns {CountdownState} カウントダウンの状態
   */
  const calculateTimeLeft = useCallback((): CountdownState => {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    const now = new Date();
    const target = typeof targetDate === "string" ? new Date(targetDate) : targetDate;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
    // ターゲット日時と現在の日時の差を計算
    const difference = target.getTime() - now.getTime();

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
    // タイマーが終了している場合
    if (difference <= 0) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: true,
      };
    }

    // 残り時間を計算
    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / (1000 * 60)) % 60),
      seconds: Math.floor((difference / 1000) % 60),
      isExpired: false,
    };
  }, [targetDate]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // カウントダウンの状態を管理するuseState
  const [timeLeft, setTimeLeft] = useState<CountdownState>(calculateTimeLeft());

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // タイマーを更新
  useEffect(() => {
    // 1秒ごとに更新
    const timerId = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);

      // 時間切れになったらタイマーを停止
      if (newTimeLeft.isExpired) {
        clearInterval(timerId);
      }
    }, 1000);

    // クリーンアップ
    return () => clearInterval(timerId);
  }, [targetDate, calculateTimeLeft]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * カウントダウンをフォーマットする関数
   * @returns フォーマットされたカウントダウン
   */
  const formatCountdown = useCallback((): string => {
    if (timeLeft.isExpired) {
      return "終了";
    }

    if (timeLeft.days > 0) {
      return `${timeLeft.days}日 ${timeLeft.hours}時間`;
    }

    if (timeLeft.hours > 0) {
      return `${timeLeft.hours}時間 ${timeLeft.minutes}分`;
    }

    if (timeLeft.minutes > 0) {
      return `${timeLeft.minutes}分 ${timeLeft.seconds}秒`;
    }

    return `${timeLeft.seconds}秒`;
  }, [timeLeft]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    countdownState: timeLeft,
    countdown: formatCountdown,
  };
}
