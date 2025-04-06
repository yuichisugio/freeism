import type { ClassValue } from "clsx";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Auth.js v5のauth()関数をラップする関数
 * 認証ライブラリの移行を容易にするため
 * @returns 認証セッション情報
 */
export async function getAuthSession(): Promise<Session | null> {
  return await auth();
}

/**
 * 名前から頭文字を取得する
 * @param name 名前
 * @returns 頭文字 (最大2文字)
 */
export function GetInitialsFromName(name: string): string {
  if (!name) return "";

  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return name.substring(0, 2).toUpperCase();
  }

  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * 日付を相対時間形式に変換する
 * @param date 対象の日付
 * @returns 相対時間文字列 (例: "3分前", "昨日", "2日前")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return "たった今";
  } else if (minutes < 60) {
    return `${minutes}分前`;
  } else if (hours < 24) {
    return `${hours}時間前`;
  } else if (days === 1) {
    return "昨日";
  } else if (days < 7) {
    return `${days}日前`;
  } else {
    // 日付をフォーマット (例: 2023/04/01)
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
  }
}
