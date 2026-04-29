import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { useBreakpoint } from "./use-breakpoint";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("useBreakpoint", () => {
  // モック用の変数
  let mockMatchMedia: ReturnType<typeof vi.fn>;
  let mockAddEventListener: ReturnType<typeof vi.fn>;
  let mockRemoveEventListener: ReturnType<typeof vi.fn>;
  let originalMatchMedia: typeof window.matchMedia;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  beforeEach(() => {
    // 元のmatchMediaを保存
    originalMatchMedia = window.matchMedia;

    // matchMediaのモック関数を作成
    mockAddEventListener = vi.fn();
    mockRemoveEventListener = vi.fn();
    mockMatchMedia = vi.fn();

    // windowオブジェクトにmatchMediaを設定
    window.matchMedia = mockMatchMedia;
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  afterEach(() => {
    // 元のmatchMediaを復元
    window.matchMedia = originalMatchMedia;
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("初期状態テスト（正常系・境界値）", () => {
    test.each([
      {
        matches: false,
        expectedIsSmUp: false,
        description: "should return isSmUp as false when screen width is less than 640px",
      },
      {
        matches: true,
        expectedIsSmUp: true,
        description: "should return isSmUp as true when screen width is 640px or more",
      },
    ])("$description", ({ matches, expectedIsSmUp }) => {
      mockMatchMedia.mockImplementation(() => ({
        matches,
        media: "(min-width: 640px)",
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
        dispatchEvent: vi.fn(),
      }));

      const { result, unmount } = renderHook(() => useBreakpoint());

      expect(result.current.isSmUp).toBe(expectedIsSmUp);
      expect(mockMatchMedia).toHaveBeenCalledWith("(min-width: 640px)");
      expect(mockAddEventListener).toHaveBeenCalledWith("change", expect.any(Function));

      unmount();

      expect(mockRemoveEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("動的変更テスト", () => {
    test.each([
      {
        initialMatches: false,
        changeToMatches: true,
        expectedInitial: false,
        expectedAfterChange: true,
        description: "should update isSmUp when media query changes from false to true",
      },
      {
        initialMatches: true,
        changeToMatches: false,
        expectedInitial: true,
        expectedAfterChange: false,
        description: "should update isSmUp when media query changes from true to false",
      },
    ])("$description", ({ initialMatches, changeToMatches, expectedInitial, expectedAfterChange }) => {
      let mediaQueryHandler: ((e: MediaQueryListEvent) => void) | null = null;

      mockMatchMedia.mockImplementation(() => ({
        matches: initialMatches,
        media: "(min-width: 640px)",
        addEventListener: vi.fn().mockImplementation((event: string, handler: (e: MediaQueryListEvent) => void) => {
          if (event === "change") {
            mediaQueryHandler = handler;
          }
        }),
        removeEventListener: mockRemoveEventListener,
        dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => useBreakpoint());

      // 初期状態の確認
      expect(result.current.isSmUp).toBe(expectedInitial);

      // メディアクエリの変更をシミュレート
      act(() => {
        if (mediaQueryHandler) {
          mediaQueryHandler({ matches: changeToMatches } as unknown as MediaQueryListEvent);
        }
      });

      // 状態が更新されることを確認
      expect(result.current.isSmUp).toBe(expectedAfterChange);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系・エッジケーステスト", () => {
    test("should handle matchMedia not supported", () => {
      // matchMediaがサポートされていない場合のテスト
      window.matchMedia = undefined as unknown as typeof window.matchMedia;

      // エラーが発生せず、初期値がfalseになることを確認
      const { result } = renderHook(() => useBreakpoint());
      expect(result.current.isSmUp).toBe(false);
    });

    test("should handle multiple rapid changes", () => {
      let mediaQueryHandler: ((e: MediaQueryListEvent) => void) | null = null;

      mockMatchMedia.mockImplementation(() => ({
        matches: false,
        media: "(min-width: 640px)",
        addEventListener: vi.fn().mockImplementation((event: string, handler: (e: MediaQueryListEvent) => void) => {
          if (event === "change") {
            mediaQueryHandler = handler;
          }
        }),
        removeEventListener: mockRemoveEventListener,
        dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => useBreakpoint());

      // 初期状態
      expect(result.current.isSmUp).toBe(false);

      // 複数回の急速な変更をシミュレート
      act(() => {
        if (mediaQueryHandler) {
          mediaQueryHandler({ matches: true } as unknown as MediaQueryListEvent);
          mediaQueryHandler({ matches: false } as unknown as MediaQueryListEvent);
          mediaQueryHandler({ matches: true } as unknown as MediaQueryListEvent);
        }
      });

      // 最後の状態が反映されることを確認
      expect(result.current.isSmUp).toBe(true);
    });

    test.each([
      { matches: null, expectedResult: null, description: "should handle null matches value" },
      { matches: undefined, expectedResult: undefined, description: "should handle undefined matches value" },
      { matches: "invalid", expectedResult: "invalid", description: "should handle string matches value" },
    ])("$description", ({ matches, expectedResult }) => {
      let mediaQueryHandler: ((e: MediaQueryListEvent) => void) | null = null;

      mockMatchMedia.mockImplementation(() => ({
        matches: false,
        media: "(min-width: 640px)",
        addEventListener: vi.fn().mockImplementation((event: string, handler: (e: MediaQueryListEvent) => void) => {
          if (event === "change") {
            mediaQueryHandler = handler;
          }
        }),
        removeEventListener: mockRemoveEventListener,
        dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => useBreakpoint());

      // 不正なイベントオブジェクトが渡された場合の動作を確認
      act(() => {
        if (mediaQueryHandler) {
          mediaQueryHandler({ matches } as unknown as MediaQueryListEvent);
        }
      });

      // 実際の実装では e.matches がそのまま設定されるため、渡された値が設定される
      expect(result.current.isSmUp).toBe(expectedResult);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("メモリリーク防止テスト", () => {
    test.each([
      { mountCount: 1, description: "should properly clean up event listeners on single mount/unmount" },
      { mountCount: 3, description: "should properly clean up event listeners on multiple mounts/unmounts" },
    ])("$description", ({ mountCount }) => {
      mockMatchMedia.mockImplementation(() => ({
        matches: false,
        media: "(min-width: 640px)",
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
        dispatchEvent: vi.fn(),
      }));

      // 指定回数マウント・アンマウント
      const unmountFunctions = [];
      for (let i = 0; i < mountCount; i++) {
        const { unmount } = renderHook(() => useBreakpoint());
        unmountFunctions.push(unmount);
      }

      // 指定回数のマウントで指定回数のaddEventListenerが呼ばれることを確認
      expect(mockAddEventListener).toHaveBeenCalledTimes(mountCount);

      // アンマウント
      unmountFunctions.forEach((unmount) => unmount());

      // 指定回数のアンマウントで指定回数のremoveEventListenerが呼ばれることを確認
      expect(mockRemoveEventListener).toHaveBeenCalledTimes(mountCount);
    });

    test("should use the same handler function for add and remove", () => {
      let addedHandler: ((e: MediaQueryListEvent) => void) | undefined;
      let removedHandler: ((e: MediaQueryListEvent) => void) | undefined;

      mockMatchMedia.mockImplementation(() => ({
        matches: false,
        media: "(min-width: 640px)",
        addEventListener: vi.fn().mockImplementation((_event: string, handler: (e: MediaQueryListEvent) => void) => {
          addedHandler = handler;
        }),
        removeEventListener: vi.fn().mockImplementation((_event: string, handler: (e: MediaQueryListEvent) => void) => {
          removedHandler = handler;
        }),
        dispatchEvent: vi.fn(),
      }));

      const { unmount } = renderHook(() => useBreakpoint());
      unmount();

      // 追加と削除で同じハンドラー関数が使用されることを確認
      expect(addedHandler).toBeDefined();
      expect(removedHandler).toBeDefined();
      expect(addedHandler).toBe(removedHandler);
    });
  });
});
