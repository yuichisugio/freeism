import { render, screen } from "@testing-library/react";
import { Factory } from "fishery";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { Footer } from "./footer";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ホイストされたモック関数の宣言
 */
const { mockCacheLife } = vi.hoisted(() => ({
  mockCacheLife: vi.fn(),
}));

/**
 * モック設定
 */

// Next.js Linkコンポーネントのモック
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// SVGコンポーネントのモック
vi.mock("@/components/ui/svg", () => ({
  TwitterLogoSvg: () => <svg data-testid="twitter-logo" />,
  GitHubLogoSvg: () => <svg data-testid="github-logo" />,
}));

// Next.js cacheのモック
vi.mock("next/cache", () => ({
  unstable_cacheLife: mockCacheLife,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Fisheryファクトリーを使用したテストデータ作成
 */

// 現在の年度を取得するファクトリー
const currentYearFactory = Factory.define<{ year: number }>(() => ({
  year: new Date().getFullYear(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ作成ヘルパー関数
 */

const createTestYear = () => {
  return currentYearFactory.build();
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// 各テスト前にモックをリセット
beforeEach(() => {
  vi.clearAllMocks();
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("Footer", () => {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("基本レンダリング", () => {
    test("should render Footer component correctly", async () => {
      render(await Footer());

      // フッター要素が存在することを確認
      const footer = screen.getByRole("contentinfo");
      expect(footer).toBeInTheDocument();
    });

    test("should apply correct CSS classes to footer element", async () => {
      render(await Footer());

      const footer = screen.getByRole("contentinfo");
      expect(footer).toHaveClass(
        "w-full",
        "border-t",
        "border-blue-100",
        "bg-gradient-to-b",
        "from-white",
        "to-blue-50",
        "dark:border-blue-900",
        "dark:from-gray-950",
        "dark:to-blue-950",
      );
    });

    test("should display current year in copyright", async () => {
      const testYear = createTestYear();
      render(await Footer());

      const copyrightText = screen.getByText(`© ${testYear.year} Freeism-App. All rights reserved.`);
      expect(copyrightText).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("Legal情報セクション", () => {
    test("should render Legal section with correct heading", async () => {
      render(await Footer());

      const legalHeading = screen.getByRole("heading", { name: "Legal" });
      expect(legalHeading).toBeInTheDocument();
      expect(legalHeading).toHaveClass("mb-3", "text-lg", "font-semibold", "text-blue-900", "sm:mb-4", "dark:text-blue-100");
    });

    test("should render terms of service link", async () => {
      render(await Footer());

      const termsLink = screen.getByRole("link", { name: "利用規約" });
      expect(termsLink).toBeInTheDocument();
      expect(termsLink).toHaveAttribute("href", "/terms");
    });

    test("should render privacy policy link", async () => {
      render(await Footer());

      const privacyLink = screen.getByRole("link", { name: "プライバシーポリシー" });
      expect(privacyLink).toBeInTheDocument();
      expect(privacyLink).toHaveAttribute("href", "/privacy");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("SNSリンクセクション", () => {
    test("should render About section with correct heading", async () => {
      render(await Footer());

      const aboutHeading = screen.getByRole("heading", { name: "About" });
      expect(aboutHeading).toBeInTheDocument();
      expect(aboutHeading).toHaveClass("mb-3", "text-lg", "font-semibold", "text-blue-900", "sm:mb-4", "dark:text-blue-100");
    });

    test("should render Twitter link with correct attributes", async () => {
      render(await Footer());

      const twitterLinks = screen.getAllByRole("link").filter((link) => link.getAttribute("href") === "https://x.com/sugi_sugi_329");

      expect(twitterLinks).toHaveLength(1);
      const twitterLink = twitterLinks[0];
      expect(twitterLink).toHaveAttribute("target", "_blank");
      expect(twitterLink).toHaveAttribute("rel", "noopener noreferrer");
    });

    test("should render GitHub link with correct attributes", async () => {
      render(await Footer());

      const githubLinks = screen.getAllByRole("link").filter((link) => link.getAttribute("href") === "https://github.com/yuichisugio");

      expect(githubLinks).toHaveLength(1);
      const githubLink = githubLinks[0];
      expect(githubLink).toHaveAttribute("target", "_blank");
      expect(githubLink).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("SVGコンポーネント", () => {
    test("should render TwitterLogoSvg component", async () => {
      render(await Footer());

      const twitterLogo = screen.getByTestId("twitter-logo");
      expect(twitterLogo).toBeInTheDocument();
    });

    test("should render GitHubLogoSvg component", async () => {
      render(await Footer());

      const githubLogo = screen.getByTestId("github-logo");
      expect(githubLogo).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("レスポンシブ対応", () => {
    test("should apply responsive classes to container", async () => {
      render(await Footer());

      const container = screen.getByRole("contentinfo").querySelector(".container");
      expect(container).toHaveClass("mx-auto", "px-4", "py-8", "sm:py-12");
    });

    test("should apply responsive grid classes", async () => {
      render(await Footer());

      const gridContainer = screen.getByRole("contentinfo").querySelector(".grid");
      expect(gridContainer).toHaveClass("grid", "grid-cols-1", "gap-8", "text-center", "sm:grid-cols-2", "sm:gap-40", "sm:text-left");
    });

    test("should apply responsive classes to Legal links", async () => {
      render(await Footer());

      const termsLink = screen.getByRole("link", { name: "利用規約" });
      expect(termsLink).toHaveClass(
        "text-sm",
        "text-neutral-600",
        "transition-colors",
        "hover:text-blue-600",
        "sm:text-base",
        "dark:text-neutral-400",
        "dark:hover:text-blue-300",
      );
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("アクセシビリティ", () => {
    test("should have proper semantic structure", async () => {
      render(await Footer());

      // footer要素がcontentinfoロールを持つことを確認
      const footer = screen.getByRole("contentinfo");
      expect(footer).toBeInTheDocument();

      // 見出し要素が適切に設定されていることを確認
      const headings = screen.getAllByRole("heading");
      expect(headings).toHaveLength(2);
      expect(headings[0]).toHaveTextContent("Legal");
      expect(headings[1]).toHaveTextContent("About");
    });

    test("should have proper link accessibility", async () => {
      render(await Footer());

      // 外部リンクが適切なrel属性を持つことを確認
      const externalLinks = screen.getAllByRole("link").filter((link) => link.getAttribute("target") === "_blank");

      externalLinks.forEach((link) => {
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
      });
    });

    test("should have proper list structure for Legal links", async () => {
      render(await Footer());

      const legalList = screen.getByRole("list");
      expect(legalList).toBeInTheDocument();

      const listItems = screen.getAllByRole("listitem");
      expect(listItems).toHaveLength(2);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値・エラーケース", () => {
    test("should handle different year values correctly", async () => {
      // 現在の年度を取得
      const currentYear = new Date().getFullYear();

      render(await Footer());

      const copyrightText = screen.getByText(`© ${currentYear} Freeism-App. All rights reserved.`);
      expect(copyrightText).toBeInTheDocument();
    });

    test("should render all required elements even with minimal content", async () => {
      render(await Footer());

      // 必須要素が全て存在することを確認
      expect(screen.getByRole("contentinfo")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Legal" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "About" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "利用規約" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toBeInTheDocument();
      expect(screen.getByTestId("twitter-logo")).toBeInTheDocument();
      expect(screen.getByTestId("github-logo")).toBeInTheDocument();
    });

    test("should maintain proper structure with all CSS classes", async () => {
      render(await Footer());

      const footer = screen.getByRole("contentinfo");

      // フッターの基本構造を確認
      expect(footer.children).toHaveLength(1); // container div

      const container = footer.children[0];
      expect(container).toHaveClass("container");

      const flexContainer = container.children[0];
      expect(flexContainer).toHaveClass("flex", "flex-col", "items-center");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("キャッシュ機能", () => {
    test("should call unstable_cacheLife with max parameter", async () => {
      render(await Footer());

      expect(mockCacheLife).toHaveBeenCalledWith("max");
    });
  });
});
