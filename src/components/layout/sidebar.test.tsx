import { usePathname } from "next/navigation";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { signOut } from "next-auth/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { Sidebar } from "./sidebar";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// @/lib/utilsのcn関数をモック
vi.mock("@/lib/utils", () => ({
  cn: vi.fn((...classes: (string | undefined | null | boolean)[]) => classes.filter(Boolean).join(" ")),
}));

// next/navigationのモック
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

// next-auth/reactのモック
vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

// Lucide Reactアイコンのモック
vi.mock("lucide-react", () => ({
  History: () => <div data-testid="history-icon">History</div>,
  Home: () => <div data-testid="home-icon">Home</div>,
  Menu: () => <div data-testid="menu-icon">Menu</div>,
  PlusCircle: () => <div data-testid="plus-circle-icon">PlusCircle</div>,
  Search: () => <div data-testid="search-icon">Search</div>,
  Settings: () => <div data-testid="settings-icon">Settings</div>,
  ShoppingCart: () => <div data-testid="shopping-cart-icon">ShoppingCart</div>,
  UserCircle: () => <div data-testid="user-circle-icon">UserCircle</div>,
  X: () => <div data-testid="x-icon">X</div>,
}));

// UIコンポーネントのモック
vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <div data-testid="alert-dialog">{children}</div>,
  AlertDialogAction: ({ children, onClick, ...props }: { children: React.ReactNode; onClick?: () => void; [key: string]: unknown }) => (
    <button data-testid="alert-dialog-action" onClick={onClick} {...props}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <button data-testid="alert-dialog-cancel" {...props}>
      {children}
    </button>
  ),
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="alert-dialog-content">{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div data-testid="alert-dialog-footer">{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="alert-dialog-header">{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div data-testid="alert-dialog-title">{children}</div>,
  AlertDialogTrigger: ({ children, asChild: _asChild, ...props }: { children: React.ReactNode; asChild?: boolean; [key: string]: unknown }) => (
    <div data-testid="alert-dialog-trigger" {...props}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: { children: React.ReactNode; onClick?: () => void; [key: string]: unknown }) => (
    <button data-testid="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

// Next.js Linkのモック
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
    scroll,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: () => void;
    scroll?: boolean;
    [key: string]: unknown;
  }) => (
    <a data-testid="link" href={href} onClick={onClick} data-scroll={scroll?.toString()} {...props}>
      {children}
    </a>
  ),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// モック関数の型定義
const mockUsePathname = vi.mocked(usePathname);
const mockSignOut = vi.mocked(signOut);

describe("Sidebar", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
    // デフォルトのpathname設定
    mockUsePathname.mockReturnValue("/dashboard/group-list");
  });

  describe("基本レンダリング", () => {
    test("should render sidebar component correctly", () => {
      render(<Sidebar />);

      // サイドバー本体が表示されることを確認
      const sidebar = screen.getByRole("complementary");
      expect(sidebar).toBeInTheDocument();
      expect(sidebar).toHaveAttribute("id", "app-sidebar");
    });

    test("should render hamburger menu button for mobile", () => {
      render(<Sidebar />);

      // ハンバーガーメニューボタンが表示されることを確認
      const hamburgerButton = screen.getByRole("button", { name: /open menu/i });
      expect(hamburgerButton).toBeInTheDocument();
      expect(hamburgerButton).toHaveClass("sm:hidden");
    });

    test("should render all sidebar sections", () => {
      render(<Sidebar />);

      // 各セクションのタイトルが表示されることを確認
      expect(screen.getByText("Main")).toBeInTheDocument();
      expect(screen.getByText("オークション")).toBeInTheDocument();
      expect(screen.getByText("My Info")).toBeInTheDocument();
      expect(screen.getByText("etc")).toBeInTheDocument();
    });

    test("should render all navigation links", () => {
      render(<Sidebar />);

      // 主要なナビゲーションリンクが表示されることを確認
      expect(screen.getByText("Group一覧")).toBeInTheDocument();
      expect(screen.getByText("Group作成")).toBeInTheDocument();
      expect(screen.getByText("通知作成")).toBeInTheDocument();
      expect(screen.getByText("Task作成")).toBeInTheDocument();
      expect(screen.getByText("レビュー検索")).toBeInTheDocument();
      expect(screen.getByText("GitHub API変換")).toBeInTheDocument();
      expect(screen.getByText("商品一覧")).toBeInTheDocument();
      expect(screen.getByText("入札・落札履歴")).toBeInTheDocument();
      expect(screen.getByText("参加Group一覧")).toBeInTheDocument();
      expect(screen.getByText("Task一覧")).toBeInTheDocument();

      // Settingsリンクを特定のhrefで確認（複数あるため、getAllByRoleを使用）
      const settingsLinks = screen.getAllByRole("link", { name: /settings/i });
      const actualSettingsLink = settingsLinks.find((link) => link.getAttribute("href") === "/dashboard/settings");
      expect(actualSettingsLink).toBeInTheDocument();
      expect(actualSettingsLink).toHaveAttribute("href", "/dashboard/settings");

      expect(screen.getByText("Logout")).toBeInTheDocument();
    });
  });

  describe("状態管理", () => {
    test("should toggle sidebar open state when hamburger button is clicked", () => {
      render(<Sidebar />);

      const hamburgerButton = screen.getByRole("button", { name: /open menu/i });
      const sidebar = screen.getByRole("complementary");

      // 初期状態では閉じている（モバイル）
      expect(sidebar).toHaveClass("-translate-x-full");

      // ハンバーガーボタンをクリック
      fireEvent.click(hamburgerButton);

      // サイドバーが開く
      expect(sidebar).toHaveClass("translate-x-0");

      // ボタンのaria-labelが変更される
      expect(hamburgerButton).toHaveAttribute("aria-label", "Close menu");
    });

    test("should close sidebar when overlay is clicked", () => {
      render(<Sidebar />);

      const hamburgerButton = screen.getByRole("button", { name: /open menu/i });

      // サイドバーを開く
      fireEvent.click(hamburgerButton);

      // オーバーレイが表示される
      const overlay = screen.getByRole("button", { name: /閉じる/i });
      expect(overlay).toBeInTheDocument();

      // オーバーレイをクリック
      fireEvent.click(overlay);

      // サイドバーが閉じる
      const sidebar = screen.getByRole("complementary");
      expect(sidebar).toHaveClass("-translate-x-full");
    });

    test("should close sidebar when Escape key is pressed on overlay", () => {
      render(<Sidebar />);

      const hamburgerButton = screen.getByRole("button", { name: /open menu/i });

      // サイドバーを開く
      fireEvent.click(hamburgerButton);

      // オーバーレイが表示される
      const overlay = screen.getByRole("button", { name: /閉じる/i });
      expect(overlay).toBeInTheDocument();

      // Escapeキーを押す
      fireEvent.keyDown(overlay, { key: "Escape" });

      // サイドバーが閉じる
      const sidebar = screen.getByRole("complementary");
      expect(sidebar).toHaveClass("-translate-x-full");
    });

    test("should update selected path when pathname changes", () => {
      // 初期状態では/dashboard/group-listが選択されている
      render(<Sidebar />);

      // 初期状態の確認
      const groupListLinks = screen.getAllByRole("link", { name: /group一覧/i });
      const actualGroupListLink = groupListLinks.find((link) => link.getAttribute("href") === "/dashboard/group-list");
      expect(actualGroupListLink).toHaveClass("bg-blue-100", "text-blue-900");

      // 前のレンダリング結果をクリア
      cleanup();

      // pathnameを変更して新しいコンポーネントをレンダリング
      mockUsePathname.mockReturnValue("/dashboard/settings");

      // 新しいpathnameで再レンダリング
      render(<Sidebar />);

      // 新しいレンダリング後のSettingsリンクを取得
      const newSettingsLinks = screen.getAllByRole("link", { name: /settings/i });
      const actualSettingsLink = newSettingsLinks.find((link) => link.getAttribute("href") === "/dashboard/settings");
      expect(actualSettingsLink).toHaveClass("bg-blue-100", "text-blue-900");

      // Group一覧リンクは選択されていない状態になる
      const newGroupListLinks = screen.getAllByRole("link", { name: /group一覧/i });
      const newActualGroupListLink = newGroupListLinks.find((link) => link.getAttribute("href") === "/dashboard/group-list");
      expect(newActualGroupListLink).toHaveClass("text-gray-900");
    });
  });

  describe("ナビゲーション", () => {
    test("should close sidebar when navigation link is clicked", () => {
      render(<Sidebar />);

      const hamburgerButton = screen.getByRole("button", { name: /open menu/i });

      // サイドバーを開く
      fireEvent.click(hamburgerButton);

      // ナビゲーションリンクをクリック
      const groupListLinks = screen.getAllByRole("link", { name: /group一覧/i });
      const actualGroupListLink = groupListLinks.find((link) => link.getAttribute("href") === "/dashboard/group-list");
      fireEvent.click(actualGroupListLink!);

      // サイドバーが閉じる
      const sidebar = screen.getByRole("complementary");
      expect(sidebar).toHaveClass("-translate-x-full");
    });

    test("should have correct href attributes for all navigation links", () => {
      render(<Sidebar />);

      // 各リンクのhref属性を確認
      const groupListLinks = screen.getAllByRole("link", { name: /group一覧/i });
      const actualGroupListLink = groupListLinks.find((link) => link.getAttribute("href") === "/dashboard/group-list");
      expect(actualGroupListLink).toHaveAttribute("href", "/dashboard/group-list");

      expect(screen.getByRole("link", { name: /group作成/i })).toHaveAttribute("href", "/dashboard/create-group");
      expect(screen.getByRole("link", { name: /通知作成/i })).toHaveAttribute("href", "/dashboard/create-notification");
      expect(screen.getByRole("link", { name: /task作成/i })).toHaveAttribute("href", "/dashboard/create-task");
      expect(screen.getByRole("link", { name: /レビュー検索/i })).toHaveAttribute("href", "/dashboard/review-search");
      expect(screen.getByRole("link", { name: /github api変換/i })).toHaveAttribute("href", "/dashboard/github-api-conversion");
      expect(screen.getByRole("link", { name: /商品一覧/i })).toHaveAttribute("href", "/dashboard/auction");
      expect(screen.getByRole("link", { name: /入札・落札履歴/i })).toHaveAttribute("href", "/dashboard/auction/history");
      expect(screen.getByRole("link", { name: /参加group一覧/i })).toHaveAttribute("href", "/dashboard/my-group");
      expect(screen.getByRole("link", { name: /task一覧/i })).toHaveAttribute("href", "/dashboard/my-task");

      const settingsLinks = screen.getAllByRole("link", { name: /settings/i });
      const actualSettingsLink = settingsLinks.find((link) => link.getAttribute("href") === "/dashboard/settings");
      expect(actualSettingsLink).toHaveAttribute("href", "/dashboard/settings");
    });

    test("should have scroll=false attribute for all navigation links", () => {
      render(<Sidebar />);

      // すべてのリンクがdata-scroll=falseを持つことを確認
      const allLinks = screen.getAllByTestId("link");
      allLinks.forEach((link) => {
        expect(link).toHaveAttribute("data-scroll", "false");
      });
    });
  });

  describe("ログアウト機能", () => {
    test("should render logout confirmation dialog", () => {
      render(<Sidebar />);

      // ログアウト確認ダイアログの要素が表示されることを確認
      expect(screen.getByTestId("alert-dialog-content")).toBeInTheDocument();
      expect(screen.getByTestId("alert-dialog-title")).toHaveTextContent("ログアウトしますか？");
      expect(screen.getByTestId("alert-dialog-cancel")).toHaveTextContent("キャンセル");
      expect(screen.getByTestId("alert-dialog-action")).toBeInTheDocument();
    });

    test("should call signOut when logout button is clicked", () => {
      render(<Sidebar />);

      // ログアウトボタンをクリック（AlertDialogAction内のButtonをクリック）
      const logoutButtons = screen.getAllByTestId("button");
      const actualLogoutButton = logoutButtons.find((button) => button.textContent === "ログアウト");
      fireEvent.click(actualLogoutButton!);

      // signOut関数が正しい引数で呼ばれることを確認
      expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: "/" });
    });

    test("should close sidebar when logout link is clicked", () => {
      render(<Sidebar />);

      const hamburgerButton = screen.getByRole("button", { name: /open menu/i });

      // サイドバーを開く
      fireEvent.click(hamburgerButton);

      // ログアウトリンクをクリック
      const logoutLink = screen.getByRole("link", { name: /logout/i });
      fireEvent.click(logoutLink);

      // サイドバーが閉じる
      const sidebar = screen.getByRole("complementary");
      expect(sidebar).toHaveClass("-translate-x-full");
    });
  });
});
