/**
 * RFC 3339の日時を`YYYY/MM/DD HH:MM (UTC)`で表示する（管理画面と公開プロフィールで共通、日英共通）。
 * @see ../../docs/specification/v0.1/design-system/design-system.ja.md
 * @see ./format-date-time.test.ts
 */
export function formatUtcDateTime(value: string): string {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getUTCFullYear()}/${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} (UTC)`;
}
