import type { Metadata } from "next";
import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import TermsPage, { metadata } from "./page";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// Next.jsのキャッシュ機能をモック
vi.mock("next/cache", () => ({
  unstable_cacheLife: vi.fn(),
}));

// 子コンポーネントをモック
vi.mock("@/components/layout/header", () => ({
  Header: ({ buttonDisplay }: { buttonDisplay: boolean }) => (
    <header data-testid="header" data-button-display={buttonDisplay}>
      Header
    </header>
  ),
}));

vi.mock("@/components/layout/footer", () => ({
  Footer: () => <footer data-testid="footer">Footer</footer>,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("TermsPage", () => {
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
        title: "利用規約 | Freeism-App",
        description: "Freeism-Appの利用規約をご確認ください。",
      } satisfies Metadata);
    });

    test("should have metadata as a static export", () => {
      // Assert
      expect(metadata).toBeDefined();
      expect(typeof metadata).toBe("object");
      expect(metadata.title).toBe("利用規約 | Freeism-App");
      expect(metadata.description).toBe("Freeism-Appの利用規約をご確認ください。");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("基本レンダリング", () => {
    test("should render page correctly", async () => {
      // Act
      render(await TermsPage());

      // Assert
      const mainElement = screen.getByRole("main");
      expect(mainElement).toBeInTheDocument();
    });

    test("should return a valid React fragment", async () => {
      // Act
      const result = await TermsPage();

      // Assert
      expect(result).toBeDefined();
      expect(React.isValidElement(result)).toBe(true);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("コンテンツ要素", () => {
    test("should render page title", async () => {
      // Act
      render(await TermsPage());

      // Assert
      const title = screen.getByRole("heading", { name: "利用規約" });
      expect(title).toBeInTheDocument();
      expect(title).toHaveClass("mb-8", "text-center", "text-3xl", "font-bold", "text-blue-900");
    });

    test("should render page title as h1 element", async () => {
      // Act
      render(await TermsPage());

      // Assert
      const title = screen.getByRole("heading", { level: 1 });
      expect(title).toBeInTheDocument();
      expect(title).toHaveTextContent("利用規約");
    });

    test("should render all section headings", async () => {
      // Act
      render(await TermsPage());

      // Assert
      const sectionHeadings = ["1. はじめに", "2. 利用登録", "3. ユーザーの責任", "4. 禁止事項", "5. 規約の変更"];

      sectionHeadings.forEach((heading) => {
        const element = screen.getByRole("heading", { name: heading });
        expect(element).toBeInTheDocument();
        expect(element).toHaveClass("text-xl", "font-semibold", "text-blue-800");
      });
    });

    test("should render section content paragraphs", async () => {
      // Act
      render(await TermsPage());

      // Assert
      const introText = screen.getByText(/この利用規約（以下、「本規約」といいます。）は、Freeism-App/);
      expect(introText).toBeInTheDocument();

      const registrationText = screen.getByText(/当サービスの利用を希望する方は、本規約に同意の上/);
      expect(registrationText).toBeInTheDocument();

      const responsibilityText = screen.getByText(/ユーザーは、自己の責任において当サービスを利用するものとし/);
      expect(responsibilityText).toBeInTheDocument();
    });

    test("should render list items in sections", async () => {
      // Act
      render(await TermsPage());

      // Assert
      // 利用登録セクションのリスト項目
      const registrationListItems = [
        "利用登録の申請に際して虚偽の事項を届け出た場合",
        "本規約に違反したことがある者からの申請である場合",
        "その他、当サービスが利用登録を相当でないと判断した場合",
      ];

      registrationListItems.forEach((item) => {
        expect(screen.getByText(item)).toBeInTheDocument();
      });

      // 禁止事項セクションのリスト項目
      const prohibitedItems = [
        "法令または公序良俗に違反する行為",
        "犯罪行為に関連する行為",
        "当サービスの運営を妨害するおそれのある行為",
        "他のユーザーに関する個人情報等を収集または蓄積する行為",
        "他のユーザーに成りすます行為",
        "当サービスに関連して、反社会的勢力に対して直接または間接に利益を供与する行為",
      ];

      prohibitedItems.forEach((item) => {
        expect(screen.getByText(item)).toBeInTheDocument();
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("子コンポーネント", () => {
    test("should render Header component with correct props", async () => {
      // Act
      render(await TermsPage());

      // Assert
      const header = screen.getByTestId("header");
      expect(header).toBeInTheDocument();
      expect(header).toHaveAttribute("data-button-display", "false");
    });

    test("should render Footer component", async () => {
      // Act
      render(await TermsPage());

      // Assert
      const footer = screen.getByTestId("footer");
      expect(footer).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("レイアウトとスタイル", () => {
    test("should apply correct CSS classes to main element", async () => {
      // Act
      render(await TermsPage());

      // Assert
      const mainElement = screen.getByRole("main");
      expect(mainElement).toHaveClass("container", "mx-auto", "min-h-screen", "px-4", "py-12");
    });

    test("should apply correct CSS classes to content container", async () => {
      // Act
      render(await TermsPage());

      // Assert
      const contentContainer = screen.getByRole("main").querySelector(".mx-auto.max-w-3xl");
      expect(contentContainer).toBeInTheDocument();
      expect(contentContainer).toHaveClass("mx-auto", "max-w-3xl");
    });

    test("should apply correct CSS classes to prose container", async () => {
      // Act
      render(await TermsPage());

      // Assert
      const proseContainer = screen.getByRole("main").querySelector(".prose");
      expect(proseContainer).toBeInTheDocument();
      expect(proseContainer).toHaveClass(
        "prose",
        "prose-blue",
        "mx-auto",
        "max-w-none",
        "space-y-6",
        "text-neutral-700",
      );
    });

    test("should render sections with correct structure", async () => {
      // Act
      render(await TermsPage());

      // Assert
      const sections = screen.getByRole("main").querySelectorAll("section");
      expect(sections).toHaveLength(5);

      sections.forEach((section) => {
        expect(section).toBeInTheDocument();
      });
    });

    test("should render lists with correct CSS classes", async () => {
      // Act
      render(await TermsPage());

      // Assert
      const lists = screen.getByRole("main").querySelectorAll("ul");
      expect(lists).toHaveLength(2);

      lists.forEach((list) => {
        expect(list).toHaveClass("list-inside", "list-disc");
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("キャッシュ機能", () => {
    test("should call cacheLife with 'max' parameter", async () => {
      // Arrange
      const { unstable_cacheLife } = await import("next/cache");
      const mockCacheLife = vi.mocked(unstable_cacheLife);

      // Act
      await TermsPage();

      // Assert
      expect(mockCacheLife).toHaveBeenCalledWith("max");
    });

    test("should call cacheLife exactly once", async () => {
      // Arrange
      const { unstable_cacheLife } = await import("next/cache");
      const mockCacheLife = vi.mocked(unstable_cacheLife);
      mockCacheLife.mockClear();

      // Act
      await TermsPage();

      // Assert
      expect(mockCacheLife).toHaveBeenCalledTimes(1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("アクセシビリティ", () => {
    test("should have proper heading hierarchy", async () => {
      // Act
      render(await TermsPage());

      // Assert
      const h1Elements = screen.getAllByRole("heading", { level: 1 });
      const h2Elements = screen.getAllByRole("heading", { level: 2 });

      expect(h1Elements).toHaveLength(1);
      expect(h2Elements).toHaveLength(5);

      // h1が最初に来ることを確認
      expect(h1Elements[0]).toHaveTextContent("利用規約");
    });

    test("should have descriptive text content for screen readers", async () => {
      // Act
      render(await TermsPage());

      // Assert
      const mainElement = screen.getByRole("main");
      expect(mainElement).toHaveTextContent("利用規約");
      expect(mainElement).toHaveTextContent("はじめに");
      expect(mainElement).toHaveTextContent("利用登録");
      expect(mainElement).toHaveTextContent("ユーザーの責任");
      expect(mainElement).toHaveTextContent("禁止事項");
      expect(mainElement).toHaveTextContent("規約の変更");
    });

    test("should have semantic HTML structure", async () => {
      // Act
      render(await TermsPage());

      // Assert
      const mainElement = screen.getByRole("main");
      const sections = mainElement.querySelectorAll("section");
      const headings = screen.getAllByRole("heading");
      const lists = mainElement.querySelectorAll("ul");

      expect(mainElement).toBeInTheDocument();
      expect(sections).toHaveLength(5);
      expect(headings).toHaveLength(6); // 1 h1 + 5 h2
      expect(lists).toHaveLength(2);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値・エラーケース", () => {
    test("should handle component rendering without errors", async () => {
      // Act & Assert
      expect(async () => {
        render(await TermsPage());
      }).not.toThrow();
    });

    test("should render all required elements even with minimal content", async () => {
      // Act
      render(await TermsPage());

      // Assert
      // 必須要素が全て存在することを確認
      expect(screen.getByTestId("header")).toBeInTheDocument();
      expect(screen.getByRole("main")).toBeInTheDocument();
      expect(screen.getByTestId("footer")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "利用規約" })).toBeInTheDocument();
    });

    test("should maintain proper structure with all CSS classes", async () => {
      // Act
      render(await TermsPage());

      // Assert
      const fragment = screen.getByTestId("header").parentElement;

      // フラグメントの基本構造を確認
      expect(fragment).toContainElement(screen.getByTestId("header"));
      expect(fragment).toContainElement(screen.getByRole("main"));
      expect(fragment).toContainElement(screen.getByTestId("footer"));
    });

    test("should render correct number of sections and headings", async () => {
      // Act
      render(await TermsPage());

      // Assert
      const sections = screen.getByRole("main").querySelectorAll("section");
      const h2Headings = screen.getAllByRole("heading", { level: 2 });
      const allHeadings = screen.getAllByRole("heading");

      expect(sections).toHaveLength(5);
      expect(h2Headings).toHaveLength(5);
      expect(allHeadings).toHaveLength(6); // 1 h1 + 5 h2
    });

    test("should handle async component rendering correctly", async () => {
      // Act
      const result = await TermsPage();

      // Assert
      expect(result).toBeDefined();
      expect(React.isValidElement(result)).toBe(true);

      // レンダリングが正常に完了することを確認
      expect(() => render(result)).not.toThrow();
    });
  });
});
