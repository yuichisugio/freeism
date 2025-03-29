"use client";

import { useCallback, useEffect, useState } from "react";

type TimeRemaining = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  isUrgent: boolean;
  isCritical: boolean;
};

type UseCountdownProps = {
  endTime: Date | string;
  onExpire?: () => void;
};

export function useCountdown({ endTime, onExpire }: UseCountdownProps) {
  // 残り時間を計算する関数
  const getTimeRemaining = useCallback((): TimeRemaining => {
    const now = new Date();
    const end = new Date(endTime);
    const diff = end.getTime() - now.getTime();

    // 既に終了している場合
    if (diff <= 0) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: true,
        isUrgent: false,
        isCritical: false,
      };
    }

    // 残り時間を計算
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    // 残り時間による状態の判定
    const isUrgent = days === 0 && hours < 12; // 12時間以内は注意状態
    const isCritical = days === 0 && hours === 0 && minutes < 30; // 30分以内は警告状態

    return { days, hours, minutes, seconds, isExpired: false, isUrgent, isCritical };
  }, [endTime]);

  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>(getTimeRemaining());

  // 残り時間をフォーマットする関数
  const formatTimeRemaining = useCallback((): string => {
    if (timeRemaining.isExpired) {
      return "終了しました";
    }

    if (timeRemaining.days > 0) {
      return `残り${timeRemaining.days}日${timeRemaining.hours}時間`;
    }

    if (timeRemaining.hours > 0) {
      return `残り${timeRemaining.hours}時間${timeRemaining.minutes}分`;
    }

    if (timeRemaining.minutes > 0) {
      return `残り${timeRemaining.minutes}分${timeRemaining.seconds}秒`;
    }

    return `残り${timeRemaining.seconds}秒`;
  }, [timeRemaining]);

  // 1秒ごとに残り時間を更新するタイマー
  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeRemaining = getTimeRemaining();
      setTimeRemaining(newTimeRemaining);

      // 終了した場合
      if (newTimeRemaining.isExpired) {
        clearInterval(timer);
        if (onExpire) onExpire();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime, onExpire, getTimeRemaining]);

  return {
    timeRemaining,
    formatTimeRemaining,
  };
}
