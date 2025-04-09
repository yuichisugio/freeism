import type { ClassValue } from "clsx";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * クラス名をマージする
 * @param inputs クラス名
 * @returns マージされたクラス名
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Auth.js v5のauth()関数をラップする関数
 * 認証ライブラリの移行を容易にするため
 * layout.tsxなどSessionごと欲しい場合に使用する
 * @returns 認証セッション情報
 */
export async function getAuthSession(): Promise<Session | null> {
  return await auth();
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * セッションのユーザーIDを取得する
 * 認証ライブラリの移行を容易にするため
 * sessionのuserIdが欲しい時に使用する
 * @returns ユーザーID
 */
export async function getAuthenticatedSessionUserId(): Promise<string> {
  try {
    // セッション情報を取得
    const session = await auth();

    // セッション情報が取得できない場合はエラーを投げる
    if (!session?.user?.id) {
      throw new Error("utils.ts_getSessionUserId_ユーザーIDが取得できませんでした");
    }

    const sessionUserId = session.user.id;

    // セッション情報が取得できた場合はユーザーIDを返す
    return sessionUserId;

    // エラーが発生した場合はエラーを投げる
  } catch (error) {
    console.error(error);
    throw new Error("utils.ts_getSessionUserId_ユーザーIDが取得できませんでした");
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 金額を通貨形式にフォーマットする
 * @param amount 金額
 * @returns フォーマットされた金額文字列
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    minimumFractionDigits: 0,
  }).format(amount);
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 日付を指定されたロケールに基づいた相対時間形式または絶対日付形式に変換します。
 *
 * @param date 変換対象の日付 (Dateオブジェクトまたは日付文字列)。
 * @param locale ロケール指定 (例: 'ja-JP')。デフォルトは 'ja-JP'。
 * @returns 相対時間文字列 (例: "たった今", "3分前", "明日", "2週間後", "2023/04/01")。
 * 無効な日付が入力された場合は "無効な日付" を返します。
 */
export function formatRelativeTime(date: Date | string, locale = "ja-JP"): string {
  const inputDate = typeof date === "string" ? new Date(date) : date;

  // 入力された日付が有効かチェック
  if (isNaN(inputDate.getTime())) {
    return "無効な日付";
  }

  const now = new Date();
  const diff = now.getTime() - inputDate.getTime(); // ミリ秒単位の差分
  const isPast = diff > 0; // 過去かどうか
  const absDiff = Math.abs(diff); // 差分の絶対値

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7); // 週数を計算

  // Intl.RelativeTimeFormatを使用して相対時間をフォーマット
  // Note: ブラウザやNode.jsのバージョンによっては対応していない場合があります
  try {
    // numeric: 'auto' は "昨日", "明日", "先週", "来週" のような表現を可能にする
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

    // 60秒未満の場合
    if (seconds < 60 && isPast) {
      return "たった今"; // "just now" は特別扱い

      // 60分未満の場合
    } else if (minutes < 60) {
      return rtf.format(isPast ? -minutes : minutes, "minute");

      // 24時間未満の場合
    } else if (hours < 24) {
      return rtf.format(isPast ? -hours : hours, "hour");

      // 7日未満の場合
    } else if (days < 7) {
      return rtf.format(isPast ? -days : days, "day");

      // 4週間未満の場合
    } else if (weeks < 4) {
      return rtf.format(isPast ? -weeks : weeks, "week");
    }
    // 4週間以上経過した場合は、以下の日付フォーマット処理に進む
  } catch (e) {
    // Intl.RelativeTimeFormat が使えない環境向けのフォールバック (簡易版)
    console.warn("Intl.RelativeTimeFormat is not supported in this environment. Falling back to basic formatting.", e);
    const suffix = isPast ? "前" : "後";
    if (seconds < 60 && isPast) {
      return "たった今";
    } else if (minutes < 60) {
      return `${minutes}分${suffix}`;
    } else if (hours < 24) {
      return `${hours}時間${suffix}`;
    } else if (days === 1) {
      return isPast ? "昨日" : "明日";
    } else if (days < 7) {
      return `${days}日${suffix}`;
    } else if (weeks < 4) {
      // 1週間以上4週間未満の場合
      return `${weeks}週間${suffix}`;
    }
    // 4週間以上経過した場合は、以下の日付フォーマット処理に進む
  }

  // 4週間以上経過した場合、またはIntlが使えない場合のフォールバック
  const year = inputDate.getFullYear();
  const month = String(inputDate.getMonth() + 1).padStart(2, "0");
  const day = String(inputDate.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
