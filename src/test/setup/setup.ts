import "@testing-library/jest-dom";

import React from "react";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

afterEach(() => {
  // 各テスト後にDOMをクリーンアップ
  cleanup();
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

// Next.js router のモック
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
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

// Auth.js のモック設定
vi.mock("next-auth", () => ({
  default: vi.fn(() => Promise.resolve()),
}));

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({
    data: {
      user: {
        id: "test-user-id",
        email: "test@example.com",
        name: "Test User",
      },
      accessToken: "test-access-token",
    },
    status: "authenticated",
  })),
  signIn: vi.fn(() => Promise.resolve({ ok: true })),
  signOut: vi.fn(() => Promise.resolve({ ok: true })),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// サーバーサイドの認証モック
vi.mock("next-auth/next", () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: {
        id: "test-user-id",
        email: "test@example.com",
        name: "Test User",
      },
    }),
  ),
}));

// Prisma クライアントのモック
vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    post: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $transaction: vi.fn(),
  },
}));

// Prisma の型安全性を保持したモックヘルパー
export const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  // 他のモデルも同様に定義
};

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
