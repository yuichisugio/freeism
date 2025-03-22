"use client";

import { useEffect, useState } from "react";

/**
 * カウントダウンタイマーの状態
 */
export type CountdownState = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
};

/**
 * カウントダウンタイマー用カスタムフック
 */
export function useCountdown(targetDate: Date | string) {
  const calculateTimeLeft = (): CountdownState => {
    const now = new Date();
    const target = typeof targetDate === "string" ? new Date(targetDate) : targetDate;

    const difference = target.getTime() - now.getTime();

    if (difference <= 0) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: true,
      };
    }

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / (1000 * 60)) % 60),
      seconds: Math.floor((difference / 1000) % 60),
      isExpired: false,
    };
  };

  const [timeLeft, setTimeLeft] = useState<CountdownState>(calculateTimeLeft());

  useEffect(() => {
    // 初期値設定
    setTimeLeft(calculateTimeLeft());

    // タイマーがすでに終了している場合は何もしない
    if (timeLeft.isExpired) return;

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
  }, [targetDate]);

  // カウントダウンをフォーマットする関数
  const formatCountdown = () => {
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
  };

  return {
    countdownState: timeLeft,
    formatCountdown,
  };
}

/**
 * カウントダウンをフォーマットする
 */
export function formatCountdown(countdown: CountdownState): string {
  if (countdown.isExpired) {
    return "終了";
  }

  if (countdown.days > 0) {
    return `${countdown.days}日 ${countdown.hours}時間`;
  }

  if (countdown.hours > 0) {
    return `${countdown.hours}時間 ${countdown.minutes}分`;
  }

  if (countdown.minutes > 0) {
    return `${countdown.minutes}分 ${countdown.seconds}秒`;
  }

  return `${countdown.seconds}秒`;
}
