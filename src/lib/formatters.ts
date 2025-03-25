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

/**
 * 日付を指定形式にフォーマットする
 * @param date 日付
 * @returns フォーマットされた日付文字列
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * 相対日時を計算する（例：「3時間前」、「2日前」など）
 * @param date 日付
 * @returns 相対的な時間表現
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - d.getTime());
  const diffMinutes = Math.floor(diffTime / (1000 * 60));
  const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffMinutes < 60) {
    return `${diffMinutes}分${d > now ? "後" : "前"}`;
  } else if (diffHours < 24) {
    return `${diffHours}時間${d > now ? "後" : "前"}`;
  } else if (diffDays < 30) {
    return `${diffDays}日${d > now ? "後" : "前"}`;
  } else {
    return formatDate(d);
  }
}
