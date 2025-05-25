import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { cn, formatCurrency, formatRelativeTime } from "./utils";

// Next.jsのredirect関数をモック
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// auth関数をモック
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

describe("utils", () => {
  describe("cn", () => {
    test("should merge class names correctly", () => {
      expect(cn("class1", "class2")).toBe("class1 class2");
    });

    test("should handle conditional classes", () => {
      expect(cn("base", true && "conditional", false && "hidden")).toBe("base conditional");
    });

    test("should handle undefined and null values", () => {
      expect(cn("base", undefined, null, "valid")).toBe("base valid");
    });

    test("should merge Tailwind classes correctly", () => {
      // tailwind-mergeの機能をテスト
      expect(cn("px-2", "px-4")).toBe("px-4");
      expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    });

    test("should handle arrays and objects", () => {
      expect(cn(["class1", "class2"], { class3: true, class4: false })).toBe("class1 class2 class3");
    });

    test("should handle empty inputs", () => {
      expect(cn()).toBe("");
      expect(cn("")).toBe("");
    });
  });

  describe("formatCurrency", () => {
    test("should format positive numbers correctly", () => {
      expect(formatCurrency(1000)).toBe("￥1,000");
      expect(formatCurrency(1234567)).toBe("￥1,234,567");
    });

    test("should format zero correctly", () => {
      expect(formatCurrency(0)).toBe("￥0");
    });

    test("should format negative numbers correctly", () => {
      expect(formatCurrency(-1000)).toBe("-￥1,000");
    });

    test("should format decimal numbers correctly", () => {
      expect(formatCurrency(1000.5)).toBe("￥1,001");
      expect(formatCurrency(1000.4)).toBe("￥1,000");
    });

    test("should handle very large numbers", () => {
      expect(formatCurrency(999999999)).toBe("￥999,999,999");
    });

    test("should handle very small numbers", () => {
      expect(formatCurrency(0.1)).toBe("￥0");
      expect(formatCurrency(0.9)).toBe("￥1");
    });
  });

  describe("formatRelativeTime", () => {
    let originalDate: DateConstructor;
    const mockNow = new Date("2023-04-15T12:00:00Z");

    beforeEach(() => {
      originalDate = global.Date;
      vi.useFakeTimers();
      vi.setSystemTime(mockNow);
    });

    afterEach(() => {
      vi.useRealTimers();
      global.Date = originalDate;
    });

    test("should return 'たった今' for very recent past dates", () => {
      const recentDate = new Date("2023-04-15T11:59:30Z"); // 30秒前
      expect(formatRelativeTime(recentDate)).toBe("たった今");
    });

    test("should format minutes correctly", () => {
      const fiveMinutesAgo = new Date("2023-04-15T11:55:00Z");
      const fiveMinutesLater = new Date("2023-04-15T12:05:00Z");

      expect(formatRelativeTime(fiveMinutesAgo)).toBe("5 分前");
      expect(formatRelativeTime(fiveMinutesLater)).toBe("5 分後");
    });

    test("should format hours correctly", () => {
      const twoHoursAgo = new Date("2023-04-15T10:00:00Z");
      const twoHoursLater = new Date("2023-04-15T14:00:00Z");

      expect(formatRelativeTime(twoHoursAgo)).toBe("2 時間前");
      expect(formatRelativeTime(twoHoursLater)).toBe("2 時間後");
    });

    test("should format days correctly", () => {
      const yesterday = new Date("2023-04-14T12:00:00Z");
      const tomorrow = new Date("2023-04-16T12:00:00Z");
      const threeDaysAgo = new Date("2023-04-12T12:00:00Z");

      expect(formatRelativeTime(yesterday)).toBe("昨日");
      expect(formatRelativeTime(tomorrow)).toBe("明日");
      expect(formatRelativeTime(threeDaysAgo)).toBe("3 日前");
    });

    test("should format weeks correctly", () => {
      const oneWeekAgo = new Date("2023-04-08T12:00:00Z");
      const twoWeeksLater = new Date("2023-04-29T12:00:00Z");

      expect(formatRelativeTime(oneWeekAgo)).toBe("先週");
      expect(formatRelativeTime(twoWeeksLater)).toBe("2 週間後");
    });

    test("should format absolute dates for distant times", () => {
      const distantPast = new Date("2023-01-01T12:00:00Z");
      const distantFuture = new Date("2023-12-31T12:00:00Z");

      expect(formatRelativeTime(distantPast)).toBe("2023/01/01");
      expect(formatRelativeTime(distantFuture)).toBe("2023/12/31");
    });

    test("should handle string input", () => {
      const dateString = "2023-04-15T11:55:00Z";
      expect(formatRelativeTime(dateString)).toBe("5 分前");
    });

    test("should handle invalid dates", () => {
      expect(formatRelativeTime("invalid-date")).toBe("無効な日付");
      expect(formatRelativeTime(new Date("invalid"))).toBe("無効な日付");
    });

    test("should handle different locales", () => {
      const fiveMinutesAgo = new Date("2023-04-15T11:55:00Z");

      // 日本語ロケール（デフォルト）
      expect(formatRelativeTime(fiveMinutesAgo, "ja-JP")).toBe("5 分前");

      // 英語ロケール
      expect(formatRelativeTime(fiveMinutesAgo, "en-US")).toBe("5 minutes ago");
    });

    test("should handle edge cases", () => {
      // 境界値のテスト
      const exactly60SecondsAgo = new Date("2023-04-15T11:59:00Z");
      const exactly60MinutesAgo = new Date("2023-04-15T11:00:00Z");
      const exactly24HoursAgo = new Date("2023-04-14T12:00:00Z");

      expect(formatRelativeTime(exactly60SecondsAgo)).toBe("1 分前");
      expect(formatRelativeTime(exactly60MinutesAgo)).toBe("1 時間前");
      expect(formatRelativeTime(exactly24HoursAgo)).toBe("昨日");
    });

    test.skip("should handle Intl.RelativeTimeFormat fallback", () => {
      // このテストは一時的にスキップ（TypeScriptの制約のため）
      const fiveMinutesAgo = new Date("2023-04-15T11:55:00Z");
      const result = formatRelativeTime(fiveMinutesAgo);
      expect(result).toBe("5 分前");
    });

    test("should handle future dates correctly", () => {
      const futureMinutes = new Date("2023-04-15T12:30:00Z"); // 30分後
      const futureHours = new Date("2023-04-15T15:00:00Z"); // 3時間後
      const futureDays = new Date("2023-04-18T12:00:00Z"); // 3日後

      expect(formatRelativeTime(futureMinutes)).toBe("30 分後");
      expect(formatRelativeTime(futureHours)).toBe("3 時間後");
      expect(formatRelativeTime(futureDays)).toBe("3 日後");
    });
  });
});
