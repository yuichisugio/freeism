import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { Header } from "./header";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// next/cacheのモック
vi.mock("next/cache", () => ({
  unstable_cacheLife: vi.fn(),
}));

// Next.js Linkのモック
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
    [key: string]: unknown;
  }) => (
    <a data-testid="link" href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

// NotificationButtonWrapperのモック
vi.mock("@/components/notification/notification-button-wrapper", () => ({
  NotificationButtonWrapper: ({ isMobile }: { isMobile: boolean }) => (
    <div data-testid="notification-button-wrapper" data-is-mobile={isMobile}>
      Notification Button Wrapper
    </div>
  ),
}));

// ThemeToggleのモック
vi.mock("@/components/share/theme-toggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Theme Toggle</div>,
}));

// AppLogoSvgのモック
vi.mock("@/components/ui/svg", () => ({
  AppLogoSvg: () => <div data-testid="app-logo-svg">App Logo</div>,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Headerコンポーネントのテスト
 */
describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 基本的なレンダリングテスト
   */
  describe("基本レンダリング", () => {
    test("should render header component correctly", async () => {
      // Act
      render(await Header({ buttonDisplay: true }));

      // Assert
      const header = screen.getByRole("banner");
      expect(header).toBeInTheDocument();
      expect(header).toHaveAttribute("id", "app-header");
    });

    test("should render app logo and title", async () => {
      // Act
      render(await Header({ buttonDisplay: true }));

      // Assert
      const logos = screen.getAllByTestId("app-logo-svg");
      expect(logos).toHaveLength(2); // モバイル用とデスクトップ用
      expect(logos[0]).toBeInTheDocument();
      expect(logos[1]).toBeInTheDocument();

      const titles = screen.getAllByText("Freeism-App");
      expect(titles).toHaveLength(2); // モバイル用とデスクトップ用
      expect(titles[0]).toBeInTheDocument();
      expect(titles[1]).toBeInTheDocument();
    });

    test("should render home link with correct href", async () => {
      // Act
      render(await Header({ buttonDisplay: true }));

      // Assert
      const homeLinks = screen.getAllByTestId("link");
      const homeLink = homeLinks.find((link) => link.getAttribute("href") === "/");
      expect(homeLink).toBeInTheDocument();
      expect(homeLink).toHaveAttribute("href", "/");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * buttonDisplayプロパティのテスト
   */
  describe("buttonDisplay プロパティ", () => {
    test("should render notification button when buttonDisplay is true", async () => {
      // Act
      render(await Header({ buttonDisplay: true }));

      // Assert
      const notificationButtons = screen.getAllByTestId("notification-button-wrapper");
      expect(notificationButtons).toHaveLength(2); // モバイル用とデスクトップ用

      // モバイル用ボタンの確認
      const mobileButton = notificationButtons.find((button) => button.getAttribute("data-is-mobile") === "true");
      expect(mobileButton).toBeInTheDocument();

      // デスクトップ用ボタンの確認
      const desktopButton = notificationButtons.find((button) => button.getAttribute("data-is-mobile") === "false");
      expect(desktopButton).toBeInTheDocument();
    });

    test("should not render notification button when buttonDisplay is false", async () => {
      // Act
      render(await Header({ buttonDisplay: false }));

      // Assert
      expect(screen.queryByTestId("notification-button-wrapper")).not.toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ThemeToggleのテスト
   */
  describe("ThemeToggle", () => {
    test("should render theme toggle component", async () => {
      // Act
      render(await Header({ buttonDisplay: true }));

      // Assert
      expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
    });

    test("should render theme toggle even when buttonDisplay is false", async () => {
      // Act
      render(await Header({ buttonDisplay: false }));

      // Assert
      expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レスポンシブレイアウトのテスト
   */
  describe("レスポンシブレイアウト", () => {
    test("should render mobile layout with correct CSS classes", async () => {
      // Act
      render(await Header({ buttonDisplay: true }));

      // Assert
      // モバイル用レイアウト（sm未満で表示）
      const mobileLayout = screen.getByRole("banner").querySelector(".sm\\:hidden");
      expect(mobileLayout).toBeInTheDocument();
      expect(mobileLayout).toHaveClass("flex", "h-full", "items-center", "justify-between", "sm:hidden");
    });

    test("should render desktop layout with correct CSS classes", async () => {
      // Act
      render(await Header({ buttonDisplay: true }));

      // Assert
      // デスクトップ用レイアウト（sm以上で表示）
      const desktopLayout = screen.getByRole("banner").querySelector(".sm\\:flex");
      expect(desktopLayout).toBeInTheDocument();
      expect(desktopLayout).toHaveClass("hidden", "h-full", "items-center", "justify-between", "sm:flex");
    });

    test("should render navigation element in desktop layout", async () => {
      // Act
      render(await Header({ buttonDisplay: true }));

      // Assert
      const nav = screen.getByRole("navigation");
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveClass("flex", "items-center", "gap-6", "pr-4");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * CSSクラスとスタイリングのテスト
   */
  describe("CSSクラスとスタイリング", () => {
    test("should have correct header CSS classes", async () => {
      // Act
      render(await Header({ buttonDisplay: true }));

      // Assert
      const header = screen.getByRole("banner");
      expect(header).toHaveClass(
        "sticky",
        "top-0",
        "z-50",
        "w-full",
        "transform-gpu",
        "border-b",
        "border-blue-100",
        "bg-white/80",
        "backdrop-blur-lg",
        "transition-colors",
        "duration-200",
        "dark:border-blue-900",
        "dark:bg-gray-950/80",
      );
    });

    test("should have correct container CSS classes", async () => {
      // Act
      render(await Header({ buttonDisplay: true }));

      // Assert
      const container = screen.getByRole("banner").querySelector(".h-16");
      expect(container).toBeInTheDocument();
      expect(container).toHaveClass("h-16", "w-full", "px-4");
    });

    test("should have correct link styling", async () => {
      // Act
      render(await Header({ buttonDisplay: true }));

      // Assert
      const homeLinks = screen.getAllByTestId("link");
      homeLinks.forEach((link) => {
        expect(link).toHaveClass(
          "flex",
          "items-center",
          "overscroll-none",
          "text-blue-600",
          "transition-colors",
          "hover:text-blue-700",
          "dark:text-blue-400",
          "dark:hover:text-blue-300",
        );
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * アクセシビリティのテスト
   */
  describe("アクセシビリティ", () => {
    test("should have correct semantic HTML structure", async () => {
      // Act
      render(await Header({ buttonDisplay: true }));

      // Assert
      // header要素がbannerロールを持つ
      const header = screen.getByRole("banner");
      expect(header).toBeInTheDocument();
      expect(header.tagName).toBe("HEADER");

      // nav要素がnavigationロールを持つ
      const nav = screen.getByRole("navigation");
      expect(nav).toBeInTheDocument();
      expect(nav.tagName).toBe("NAV");
    });

    test("should have correct id attribute", async () => {
      // Act
      render(await Header({ buttonDisplay: true }));

      // Assert
      const header = screen.getByRole("banner");
      expect(header).toHaveAttribute("id", "app-header");
    });

    test("should have accessible link structure", async () => {
      // Act
      render(await Header({ buttonDisplay: true }));

      // Assert
      const homeLinks = screen.getAllByTestId("link");
      homeLinks.forEach((link) => {
        expect(link).toHaveAttribute("href", "/");
        // リンクにはテキストコンテンツが含まれている
        expect(link).toHaveTextContent("Freeism-App");
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * プロパティのデフォルト値テスト
   */
  describe("プロパティのデフォルト値", () => {
    test("should use default buttonDisplay value when undefined is provided", async () => {
      // Act - undefinedを渡した場合
      render(await Header({ buttonDisplay: undefined as unknown as boolean }));

      // Assert - undefinedの場合でもデフォルト値trueが適用されるため、ボタンが表示される
      const notificationButtons = screen.getAllByTestId("notification-button-wrapper");
      expect(notificationButtons).toHaveLength(2); // モバイル用とデスクトップ用
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 境界値・異常系テスト
   */
  describe("境界値・異常系", () => {
    test("should handle undefined buttonDisplay gracefully", async () => {
      // Act
      render(await Header({ buttonDisplay: undefined as unknown as boolean }));

      // Assert - undefinedの場合でもデフォルト値が適用されるため、ボタンが表示される
      const notificationButtons = screen.getAllByTestId("notification-button-wrapper");
      expect(notificationButtons).toHaveLength(2); // モバイル用とデスクトップ用
    });

    test("should handle null buttonDisplay gracefully", async () => {
      // Act
      render(await Header({ buttonDisplay: null as unknown as boolean }));

      // Assert - nullの場合はfalsyとして扱われる
      expect(screen.queryByTestId("notification-button-wrapper")).not.toBeInTheDocument();
    });

    test("should handle default props gracefully", async () => {
      // Act - デフォルト値を使用
      render(await Header({ buttonDisplay: true }));

      // Assert - 基本的な要素は表示される
      expect(screen.getByRole("banner")).toBeInTheDocument();
      expect(screen.getAllByText("Freeism-App")).toHaveLength(2);
      expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();

      // デフォルト値でボタンが表示される
      const notificationButtons = screen.getAllByTestId("notification-button-wrapper");
      expect(notificationButtons).toHaveLength(2);
    });
  });
});
