import "@testing-library/jest-dom";
import "./auth-js-setup"; // Auth.js関連のモック設定をインポート

import React from "react";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

afterEach(() => {
  // 各テスト後にDOMをクリーンアップ
  cleanup();
  // 各テスト後にモックをリセット
  vi.clearAllMocks();
});

// グローバルなモック設定
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    addListener: () => {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    removeListener: () => {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    addEventListener: () => {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    removeEventListener: () => {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    dispatchEvent: () => {},
  }),
});

// Sonner（トースト通知）のモック
export const mockToastError = vi.fn();
export const mockToastSuccess = vi.fn();
export const mockToastInfo = vi.fn();
export const mockToastWarning = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
    info: mockToastInfo,
    warning: mockToastWarning,
  },
}));

// Next.js navigation のモック
export const mockPush = vi.fn();
export const mockReplace = vi.fn();
export const mockBack = vi.fn();
export const mockForward = vi.fn();
export const mockRefresh = vi.fn();
export const mockPrefetch = vi.fn();
export const mockRedirect = vi.fn();

export const mockNotFound = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    forward: mockForward,
    refresh: mockRefresh,
    prefetch: mockPrefetch,
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
  redirect: mockRedirect,
  notFound: mockNotFound,
}));

// Next-auth/react のモック
export const mockUseSession = vi.fn();
export const mockSignIn = vi.fn();
export const mockSignOut = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: mockUseSession,
  signIn: mockSignIn,
  signOut: mockSignOut,
}));

// Next.js Image コンポーネントのモック
vi.mock("next/image", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: (props: any) => {
    return React.createElement("img", props);
  },
}));

// Next.js server関連のモック
vi.mock("next/server", () => ({
  NextRequest: vi.fn(),
  NextResponse: vi.fn(),
}));

// Fetch APIのグローバルモック
export const fetchMock = vi.fn();
global.fetch = fetchMock;

// 環境変数のテスト専用設定
process.env.NEXTAUTH_URL = "http://localhost:3000";
process.env.NEXTAUTH_SECRET = "test-secret";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test_db";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

// テスト環境固有の設定
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// IntersectionObserver のモック
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// テスト実行時間の監視
const testStartTime = performance.now();

// メモリリークの検出支援
let initialMemoryUsage: NodeJS.MemoryUsage;

beforeAll(() => {
  console.log("テストセットアップ開始");
  initialMemoryUsage = process.memoryUsage();

  // デフォルトのセッション状態を設定
  mockUseSession.mockReturnValue({
    data: {
      user: {
        id: "test-user-id",
        email: "test@example.com",
        name: "Test User",
      },
    },
    status: "authenticated",
  });

  // デフォルトのfetchレスポンスを設定
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
  } as Response);
});

afterAll(() => {
  const testEndTime = performance.now();
  const totalTime = testEndTime - testStartTime;
  console.log(`総テスト実行時間: ${totalTime.toFixed(2)}ms`);
  const finalMemoryUsage = process.memoryUsage();
  const memoryDiff = finalMemoryUsage.heapUsed - initialMemoryUsage.heapUsed;

  if (memoryDiff > 50 * 1024 * 1024) {
    // 50MB以上の増加で警告
    console.warn(`メモリ使用量が大幅に増加: ${(memoryDiff / 1024 / 1024).toFixed(2)}MB`);
  }
});

// 未処理のエラーをキャッチ
process.on("unhandledRejection", (reason) => {
  console.error("未処理のPromise拒否:", reason);
  throw reason;
});

process.on("uncaughtException", (error) => {
  console.error("未処理の例外:", error);
  throw error;
});

// コンソール出力を完全に抑制（テスト中の不要な出力を防ぐ）
const originalConsole = { ...console };

// テストセットアップ
beforeAll(() => {
  // グローバルなconsoleオブジェクトを上書きして出力を抑制
  global.console = {
    ...console,
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    dir: vi.fn(),
  };
});

afterAll(() => {
  // すべてのテスト終了後のクリーンアップ
  // コンソールを元に戻す
  global.console = originalConsole;
  vi.restoreAllMocks();
});

// permission APIのモック
vi.mock("@/lib/actions/permission", () => ({
  checkIsOwner: vi.fn(),
  grantOwnerPermission: vi.fn(),
  checkIsAppOwner: vi.fn(),
  checkGroupMembership: vi.fn(),
  checkOneGroupOwner: vi.fn(),
}));

// notification form APIのモック
vi.mock("@/lib/actions/notification/create-notification-form", () => ({
  prepareCreateNotificationForm: vi.fn(),
}));

// next-themesのモック
vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));
