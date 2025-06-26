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

// Tanstack Query のモック設定
vi.mock("@tanstack/react-query", async () => {
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

export { mockUseQuery, mockUseMutation, mockUseInfiniteQuery, mockUseQueryClient };

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
  mutateAsync: vi.fn(),
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
