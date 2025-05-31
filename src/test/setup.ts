import "@testing-library/jest-dom";

import React from "react";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

// コンソール出力を完全に抑制（テスト中の不要な出力を防ぐ）
const originalConsole = { ...console };

// テストセットアップ
/**
 * 出力されたか検証する場合のコード
 * test("should log error message", () => {
   const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});
   expect(mockConsoleError).toHaveBeenCalledWith("期待するエラーメッセージ");
   mockConsoleError.mockRestore();
 });
 */
beforeAll(() => {
  // テスト開始前の設定
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
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    return React.createElement("img", props);
  },
}));
