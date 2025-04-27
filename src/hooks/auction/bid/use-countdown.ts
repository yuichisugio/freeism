"use client";

import { useCallback, useEffect, useState } from "react";
import { type CountdownState } from "@/lib/auction/type/types";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * カウントダウンタイマー用カスタムフックの型
 */
type UseCountdownResult = {
  countdownState: CountdownState;
  formatCountdown: () => string;
  isUrgent: boolean;
  isCritical: boolean;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * カウントダウンタイマー用カスタムフック
 * @param {Date | string} targetDate カウントダウンのターゲット日時
 * @returns {UseCountdownResult} カウントダウンの状態とフォーマットされたカウントダウン
 */
export function useCountdown(targetDate: Date | string, onExpire: () => void | null): UseCountdownResult {
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
      return { days: 0, hours: 0, minutes: 0, isExpired: true, isUrgent: false, isCritical: false };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    // 分は切り上げると「あと○分」で表示が自然です
    const minutes = Math.ceil((diff / (1000 * 60)) % 60);

    /**
     * 残り時間による状態の判定
     * 12時間以内は注意状態
     * 30分以内は警告状態
     */
    const isUrgent = days === 0 && hours < 12;
    const isCritical = days === 0 && hours === 0 && minutes < 30;

    return { days, hours, minutes, isExpired: false, isUrgent, isCritical };
  }, [targetDate]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // マウント時にも一度だけ即時更新しておく（useStateの初期化だけだと、ちょうど分替わり前後で表示が1分古くなる可能性があるため）
  useEffect(() => {
    setCountdownState(calculateTimeLeft());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // カウントダウンの状態を管理するuseState
  const [countdownState, setCountdownState] = useState<CountdownState>(calculateTimeLeft());

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 1分ごとの更新
  useEffect(() => {
    const id = setInterval(() => {
      setCountdownState(calculateTimeLeft());
    }, 60 * 1000);

    // 終了した場合、onExpireを実行
    if (countdownState.isExpired) {
      clearInterval(id);
      if (onExpire) onExpire();
    }

    return () => clearInterval(id);
  }, [calculateTimeLeft, onExpire, countdownState.isExpired]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * カウントダウンをフォーマットする関数
   * @returns フォーマットされたカウントダウン
   */
  const formatCountdown = useCallback((): string => {
    if (countdownState.isExpired) {
      return "終了";
    }
    if (countdownState.days > 0) {
      return `${countdownState.days}日 ${countdownState.hours}時間`;
    }
    if (countdownState.hours > 0) {
      return `${countdownState.hours}時間 ${countdownState.minutes}分`;
    }
    // 残り1時間未満は「○分」とだけ表示
    return `${countdownState.minutes}分`;
  }, [countdownState]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    // state
    countdownState,
    isUrgent: countdownState.isUrgent,
    isCritical: countdownState.isCritical,
    // function
    formatCountdown,
  };
}
