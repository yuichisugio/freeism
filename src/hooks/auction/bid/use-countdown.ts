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
    const now = new Date();
    const target = typeof targetDate === "string" ? new Date(targetDate) : targetDate;
    const diff = target.getTime() - now.getTime();

    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, isExpired: true };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    // 分は切り上げると「あと○分」で表示が自然です
    const minutes = Math.ceil((diff / (1000 * 60)) % 60);

    return { days, hours, minutes, isExpired: false };
  }, [targetDate]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // マウント時にも一度だけ即時更新しておく（useStateの初期化だけだと、ちょうど分替わり前後で表示が1分古くなる可能性があるため）
  useEffect(() => {
    setTimeLeft(calculateTimeLeft());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // カウントダウンの状態を管理するuseState
  const [timeLeft, setTimeLeft] = useState<CountdownState>(calculateTimeLeft());

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 1分ごとの更新
  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 60 * 1000);
    return () => clearInterval(id);
  }, [calculateTimeLeft]);

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
    // 残り1時間未満は「○分」とだけ表示
    return `${timeLeft.minutes}分`;
  }, [timeLeft]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    countdownState: timeLeft,
    countdown: formatCountdown,
  };
}
