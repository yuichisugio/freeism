import type { Metadata } from "next";
import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import SignInPage, { metadata } from "./page";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// Next.jsのキャッシュ機能をモック
vi.mock("next/cache", () => ({
  unstable_cacheLife: vi.fn(),
}));

// 子コンポーネントをモック
vi.mock("@/components/auth/sign-in-button", () => ({
  SignInButton: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <button data-testid="sign-in-button" className={className}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/layout/footer", () => ({
  Footer: () => <footer data-testid="footer">Footer</footer>,
}));

vi.mock("@/components/ui/svg", () => ({
  GoogleLogoSvg: () => <svg data-testid="google-logo" />,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("SignInPage", () => {
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
        title: "ログイン | Freeism-App",
        description: "Freeism-Appへのログインページです。",
      } satisfies Metadata);
    });

    test("should have metadata as a static export", () => {
      // Assert
      expect(metadata).toBeDefined();
      expect(typeof metadata).toBe("object");
      expect(metadata.title).toBe("ログイン | Freeism-App");
      expect(metadata.description).toBe("Freeism-Appへのログインページです。");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("基本レンダリング", () => {
    test("should render page correctly", async () => {
      // Act
      render(await SignInPage());

      // Assert
      const mainElement = screen.getByRole("main");
      expect(mainElement).toBeInTheDocument();
    });

    test("should return a valid React fragment", async () => {
      // Act
      const result = await SignInPage();

      // Assert
      expect(result).toBeDefined();
      expect(React.isValidElement(result)).toBe(true);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("コンテンツ要素", () => {
    test("should render page title", async () => {
      // Act
      render(await SignInPage());

      // Assert
      const title = screen.getByRole("heading", { name: "新規登録/ログイン" });
      expect(title).toBeInTheDocument();
      expect(title).toHaveClass("text-3xl", "font-bold", "text-blue-600", "dark:text-blue-400");
    });

    test("should render welcome message", async () => {
      // Act
      render(await SignInPage());

      // Assert
      const welcomeMessage = screen.getByText("Freeism-Appへようこそ");
      expect(welcomeMessage).toBeInTheDocument();
      expect(welcomeMessage).toHaveClass("mt-2", "text-neutral-700", "dark:text-neutral-400");
    });

    test("should render page title as h1 element", async () => {
      // Act
      render(await SignInPage());

      // Assert
      const title = screen.getByRole("heading", { level: 1 });
      expect(title).toBeInTheDocument();
      expect(title).toHaveTextContent("新規登録/ログイン");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("子コンポーネント", () => {
    test("should render SignInButton component", async () => {
      // Act
      render(await SignInPage());

      // Assert
      const signInButton = screen.getByTestId("sign-in-button");
      expect(signInButton).toBeInTheDocument();
      expect(signInButton).toHaveTextContent("Google");
    });

    test("should render GoogleLogoSvg component", async () => {
      // Act
      render(await SignInPage());

      // Assert
      const googleLogo = screen.getByTestId("google-logo");
      expect(googleLogo).toBeInTheDocument();
    });

    test("should render Footer component", async () => {
      // Act
      render(await SignInPage());

      // Assert
      const footer = screen.getByTestId("footer");
      expect(footer).toBeInTheDocument();
    });

    test("should render SignInButton with correct CSS classes", async () => {
      // Act
      render(await SignInPage());

      // Assert
      const signInButton = screen.getByTestId("sign-in-button");
      expect(signInButton).toHaveClass(
        "inline-flex",
        "w-full",
        "items-center",
        "justify-center",
        "gap-3",
        "rounded-lg",
        "border",
        "border-neutral-300",
        "bg-white",
        "py-3",
        "text-sm",
        "font-bold",
        "text-neutral-800",
        "transition-colors",
        "hover:bg-neutral-50",
        "focus:outline-none",
        "focus-visible:ring-0",
        "dark:border-neutral-700",
        "dark:bg-gray-700",
        "dark:text-neutral-200",
        "dark:hover:bg-gray-800",
      );
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("レイアウトとスタイル", () => {
    test("should apply correct CSS classes to main element", async () => {
      // Act
      render(await SignInPage());

      // Assert
      const mainElement = screen.getByRole("main");
      expect(mainElement).toHaveClass(
        "flex",
        "min-h-screen",
        "flex-col",
        "items-center",
        "justify-center",
        "bg-gradient-to-b",
        "from-white",
        "to-blue-50",
        "dark:border-blue-900",
        "dark:from-gray-950",
        "dark:via-blue-950",
        "dark:to-gray-950",
      );
    });

    test("should apply correct CSS classes to card container", async () => {
      // Act
      render(await SignInPage());

      // Assert
      const cardContainer = screen.getByRole("main").querySelector("div");
      expect(cardContainer).toHaveClass("w-full", "max-w-md", "rounded-xl", "bg-white", "p-8", "shadow-lg", "dark:bg-gray-900");
    });

    test("should apply correct CSS classes to content wrapper", async () => {
      // Act
      render(await SignInPage());

      // Assert
      const contentWrapper = screen.getByRole("main").querySelector("div > div");
      expect(contentWrapper).toHaveClass("text-center");
    });

    test("should apply correct CSS classes to button container", async () => {
      // Act
      render(await SignInPage());

      // Assert
      const buttonContainer = screen.getByRole("main").querySelector("div")?.children[1];
      expect(buttonContainer).toHaveClass("mt-8");

      const flexContainer = buttonContainer?.children[0];
      expect(flexContainer).toHaveClass("flex");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("アクセシビリティ", () => {
    test("should have proper semantic structure", async () => {
      // Act
      render(await SignInPage());

      // Assert
      const mainElement = screen.getByRole("main");
      const heading = screen.getByRole("heading", { level: 1 });
      const button = screen.getByRole("button");
      const footer = screen.getByRole("contentinfo");

      expect(mainElement).toBeInTheDocument();
      expect(heading).toBeInTheDocument();
      expect(button).toBeInTheDocument();
      expect(footer).toBeInTheDocument();
    });

    test("should have proper heading hierarchy", async () => {
      // Act
      render(await SignInPage());

      // Assert
      const headings = screen.getAllByRole("heading");
      expect(headings).toHaveLength(1);
      expect(headings[0]).toHaveProperty("tagName", "H1");
    });

    test("should render content in logical order", async () => {
      // Act
      render(await SignInPage());

      // Assert
      const mainElement = screen.getByRole("main");
      const footer = screen.getByTestId("footer");

      // メイン要素がフッターより前に来ることを確認
      expect(mainElement.compareDocumentPosition(footer)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値・エラーケース", () => {
    test("should handle component rendering without errors", async () => {
      // Act & Assert
      expect(async () => {
        render(await SignInPage());
      }).not.toThrow();
    });

    test("should render even if child components are undefined", async () => {
      // Act
      render(await SignInPage());

      // Assert
      const mainElement = screen.getByRole("main");
      expect(mainElement).toBeInTheDocument();
    });

    test("should maintain structure integrity", async () => {
      // Act
      render(await SignInPage());

      // Assert
      const fragment = screen.getByRole("main").parentElement;
      expect(fragment).not.toBeNull();
      expect(fragment?.children).toHaveLength(2); // main + footer
    });

    test("should render all required elements", async () => {
      // Act
      render(await SignInPage());

      // Assert
      expect(screen.getByRole("main")).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
      expect(screen.getByText("Freeism-Appへようこそ")).toBeInTheDocument();
      expect(screen.getByTestId("sign-in-button")).toBeInTheDocument();
      expect(screen.getByTestId("google-logo")).toBeInTheDocument();
      expect(screen.getByTestId("footer")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("コンポーネントの統合", () => {
    test("should integrate all components correctly", async () => {
      // Act
      render(await SignInPage());

      // Assert
      // 全てのコンポーネントが適切に統合されていることを確認
      expect(screen.getByRole("main")).toBeInTheDocument();
      expect(screen.getByRole("heading")).toBeInTheDocument();
      expect(screen.getByTestId("sign-in-button")).toBeInTheDocument();
      expect(screen.getByTestId("google-logo")).toBeInTheDocument();
      expect(screen.getByTestId("footer")).toBeInTheDocument();

      // GoogleLogoSvgがSignInButtonの子要素として存在することを確認
      const signInButton = screen.getByTestId("sign-in-button");
      const googleLogo = screen.getByTestId("google-logo");
      expect(signInButton).toContainElement(googleLogo);
    });

    test("should render components in expected order", async () => {
      // Act
      render(await SignInPage());

      // Assert
      const main = screen.getByRole("main");
      const footer = screen.getByTestId("footer");

      // Document内での順序を確認
      const allElements = Array.from(document.body.querySelectorAll("*"));
      const mainIndex = allElements.indexOf(main);
      const footerIndex = allElements.indexOf(footer);

      expect(mainIndex).toBeLessThan(footerIndex);
    });
  });
});
