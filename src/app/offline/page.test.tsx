import type { Metadata } from "next";
import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import OfflinePage, { metadata } from "./page";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// Next.jsのキャッシュ機能をモック
vi.mock("next/cache", () => ({
  unstable_cacheLife: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("OfflinePage", () => {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 各テスト前のセットアップ
   */
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("メタデータ", () => {
    test("should export correct metadata", () => {
      // Assert
      expect(metadata).toStrictEqual({
        title: "オフライン - Freeism-App",
        description: "インターネット接続を確認して再度お試しください。",
      } satisfies Metadata);
    });

    test("should have metadata as a static export", () => {
      // Assert
      expect(metadata).toBeDefined();
      expect(typeof metadata).toBe("object");
      expect(metadata.title).toBe("オフライン - Freeism-App");
      expect(metadata.description).toBe("インターネット接続を確認して再度お試しください。");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("基本レンダリング", () => {
    test("should render page correctly", async () => {
      // Act
      render(await OfflinePage());

      // Assert
      const containerElement = screen.getByText("オフラインです");
      expect(containerElement).toBeInTheDocument();
    });

    test("should return a valid React element", async () => {
      // Act
      const result = await OfflinePage();

      // Assert
      expect(result).toBeDefined();
      expect(React.isValidElement(result)).toBe(true);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("コンテンツ要素", () => {
    test("should render page title", async () => {
      // Act
      render(await OfflinePage());

      // Assert
      const title = screen.getByRole("heading", { name: "オフラインです" });
      expect(title).toBeInTheDocument();
      expect(title).toHaveClass("mb-4", "text-2xl", "font-bold");
    });

    test("should render description message", async () => {
      // Act
      render(await OfflinePage());

      // Assert
      const description = screen.getByText("インターネット接続を確認して再度お試しください。");
      expect(description).toBeInTheDocument();
    });

    test("should render page title as h1 element", async () => {
      // Act
      render(await OfflinePage());

      // Assert
      const title = screen.getByRole("heading", { level: 1 });
      expect(title).toBeInTheDocument();
      expect(title).toHaveTextContent("オフラインです");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("レイアウトとスタイル", () => {
    test("should apply correct CSS classes to container element", async () => {
      // Act
      render(await OfflinePage());

      // Assert
      const container = screen.getByText("オフラインです").parentElement;
      expect(container).toHaveClass("flex", "min-h-screen", "flex-col", "items-center", "justify-center", "p-4", "text-center");
    });

    test("should apply correct CSS classes to title element", async () => {
      // Act
      render(await OfflinePage());

      // Assert
      const title = screen.getByRole("heading", { name: "オフラインです" });
      expect(title).toHaveClass("mb-4", "text-2xl", "font-bold");
    });

    test("should render elements in correct hierarchy", async () => {
      // Act
      render(await OfflinePage());

      // Assert
      const container = screen.getByText("オフラインです").parentElement;
      const title = screen.getByRole("heading", { name: "オフラインです" });
      const description = screen.getByText("インターネット接続を確認して再度お試しください。");

      expect(container).toContainElement(title);
      expect(container).toContainElement(description);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("キャッシュ機能", () => {
    test("should call cacheLife with 'max' parameter", async () => {
      // Arrange
      const { unstable_cacheLife } = await import("next/cache");
      const mockCacheLife = vi.mocked(unstable_cacheLife);

      // Act
      await OfflinePage();

      // Assert
      expect(mockCacheLife).toHaveBeenCalledWith("max");
    });

    test("should call cacheLife exactly once", async () => {
      // Arrange
      const { unstable_cacheLife } = await import("next/cache");
      const mockCacheLife = vi.mocked(unstable_cacheLife);
      mockCacheLife.mockClear();

      // Act
      await OfflinePage();

      // Assert
      expect(mockCacheLife).toHaveBeenCalledTimes(1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("アクセシビリティ", () => {
    test("should have proper heading structure", async () => {
      // Act
      render(await OfflinePage());

      // Assert
      const headings = screen.getAllByRole("heading");
      expect(headings).toHaveLength(1);
      expect(headings[0]).toHaveProperty("tagName", "H1");
    });

    test("should have descriptive text content", async () => {
      // Act
      render(await OfflinePage());

      // Assert
      const title = screen.getByRole("heading", { name: "オフラインです" });
      const description = screen.getByText("インターネット接続を確認して再度お試しください。");

      expect(title).toHaveTextContent("オフラインです");
      expect(description).toHaveTextContent("インターネット接続を確認して再度お試しください。");
    });
  });
});
