import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { vi } from "vitest";

// テスト用のQueryClientを作成
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

// プロバイダーでラップするコンポーネント
export function AllTheProviders({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light">
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}

// ホイストされたモック関数の宣言
const { mockUseQuery, mockUseMutation, mockUseInfiniteQuery, mockUseQueryClient } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  mockUseMutation: vi.fn(),
  mockUseInfiniteQuery: vi.fn(),
  mockUseQueryClient: vi.fn(),
}));

// 注意: use-push-notification.test.tsではTanStack Queryのモックを無効化するため、
// これらのモックは他のテストでのみ使用されます

export { mockUseQuery, mockUseMutation, mockUseInfiniteQuery, mockUseQueryClient };

// TanStack Queryのモックを適用する関数
export function applyTanStackQueryMocks() {
  vi.doMock("@tanstack/react-query", async () => {
    const actual = await vi.importActual("@tanstack/react-query");
    return {
      ...actual,
      useQuery: mockUseQuery,
      useMutation: mockUseMutation,
      useInfiniteQuery: mockUseInfiniteQuery,
      useQueryClient: mockUseQueryClient,
      QueryClient: actual.QueryClient,
      QueryClientProvider: actual.QueryClientProvider,
    };
  });

  // デフォルトのモック実装
  mockUseQuery.mockReturnValue({
    data: undefined,
    isPending: false,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  });

  mockUseMutation.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isLoading: false,
    isError: false,
    error: null,
    reset: vi.fn(),
    data: undefined,
  });

  mockUseInfiniteQuery.mockReturnValue({
    data: undefined,
    isPending: false,
    isLoading: false,
    isFetching: false,
    isFetchingNextPage: false,
    isError: false,
    error: null,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    refetch: vi.fn(),
  });

  mockUseQueryClient.mockReturnValue({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
    getQueryData: vi.fn(),
    removeQueries: vi.fn(),
    clear: vi.fn(),
    prefetchQuery: vi.fn(),
    setQueriesData: vi.fn(),
  });
}

// TanStack Queryのモックを無効化する関数
export function disableTanStackQueryMocks() {
  vi.doUnmock("@tanstack/react-query");
}
