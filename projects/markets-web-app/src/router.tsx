import { createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { routeTree } from "./routeTree.gen";
import { createMarketsClient, type MarketsClient } from "./client/api/markets-client";

export interface MarketsRouterContext {
  marketsClient: MarketsClient;
  queryClient: QueryClient;
}

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { refetchOnWindowFocus: true, retry: 1 } },
  });
  const marketsClient = createMarketsClient();
  return createRouter({
    context: { marketsClient, queryClient },
    defaultPreloadStaleTime: 0,
    routeTree,
    scrollRestoration: true,
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
