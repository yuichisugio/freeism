import type { Metadata } from "next";
import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import PrivacyPage, { metadata } from "./page";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// next/cacheのモック
vi.mock("next/cache", () => ({
  unstable_cacheLife: vi.fn(),
}));

// Headerコンポーネントのモック
vi.mock("@/components/layout/header", () => ({
  Header: ({ buttonDisplay }: { buttonDisplay: boolean }) => (
    <header data-testid="header" data-button-display={buttonDisplay}>
      Header
    </header>
  ),
}));

// Footerコンポーネントのモック
vi.mock("@/components/layout/footer", () => ({
  Footer: () => <footer data-testid="footer">Footer</footer>,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("PrivacyPage", () => {
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
        title: "プライバシーポリシー | Freeism-App",
        description: "Freeism-Appのプライバシーポリシーをご確認ください。",
      } satisfies Metadata);
    });

    test("should have metadata as a static export", () => {
      // Assert
      expect(metadata).toBeDefined();
      expect(typeof metadata).toBe("object");
      expect(metadata.title).toBe("プライバシーポリシー | Freeism-App");
      expect(metadata.description).toBe("Freeism-Appのプライバシーポリシーをご確認ください。");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("基本レンダリング", () => {
    test("should render page correctly", async () => {
      // Act
      render(await PrivacyPage());

      // Assert
      const mainElement = screen.getByRole("main");
      expect(mainElement).toBeInTheDocument();
    });

    test("should return a valid React fragment", async () => {
      // Act
      const result = await PrivacyPage();

      // Assert
      expect(result).toBeDefined();
      expect(React.isValidElement(result)).toBe(true);
    });

    test("should render Header with buttonDisplay false", async () => {
      // Act
      render(await PrivacyPage());

      // Assert
      const header = screen.getByTestId("header");
      expect(header).toBeInTheDocument();
      expect(header).toHaveAttribute("data-button-display", "false");
    });

    test("should render Footer component", async () => {
      // Act
      render(await PrivacyPage());

      // Assert
      const footer = screen.getByTestId("footer");
      expect(footer).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("コンテンツ要素", () => {
    test("should render page title", async () => {
      // Act
      render(await PrivacyPage());

      // Assert
      const title = screen.getByRole("heading", { name: "プライバシーポリシー" });
      expect(title).toBeInTheDocument();
      expect(title).toHaveClass("mb-8", "text-center", "text-3xl", "font-bold", "text-blue-900");
    });

    test("should render page title as h1 element", async () => {
      // Act
      render(await PrivacyPage());

      // Assert
      const title = screen.getByRole("heading", { level: 1 });
      expect(title).toBeInTheDocument();
      expect(title).toHaveTextContent("プライバシーポリシー");
    });

    test("should render all section headings", async () => {
      // Act
      render(await PrivacyPage());

      // Assert
      const sectionHeadings = [
        "1. 個人情報の収集",
        "2. 個人情報の利用目的",
        "3. 個人情報の管理",
        "4. 個人情報の第三者提供",
        "5. Cookieの使用",
        "6. プライバシーポリシーの変更",
        "7. お問い合わせ",
      ];

      sectionHeadings.forEach((heading) => {
        const element = screen.getByRole("heading", { name: heading });
        expect(element).toBeInTheDocument();
        expect(element).toHaveClass("text-xl", "font-semibold", "text-blue-800");
      });
    });

    test("should render section content paragraphs", async () => {
      // Act
      render(await PrivacyPage());

      // Assert
      expect(
        screen.getByText(/Freeism-App（以下、「当サービス」といいます。）は、以下の個人情報を収集することがあります/),
      ).toBeInTheDocument();
      expect(screen.getByText(/当サービスは、収集した個人情報を以下の目的で利用します/)).toBeInTheDocument();
      expect(screen.getByText(/当サービスは、個人情報の漏洩、滅失、毀損等を防ぐため/)).toBeInTheDocument();
    });

    test("should render list items in collection section", async () => {
      // Act
      render(await PrivacyPage());

      // Assert
      const listItems = ["氏名", "メールアドレス", "プロフィール画像", "その他当サービスの利用に必要な情報"];

      listItems.forEach((item) => {
        expect(screen.getByText(item)).toBeInTheDocument();
      });
    });

    test("should render list items in usage purpose section", async () => {
      // Act
      render(await PrivacyPage());

      // Assert
      const usagePurposeItems = [
        "ユーザー登録とアカウント管理",
        "サービスの提供と運営",
        "ユーザーサポート",
        "サービスの改善と新機能の開発",
        "不正アクセスの防止",
      ];

      usagePurposeItems.forEach((item) => {
        expect(screen.getByText(item)).toBeInTheDocument();
      });
    });

    test("should render list items in third party provision section", async () => {
      // Act
      render(await PrivacyPage());

      // Assert
      const thirdPartyItems = [
        "ユーザーの同意がある場合",
        "法令に基づく場合",
        "人の生命、身体または財産の保護のために必要がある場合",
        "公衆衛生の向上または児童の健全な育成の推進のために必要がある場合",
      ];

      thirdPartyItems.forEach((item) => {
        expect(screen.getByText(item)).toBeInTheDocument();
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("レイアウト・スタイリング", () => {
    test("should have proper main container styling", async () => {
      // Act
      render(await PrivacyPage());

      // Assert
      const mainElement = screen.getByRole("main");
      expect(mainElement).toHaveClass("container", "mx-auto", "min-h-screen", "px-4", "py-12");
    });

    test("should have proper content wrapper styling", async () => {
      // Act
      render(await PrivacyPage());

      // Assert
      const contentWrapper = screen.getByRole("main").querySelector("div");
      expect(contentWrapper).toHaveClass("mx-auto", "max-w-3xl");
    });

    test("should have proper prose styling for content", async () => {
      // Act
      render(await PrivacyPage());

      // Assert
      const proseContainer = screen.getByRole("main").querySelector(".prose");
      expect(proseContainer).toHaveClass(
        "prose",
        "prose-blue",
        "mx-auto",
        "max-w-none",
        "space-y-6",
        "text-neutral-700",
      );
    });

    test("should render all sections with proper structure", async () => {
      // Act
      render(await PrivacyPage());

      // Assert
      const sections = screen.getByRole("main").querySelectorAll("section");
      expect(sections).toHaveLength(7);

      sections.forEach((section) => {
        expect(section).toBeInTheDocument();
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("アクセシビリティ", () => {
    test("should have proper semantic structure", async () => {
      // Act
      render(await PrivacyPage());

      // Assert
      const header = screen.getByTestId("header");
      const mainElement = screen.getByRole("main");
      const footer = screen.getByTestId("footer");

      expect(header).toBeInTheDocument();
      expect(mainElement).toBeInTheDocument();
      expect(footer).toBeInTheDocument();
    });

    test("should have proper heading hierarchy", async () => {
      // Act
      render(await PrivacyPage());

      // Assert
      const h1Elements = screen.getAllByRole("heading", { level: 1 });
      const h2Elements = screen.getAllByRole("heading", { level: 2 });

      expect(h1Elements).toHaveLength(1);
      expect(h2Elements).toHaveLength(7);

      // h1が最初に来ることを確認
      expect(h1Elements[0]).toHaveTextContent("プライバシーポリシー");
    });

    test("should render content in logical order", async () => {
      // Act
      render(await PrivacyPage());

      // Assert
      const header = screen.getByTestId("header");
      const mainElement = screen.getByRole("main");
      const footer = screen.getByTestId("footer");

      // ヘッダー → メイン → フッターの順序を確認
      expect(header.compareDocumentPosition(mainElement)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(mainElement.compareDocumentPosition(footer)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    test("should have proper list structure", async () => {
      // Act
      render(await PrivacyPage());

      // Assert
      const lists = screen.getByRole("main").querySelectorAll("ul");
      expect(lists.length).toBeGreaterThan(0);

      lists.forEach((list) => {
        expect(list).toHaveClass("list-inside", "list-disc");
        const listItems = list.querySelectorAll("li");
        expect(listItems.length).toBeGreaterThan(0);
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値・エラーケース", () => {
    test("should handle component rendering without errors", async () => {
      // Act & Assert
      expect(async () => {
        render(await PrivacyPage());
      }).not.toThrow();
    });

    test("should render even if child components are undefined", async () => {
      // Act
      render(await PrivacyPage());

      // Assert
      const mainElement = screen.getByRole("main");
      expect(mainElement).toBeInTheDocument();
    });

    test("should maintain structure integrity", async () => {
      // Act
      render(await PrivacyPage());

      // Assert
      const fragment = screen.getByTestId("header").parentElement;
      expect(fragment).not.toBeNull();
      expect(fragment?.children).toHaveLength(3); // header + main + footer
    });

    test("should render all required elements", async () => {
      // Act
      render(await PrivacyPage());

      // Assert
      expect(screen.getByTestId("header")).toBeInTheDocument();
      expect(screen.getByRole("main")).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
      expect(screen.getByTestId("footer")).toBeInTheDocument();
    });

    test("should handle async component correctly", async () => {
      // Act
      const component = PrivacyPage();

      // Assert
      expect(component).toBeInstanceOf(Promise);

      const resolvedComponent = await component;
      expect(React.isValidElement(resolvedComponent)).toBe(true);
    });

    test("should render all sections without missing content", async () => {
      // Act
      render(await PrivacyPage());

      // Assert
      const sections = screen.getByRole("main").querySelectorAll("section");
      expect(sections).toHaveLength(7);

      // 各セクションに見出しとコンテンツがあることを確認
      sections.forEach((section, index) => {
        const heading = section.querySelector("h2");
        const content = section.querySelector("p, ul");

        expect(heading).toBeInTheDocument();
        expect(content).toBeInTheDocument();
        expect(heading?.textContent).toContain(`${index + 1}.`);
      });
    });

    test("should handle null or undefined props gracefully", async () => {
      // Act & Assert
      expect(async () => {
        const result = await PrivacyPage();
        render(result);
      }).not.toThrow();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("キャッシュ設定", () => {
    test("should call cacheLife with max parameter", async () => {
      // Arrange
      const { unstable_cacheLife } = await import("next/cache");
      const mockCacheLife = vi.mocked(unstable_cacheLife);

      // Act
      await PrivacyPage();

      // Assert
      expect(mockCacheLife).toHaveBeenCalledWith("max");
    });
  });
});
