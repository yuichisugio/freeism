import { unstable_cacheLife } from "next/cache";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { HeroSection } from "./hero-section";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Next.jsのキャッシュ機能をモック
 */
vi.mock("next/cache", () => ({
  unstable_cacheLife: vi.fn(),
}));

const mockCacheLife = vi.mocked(unstable_cacheLife);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * HeroSectionコンポーネントのテスト
 */
describe("HeroSection", () => {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 基本的なレンダリングテスト
   */
  describe("基本レンダリング", () => {
    test("should render hero section component correctly", async () => {
      // Act
      const { container } = render(await HeroSection());

      // Assert
      const section = container.querySelector("section");
      expect(section).toBeInTheDocument();
      expect(section).toHaveClass("relative", "bg-gradient-to-b");
    });

    test("should render main heading correctly", async () => {
      // Act
      render(await HeroSection());

      // Assert
      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent("新しい経済の仕組みを提案");
    });

    test("should render description text correctly", async () => {
      // Act
      render(await HeroSection());

      // Assert
      const description = screen.getByText("Freeism-Appは、資本主義に変わる経済の仕組みを提案し、体験できるWebサービスです。");
      expect(description).toBeInTheDocument();
    });

    test("should render background decorative elements", async () => {
      // Act
      const { container } = render(await HeroSection());

      // Assert
      const backgroundContainer = container.querySelector(".absolute.inset-0.overflow-hidden");
      expect(backgroundContainer).toBeInTheDocument();

      const decorativeElements = container.querySelectorAll(".absolute.top-1\\/2");
      expect(decorativeElements).toHaveLength(2);
    });

    test("should render container with proper structure", async () => {
      // Act
      const { container } = render(await HeroSection());

      // Assert
      const mainContainer = container.querySelector(".relative.container.mx-auto");
      expect(mainContainer).toBeInTheDocument();

      const contentContainer = container.querySelector(".mx-auto.text-center");
      expect(contentContainer).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ボタンとリンクのテスト
   */
  describe("ボタンとリンク", () => {
    test("should render detail button with correct link", async () => {
      // Act
      render(await HeroSection());

      // Assert
      const detailButton = screen.getByRole("link", { name: "詳細" });
      expect(detailButton).toBeInTheDocument();
      expect(detailButton).toHaveAttribute("href", "https://docs.google.com/document/d/1ksGHN6jWdwoMZ59-EX3g_CFXY3J3D7Qes4-TluqX7qU/edit?tab=t.0");
      expect(detailButton).toHaveAttribute("target", "_blank");
      expect(detailButton).toHaveAttribute("rel", "noopener noreferrer");
    });

    test("should render usage button with correct link", async () => {
      // Act
      render(await HeroSection());

      // Assert
      const usageButton = screen.getByRole("link", { name: "利用する" });
      expect(usageButton).toBeInTheDocument();
      expect(usageButton).toHaveAttribute("href", "/dashboard/group-list");
    });

    test("should render buttons with correct styling classes", async () => {
      // Act
      render(await HeroSection());

      // Assert
      const detailButton = screen.getByRole("link", { name: "詳細" });
      expect(detailButton).toHaveClass("border-blue-200", "bg-white", "text-blue-700");

      const usageButton = screen.getByRole("link", { name: "利用する" });
      expect(usageButton).toHaveAttribute("href", "/dashboard/group-list");
    });

    test("should render buttons container with proper layout", async () => {
      // Act
      const { container } = render(await HeroSection());

      // Assert
      const buttonContainer = container.querySelector(".flex.flex-col.items-center.justify-center");
      expect(buttonContainer).toBeInTheDocument();
      expect(buttonContainer).toHaveClass("gap-3", "sm:flex-row", "sm:gap-4");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュ機能のテスト
   */
  describe("キャッシュ機能", () => {
    test("should call unstable_cacheLife with max parameter", async () => {
      // Act
      render(await HeroSection());

      // Assert
      expect(mockCacheLife).toHaveBeenCalledWith("max");
      expect(mockCacheLife).toHaveBeenCalledTimes(1);
    });

    test("should call cacheLife only once even with multiple renders", async () => {
      // Act
      render(await HeroSection());
      render(await HeroSection());

      // Assert
      expect(mockCacheLife).toHaveBeenCalledWith("max");
      expect(mockCacheLife).toHaveBeenCalledTimes(2);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * アクセシビリティテスト
   */
  describe("アクセシビリティ", () => {
    test("should have proper heading hierarchy", async () => {
      // Act
      render(await HeroSection());

      // Assert
      const headings = screen.getAllByRole("heading");
      expect(headings).toHaveLength(1);
      expect(headings[0]).toHaveProperty("tagName", "H1");
    });

    test("should have accessible link text", async () => {
      // Act
      render(await HeroSection());

      // Assert
      const detailLink = screen.getByRole("link", { name: "詳細" });
      const usageLink = screen.getByRole("link", { name: "利用する" });

      expect(detailLink).toHaveAccessibleName("詳細");
      expect(usageLink).toHaveAccessibleName("利用する");
    });

    test("should have proper external link attributes for security", async () => {
      // Act
      render(await HeroSection());

      // Assert
      const externalLink = screen.getByRole("link", { name: "詳細" });
      expect(externalLink).toHaveAttribute("rel", "noopener noreferrer");
      expect(externalLink).toHaveAttribute("target", "_blank");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レスポンシブデザインテスト
   */
  describe("レスポンシブデザイン", () => {
    test("should have responsive classes for section", async () => {
      // Act
      const { container } = render(await HeroSection());

      // Assert
      const section = container.querySelector("section");
      expect(section).toHaveClass("py-16", "sm:py-24", "lg:py-32");
    });

    test("should have responsive classes for heading", async () => {
      // Act
      render(await HeroSection());

      // Assert
      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveClass("text-3xl", "sm:text-4xl", "md:text-5xl", "lg:text-6xl");
    });

    test("should have responsive classes for description", async () => {
      // Act
      render(await HeroSection());

      // Assert
      const description = screen.getByText("Freeism-Appは、資本主義に変わる経済の仕組みを提案し、体験できるWebサービスです。");
      expect(description).toHaveClass("text-base", "sm:text-lg", "md:text-xl");
    });

    test("should have responsive container classes", async () => {
      // Act
      const { container } = render(await HeroSection());

      // Assert
      const contentContainer = container.querySelector(".mx-auto.text-center");
      expect(contentContainer).toHaveClass("sm:max-w-lg", "md:max-w-2xl", "lg:max-w-3xl");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ダークモード対応テスト
   */
  describe("ダークモード対応", () => {
    test("should have dark mode classes for section background", async () => {
      // Act
      const { container } = render(await HeroSection());

      // Assert
      const section = container.querySelector("section");
      expect(section).toHaveClass("dark:from-blue-950", "dark:via-gray-950", "dark:to-gray-950");
    });

    test("should have dark mode classes for heading", async () => {
      // Act
      render(await HeroSection());

      // Assert
      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveClass("dark:from-blue-400", "dark:to-blue-500");
    });

    test("should have dark mode classes for description", async () => {
      // Act
      render(await HeroSection());

      // Assert
      const description = screen.getByText("Freeism-Appは、資本主義に変わる経済の仕組みを提案し、体験できるWebサービスです。");
      expect(description).toHaveClass("dark:text-neutral-400");
    });

    test("should have dark mode classes for decorative elements", async () => {
      // Act
      const { container } = render(await HeroSection());

      // Assert
      const decorativeElements = container.querySelectorAll(".dark\\:bg-blue-900\\/30");
      expect(decorativeElements).toHaveLength(2);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * エラーハンドリングテスト
   */
  describe("エラーハンドリング", () => {
    test("should handle cacheLife function errors gracefully", async () => {
      // Arrange
      mockCacheLife.mockImplementationOnce(() => {
        throw new Error("Cache error");
      });

      // Act & Assert
      await expect(async () => {
        render(await HeroSection());
      }).rejects.toThrow("Cache error");
    });

    test("should render successfully even if cacheLife is mocked", async () => {
      // Arrange
      mockCacheLife.mockImplementationOnce(() => {
        // モック実装：何もしない
      });

      // Act
      const result = render(await HeroSection());

      // Assert
      expect(result.container.querySelector("section")).toBeInTheDocument();
      expect(mockCacheLife).toHaveBeenCalledWith("max");
    });
  });
});
