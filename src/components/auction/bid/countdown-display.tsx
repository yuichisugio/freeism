"use client";

import { type CountdownDisplayProps } from "@/lib/auction/type/types";
import { motion } from "framer-motion";
import { AlertTriangle, Clock } from "lucide-react";

/**
 * カウントダウン表示
 * @param countdownState カウントダウンの状態
 * @param formattedCountdown カウントダウンの表示形式
 * @returns カウントダウン表示
 */
export function CountdownDisplay({ countdownState, countdownAction }: CountdownDisplayProps) {
  // オークション終了時の表示
  if (countdownState.isExpired) {
    return (
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-2 font-medium text-red-500">
        <AlertTriangle className="h-4 w-4" />
        <span>オークション終了</span>
      </motion.div>
    );
  }

  // 残り時間が24時間以内の場合（急ぎ表示）
  if (countdownState.days === 0 && countdownState.hours < 24) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="relative">
        <div className="flex items-center gap-2 font-medium text-red-500">{countdownAction()}</div>
        {countdownState.hours < 1 && <div className="mt-1 text-xs text-red-500">まもなく終了します！</div>}
      </motion.div>
    );
  }

  // 通常表示（余裕がある場合）
  return (
    <div className="text-muted-foreground flex items-center gap-1">
      <Clock className="h-4 w-4" />
      <span>{countdownAction()}</span>
    </div>
  );
}
