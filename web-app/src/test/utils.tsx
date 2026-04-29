import type { RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { ThemeProvider } from "next-themes";

// テスト用のQueryClientを作成
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

// プロバイダーでラップするコンポーネント
function AllTheProviders({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light">
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}

// カスタムレンダー関数
const customRender = (ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) =>
  render(ui, { wrapper: AllTheProviders, ...options });

// テストユーティリティをエクスポート
export * from "@testing-library/react";
export { customRender as render };

// テストデータファクトリー関数
export const createMockUser = (overrides = {}) => ({
  id: "test-user-id",
  email: "test@example.com",
  name: "Test User",
  image: "https://example.com/avatar.jpg",
  ...overrides,
});

export const createMockAuction = (overrides = {}) => ({
  id: "test-auction-id",
  title: "Test Auction",
  description: "Test auction description",
  startingPrice: 1000,
  currentPrice: 1500,
  endTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24時間後
  status: "ACTIVE",
  ...overrides,
});

// 非同期処理のテスト用ヘルパー
export const waitForLoadingToFinish = () => new Promise((resolve) => setTimeout(resolve, 0));
