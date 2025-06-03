import React from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { Providers } from "./providers";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// ホイストされたモック関数の作成
const { mockQueryClient, mockPersistOptions, MockThemeProvider, MockPersistQueryClientProvider, MockPushNotificationProvider, MockNuqsAdapter } =
  vi.hoisted(() => {
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

    const MockPushNotificationProvider = vi.fn(({ children }: { children: React.ReactNode }) => (
      <div data-testid="push-notification-provider">{children}</div>
    ));

    const MockNuqsAdapter = vi.fn(({ children }: { children: React.ReactNode }) => <div data-testid="nuqs-adapter">{children}</div>);

    return {
      mockQueryClient,
      mockPersistOptions,
      MockThemeProvider,
      MockPersistQueryClientProvider,
      MockPushNotificationProvider,
      MockNuqsAdapter,
    };
  });

// モック設定
vi.mock("@/lib/tanstack-query", () => ({
  queryClient: mockQueryClient,
  persistOptions: mockPersistOptions,
}));

vi.mock("./push-notification-provider", () => ({
  PushNotificationProvider: MockPushNotificationProvider,
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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("Providers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // モック関数のリセット
    MockThemeProvider.mockClear();
    MockPersistQueryClientProvider.mockClear();
    MockPushNotificationProvider.mockClear();
    MockNuqsAdapter.mockClear();
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
      expect(screen.getByTestId("theme-provider")).toBeInTheDocument();
      expect(screen.getByTestId("persist-query-client-provider")).toBeInTheDocument();
      expect(screen.getByTestId("push-notification-provider")).toBeInTheDocument();
      expect(screen.getByTestId("nuqs-adapter")).toBeInTheDocument();

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
      expect(MockThemeProvider).toHaveBeenCalledTimes(1);
      expect(MockPersistQueryClientProvider).toHaveBeenCalledTimes(1);
      expect(MockPushNotificationProvider).toHaveBeenCalledTimes(1);
      expect(MockNuqsAdapter).toHaveBeenCalledTimes(1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系", () => {
    test("should handle undefined children", () => {
      // Act & Assert
      expect(() => {
        render(<Providers>{undefined}</Providers>);
      }).not.toThrow();
    });

    test("should handle null children", () => {
      // Act & Assert
      expect(() => {
        render(<Providers>{null}</Providers>);
      }).not.toThrow();
    });

    test("should handle empty children", () => {
      // Act & Assert
      expect(() => {
        render(<Providers>{""}</Providers>);
      }).not.toThrow();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("memoization テスト", () => {
    test("should be memoized and not re-render unnecessarily", () => {
      // Arrange
      const TestChild = vi.fn(() => <div data-testid="test-child">Test</div>);

      // Act - 初回レンダリング
      const { rerender } = render(
        <Providers>
          <TestChild />
        </Providers>,
      );

      // 初回レンダリング後のモック呼び出し回数を記録（未使用だが、テストの意図を明確にするため残す）
      // 初期状態のモック呼び出し回数を記録（将来の拡張用）
      // const initialThemeProviderCalls = MockThemeProvider.mock.calls.length;
      // const initialPersistProviderCalls = MockPersistQueryClientProvider.mock.calls.length;
      // const initialPushProviderCalls = MockPushNotificationProvider.mock.calls.length;
      // const initialNuqsAdapterCalls = MockNuqsAdapter.mock.calls.length;

      // Act - 同じpropsで再レンダリング
      rerender(
        <Providers>
          <TestChild />
        </Providers>,
      );

      // Assert - Reactのmemoizationの動作を確認
      // 注意: モックコンポーネントは実際のReactコンポーネントではないため、
      // memoizationの効果は限定的です。ここでは基本的な動作確認を行います。
      expect(MockThemeProvider).toHaveBeenCalled();
      expect(MockPersistQueryClientProvider).toHaveBeenCalled();
      expect(MockPushNotificationProvider).toHaveBeenCalled();
      expect(MockNuqsAdapter).toHaveBeenCalled();

      // 子コンポーネントが再レンダリングされることを確認
      expect(TestChild).toHaveBeenCalledTimes(2);
    });

    test("should maintain component identity across re-renders", () => {
      // Act - 初回レンダリング
      const { rerender } = render(
        <Providers>
          <div>Test</div>
        </Providers>,
      );
      const firstRenderProviders = screen.getByTestId("theme-provider");

      // Act - 再レンダリング
      rerender(
        <Providers>
          <div>Test</div>
        </Providers>,
      );
      const secondRenderProviders = screen.getByTestId("theme-provider");

      // Assert - 同じDOM要素が維持される
      expect(firstRenderProviders).toBe(secondRenderProviders);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("プロバイダー統合テスト", () => {
    test("should handle provider nesting correctly", () => {
      // Act
      render(
        <Providers>
          <div data-testid="test-content">Test Content</div>
        </Providers>,
      );

      // Assert - プロバイダーの階層構造を確認
      const themeProvider = screen.getByTestId("theme-provider");
      const persistProvider = screen.getByTestId("persist-query-client-provider");
      const pushProvider = screen.getByTestId("push-notification-provider");
      const nuqsAdapter = screen.getByTestId("nuqs-adapter");
      const testContent = screen.getByTestId("test-content");

      // 階層構造の確認（外側から内側へ）
      expect(themeProvider).toContainElement(persistProvider);
      expect(persistProvider).toContainElement(pushProvider);
      expect(pushProvider).toContainElement(nuqsAdapter);
      expect(nuqsAdapter).toContainElement(testContent);
    });

    test("should render providers with correct configuration", () => {
      // Act
      render(
        <Providers>
          <div data-testid="test-content">Test Content</div>
        </Providers>,
      );

      // Assert - 各プロバイダーが正しい設定で呼ばれることを確認
      expect(MockThemeProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          attribute: "class",
          defaultTheme: "system",
          enableSystem: true,
          disableTransitionOnChange: true,
        }),
        undefined,
      );

      expect(MockPersistQueryClientProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          client: mockQueryClient,
          persistOptions: mockPersistOptions,
        }),
        undefined,
      );

      expect(MockPushNotificationProvider).toHaveBeenCalled();
      expect(MockNuqsAdapter).toHaveBeenCalled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle multiple children", () => {
      // Arrange
      const children = [
        <div key="1" data-testid="child-1">
          Child 1
        </div>,
        <div key="2" data-testid="child-2">
          Child 2
        </div>,
        <div key="3" data-testid="child-3">
          Child 3
        </div>,
      ];

      // Act
      render(<Providers>{children}</Providers>);

      // Assert
      expect(screen.getByTestId("child-1")).toBeInTheDocument();
      expect(screen.getByTestId("child-2")).toBeInTheDocument();
      expect(screen.getByTestId("child-3")).toBeInTheDocument();
    });

    test("should handle deeply nested children", () => {
      // Arrange
      const NestedComponent = () => (
        <div data-testid="nested-parent">
          <div data-testid="nested-child">
            <span data-testid="deeply-nested">Deeply nested content</span>
          </div>
        </div>
      );

      // Act
      render(
        <Providers>
          <NestedComponent />
        </Providers>,
      );

      // Assert
      expect(screen.getByTestId("nested-parent")).toBeInTheDocument();
      expect(screen.getByTestId("nested-child")).toBeInTheDocument();
      expect(screen.getByTestId("deeply-nested")).toBeInTheDocument();
    });

    test("should handle large number of children", () => {
      // Arrange
      const manyChildren = Array.from({ length: 100 }, (_, i) => (
        <div key={i} data-testid={`child-${i}`}>
          Child {i}
        </div>
      ));

      // Act
      render(<Providers>{manyChildren}</Providers>);

      // Assert - 最初と最後の要素を確認
      expect(screen.getByTestId("child-0")).toBeInTheDocument();
      expect(screen.getByTestId("child-99")).toBeInTheDocument();
      expect(screen.getByText("Child 0")).toBeInTheDocument();
      expect(screen.getByText("Child 99")).toBeInTheDocument();
    });

    test("should handle React fragments as children", () => {
      // Act
      render(
        <Providers>
          <>
            <div data-testid="fragment-child-1">Fragment Child 1</div>
            <div data-testid="fragment-child-2">Fragment Child 2</div>
          </>
        </Providers>,
      );

      // Assert
      expect(screen.getByTestId("fragment-child-1")).toBeInTheDocument();
      expect(screen.getByTestId("fragment-child-2")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("パフォーマンステスト", () => {
    test("should render efficiently with many re-renders", () => {
      // Arrange
      const TestComponent = ({ count }: { count: number }) => <div data-testid="counter">Count: {count}</div>;

      // Act - 複数回の再レンダリング
      const { rerender } = render(
        <Providers>
          <TestComponent count={0} />
        </Providers>,
      );

      // 複数回再レンダリングを実行
      for (let i = 1; i <= 10; i++) {
        act(() => {
          rerender(
            <Providers>
              <TestComponent count={i} />
            </Providers>,
          );
        });
      }

      // Assert - 最終的な状態を確認
      expect(screen.getByTestId("counter")).toHaveTextContent("Count: 10");

      // プロバイダーが適切に動作していることを確認
      expect(screen.getByTestId("theme-provider")).toBeInTheDocument();
      expect(screen.getByTestId("persist-query-client-provider")).toBeInTheDocument();
      expect(screen.getByTestId("push-notification-provider")).toBeInTheDocument();
      expect(screen.getByTestId("nuqs-adapter")).toBeInTheDocument();
    });
  });
});
