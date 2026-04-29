import React from "react";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";

// 統合テスト用のQueryClientを作成（TanStack Queryのフックをモックしない）
const createIntegrationTestQueryClient = () =>
  new QueryClient({
    mutationCache: new MutationCache({
      onError: () => {
        // テスト環境では空実装（トースト表示などを無効化）
      },
      onSuccess: () => {
        // テスト環境では空実装
      },
    }),
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
        onError: () => {
          // テスト環境では空実装（メタ処理をスキップ）
        },
        onSuccess: () => {
          // テスト環境では空実装（メタ処理をスキップ）
        },
        onSettled: () => {
          // テスト環境では空実装（メタ処理をスキップ）
        },
      },
    },
  });

// 統合テスト用プロバイダー（TanStack Queryの実際のフックを使用）
export function IntegrationTestProviders({ children }: { children: React.ReactNode }) {
  const queryClient = createIntegrationTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light">
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
