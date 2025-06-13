import type { ClassValue } from "clsx";
import type { Session } from "next-auth";
import { redirect } from "next/navigation";
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
 * サーバーコンポーネント専用
 * @returns ユーザーID
 */
export async function getAuthenticatedSessionUserId(): Promise<string> {
  try {
    // セッション情報を取得
    const session = await auth();

    // セッション情報が取得できない場合はエラーを投げる
    if (!session?.user?.id) {
      throw new Error("utils.ts_getAuthenticatedSessionUserId_ユーザーIDが取得できませんでした");
    }

    const sessionUserId = session.user.id;

    // セッション情報が取得できた場合はユーザーIDを返す
    return sessionUserId;

    // エラーが発生した場合はログイン画面にリダイレクト
  } catch (error) {
    console.error("utils.ts_getAuthenticatedSessionUserId_リダイレクトが発生しました", error);
    redirect("/auth/signin");
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 金額を通貨形式にフォーマットする
 * @param amount 金額（正の整数のみ）
 * @param locale ロケール指定（デフォルト: "ja-JP"）
 * @returns フォーマットされた金額文字列
 * @throws {Error} 負の値または小数点を含む値が渡された場合
 */
export function formatCurrency(amount: number, locale: "ja-JP" | "en-US" = "ja-JP"): string {
  // 負の値をチェック
  if (amount < 0) {
    throw new Error("formatCurrency: 負の値は受け付けません");
  }

  // 小数点を含む値をチェック（日本円の場合のみ）
  if (!Number.isInteger(amount) && locale === "ja-JP") {
    throw new Error("formatCurrency: 整数のみ受け付けます");
  }

  if (amount > Number.MAX_SAFE_INTEGER) {
    throw new Error("formatCurrency: 数値が大きすぎます");
  }

  // Intl.NumberFormatを使用して通貨形式にフォーマット
  return new Intl.NumberFormat(locale, {
    style: "currency", // 通貨形式にフォーマットする。
    currency: locale === "ja-JP" ? "JPY" : "USD", // 通貨の種類。ドルはUSD、円はJPY。
    minimumFractionDigits: locale === "ja-JP" ? 0 : 2, // 小数点以下の桁数。ドルは2桁、円は0桁。
  }).format(amount);
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 日付を指定されたロケールに基づいた相対時間形式に変換します。
 * @param inputDate 変換対象の日付 (Dateオブジェクト)。
 * @param locale ロケール指定 (例: 'ja-JP')。デフォルトは 'ja-JP'。
 * @returns 相対時間文字列 (例: "たった今", "3分前", "明日", "2週間後", "2023/04/01")。
 * @throws {Error} 無効な日付が入力された場合
 */
export function formatRelativeTime(inputDate: Date, locale: "ja-JP" | "en-US" = "ja-JP"): string {
  // 入力された日付が有効かチェック
  if (isNaN(inputDate.getTime())) {
    throw new Error("formatRelativeTime: 無効な日付です");
  }

  const now = new Date(); // 現在の日付
  const diff = now.getTime() - inputDate.getTime(); // ミリ秒単位の差分
  const isPast = diff > 0; // 過去かどうか
  const absDiff = Math.abs(diff); // 差分の絶対値

  const seconds = Math.floor(absDiff / 1000); // 秒数。floorは小数点以下を切り捨てる
  const minutes = Math.floor(seconds / 60); // 分
  const hours = Math.floor(minutes / 60); // 時間
  const days = Math.floor(hours / 24); // 日数
  const weeks = Math.floor(days / 7); // 週数
  const months = Math.floor(days / 30); // 月数
  const years = Math.floor(days / 365); // 年数

  // Intl.RelativeTimeFormatを使用して相対時間をフォーマット
  // Note: ブラウザやNode.jsのバージョンによっては対応していない場合があります
  // numeric: 'auto' は "昨日", "明日", "先週", "来週" のような表現を可能にする
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  // 60秒未満で、過去の場合
  if (seconds < 60 && isPast) {
    return rtf.format(isPast ? -seconds : seconds, "second");

    // 60分未満の場合
  } else if (minutes < 60) {
    return rtf.format(isPast ? -minutes : minutes, "minute");

    // 24時間未満の場合
  } else if (hours < 24) {
    return rtf.format(isPast ? -hours : hours, "hour");

    // 7日未満の場合
  } else if (days < 7) {
    return rtf.format(isPast ? -days : days, "day");

    // 6週間未満の場合
  } else if (weeks < 6) {
    return rtf.format(isPast ? -weeks : weeks, "week");

    // 12ヶ月未満の場合
  } else if (months < 12) {
    return rtf.format(isPast ? -months : months, "month");

    // 12ヶ月以上経過した場合
  } else {
    return rtf.format(isPast ? -years : years, "year");
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ファイルサイズをフォーマットする
 * @param bytes ファイルサイズ
 * @returns フォーマットされたファイルサイズ
 */
export function formatFileSize(bytes: number): string {
  // 負の値の場合はエラーを投げる
  // ファイルサイズが負の値になることは現実的にありえないため、エラーを投げる。
  const isNegative = bytes < 0;
  if (isNegative) throw new Error("formatFileSize: 負の値は受け付けません。");

  // 0の場合は0 Bytesを返す
  // 後の対数計算では、0の対数は定義されないため、この特別処理が必要になります。
  if (bytes === 0) return "0 Bytes";

  // 1024を底とする対数を計算
  // 1024は2の10乗であるため、1024を底とする対数を計算することで、ファイルサイズを1024で割ることができる。
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  // 対数を計算。Math.logは底をeとする対数を計算する。
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // インデックスが配列の範囲内になるように制限（負の値も0にクランプ）
  const sizeIndex = Math.max(0, Math.min(i, sizes.length - 1));

  // フォーマットされたサイズを計算
  const formattedSize = parseFloat((bytes / Math.pow(k, sizeIndex)).toFixed(1));

  // 結果を返す
  const result = formattedSize + " " + sizes[sizeIndex];

  return result;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 時間範囲の表示
 * @param hours 時間数
 * @param locale ロケール指定（デフォルト: "ja-JP"）
 * @returns フォーマットされた時間表示文字列
 */
export function formatTimeDisplay(hours: number, locale: "ja-JP" | "en-US" = "ja-JP"): string {
  // 負の値の場合はエラーを投げる
  if (hours < 0) throw new Error("formatTimeDisplay: 負の値は受け付けません。");

  // 1時間未満の場合
  if (hours < 1) return locale === "ja-JP" ? "即時" : "immediate";

  // 1時間以上24時間未満の場合
  if (hours < 24) {
    return locale === "ja-JP" ? `${hours}時間` : `${hours} hour${hours !== 1 ? "s" : ""}`;
  }

  // 24時間以上の場合
  const days = Math.floor(hours / 24);

  // 日数をフォーマット
  return locale === "ja-JP" ? `${days}日` : `${days} day${days !== 1 ? "s" : ""}`;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
