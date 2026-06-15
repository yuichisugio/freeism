import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { usePagination } from "./use-pagination";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// 各テスト前にモックをリセット
beforeEach(() => {
  vi.clearAllMocks();
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("usePagination", () => {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系", () => {
    test.each([
      [
        "基本的なケース（最初のページ）",
        { currentPage: 1, totalPages: 5, maxPageToShow: 10 },
        {
          pageNumbers: [1, 2, 3, 4, 5],
          hasPreviousPage: false,
          hasNextPage: true,
          totalPages: 5,
          isFirstPage: true,
          isLastPage: false,
        },
      ],
      [
        "基本的なケース（2ページ目）",
        { currentPage: 2, totalPages: 5, maxPageToShow: 10 },
        {
          pageNumbers: [1, 2, 3, 4, 5],
          hasPreviousPage: true,
          hasNextPage: true,
          totalPages: 5,
          isFirstPage: false,
          isLastPage: false,
        },
      ],
      [
        "中間ページ",
        { currentPage: 3, totalPages: 5, maxPageToShow: 10 },
        {
          pageNumbers: [1, 2, 3, 4, 5],
          hasPreviousPage: true,
          hasNextPage: true,
          totalPages: 5,
          isFirstPage: false,
          isLastPage: false,
        },
      ],
      [
        "最後のページ",
        { currentPage: 5, totalPages: 5, maxPageToShow: 10 },
        {
          pageNumbers: [1, 2, 3, 4, 5],
          hasPreviousPage: true,
          hasNextPage: false,
          totalPages: 5,
          isFirstPage: false,
          isLastPage: true,
        },
      ],
      [
        "単一ページ",
        { currentPage: 1, totalPages: 1, maxPageToShow: 10 },
        {
          pageNumbers: [1],
          hasPreviousPage: false,
          hasNextPage: false,
          totalPages: 1,
          isFirstPage: true,
          isLastPage: true,
        },
      ],
      [
        "全ページ数がmaxPageToShowと同じ",
        { currentPage: 5, totalPages: 10, maxPageToShow: 10 },
        {
          pageNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          hasPreviousPage: true,
          hasNextPage: true,
          totalPages: 10,
          isFirstPage: false,
          isLastPage: false,
        },
      ],
      [
        "maxPageToShowより総ページ数が少ない",
        { currentPage: 3, totalPages: 5, maxPageToShow: 20 },
        {
          pageNumbers: [1, 2, 3, 4, 5],
          hasPreviousPage: true,
          hasNextPage: true,
          totalPages: 5,
          isFirstPage: false,
          isLastPage: false,
        },
      ],
      [
        "最初のページ（省略記号あり）",
        { currentPage: 1, totalPages: 20, maxPageToShow: 10 },
        {
          pageNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, -2, 20],
          hasPreviousPage: false,
          hasNextPage: true,
          totalPages: 20,
          isFirstPage: true,
          isLastPage: false,
        },
      ],
      [
        "中間ページ（両端に省略記号）",
        { currentPage: 10, totalPages: 20, maxPageToShow: 10 },
        {
          pageNumbers: [1, -1, 7, 8, 9, 10, 11, 12, -2, 20],
          hasPreviousPage: true,
          hasNextPage: true,
          totalPages: 20,
          isFirstPage: false,
          isLastPage: false,
        },
      ],
      [
        "終盤のページ（前に省略記号）",
        { currentPage: 18, totalPages: 20, maxPageToShow: 10 },
        {
          pageNumbers: [1, -1, 12, 13, 14, 15, 16, 17, 18, 19, 20],
          hasPreviousPage: true,
          hasNextPage: true,
          totalPages: 20,
          isFirstPage: false,
          isLastPage: false,
        },
      ],
      [
        "境界値（前半の境界）",
        { currentPage: 5, totalPages: 20, maxPageToShow: 10 },
        {
          pageNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, -2, 20],
          hasPreviousPage: true,
          hasNextPage: true,
          totalPages: 20,
          isFirstPage: false,
          isLastPage: false,
        },
      ],
      [
        "境界値（後半の境界）",
        { currentPage: 16, totalPages: 20, maxPageToShow: 10 },
        {
          pageNumbers: [1, -1, 12, 13, 14, 15, 16, 17, 18, 19, 20],
          hasPreviousPage: true,
          hasNextPage: true,
          totalPages: 20,
          isFirstPage: false,
          isLastPage: false,
        },
      ],
      [
        "現在ページが総ページ数と同じ",
        { currentPage: 10, totalPages: 10, maxPageToShow: 10 },
        {
          pageNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          hasPreviousPage: true,
          hasNextPage: false,
          totalPages: 10,
          isFirstPage: false,
          isLastPage: true,
        },
      ],
      [
        "大きな数値",
        { currentPage: 1000, totalPages: 2000, maxPageToShow: 10 },
        {
          pageNumbers: [1, -1, 997, 998, 999, 1000, 1001, 1002, -2, 2000],
          hasPreviousPage: true,
          hasNextPage: true,
          totalPages: 2000,
          isFirstPage: false,
          isLastPage: false,
        },
      ],
      [
        "開始付近の大きな総ページ数",
        { currentPage: 2, totalPages: 100, maxPageToShow: 10 },
        {
          pageNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, -2, 100],
          hasPreviousPage: true,
          hasNextPage: true,
          totalPages: 100,
          isFirstPage: false,
          isLastPage: false,
        },
      ],
      [
        "終了付近の大きな総ページ数",
        { currentPage: 99, totalPages: 100, maxPageToShow: 10 },
        {
          pageNumbers: [1, -1, 92, 93, 94, 95, 96, 97, 98, 99, 100],
          hasPreviousPage: true,
          hasNextPage: true,
          totalPages: 100,
          isFirstPage: false,
          isLastPage: false,
        },
      ],
      [
        "maxPageToShow最小値（1）",
        { currentPage: 5, totalPages: 10, maxPageToShow: 1 },
        {
          pageNumbers: [1, -1, -2, 10],
          hasPreviousPage: true,
          hasNextPage: true,
          totalPages: 10,
          isFirstPage: false,
          isLastPage: false,
        },
      ],
      [
        "maxPageToShow小さい値（4）",
        { currentPage: 5, totalPages: 10, maxPageToShow: 4 },
        {
          pageNumbers: [1, -1, -2, 10],
          hasPreviousPage: true,
          hasNextPage: true,
          totalPages: 10,
          isFirstPage: false,
          isLastPage: false,
        },
      ],
      [
        "省略記号配置の境界（startPageが2）",
        { currentPage: 6, totalPages: 15, maxPageToShow: 8 },
        {
          pageNumbers: [1, -1, 4, 5, 6, 7, -2, 15],
          hasPreviousPage: true,
          hasNextPage: true,
          totalPages: 15,
          isFirstPage: false,
          isLastPage: false,
        },
      ],
      [
        "省略記号配置の境界（endPageがtotalPages-1）",
        { currentPage: 10, totalPages: 15, maxPageToShow: 8 },
        {
          pageNumbers: [1, -1, 8, 9, 10, 11, -2, 15],
          hasPreviousPage: true,
          hasNextPage: true,
          totalPages: 15,
          isFirstPage: false,
          isLastPage: false,
        },
      ],
    ])("should return correct pagination data for %s", (_, props, expected) => {
      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current).toStrictEqual(expected);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系", () => {
    test.each([
      ["負のcurrentPage", { currentPage: -1, totalPages: 5, maxPageToShow: 10 }],
      ["負のtotalPages", { currentPage: 1, totalPages: -5, maxPageToShow: 10 }],
      ["負のmaxPageToShow", { currentPage: 1, totalPages: 5, maxPageToShow: -10 }],
      ["currentPageがゼロ", { currentPage: 0, totalPages: 5, maxPageToShow: 10 }],
      ["totalPagesがゼロ", { currentPage: 1, totalPages: 0, maxPageToShow: 10 }],
      ["maxPageToShowがゼロ", { currentPage: 1, totalPages: 5, maxPageToShow: 0 }],
      ["非整数値のcurrentPage", { currentPage: 1.5, totalPages: 5, maxPageToShow: 10 }],
      ["非整数値のtotalPages", { currentPage: 1, totalPages: 5.7, maxPageToShow: 10 }],
      ["非整数値のmaxPageToShow", { currentPage: 1, totalPages: 5, maxPageToShow: 10.3 }],
      ["currentPageが上限値を超える", { currentPage: Number.MAX_SAFE_INTEGER + 1, totalPages: 5, maxPageToShow: 10 }],
      ["totalPagesが上限値を超える", { currentPage: 1, totalPages: Number.MAX_SAFE_INTEGER + 1, maxPageToShow: 10 }],
      ["maxPageToShowが上限値を超える", { currentPage: 1, totalPages: 5, maxPageToShow: Number.MAX_SAFE_INTEGER + 1 }],
      ["currentPageが下限値を超える", { currentPage: Number.MIN_SAFE_INTEGER - 1, totalPages: 5, maxPageToShow: 10 }],
      ["totalPagesが下限値を超える", { currentPage: 1, totalPages: Number.MIN_SAFE_INTEGER - 1, maxPageToShow: 10 }],
      ["maxPageToShowが下限値を超える", { currentPage: 1, totalPages: 5, maxPageToShow: Number.MIN_SAFE_INTEGER - 1 }],
      [
        "undefined props",
        {
          currentPage: undefined as unknown as number,
          totalPages: undefined as unknown as number,
          maxPageToShow: undefined as unknown as number,
        },
      ],
      [
        "null props",
        {
          currentPage: null as unknown as number,
          totalPages: null as unknown as number,
          maxPageToShow: null as unknown as number,
        },
      ],
      [
        "string props",
        {
          currentPage: "5" as unknown as number,
          totalPages: "10" as unknown as number,
          maxPageToShow: "8" as unknown as number,
        },
      ],
      [
        "boolean props",
        {
          currentPage: true as unknown as number,
          totalPages: false as unknown as number,
          maxPageToShow: true as unknown as number,
        },
      ],
      [
        "Infinityの値",
        {
          currentPage: Infinity,
          totalPages: 5,
          maxPageToShow: 10,
        },
      ],
      [
        "NaNの値",
        {
          currentPage: NaN,
          totalPages: 5,
          maxPageToShow: 10,
        },
      ],
    ])("should throw error for %s", (_, props) => {
      // Act & Assert
      expect(() => {
        renderHook(() => usePagination(props));
      }).toThrow("ページネーションフックのプロップが無効です。");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("パフォーマンステスト", () => {
    test.each([
      [
        "大きな数値の効率的な処理",
        {
          currentPage: 50000,
          totalPages: 100000,
          maxPageToShow: 10,
        },
        {
          expectedLength: 10,
          expectedTotalPages: 100000,
          maxExecutionTime: 100,
        },
      ],
      [
        "非常に大きな数値の効率的な処理",
        {
          currentPage: 500000,
          totalPages: 1000000,
          maxPageToShow: 15,
        },
        {
          expectedLength: 15,
          expectedTotalPages: 1000000,
          maxExecutionTime: 150,
        },
      ],
    ])("should handle %s efficiently", (_, props, expected) => {
      // Act
      const startTime = performance.now();
      const { result } = renderHook(() => usePagination(props));
      const endTime = performance.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(expected.maxExecutionTime);
      expect(result.current.pageNumbers).toHaveLength(expected.expectedLength);
      expect(result.current.totalPages).toBe(expected.expectedTotalPages);
    });

    test("should memoize results correctly", () => {
      // Arrange
      const props = {
        currentPage: 5,
        totalPages: 10,
        maxPageToShow: 10,
      };

      // Act
      const { result, rerender } = renderHook(() => usePagination(props));
      const firstResult = result.current;

      // 同じpropsで再レンダリング
      rerender();
      const secondResult = result.current;

      // Assert。同じ参照IDなら同じ結果が返ってくることを確認
      expect(firstResult).toStrictEqual(secondResult);
    });
  });
});
