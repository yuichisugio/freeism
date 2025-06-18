import { unstable_cacheLife as cacheLife } from "next/cache";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { DescriptionSection } from "./description-section";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Next.jsのキャッシュ機能をモック
 */
vi.mock("next/cache", () => ({
  unstable_cacheLife: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * DescriptionSectionコンポーネントのテスト
 */
describe("DescriptionSection", () => {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  beforeEach(() => {
    vi.clearAllMocks();
    // モックを正常な状態にリセット
    vi.mocked(cacheLife).mockImplementation(() => undefined);
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 基本的なレンダリングテスト
   */
  describe("基本レンダリング", () => {
    test("should render description section component correctly", async () => {
      // Act
      const result = await DescriptionSection();
      const { container } = render(result);

      // Assert
      const section = container.querySelector("section");
      expect(section).toBeInTheDocument();
      expect(section).toHaveClass("relative", "overflow-hidden");
    });

    test("should render section with correct id", async () => {
      // Act
      const result = await DescriptionSection();
      const { container } = render(result);

      // Assert
      const section = container.querySelector("section");
      expect(section).toHaveAttribute("id", "features");
    });

    test("should render section with correct CSS classes", async () => {
      // Act
      const result = await DescriptionSection();
      const { container } = render(result);

      // Assert
      const section = container.querySelector("section");
      expect(section).toHaveClass("relative", "overflow-hidden", "border-t", "border-blue-100", "bg-gradient-to-b");
    });

    test("should render component without throwing errors", async () => {
      // Act & Assert
      await expect(DescriptionSection()).resolves.toBeDefined();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * コンテンツ要素のテスト
   */
  describe("コンテンツ要素", () => {
    test("should render main title correctly", async () => {
      // Act
      const result = await DescriptionSection();
      const { container } = render(result);

      // Assert
      const title = container.querySelector("h2");
      expect(title).toBeInTheDocument();
      expect(title).toHaveTextContent("サービスの特徴");
      expect(title).toHaveClass("text-2xl", "font-bold", "text-blue-900");
    });

    test("should render description text correctly", async () => {
      // Act
      const result = await DescriptionSection();
      const { container } = render(result);

      // Assert
      const description = container.querySelector("p");
      expect(description).toBeInTheDocument();
      expect(description).toHaveTextContent("Freeism-Appが提供する主な機能と特徴をご紹介します");
      expect(description).toHaveClass("text-base", "text-neutral-600");
    });

    test("should render iframe with correct attributes", async () => {
      // Act
      const result = await DescriptionSection();
      const { container } = render(result);

      // Assert
      const iframe = container.querySelector("iframe");
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute("title", "サービス説明");
      expect(iframe).toHaveAttribute(
        "src",
        "https://docs.google.com/document/d/e/2PACX-1vSv2DzoMvPnYK4EQQn2q8jwSch9-YV3LrNUC42CcFxJoM4lWWfw_C6BbCtLxwHVTiw-FITAF1U1rl0u/pub?embedded=true",
      );
    });

    test("should render iframe with correct CSS classes", async () => {
      // Act
      const result = await DescriptionSection();
      const { container } = render(result);

      // Assert
      const iframe = container.querySelector("iframe");
      expect(iframe).toHaveClass("h-[500px]", "w-full", "overflow-x-hidden", "overflow-y-auto", "rounded-xl");
    });

    test("should render only one h2 element", async () => {
      // Act
      const result = await DescriptionSection();
      const { container } = render(result);

      // Assert
      const titles = container.querySelectorAll("h2");
      expect(titles).toHaveLength(1);
    });

    test("should render only one iframe element", async () => {
      // Act
      const result = await DescriptionSection();
      const { container } = render(result);

      // Assert
      const iframes = container.querySelectorAll("iframe");
      expect(iframes).toHaveLength(1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュ機能のテスト
   */
  describe("キャッシュ機能", () => {
    test("should call cacheLife with 'max' parameter", async () => {
      // Act
      await DescriptionSection();

      // Assert
      expect(cacheLife).toHaveBeenCalledWith("max");
      expect(cacheLife).toHaveBeenCalledTimes(1);
    });

    test("should call cacheLife before rendering", async () => {
      // Arrange
      const mockCacheLife = vi.mocked(cacheLife);
      mockCacheLife.mockClear();

      // Act
      await DescriptionSection();

      // Assert
      expect(mockCacheLife).toHaveBeenCalledWith("max");
    });

    test("should handle cacheLife errors gracefully", async () => {
      // Arrange
      const mockCacheLife = vi.mocked(cacheLife);
      mockCacheLife.mockImplementation(() => {
        throw new Error("Cache error");
      });

      // Act & Assert
      await expect(DescriptionSection()).rejects.toThrow("Cache error");

      // Cleanup - モックを正常な状態に戻す
      mockCacheLife.mockImplementation(() => undefined);
    });

    test("should handle rendering when cacheLife is undefined", async () => {
      // Arrange
      const mockCacheLife = vi.mocked(cacheLife);
      mockCacheLife.mockImplementation(() => undefined);

      // Act
      const result = await DescriptionSection();
      const { container } = render(result);

      // Assert
      const section = container.querySelector("section");
      expect(section).toBeInTheDocument();
      expect(mockCacheLife).toHaveBeenCalledWith("max");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レスポンシブデザインのテスト
   */
  describe("レスポンシブデザイン", () => {
    test("should have responsive container classes", async () => {
      // Act
      const result = await DescriptionSection();
      const { container } = render(result);

      // Assert
      const mainContainer = container.querySelector(".container");
      expect(mainContainer).toBeInTheDocument();
      expect(mainContainer).toHaveClass("mx-auto", "px-4");
    });

    test("should have responsive max-width classes", async () => {
      // Act
      const result = await DescriptionSection();
      const { container } = render(result);

      // Assert
      const contentContainer = container.querySelector(".max-w-sm");
      expect(contentContainer).toBeInTheDocument();
      expect(contentContainer).toHaveClass("max-w-sm", "sm:max-w-2xl", "md:max-w-3xl", "lg:max-w-5xl");
    });

    test("should have responsive title classes", async () => {
      // Act
      const result = await DescriptionSection();
      const { container } = render(result);

      // Assert
      const title = container.querySelector("h2");
      expect(title).toHaveClass("text-2xl", "sm:text-3xl", "lg:text-4xl");
    });

    test("should have responsive iframe height classes", async () => {
      // Act
      const result = await DescriptionSection();
      const { container } = render(result);

      // Assert
      const iframe = container.querySelector("iframe");
      expect(iframe).toHaveClass("h-[500px]", "sm:h-[600px]", "md:h-[700px]", "lg:h-[800px]");
    });

    test("should have responsive spacing classes", async () => {
      // Act
      const result = await DescriptionSection();
      const { container } = render(result);

      // Assert
      const section = container.querySelector("section");
      expect(section).toHaveClass("py-16", "sm:py-20", "lg:py-24");
    });

    test("should have responsive margin classes for title section", async () => {
      // Act
      const result = await DescriptionSection();
      const { container } = render(result);

      // Assert
      const titleSection = container.querySelector(".mb-8");
      expect(titleSection).toBeInTheDocument();
      expect(titleSection).toHaveClass("mb-8", "sm:mb-12");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ダークモード対応のテスト
   */
  describe("ダークモード対応", () => {
    test("should have dark mode classes for section", async () => {
      // Act
      const result = await DescriptionSection();
      const { container } = render(result);

      // Assert
      const section = container.querySelector("section");
      expect(section).toHaveClass(
        "dark:border-blue-900",
        "dark:from-gray-950",
        "dark:via-blue-950",
        "dark:to-gray-950",
      );
    });

    test("should have dark mode classes for title", async () => {
      // Act
      const result = await DescriptionSection();
      const { container } = render(result);

      // Assert
      const title = container.querySelector("h2");
      expect(title).toHaveClass("dark:text-blue-100");
    });

    test("should have dark mode classes for description", async () => {
      // Act
      const result = await DescriptionSection();
      const { container } = render(result);

      // Assert
      const description = container.querySelector("p");
      expect(description).toHaveClass("dark:text-neutral-400");
    });

    test("should have dark mode classes for iframe", async () => {
      // Act
      const result = await DescriptionSection();
      const { container } = render(result);

      // Assert
      const iframe = container.querySelector("iframe");
      expect(iframe).toHaveClass("dark:border-blue-900", "dark:bg-gray-950/80", "dark:shadow-blue-900/20");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * アクセシビリティのテスト
   */
  describe("アクセシビリティ", () => {
    test("should have proper heading hierarchy", async () => {
      // Act
      const result = await DescriptionSection();
      const { container } = render(result);

      // Assert
      const heading = container.querySelector("h2");
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent("サービスの特徴");
    });

    test("should have iframe with title attribute for screen readers", async () => {
      // Act
      const result = await DescriptionSection();
      const { container } = render(result);

      // Assert
      const iframe = container.querySelector("iframe");
      expect(iframe).toHaveAttribute("title", "サービス説明");
    });

    test("should have section with semantic id", async () => {
      // Act
      const result = await DescriptionSection();
      const { container } = render(result);

      // Assert
      const section = container.querySelector("section");
      expect(section).toHaveAttribute("id", "features");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 境界値・異常系のテスト
   */
  describe("境界値・異常系", () => {
    test("should handle multiple consecutive calls correctly", async () => {
      // Act
      const result1 = await DescriptionSection();
      const result2 = await DescriptionSection();
      const result3 = await DescriptionSection();

      // Assert
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result3).toBeDefined();
      expect(cacheLife).toHaveBeenCalledTimes(3);
    });

    test("should maintain consistent structure across multiple renders", async () => {
      // Act
      const result1 = await DescriptionSection();
      const result2 = await DescriptionSection();
      const { container: container1 } = render(result1);
      const { container: container2 } = render(result2);

      // Assert
      const section1 = container1.querySelector("section");
      const section2 = container2.querySelector("section");
      expect(section1?.getAttribute("id")).toBe(section2?.getAttribute("id"));
      expect(section1?.className).toBe(section2?.className);
    });
  });
});
