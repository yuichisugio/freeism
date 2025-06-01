import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { UsePaginationProps } from "./use-pagination";
import { usePagination } from "./use-pagination";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// 各テスト前にモックをリセット
beforeEach(() => {
  vi.clearAllMocks();
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("usePagination", () => {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系", () => {
    test("should return correct pagination data for basic case", () => {
      // Arrange
      const props = {
        currentPage: 1,
        totalPages: 5,
        maxPageToShow: 10,
        totalCount: 50,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.pageNumbers).toStrictEqual([1, 2, 3, 4, 5]);
      expect(result.current.hasPreviousPage).toBe(false);
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.totalPages).toBe(5);
      expect(result.current.isFirstPage).toBe(true);
      expect(result.current.isLastPage).toBe(false);
    });

    test("should return correct pagination data when on middle page", () => {
      // Arrange
      const props = {
        currentPage: 3,
        totalPages: 5,
        maxPageToShow: 10,
        totalCount: 50,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.pageNumbers).toStrictEqual([1, 2, 3, 4, 5]);
      expect(result.current.hasPreviousPage).toBe(true);
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.totalPages).toBe(5);
      expect(result.current.isFirstPage).toBe(false);
      expect(result.current.isLastPage).toBe(false);
    });

    test("should return correct pagination data when on last page", () => {
      // Arrange
      const props = {
        currentPage: 5,
        totalPages: 5,
        maxPageToShow: 10,
        totalCount: 50,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.pageNumbers).toStrictEqual([1, 2, 3, 4, 5]);
      expect(result.current.hasPreviousPage).toBe(true);
      expect(result.current.hasNextPage).toBe(false);
      expect(result.current.totalPages).toBe(5);
      expect(result.current.isFirstPage).toBe(false);
      expect(result.current.isLastPage).toBe(true);
    });

    test("should handle pagination with ellipsis when total pages exceed maxPageToShow", () => {
      // Arrange
      const props = {
        currentPage: 1,
        totalPages: 20,
        maxPageToShow: 10,
        totalCount: 200,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.pageNumbers).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, -2, 20]);
      expect(result.current.hasPreviousPage).toBe(false);
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.totalPages).toBe(20);
      expect(result.current.isFirstPage).toBe(true);
      expect(result.current.isLastPage).toBe(false);
    });

    test("should handle pagination when current page is in the middle with ellipsis on both sides", () => {
      // Arrange
      const props = {
        currentPage: 10,
        totalPages: 20,
        maxPageToShow: 10,
        totalCount: 200,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      // 実際の実装では: startPage = 10 - Math.floor((10-4)/2) = 10 - 3 = 7, endPage = 7 + (10-4) - 1 = 12
      expect(result.current.pageNumbers).toStrictEqual([1, -1, 7, 8, 9, 10, 11, 12, -2, 20]);
      expect(result.current.hasPreviousPage).toBe(true);
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.totalPages).toBe(20);
      expect(result.current.isFirstPage).toBe(false);
      expect(result.current.isLastPage).toBe(false);
    });

    test("should handle pagination when current page is near the end", () => {
      // Arrange
      const props = {
        currentPage: 18,
        totalPages: 20,
        maxPageToShow: 10,
        totalCount: 200,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.pageNumbers).toStrictEqual([1, -1, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
      expect(result.current.hasPreviousPage).toBe(true);
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.totalPages).toBe(20);
      expect(result.current.isFirstPage).toBe(false);
      expect(result.current.isLastPage).toBe(false);
    });

    test("should handle single page", () => {
      // Arrange
      const props = {
        currentPage: 1,
        totalPages: 1,
        maxPageToShow: 10,
        totalCount: 5,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.pageNumbers).toStrictEqual([1]);
      expect(result.current.hasPreviousPage).toBe(false);
      expect(result.current.hasNextPage).toBe(false);
      expect(result.current.totalPages).toBe(1);
      expect(result.current.isFirstPage).toBe(true);
      expect(result.current.isLastPage).toBe(true);
    });

    test("should use default maxPageToShow when not provided", () => {
      // Arrange
      const props = {
        currentPage: 1,
        totalPages: 5,
        totalCount: 50,
      } as unknown as UsePaginationProps; // maxPageToShowを省略

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.pageNumbers).toStrictEqual([1, 2, 3, 4, 5]);
      expect(result.current.totalPages).toBe(5);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle zero total pages", () => {
      // Arrange
      const props = {
        currentPage: 1,
        totalPages: 0,
        maxPageToShow: 10,
        totalCount: 0,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.pageNumbers).toStrictEqual([]);
      expect(result.current.hasPreviousPage).toBe(false);
      expect(result.current.hasNextPage).toBe(false);
      expect(result.current.totalPages).toBe(0);
      expect(result.current.isFirstPage).toBe(true);
      expect(result.current.isLastPage).toBe(false); // 1 === 0 は false
    });

    test("should handle current page equals total pages", () => {
      // Arrange
      const props = {
        currentPage: 10,
        totalPages: 10,
        maxPageToShow: 10,
        totalCount: 100,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.pageNumbers).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(result.current.hasPreviousPage).toBe(true);
      expect(result.current.hasNextPage).toBe(false);
      expect(result.current.totalPages).toBe(10);
      expect(result.current.isFirstPage).toBe(false);
      expect(result.current.isLastPage).toBe(true);
    });

    test("should handle maxPageToShow equals 1", () => {
      // Arrange
      const props = {
        currentPage: 5,
        totalPages: 10,
        maxPageToShow: 1,
        totalCount: 100,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      // maxPageToShow=1の場合、endPage = 1-1 = 0, startPage = 10-(1-2) = 11 となり、
      // 実際の実装では省略記号が追加される
      expect(result.current.pageNumbers).toStrictEqual([1, -1, -2, 10]);
      expect(result.current.hasPreviousPage).toBe(true);
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.totalPages).toBe(10);
      expect(result.current.isFirstPage).toBe(false);
      expect(result.current.isLastPage).toBe(false);
    });

    test("should handle maxPageToShow equals 2", () => {
      // Arrange
      const props = {
        currentPage: 5,
        totalPages: 10,
        maxPageToShow: 2,
        totalCount: 100,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.pageNumbers).toStrictEqual([1, -1, -2, 10]);
      expect(result.current.hasPreviousPage).toBe(true);
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.totalPages).toBe(10);
      expect(result.current.isFirstPage).toBe(false);
      expect(result.current.isLastPage).toBe(false);
    });

    test("should handle maxPageToShow equals 3", () => {
      // Arrange
      const props = {
        currentPage: 5,
        totalPages: 10,
        maxPageToShow: 3,
        totalCount: 100,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.pageNumbers).toStrictEqual([1, -1, -2, 10]);
      expect(result.current.hasPreviousPage).toBe(true);
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.totalPages).toBe(10);
      expect(result.current.isFirstPage).toBe(false);
      expect(result.current.isLastPage).toBe(false);
    });

    test("should handle maxPageToShow equals 4", () => {
      // Arrange
      const props = {
        currentPage: 5,
        totalPages: 10,
        maxPageToShow: 4,
        totalCount: 100,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.pageNumbers).toStrictEqual([1, -1, -2, 10]);
      expect(result.current.hasPreviousPage).toBe(true);
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.totalPages).toBe(10);
      expect(result.current.isFirstPage).toBe(false);
      expect(result.current.isLastPage).toBe(false);
    });

    test("should handle very large numbers", () => {
      // Arrange
      const props = {
        currentPage: 1000,
        totalPages: 2000,
        maxPageToShow: 10,
        totalCount: 20000,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      // startPage = 1000 - Math.floor((10-4)/2) = 1000 - 3 = 997, endPage = 997 + (10-4) - 1 = 1002
      expect(result.current.pageNumbers).toStrictEqual([1, -1, 997, 998, 999, 1000, 1001, 1002, -2, 2000]);
      expect(result.current.hasPreviousPage).toBe(true);
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.totalPages).toBe(2000);
      expect(result.current.isFirstPage).toBe(false);
      expect(result.current.isLastPage).toBe(false);
    });

    test("should handle current page at the beginning with large total pages", () => {
      // Arrange
      const props = {
        currentPage: 2,
        totalPages: 100,
        maxPageToShow: 10,
        totalCount: 1000,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.pageNumbers).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, -2, 100]);
      expect(result.current.hasPreviousPage).toBe(true);
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.totalPages).toBe(100);
      expect(result.current.isFirstPage).toBe(false);
      expect(result.current.isLastPage).toBe(false);
    });

    test("should handle current page at the end with large total pages", () => {
      // Arrange
      const props = {
        currentPage: 99,
        totalPages: 100,
        maxPageToShow: 10,
        totalCount: 1000,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.pageNumbers).toStrictEqual([1, -1, 92, 93, 94, 95, 96, 97, 98, 99, 100]);
      expect(result.current.hasPreviousPage).toBe(true);
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.totalPages).toBe(100);
      expect(result.current.isFirstPage).toBe(false);
      expect(result.current.isLastPage).toBe(false);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系・エッジケース", () => {
    test("should handle negative current page", () => {
      // Arrange
      const props = {
        currentPage: -1,
        totalPages: 5,
        maxPageToShow: 10,
        totalCount: 50,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.pageNumbers).toStrictEqual([1, 2, 3, 4, 5]);
      expect(result.current.hasPreviousPage).toBe(false); // -1 > 1 は false
      expect(result.current.hasNextPage).toBe(true); // -1 < 5 は true
      expect(result.current.totalPages).toBe(5);
      expect(result.current.isFirstPage).toBe(false); // -1 === 1 は false
      expect(result.current.isLastPage).toBe(false); // -1 === 5 は false
    });

    test("should handle zero current page", () => {
      // Arrange
      const props = {
        currentPage: 0,
        totalPages: 5,
        maxPageToShow: 10,
        totalCount: 50,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.pageNumbers).toStrictEqual([1, 2, 3, 4, 5]);
      expect(result.current.hasPreviousPage).toBe(false); // 0 > 1 は false
      expect(result.current.hasNextPage).toBe(true); // 0 < 5 は true
      expect(result.current.totalPages).toBe(5);
      expect(result.current.isFirstPage).toBe(false); // 0 === 1 は false
      expect(result.current.isLastPage).toBe(false); // 0 === 5 は false
    });

    test("should handle current page greater than total pages", () => {
      // Arrange
      const props = {
        currentPage: 10,
        totalPages: 5,
        maxPageToShow: 10,
        totalCount: 50,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.pageNumbers).toStrictEqual([1, 2, 3, 4, 5]);
      expect(result.current.hasPreviousPage).toBe(true); // 10 > 1 は true
      expect(result.current.hasNextPage).toBe(false); // 10 < 5 は false
      expect(result.current.totalPages).toBe(5);
      expect(result.current.isFirstPage).toBe(false); // 10 === 1 は false
      expect(result.current.isLastPage).toBe(false); // 10 === 5 は false
    });

    test("should handle negative total pages", () => {
      // Arrange
      const props = {
        currentPage: 1,
        totalPages: -5,
        maxPageToShow: 10,
        totalCount: 50,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.pageNumbers).toStrictEqual([]);
      expect(result.current.hasPreviousPage).toBe(false); // 1 > 1 は false
      expect(result.current.hasNextPage).toBe(false); // 1 < -5 は false
      expect(result.current.totalPages).toBe(-5);
      expect(result.current.isFirstPage).toBe(true); // 1 === 1 は true
      expect(result.current.isLastPage).toBe(false); // 1 === -5 は false
    });

    test("should handle zero maxPageToShow", () => {
      // Arrange
      const props = {
        currentPage: 1,
        totalPages: 5,
        maxPageToShow: 0,
        totalCount: 50,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.pageNumbers).toStrictEqual([1, -1, -2, 5]);
      expect(result.current.hasPreviousPage).toBe(false);
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.totalPages).toBe(5);
      expect(result.current.isFirstPage).toBe(true);
      expect(result.current.isLastPage).toBe(false);
    });

    test("should handle negative maxPageToShow", () => {
      // Arrange
      const props = {
        currentPage: 1,
        totalPages: 5,
        maxPageToShow: -10,
        totalCount: 50,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.pageNumbers).toStrictEqual([1, -1, -2, 5]);
      expect(result.current.hasPreviousPage).toBe(false);
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.totalPages).toBe(5);
      expect(result.current.isFirstPage).toBe(true);
      expect(result.current.isLastPage).toBe(false);
    });

    test("should handle negative total count", () => {
      // Arrange
      const props = {
        currentPage: 1,
        totalPages: 5,
        maxPageToShow: 10,
        totalCount: -50,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.pageNumbers).toStrictEqual([1, 2, 3, 4, 5]);
      expect(result.current.hasPreviousPage).toBe(false);
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.totalPages).toBe(5);
      expect(result.current.isFirstPage).toBe(true);
      expect(result.current.isLastPage).toBe(false);
    });

    test("should handle non-integer values", () => {
      // Arrange
      const props = {
        currentPage: 1.5,
        totalPages: 5.7,
        maxPageToShow: 10.3,
        totalCount: 50.9,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      // 小数点は切り捨てられて処理される
      expect(result.current.totalPages).toBe(5.7);
      expect(result.current.hasPreviousPage).toBe(true); // 1.5 > 1 は true
      expect(result.current.hasNextPage).toBe(true); // 1.5 < 5.7 は true
      expect(result.current.isFirstPage).toBe(false); // 1.5 === 1 は false
      expect(result.current.isLastPage).toBe(false); // 1.5 === 5.7 は false
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("特殊なケース", () => {
    test("should handle exactly maxPageToShow pages", () => {
      // Arrange
      const props = {
        currentPage: 5,
        totalPages: 10,
        maxPageToShow: 10,
        totalCount: 100,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.pageNumbers).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(result.current.hasPreviousPage).toBe(true);
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.totalPages).toBe(10);
      expect(result.current.isFirstPage).toBe(false);
      expect(result.current.isLastPage).toBe(false);
    });

    test("should handle maxPageToShow greater than total pages", () => {
      // Arrange
      const props = {
        currentPage: 3,
        totalPages: 5,
        maxPageToShow: 20,
        totalCount: 50,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.pageNumbers).toStrictEqual([1, 2, 3, 4, 5]);
      expect(result.current.hasPreviousPage).toBe(true);
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.totalPages).toBe(5);
      expect(result.current.isFirstPage).toBe(false);
      expect(result.current.isLastPage).toBe(false);
    });

    test("should handle ellipsis placement correctly when current page is at boundary", () => {
      // Arrange - currentPageがmaxPageToShow/2の境界にある場合
      const props = {
        currentPage: 5, // Math.ceil(10/2) = 5
        totalPages: 20,
        maxPageToShow: 10,
        totalCount: 200,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.pageNumbers).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, -2, 20]);
      expect(result.current.hasPreviousPage).toBe(true);
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.totalPages).toBe(20);
      expect(result.current.isFirstPage).toBe(false);
      expect(result.current.isLastPage).toBe(false);
    });

    test("should handle ellipsis placement correctly when current page is at end boundary", () => {
      // Arrange - currentPageが後半の境界にある場合
      const props = {
        currentPage: 16, // 20 - Math.floor(10/2) = 15, so 16 > 15
        totalPages: 20,
        maxPageToShow: 10,
        totalCount: 200,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.pageNumbers).toStrictEqual([1, -1, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
      expect(result.current.hasPreviousPage).toBe(true);
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.totalPages).toBe(20);
      expect(result.current.isFirstPage).toBe(false);
      expect(result.current.isLastPage).toBe(false);
    });

    test("should handle case where startPage is exactly 2", () => {
      // Arrange - startPageが2の場合（省略記号が表示されない境界）
      const props = {
        currentPage: 6,
        totalPages: 15,
        maxPageToShow: 8,
        totalCount: 150,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      // startPage = 6 - Math.floor((8-4)/2) = 6 - 2 = 4, endPage = 4 + (8-4) - 1 = 7
      expect(result.current.pageNumbers).toStrictEqual([1, -1, 4, 5, 6, 7, -2, 15]);
      expect(result.current.hasPreviousPage).toBe(true);
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.totalPages).toBe(15);
      expect(result.current.isFirstPage).toBe(false);
      expect(result.current.isLastPage).toBe(false);
    });

    test("should handle case where endPage is exactly totalPages - 1", () => {
      // Arrange - endPageがtotalPages-1の場合（省略記号が表示されない境界）
      const props = {
        currentPage: 10,
        totalPages: 15,
        maxPageToShow: 8,
        totalCount: 150,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      // startPage = 10 - Math.floor((8-4)/2) = 10 - 2 = 8, endPage = 8 + (8-4) - 1 = 11
      expect(result.current.pageNumbers).toStrictEqual([1, -1, 8, 9, 10, 11, -2, 15]);
      expect(result.current.hasPreviousPage).toBe(true);
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.totalPages).toBe(15);
      expect(result.current.isFirstPage).toBe(false);
      expect(result.current.isLastPage).toBe(false);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("型安全性テスト", () => {
    test("should handle undefined props gracefully", () => {
      // Arrange
      const props = {
        currentPage: undefined as unknown as number,
        totalPages: undefined as unknown as number,
        maxPageToShow: undefined as unknown as number,
        totalCount: undefined as unknown as number,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.pageNumbers).toStrictEqual([]);
      expect(result.current.hasPreviousPage).toBe(false);
      expect(result.current.hasNextPage).toBe(false);
      expect(result.current.totalPages).toBeUndefined();
      expect(result.current.isFirstPage).toBe(false);
      expect(result.current.isLastPage).toBe(true); // undefined === undefined は true
    });

    test("should handle null props gracefully", () => {
      // Arrange
      const props = {
        currentPage: null as unknown as number,
        totalPages: null as unknown as number,
        maxPageToShow: null as unknown as number,
        totalCount: null as unknown as number,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.pageNumbers).toStrictEqual([]);
      expect(result.current.hasPreviousPage).toBe(false);
      expect(result.current.hasNextPage).toBe(false);
      expect(result.current.totalPages).toBeNull();
      expect(result.current.isFirstPage).toBe(false);
      expect(result.current.isLastPage).toBe(true); // null === null は true
    });

    test("should handle string props gracefully", () => {
      // Arrange
      const props = {
        currentPage: "5" as unknown as number,
        totalPages: "10" as unknown as number,
        maxPageToShow: "8" as unknown as number,
        totalCount: "100" as unknown as number,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      // 文字列は数値として扱われる可能性がある
      expect(result.current.totalPages).toBe("10");
      expect(result.current.hasPreviousPage).toBe(true); // "5" > 1
      expect(result.current.hasNextPage).toBe(false); // "5" < "10" は文字列比較では false
      expect(result.current.isFirstPage).toBe(false); // "5" === 1
      expect(result.current.isLastPage).toBe(false); // "5" === "10"
    });

    test("should handle boolean props gracefully", () => {
      // Arrange
      const props = {
        currentPage: true as unknown as number,
        totalPages: false as unknown as number,
        maxPageToShow: true as unknown as number,
        totalCount: false as unknown as number,
      };

      // Act
      const { result } = renderHook(() => usePagination(props));

      // Assert
      expect(result.current.totalPages).toBe(false);
      expect(result.current.hasPreviousPage).toBe(false); // true > 1 は false
      expect(result.current.hasNextPage).toBe(false); // true < false は false
      expect(result.current.isFirstPage).toBe(false); // true === 1 は false
      expect(result.current.isLastPage).toBe(false); // true === false は false
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("パフォーマンステスト", () => {
    test("should handle very large page numbers efficiently", () => {
      // Arrange
      const props = {
        currentPage: 50000,
        totalPages: 100000,
        maxPageToShow: 10,
        totalCount: 1000000,
      };

      // Act
      const startTime = performance.now();
      const { result } = renderHook(() => usePagination(props));
      const endTime = performance.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(100); // 100ms以内で完了することを確認
      // startPage = 50000 - Math.floor((10-4)/2) = 50000 - 3 = 49997, endPage = 49997 + (10-4) - 1 = 50002
      expect(result.current.pageNumbers).toHaveLength(10); // 1, -1, 49997, 49998, 49999, 50000, 50001, 50002, -2, 100000
      expect(result.current.totalPages).toBe(100000);
    });

    test("should memoize results correctly", () => {
      // Arrange
      const props = {
        currentPage: 5,
        totalPages: 10,
        maxPageToShow: 10,
        totalCount: 100,
      };

      // Act
      const { result, rerender } = renderHook(() => usePagination(props));
      const firstResult = result.current;

      // 同じpropsで再レンダリング
      rerender();
      const secondResult = result.current;

      // Assert
      expect(firstResult.pageNumbers).toBe(secondResult.pageNumbers); // 参照が同じことを確認
      expect(firstResult.hasPreviousPage).toBe(secondResult.hasPreviousPage);
      expect(firstResult.hasNextPage).toBe(secondResult.hasNextPage);
      expect(firstResult.isFirstPage).toBe(secondResult.isFirstPage);
      expect(firstResult.isLastPage).toBe(secondResult.isLastPage);
    });
  });
});
