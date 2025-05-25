import "@testing-library/jest-dom";

import React from "react";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

// テストセットアップ
beforeAll(() => {
  // テスト開始前の設定
});

afterEach(() => {
  // 各テスト後にDOMをクリーンアップ
  cleanup();
});

afterAll(() => {
  // すべてのテスト終了後のクリーンアップ
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
