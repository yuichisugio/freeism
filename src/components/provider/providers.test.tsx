import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { Providers } from "./providers";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// ホイストされたモック関数の作成
const {
  mockQueryClient,
  mockPersistOptions,
  MockThemeProvider,
  MockPersistQueryClientProvider,
  MockNuqsAdapter,
  MockToaster,
  MockReactQueryDevtools,
} = vi.hoisted(() => {
  const mockQueryClient = {
    getQueryCache: vi.fn(),
    getMutationCache: vi.fn(),
    mount: vi.fn(),
    unmount: vi.fn(),
    clear: vi.fn(),
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
    removeQueries: vi.fn(),
    cancelQueries: vi.fn(),
    isFetching: vi.fn(() => 0),
    isMutating: vi.fn(() => 0),
    getDefaultOptions: vi.fn(() => ({})),
    setDefaultOptions: vi.fn(),
    getQueryDefaults: vi.fn(() => ({})),
    setQueryDefaults: vi.fn(),
    getMutationDefaults: vi.fn(() => ({})),
    setMutationDefaults: vi.fn(),
  };

  const mockPersistOptions = {
    persister: {
      persistClient: vi.fn(),
      restoreClient: vi.fn(),
      removeClient: vi.fn(),
    },
    maxAge: Infinity,
    retry: 1,
    buster: "0",
  };

  const MockThemeProvider = vi.fn(({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <div data-testid="theme-provider" data-props={JSON.stringify(props)}>
      {children}
    </div>
  ));

  const MockPersistQueryClientProvider = vi.fn(
    ({ children, client, persistOptions }: { children: React.ReactNode; client: unknown; persistOptions: unknown }) => (
      <div
        data-testid="persist-query-client-provider"
        data-client={client ? "present" : "missing"}
        data-persist-options={persistOptions ? "present" : "missing"}
      >
        {children}
      </div>
    ),
  );

  const MockNuqsAdapter = vi.fn(({ children }: { children: React.ReactNode }) => <div data-testid="nuqs-adapter">{children}</div>);

  const MockToaster = vi.fn(() => <div data-testid="toaster" />);

  const MockReactQueryDevtools = vi.fn(() => <div data-testid="react-query-devtools" />);

  return {
    mockQueryClient,
    mockPersistOptions,
    MockThemeProvider,
    MockPersistQueryClientProvider,
    MockNuqsAdapter,
    MockToaster,
    MockReactQueryDevtools,
  };
});

// モック設定
vi.mock("@/lib/tanstack-query", () => ({
  queryClient: mockQueryClient,
  persistOptions: mockPersistOptions,
}));

vi.mock("next-themes", () => ({
  ThemeProvider: MockThemeProvider,
}));

vi.mock("@tanstack/react-query-persist-client", () => ({
  PersistQueryClientProvider: MockPersistQueryClientProvider,
}));

vi.mock("nuqs/adapters/next/app", () => ({
  NuqsAdapter: MockNuqsAdapter,
}));

vi.mock("@/components/ui/sonner", () => ({
  Toaster: MockToaster,
}));

vi.mock("@tanstack/react-query-devtools", () => ({
  ReactQueryDevtools: MockReactQueryDevtools,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("Providers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // モック関数のリセット
    MockThemeProvider.mockClear();
    MockPersistQueryClientProvider.mockClear();
    MockNuqsAdapter.mockClear();
    MockToaster.mockClear();
    MockReactQueryDevtools.mockClear();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系", () => {
    test("should render children correctly", () => {
      // Arrange
      const testContent = "Test Content";

      // Act
      render(
        <Providers>
          <div data-testid="test-child">{testContent}</div>
        </Providers>,
      );

      // Assert
      expect(screen.getByTestId("test-child")).toBeInTheDocument();
      expect(screen.getByText(testContent)).toBeInTheDocument();
    });

    test("should render all provider components in correct order", () => {
      // Arrange
      const testContent = "Test Content";

      // Act
      render(
        <Providers>
          <div data-testid="test-child">{testContent}</div>
        </Providers>,
      );

      // Assert
      // 全てのプロバイダーが存在することを確認
      expect(screen.getByTestId("nuqs-adapter")).toBeInTheDocument();
      expect(screen.getByTestId("persist-query-client-provider")).toBeInTheDocument();
      expect(screen.getByTestId("theme-provider")).toBeInTheDocument();
      expect(screen.getByTestId("toaster")).toBeInTheDocument();
      expect(screen.getByTestId("react-query-devtools")).toBeInTheDocument();

      // 子要素が正しくレンダリングされることを確認
      expect(screen.getByTestId("test-child")).toBeInTheDocument();
    });

    test("should pass correct props to ThemeProvider", () => {
      // Act
      render(
        <Providers>
          <div>Test</div>
        </Providers>,
      );

      // Assert - propsの内容を確認（childrenは除外）
      const themeProviderCall = MockThemeProvider.mock.calls[0];
      const props = themeProviderCall[0];

      expect(props.attribute).toBe("class");
      expect(props.defaultTheme).toBe("system");
      expect(props.enableSystem).toBe(true);
      expect(props.disableTransitionOnChange).toBe(true);
      expect(props.children).toBeDefined();
    });

    test("should pass correct props to PersistQueryClientProvider", () => {
      // Act
      render(
        <Providers>
          <div>Test</div>
        </Providers>,
      );

      // Assert - propsの内容を確認
      const persistProviderCall = MockPersistQueryClientProvider.mock.calls[0];
      const props = persistProviderCall[0];

      expect(props.client).toBe(mockQueryClient);
      expect(props.persistOptions).toBe(mockPersistOptions);
      expect(props.children).toBeDefined();

      // data属性の確認
      const persistProvider = screen.getByTestId("persist-query-client-provider");
      expect(persistProvider).toHaveAttribute("data-client", "present");
      expect(persistProvider).toHaveAttribute("data-persist-options", "present");
    });

    test("should call all provider components exactly once", () => {
      // Act
      render(
        <Providers>
          <div>Test</div>
        </Providers>,
      );

      // Assert
      expect(MockNuqsAdapter).toHaveBeenCalledTimes(1);
      expect(MockPersistQueryClientProvider).toHaveBeenCalledTimes(1);
      expect(MockThemeProvider).toHaveBeenCalledTimes(1);
      expect(MockToaster).toHaveBeenCalledTimes(1);
      expect(MockReactQueryDevtools).toHaveBeenCalledTimes(1);
    });

    test("should handle multiple children correctly", () => {
      // Arrange
      const child1 = "Child 1";
      const child2 = "Child 2";

      // Act
      render(
        <Providers>
          <div data-testid="child-1">{child1}</div>
          <div data-testid="child-2">{child2}</div>
        </Providers>,
      );

      // Assert
      expect(screen.getByTestId("child-1")).toBeInTheDocument();
      expect(screen.getByTestId("child-2")).toBeInTheDocument();
      expect(screen.getByText(child1)).toBeInTheDocument();
      expect(screen.getByText(child2)).toBeInTheDocument();
    });

    test("should handle empty children", () => {
      // Act & Assert - エラーが発生しないことを確認
      expect(() => {
        render(<Providers>{null}</Providers>);
      }).not.toThrow();
    });

    test("should use default queryClient and persistOptions", () => {
      // Act
      render(
        <Providers>
          <div>Test</div>
        </Providers>,
      );

      // Assert
      const persistProviderCall = MockPersistQueryClientProvider.mock.calls[0];
      const props = persistProviderCall[0];

      expect(props.client).toBe(mockQueryClient);
      expect(props.persistOptions).toBe(mockPersistOptions);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系", () => {
    test("should handle missing children gracefully", () => {
      // Act & Assert - エラーが発生しないことを確認
      expect(() => {
        render(<Providers>{undefined as unknown as React.ReactNode}</Providers>);
      }).not.toThrow();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("パフォーマンス", () => {
    test("should not cause unnecessary re-renders", () => {
      // Arrange
      const TestComponent = ({ count }: { count: number }) => <div data-testid="counter">Count: {count}</div>;

      const { rerender } = render(
        <Providers>
          <TestComponent count={1} />
        </Providers>,
      );

      // 初期レンダリング後のコール数を記録
      const initialNuqsAdapterCalls = MockNuqsAdapter.mock.calls.length;
      const initialPersistProviderCalls = MockPersistQueryClientProvider.mock.calls.length;
      const initialThemeProviderCalls = MockThemeProvider.mock.calls.length;

      // Act - 子コンポーネントのpropsを変更して再レンダリング
      rerender(
        <Providers>
          <TestComponent count={2} />
        </Providers>,
      );

      // Assert - プロバイダーが再レンダリングされていないことを確認
      expect(MockNuqsAdapter.mock.calls.length).toBe(initialNuqsAdapterCalls);
      expect(MockPersistQueryClientProvider.mock.calls.length).toBe(initialPersistProviderCalls);
      expect(MockThemeProvider.mock.calls.length).toBe(initialThemeProviderCalls);

      // 子コンポーネントは更新されていることを確認
      expect(screen.getByText("Count: 2")).toBeInTheDocument();
    });

    test("should handle rapid re-renders without issues", () => {
      // Arrange
      const TestComponent = ({ value }: { value: string }) => <div data-testid="value">{value}</div>;

      const { rerender } = render(
        <Providers>
          <TestComponent value="initial" />
        </Providers>,
      );

      // Act - 複数回の高速な再レンダリング
      expect(() => {
        for (let i = 0; i < 10; i++) {
          rerender(
            <Providers>
              <TestComponent value={`value-${i}`} />
            </Providers>,
          );
        }
      }).not.toThrow();

      // Assert - 最終的な値が正しく表示されることを確認
      expect(screen.getByText("value-9")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("統合テスト", () => {
    test("should work with complex nested components", () => {
      // Arrange
      const NestedComponent = () => (
        <div data-testid="nested">
          <div data-testid="level-1">
            <div data-testid="level-2">
              <span data-testid="deep-content">Deep nested content</span>
            </div>
          </div>
        </div>
      );

      // Act
      render(
        <Providers>
          <NestedComponent />
        </Providers>,
      );

      // Assert - 深くネストされたコンポーネントが正しくレンダリングされることを確認
      expect(screen.getByTestId("nested")).toBeInTheDocument();
      expect(screen.getByTestId("level-1")).toBeInTheDocument();
      expect(screen.getByTestId("level-2")).toBeInTheDocument();
      expect(screen.getByTestId("deep-content")).toBeInTheDocument();
      expect(screen.getByText("Deep nested content")).toBeInTheDocument();
    });

    test("should maintain provider hierarchy correctly", () => {
      // Act
      render(
        <Providers>
          <div data-testid="test-content">Test</div>
        </Providers>,
      );

      // Assert - DOM階層が正しいことを確認
      const nuqsAdapter = screen.getByTestId("nuqs-adapter");
      const persistProvider = screen.getByTestId("persist-query-client-provider");
      const themeProvider = screen.getByTestId("theme-provider");
      const testContent = screen.getByTestId("test-content");

      // NuqsAdapter が最上位にあることを確認
      expect(nuqsAdapter).toBeInTheDocument();

      // PersistQueryClientProvider が NuqsAdapter の子であることを確認
      expect(nuqsAdapter).toContainElement(persistProvider);

      // ThemeProvider が PersistQueryClientProvider の子であることを確認
      expect(persistProvider).toContainElement(themeProvider);

      // テストコンテンツが ThemeProvider の子であることを確認
      expect(themeProvider).toContainElement(testContent);
    });
  });
});
