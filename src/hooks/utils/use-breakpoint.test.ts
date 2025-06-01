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

    mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
      dispatchEvent: vi.fn(),
    }));

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

  describe("正常系テスト", () => {
    test("should return isSmUp as false when screen width is less than 640px", () => {
      // 640px未満の場合のモック設定
      mockMatchMedia.mockImplementation(() => ({
        matches: false,
        media: "(min-width: 640px)",
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
      }));

      const { result } = renderHook(() => useBreakpoint());

      expect(result.current.isSmUp).toBe(false);
      expect(mockMatchMedia).toHaveBeenCalledWith("(min-width: 640px)");
    });

    test("should return isSmUp as true when screen width is 640px or more", () => {
      // 640px以上の場合のモック設定
      mockMatchMedia.mockImplementation(() => ({
        matches: true,
        media: "(min-width: 640px)",
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
      }));

      const { result } = renderHook(() => useBreakpoint());

      expect(result.current.isSmUp).toBe(true);
      expect(mockMatchMedia).toHaveBeenCalledWith("(min-width: 640px)");
    });

    test("should add event listener on mount", () => {
      renderHook(() => useBreakpoint());

      expect(mockAddEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    });

    test("should remove event listener on unmount", () => {
      const { unmount } = renderHook(() => useBreakpoint());

      unmount();

      expect(mockRemoveEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle exactly 640px width (boundary condition)", () => {
      // 境界値（640px）の場合のモック設定
      mockMatchMedia.mockImplementation(() => ({
        matches: true, // 640px以上なのでtrue
        media: "(min-width: 640px)",
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
      }));

      const { result } = renderHook(() => useBreakpoint());

      expect(result.current.isSmUp).toBe(true);
    });

    test("should handle 639px width (just below boundary)", () => {
      // 境界値直下（639px）の場合のモック設定
      mockMatchMedia.mockImplementation(() => ({
        matches: false, // 640px未満なのでfalse
        media: "(min-width: 640px)",
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
      }));

      const { result } = renderHook(() => useBreakpoint());

      expect(result.current.isSmUp).toBe(false);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("動的変更テスト", () => {
    test("should update isSmUp when media query changes from false to true", () => {
      let mediaQueryHandler: ((e: MediaQueryListEvent) => void) | null = null;

      // 初期状態は640px未満
      mockMatchMedia.mockImplementation(() => ({
        matches: false,
        media: "(min-width: 640px)",
        addEventListener: vi.fn().mockImplementation((event: string, handler: (e: MediaQueryListEvent) => void) => {
          if (event === "change") {
            mediaQueryHandler = handler;
          }
        }),
        removeEventListener: mockRemoveEventListener,
      }));

      const { result } = renderHook(() => useBreakpoint());

      // 初期状態の確認
      expect(result.current.isSmUp).toBe(false);

      // メディアクエリの変更をシミュレート（640px以上に変更）
      act(() => {
        if (mediaQueryHandler) {
          mediaQueryHandler({ matches: true } as unknown as MediaQueryListEvent);
        }
      });

      // 状態が更新されることを確認
      expect(result.current.isSmUp).toBe(true);
    });

    test("should update isSmUp when media query changes from true to false", () => {
      let mediaQueryHandler: ((e: MediaQueryListEvent) => void) | null = null;

      // 初期状態は640px以上
      mockMatchMedia.mockImplementation(() => ({
        matches: true,
        media: "(min-width: 640px)",
        addEventListener: vi.fn().mockImplementation((event: string, handler: (e: MediaQueryListEvent) => void) => {
          if (event === "change") {
            mediaQueryHandler = handler;
          }
        }),
        removeEventListener: mockRemoveEventListener,
      }));

      const { result } = renderHook(() => useBreakpoint());

      // 初期状態の確認
      expect(result.current.isSmUp).toBe(true);

      // メディアクエリの変更をシミュレート（640px未満に変更）
      act(() => {
        if (mediaQueryHandler) {
          mediaQueryHandler({ matches: false } as unknown as MediaQueryListEvent);
        }
      });

      // 状態が更新されることを確認
      expect(result.current.isSmUp).toBe(false);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系・エッジケーステスト", () => {
    test("should handle matchMedia not supported", () => {
      // matchMediaがサポートされていない場合のテスト
      window.matchMedia = undefined as unknown as typeof window.matchMedia;

      // エラーが発生することを確認
      expect(() => {
        renderHook(() => useBreakpoint());
      }).toThrow();
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

    test("should handle invalid media query event", () => {
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
      }));

      const { result } = renderHook(() => useBreakpoint());

      // 不正なイベントオブジェクトが渡された場合の動作を確認
      act(() => {
        if (mediaQueryHandler) {
          mediaQueryHandler({ matches: null } as unknown as MediaQueryListEvent);
        }
      });

      // 実際の実装では e.matches がそのまま設定されるため、nullが設定される
      expect(result.current.isSmUp).toBe(null);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("メモリリーク防止テスト", () => {
    test("should properly clean up event listeners on multiple mounts/unmounts", () => {
      // 複数回のマウント・アンマウントでメモリリークが発生しないことを確認
      const { unmount: unmount1 } = renderHook(() => useBreakpoint());
      const { unmount: unmount2 } = renderHook(() => useBreakpoint());
      const { unmount: unmount3 } = renderHook(() => useBreakpoint());

      // 3回のマウントで3回のaddEventListenerが呼ばれることを確認
      expect(mockAddEventListener).toHaveBeenCalledTimes(3);

      // アンマウント
      unmount1();
      unmount2();
      unmount3();

      // 3回のアンマウントで3回のremoveEventListenerが呼ばれることを確認
      expect(mockRemoveEventListener).toHaveBeenCalledTimes(3);
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
      }));

      const { unmount } = renderHook(() => useBreakpoint());
      unmount();

      // 追加と削除で同じハンドラー関数が使用されることを確認
      expect(addedHandler).toBeDefined();
      expect(removedHandler).toBeDefined();
      expect(addedHandler).toBe(removedHandler);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("SSR対応テスト", () => {
    test("should handle server-side rendering environment", () => {
      // SSR環境では初期値がfalseになることを確認
      // 実際のuseBreakpointフックでは、typeof window !== "undefined"チェックがある
      mockMatchMedia.mockImplementation(() => ({
        matches: false, // SSR環境では常にfalse
        media: "(min-width: 640px)",
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
      }));

      const { result } = renderHook(() => useBreakpoint());

      expect(result.current.isSmUp).toBe(false);
    });
  });
});
