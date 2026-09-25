import type { Language } from "./language";

/**
 * RFC 3339の日時を表示言語の形式で表示する。
 */
export function formatDateTime(value: string, language: Language): string {
  return new Intl.DateTimeFormat(language === "ja" ? "ja-JP" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
