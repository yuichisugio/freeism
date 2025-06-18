import type { Session } from "next-auth";
import type { MockedFunction } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cn,
  formatCurrency,
  formatFileSize,
  formatRelativeTime,
  formatTimeDisplay,
  getAuthenticatedSessionUserId,
  getAuthSession,
} from "./utils";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// Next.jsのredirect関数をモック
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// auth関数をモック
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("utils", () => {
  describe("cn", () => {
    it("should merge class names correctly", () => {
      expect(cn("class1", "class2")).toBe("class1 class2");
    });

    it("should handle conditional classes", () => {
      expect(cn("base", true && "conditional", false && "hidden")).toBe("base conditional");
    });

    it("should handle undefined and null values", () => {
      expect(cn("base", undefined, null, "valid")).toBe("base valid");
    });

    it("should merge Tailwind classes correctly", () => {
      // tailwind-mergeの機能をテスト
      expect(cn("px-2", "px-4")).toBe("px-4");
      expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    });

    it("should handle arrays and objects", () => {
      expect(cn(["class1", "class2"], { class3: true, class4: false })).toBe("class1 class2 class3");
    });

    it("should handle empty inputs", () => {
      expect(cn()).toBe("");
      expect(cn("")).toBe("");
    });
  });

  describe("formatCurrency", () => {
    describe("ja-JP locale (default)", () => {
      it("should format positive integers correctly", () => {
        expect(formatCurrency(1000)).toBe("￥1,000");
        expect(formatCurrency(1234567)).toBe("￥1,234,567");
        expect(formatCurrency(1)).toBe("￥1");
        expect(formatCurrency(9)).toBe("￥9");
      });

      it("should format zero correctly", () => {
        expect(formatCurrency(0)).toBe("￥0");
      });

      it("should throw error for negative numbers", () => {
        expect(() => formatCurrency(-1000)).toThrow("formatCurrency: 負の値は受け付けません");
        expect(() => formatCurrency(-1)).toThrow("formatCurrency: 負の値は受け付けません");
      });

      it("should throw error for decimal numbers", () => {
        expect(() => formatCurrency(1000.5)).toThrow("formatCurrency: 整数のみ受け付けます");
        expect(() => formatCurrency(1000.1)).toThrow("formatCurrency: 整数のみ受け付けます");
        expect(() => formatCurrency(0.1)).toThrow("formatCurrency: 整数のみ受け付けます");
        expect(() => formatCurrency(0.9)).toThrow("formatCurrency: 整数のみ受け付けます");
      });

      it("should handle very large integers", () => {
        // JavaScriptの数値精度の限界を考慮した現実的な値でテスト
        // Number.MAX_SAFE_INTEGER (9007199254740991) 以下の値を使用
        const largeNumber = 9007199254740991;
        const result = formatCurrency(largeNumber);
        expect(result).toBe("￥9,007,199,254,740,991");
      });

      it("should throw error for very large numbers", () => {
        expect(() => formatCurrency(9999999999999999999999)).toThrow("formatCurrency: 数値が大きすぎます");
      });
    });

    describe("en-US locale", () => {
      it("should format positive integers correctly", () => {
        expect(formatCurrency(1000, "en-US")).toBe("$1,000.00");
        expect(formatCurrency(1234567, "en-US")).toBe("$1,234,567.00");
        expect(formatCurrency(1, "en-US")).toBe("$1.00");
        expect(formatCurrency(9, "en-US")).toBe("$9.00");
      });

      it("should format zero correctly", () => {
        expect(formatCurrency(0, "en-US")).toBe("$0.00");
      });

      it("should format decimal numbers correctly", () => {
        expect(formatCurrency(1000.5, "en-US")).toBe("$1,000.50");
        expect(formatCurrency(1000.1, "en-US")).toBe("$1,000.10");
        expect(formatCurrency(0.1, "en-US")).toBe("$0.10");
        expect(formatCurrency(0.99, "en-US")).toBe("$0.99");
      });

      it("should throw error for negative numbers", () => {
        expect(() => formatCurrency(-1000, "en-US")).toThrow("formatCurrency: 負の値は受け付けません");
        expect(() => formatCurrency(-1, "en-US")).toThrow("formatCurrency: 負の値は受け付けません");
      });

      it("should throw error for very large numbers", () => {
        expect(() => formatCurrency(9999999999999999999999, "en-US")).toThrow("formatCurrency: 数値が大きすぎます");
      });
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

    describe("ja-JP locale (default)", () => {
      it("should return relative time for recent past dates", () => {
        const thirtySecondsAgo = new Date("2023-04-15T11:59:30Z");
        const thirtySecondsLater = new Date("2023-04-15T12:00:30Z");
        expect(formatRelativeTime(thirtySecondsAgo)).toBe("30秒前");
        expect(formatRelativeTime(thirtySecondsLater)).toBe("30秒後");
      });

      it("should format minutes correctly", () => {
        const fiveMinutesAgo = new Date("2023-04-15T11:55:00Z");
        const fiveMinutesLater = new Date("2023-04-15T12:05:00Z");

        expect(formatRelativeTime(fiveMinutesAgo)).toBe("5分前");
        expect(formatRelativeTime(fiveMinutesLater)).toBe("5分後");
      });

      it("should format hours correctly", () => {
        const twoHoursAgo = new Date("2023-04-15T10:00:00Z");
        const twoHoursLater = new Date("2023-04-15T14:00:00Z");

        expect(formatRelativeTime(twoHoursAgo)).toBe("2時間前");
        expect(formatRelativeTime(twoHoursLater)).toBe("2時間後");
      });

      it("should format days correctly", () => {
        const yesterday = new Date("2023-04-14T12:00:00Z");
        const tomorrow = new Date("2023-04-16T12:00:00Z");
        const threeDaysAgo = new Date("2023-04-12T12:00:00Z");
        const threeDaysLater = new Date("2023-04-18T12:00:00Z");

        expect(formatRelativeTime(yesterday)).toBe("昨日");
        expect(formatRelativeTime(tomorrow)).toBe("明日");
        expect(formatRelativeTime(threeDaysAgo)).toBe("3日前");
        expect(formatRelativeTime(threeDaysLater)).toBe("3日後");
      });

      it("should format weeks correctly", () => {
        const oneWeekAgo = new Date("2023-04-08T12:00:00Z");
        const oneWeekLater = new Date("2023-04-22T12:00:00Z");
        const twoWeeksAgo = new Date("2023-03-31T12:00:00Z");
        const twoWeeksLater = new Date("2023-04-29T12:00:00Z");

        expect(formatRelativeTime(oneWeekAgo)).toBe("先週");
        expect(formatRelativeTime(oneWeekLater)).toBe("来週");
        expect(formatRelativeTime(twoWeeksAgo)).toBe("2週間前");
        expect(formatRelativeTime(twoWeeksLater)).toBe("2週間後");
      });

      it("should format months for distant times", () => {
        const oneMonthAgo = new Date("2023-03-15T12:00:00Z");
        const oneMonthLater = new Date("2023-05-15T12:00:00Z");
        const twoMonthsAgo = new Date("2023-02-15T12:00:00Z");
        const twoMonthsLater = new Date("2023-06-15T12:00:00Z");

        // 実際の実装では月単位で表示される
        expect(formatRelativeTime(oneMonthAgo)).toBe("先月");
        expect(formatRelativeTime(oneMonthLater)).toBe("来月");
        expect(formatRelativeTime(twoMonthsAgo)).toBe("先月");
        expect(formatRelativeTime(twoMonthsLater)).toBe("2か月後");
      });

      it("should format years for distant times", () => {
        const oneYearAgo = new Date("2022-04-15T12:00:00Z");
        const oneYearLater = new Date("2024-04-15T12:00:00Z");
        const twoYearsAgo = new Date("2021-04-15T12:00:00Z");
        const twoYearsLater = new Date("2025-04-15T12:00:00Z");

        expect(formatRelativeTime(oneYearAgo)).toBe("昨年");
        expect(formatRelativeTime(oneYearLater)).toBe("来年");
        expect(formatRelativeTime(twoYearsAgo)).toBe("2年前");
        expect(formatRelativeTime(twoYearsLater)).toBe("2年後");
      });

      it("should handle invalid dates", () => {
        expect(() => formatRelativeTime(new Date("invalid"))).toThrow("formatRelativeTime: 無効な日付です");
      });

      it("should handle edge cases", () => {
        // 境界値のテスト
        const exactly60SecondsAgo = new Date("2023-04-15T11:59:00Z");
        const exactly60MinutesAgo = new Date("2023-04-15T11:00:00Z");
        const exactly24HoursAgo = new Date("2023-04-14T12:00:00Z");

        expect(formatRelativeTime(exactly60SecondsAgo)).toBe("1分前");
        expect(formatRelativeTime(exactly60MinutesAgo)).toBe("1時間前");
        expect(formatRelativeTime(exactly24HoursAgo)).toBe("昨日");
      });
    });

    describe("en-US locale", () => {
      it("should return relative time for recent past dates", () => {
        const recentDate = new Date("2023-04-15T11:59:30Z"); // 30秒前
        // 実際の実装では30秒前は"30 seconds ago"として表示される
        expect(formatRelativeTime(recentDate, "en-US")).toBe("30 seconds ago");
      });

      it("should format minutes correctly", () => {
        const fiveMinutesAgo = new Date("2023-04-15T11:55:00Z");
        const fiveMinutesLater = new Date("2023-04-15T12:05:00Z");

        expect(formatRelativeTime(fiveMinutesAgo, "en-US")).toBe("5 minutes ago");
        expect(formatRelativeTime(fiveMinutesLater, "en-US")).toBe("in 5 minutes");
      });

      it("should format hours correctly", () => {
        const twoHoursAgo = new Date("2023-04-15T10:00:00Z");
        const twoHoursLater = new Date("2023-04-15T14:00:00Z");

        expect(formatRelativeTime(twoHoursAgo, "en-US")).toBe("2 hours ago");
        expect(formatRelativeTime(twoHoursLater, "en-US")).toBe("in 2 hours");
      });

      it("should format days correctly", () => {
        const yesterday = new Date("2023-04-14T12:00:00Z");
        const tomorrow = new Date("2023-04-16T12:00:00Z");
        const threeDaysAgo = new Date("2023-04-12T12:00:00Z");

        expect(formatRelativeTime(yesterday, "en-US")).toBe("yesterday");
        expect(formatRelativeTime(tomorrow, "en-US")).toBe("tomorrow");
        expect(formatRelativeTime(threeDaysAgo, "en-US")).toBe("3 days ago");
      });

      it("should format weeks correctly", () => {
        const oneWeekAgo = new Date("2023-04-08T12:00:00Z");
        const twoWeeksLater = new Date("2023-04-29T12:00:00Z");

        expect(formatRelativeTime(oneWeekAgo, "en-US")).toBe("last week");
        expect(formatRelativeTime(twoWeeksLater, "en-US")).toBe("in 2 weeks");
      });

      it("should format months for distant times", () => {
        const distantPast = new Date("2023-01-01T12:00:00Z");
        const distantFuture = new Date("2023-12-31T12:00:00Z");

        // 実際の実装では月単位で表示される
        expect(formatRelativeTime(distantPast, "en-US")).toBe("3 months ago");
        expect(formatRelativeTime(distantFuture, "en-US")).toBe("in 8 months");
      });
    });
  });

  describe("formatFileSize", () => {
    describe("正常テスト", () => {
      it("should format zero bytes correctly", () => {
        expect(formatFileSize(0)).toBe("0 B");
      });

      it("should format bytes correctly", () => {
        expect(formatFileSize(500)).toBe("500 B");
        expect(formatFileSize(1023)).toBe("1023 B");
      });

      it("should format KB correctly", () => {
        expect(formatFileSize(1024)).toBe("1 KB");
        expect(formatFileSize(1048)).toBe("1 KB");
        expect(formatFileSize(1536)).toBe("1.5 KB");
        expect(formatFileSize(2048)).toBe("2 KB");
        expect(formatFileSize(1048575)).toBe("1024 KB");
      });

      it("should format MB correctly", () => {
        expect(formatFileSize(1048576)).toBe("1 MB");
        expect(formatFileSize(1088576)).toBe("1 MB");
        expect(formatFileSize(1572864)).toBe("1.5 MB");
        expect(formatFileSize(2097152)).toBe("2 MB");
        expect(formatFileSize(1073741823)).toBe("1024 MB");
      });

      it("should format GB correctly", () => {
        expect(formatFileSize(1073741824)).toBe("1 GB");
        expect(formatFileSize(1101004800)).toBe("1 GB");
        expect(formatFileSize(1610612736)).toBe("1.5 GB");
        expect(formatFileSize(2147483648)).toBe("2 GB");
      });

      it("should handle decimal values correctly", () => {
        expect(formatFileSize(1536.5)).toBe("1.5 KB");
        expect(formatFileSize(1572864.7)).toBe("1.5 MB");
        expect(formatFileSize(1610612736.7)).toBe("1.5 GB");
      });

      it("should handle very large numbers", () => {
        expect(formatFileSize(1099511627776)).toBe("1 TB");
        expect(formatFileSize(1125899906842624)).toBe("1 PB");
        expect(formatFileSize(1152921504606846976)).toBe("1 EB");
        expect(formatFileSize(1180591620717411303424)).toBe("1 ZB");
        expect(formatFileSize(1208925819614629174706176)).toBe("1 YB");
      });

      it("should handle very small decimal numbers", () => {
        expect(formatFileSize(0.5)).toBe("0.5 B");
        expect(formatFileSize(0.1)).toBe("0.1 B");
      });
    });

    describe("異常テスト", () => {
      it("should handle negative numbers", () => {
        // 負の値は現実的ではないが、関数の堅牢性をテスト
        expect(() => formatFileSize(-1024)).toThrow("formatFileSize: 負の値は受け付けません。");
      });
    });
  });

  describe("formatTimeDisplay", () => {
    describe("ja-JP locale (default)", () => {
      it("should return '即時' for hours less than 1", () => {
        expect(formatTimeDisplay(0)).toBe("即時");
        expect(formatTimeDisplay(0.5)).toBe("即時");
        expect(formatTimeDisplay(0.9)).toBe("即時");
      });

      it("should format hours correctly for values less than 24", () => {
        expect(formatTimeDisplay(1)).toBe("1時間");
        expect(formatTimeDisplay(12)).toBe("12時間");
        expect(formatTimeDisplay(23)).toBe("23時間");
      });

      it("should format days correctly for values 24 hours or more", () => {
        expect(formatTimeDisplay(24)).toBe("1日");
        expect(formatTimeDisplay(48)).toBe("2日");
        expect(formatTimeDisplay(72)).toBe("3日");
        expect(formatTimeDisplay(168)).toBe("7日");
      });

      it("should handle decimal hours correctly", () => {
        expect(formatTimeDisplay(1.5)).toBe("1.5時間");
        expect(formatTimeDisplay(25.7)).toBe("1日");
        expect(formatTimeDisplay(49.2)).toBe("2日");
      });

      it("should handle large numbers", () => {
        expect(formatTimeDisplay(720)).toBe("30日");
        expect(formatTimeDisplay(8760)).toBe("365日");
      });

      it("should handle negative numbers", () => {
        // 負の値は現実的ではないが、関数の堅牢性をテスト
        expect(() => formatTimeDisplay(-1)).toThrow("formatTimeDisplay: 負の値は受け付けません。");
        expect(() => formatTimeDisplay(-24)).toThrow("formatTimeDisplay: 負の値は受け付けません。");
      });

      it("should handle zero", () => {
        expect(formatTimeDisplay(0)).toBe("即時");
      });

      it("should handle boundary values", () => {
        expect(formatTimeDisplay(0.99)).toBe("即時");
        expect(formatTimeDisplay(1.0)).toBe("1時間");
        expect(formatTimeDisplay(23.99)).toBe("23.99時間");
        expect(formatTimeDisplay(24.0)).toBe("1日");
      });
    });

    describe("en-US locale", () => {
      it("should return 'immediate' for hours less than 1", () => {
        expect(formatTimeDisplay(0, "en-US")).toBe("immediate");
        expect(formatTimeDisplay(0.5, "en-US")).toBe("immediate");
        expect(formatTimeDisplay(0.9, "en-US")).toBe("immediate");
      });

      it("should format hours correctly for values less than 24", () => {
        expect(formatTimeDisplay(1, "en-US")).toBe("1 hour");
        expect(formatTimeDisplay(2, "en-US")).toBe("2 hours");
        expect(formatTimeDisplay(12, "en-US")).toBe("12 hours");
        expect(formatTimeDisplay(23, "en-US")).toBe("23 hours");
      });

      it("should format days correctly for values 24 hours or more", () => {
        expect(formatTimeDisplay(24, "en-US")).toBe("1 day");
        expect(formatTimeDisplay(48, "en-US")).toBe("2 days");
        expect(formatTimeDisplay(72, "en-US")).toBe("3 days");
        expect(formatTimeDisplay(168, "en-US")).toBe("7 days");
      });

      it("should handle decimal hours correctly", () => {
        expect(formatTimeDisplay(1.5, "en-US")).toBe("1.5 hours");
        expect(formatTimeDisplay(25.7, "en-US")).toBe("1 day");
        expect(formatTimeDisplay(49.2, "en-US")).toBe("2 days");
      });

      it("should handle singular vs plural correctly", () => {
        expect(formatTimeDisplay(1, "en-US")).toBe("1 hour");
        expect(formatTimeDisplay(2, "en-US")).toBe("2 hours");
        expect(formatTimeDisplay(24, "en-US")).toBe("1 day");
        expect(formatTimeDisplay(48, "en-US")).toBe("2 days");
      });

      it("should handle negative numbers", () => {
        // 負の値は現実的ではないが、関数の堅牢性をテスト
        expect(() => formatTimeDisplay(-1, "en-US")).toThrow("formatTimeDisplay: 負の値は受け付けません。");
        expect(() => formatTimeDisplay(-24, "en-US")).toThrow("formatTimeDisplay: 負の値は受け付けません。");
      });
    });
  });

  describe("getAuthSession", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return session from auth mock", async () => {
      // @/authのモックから固定のセッション情報が返される
      const { auth } = await import("@/auth");
      const mockAuth = auth as unknown as MockedFunction<() => Promise<Session | null>>;

      mockAuth.mockResolvedValue({
        user: {
          id: "cmb0e9xnm0001mchbj6ler4py",
          email: "test@example.com",
          name: "Test User",
          image: "https://example.com/avatar.jpg",
        },
        expires: "2024-12-31T23:59:59.999Z",
      });

      const result = await getAuthSession();

      expect(result).toStrictEqual({
        user: {
          id: "cmb0e9xnm0001mchbj6ler4py",
          email: "test@example.com",
          name: "Test User",
          image: "https://example.com/avatar.jpg",
        },
        expires: "2024-12-31T23:59:59.999Z",
      });
    });

    it("should return null when no session exists", async () => {
      const { auth } = await import("@/auth");
      const mockAuth = auth as unknown as MockedFunction<() => Promise<Session | null>>;

      mockAuth.mockResolvedValue(null);

      const result = await getAuthSession();
      expect(result).toBeNull();
    });
  });

  describe("getAuthenticatedSessionUserId", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe("正常テスト", () => {
      it("should return user ID when session exists", async () => {
        const { auth } = await import("@/auth");
        const mockAuth = auth as unknown as MockedFunction<() => Promise<Session | null>>;

        mockAuth.mockResolvedValue({
          user: {
            id: "cmb0e9xnm0001mchbj6ler4py",
            email: "test@example.com",
            name: "Test User",
            image: "https://example.com/avatar.jpg",
          },
          expires: "2024-12-31T23:59:59.999Z",
        });

        const result = await getAuthenticatedSessionUserId();
        expect(result).toBe("cmb0e9xnm0001mchbj6ler4py");
      });
    });

    describe("異常テスト", () => {
      it("should call redirect when session does not exist", async () => {
        const { auth } = await import("@/auth");
        const { redirect } = await import("next/navigation");
        const mockAuth = auth as unknown as MockedFunction<() => Promise<Session | null>>;
        const mockRedirect = vi.mocked(redirect);

        mockAuth.mockResolvedValue(null);

        // redirect関数がモックされているため、関数は正常終了する
        const result = await getAuthenticatedSessionUserId();
        expect(result).toBeUndefined();
        expect(mockRedirect).toHaveBeenCalledWith("/auth/signin");
      });

      it("should call redirect when user ID is missing", async () => {
        const { auth } = await import("@/auth");
        const { redirect } = await import("next/navigation");
        const mockAuth = auth as unknown as MockedFunction<() => Promise<Session | null>>;
        const mockRedirect = vi.mocked(redirect);

        mockAuth.mockResolvedValue({
          user: {
            email: "test@example.com",
            name: "Test User",
          },
          expires: "2024-12-31T23:59:59.999Z",
        });

        // redirect関数がモックされているため、関数は正常終了する
        const result = await getAuthenticatedSessionUserId();
        expect(result).toBeUndefined();
        expect(mockRedirect).toHaveBeenCalledWith("/auth/signin");
      });

      it("should call redirect when auth function throws error", async () => {
        const { auth } = await import("@/auth");
        const { redirect } = await import("next/navigation");
        const mockAuth = auth as unknown as MockedFunction<() => Promise<Session | null>>;
        const mockRedirect = vi.mocked(redirect);

        mockAuth.mockRejectedValue(new Error("Auth error"));

        // redirect関数がモックされているため、関数は正常終了する
        const result = await getAuthenticatedSessionUserId();
        expect(result).toBeUndefined();
        expect(mockRedirect).toHaveBeenCalledWith("/auth/signin");
      });
    });
  });
});
