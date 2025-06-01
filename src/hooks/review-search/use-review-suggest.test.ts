import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useReviewSuggest } from "./use-review-suggest";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータとモック関数の定義
 */
const mockSuggestions = [
  { value: "suggestion1", label: "サジェスト1" },
  { value: "suggestion2", label: "サジェスト2" },
  { value: "suggestion3", label: "サジェスト3" },
];

const createMockProps = () => ({
  onSuggestionsToggleAction: vi.fn(),
  suggestions: mockSuggestions,
  onSuggestionSelectAction: vi.fn(),
  onSearchExecuteAction: vi.fn(),
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * DOM要素のモック
 */
const createMockElement = () => ({
  contains: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("useReviewSuggest", () => {
  let mockProps: ReturnType<typeof createMockProps>;

  beforeEach(() => {
    mockProps = createMockProps();
    vi.clearAllMocks();

    // documentのイベントリスナーをモック
    vi.spyOn(document, "addEventListener");
    vi.spyOn(document, "removeEventListener");
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("初期化", () => {
    test("should initialize with correct default values", () => {
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      expect(result.current.inputRef.current).toBeNull();
      expect(result.current.suggestionRef.current).toBeNull();
      expect(result.current.selectedIndex).toBe(-1);
      expect(typeof result.current.handleKeyDown).toBe("function");
      expect(typeof result.current.handleSubmit).toBe("function");
    });

    test("should register mousedown event listener on mount", () => {
      renderHook(() => useReviewSuggest(mockProps));

      expect(document.addEventListener).toHaveBeenCalledWith("mousedown", expect.any(Function));
    });

    test("should cleanup event listener on unmount", () => {
      const { unmount } = renderHook(() => useReviewSuggest(mockProps));

      unmount();

      expect(document.removeEventListener).toHaveBeenCalledWith("mousedown", expect.any(Function));
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("キーボードナビゲーション - ArrowDown", () => {
    test("should move selection down when ArrowDown is pressed", () => {
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      const mockEvent = {
        key: "ArrowDown",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(result.current.selectedIndex).toBe(0);
    });

    test("should wrap to first item when ArrowDown is pressed at last item", () => {
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      // 最後のアイテムまで移動
      act(() => {
        result.current.handleKeyDown({
          key: "ArrowDown",
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent);
      });
      act(() => {
        result.current.handleKeyDown({
          key: "ArrowDown",
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent);
      });
      act(() => {
        result.current.handleKeyDown({
          key: "ArrowDown",
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent);
      });

      expect(result.current.selectedIndex).toBe(2);

      // さらにArrowDownで最初に戻る
      act(() => {
        result.current.handleKeyDown({
          key: "ArrowDown",
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent);
      });

      expect(result.current.selectedIndex).toBe(0);
    });

    test("should not change selection when ArrowDown is pressed with empty suggestions", () => {
      const propsWithEmptySuggestions = {
        ...mockProps,
        suggestions: [],
      };
      const { result } = renderHook(() => useReviewSuggest(propsWithEmptySuggestions));

      const mockEvent = {
        key: "ArrowDown",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(result.current.selectedIndex).toBe(-1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("キーボードナビゲーション - ArrowUp", () => {
    test("should move selection up when ArrowUp is pressed", () => {
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      // まず下に移動してから上に移動
      act(() => {
        result.current.handleKeyDown({
          key: "ArrowDown",
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent);
      });
      act(() => {
        result.current.handleKeyDown({
          key: "ArrowDown",
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent);
      });

      expect(result.current.selectedIndex).toBe(1);

      act(() => {
        result.current.handleKeyDown({
          key: "ArrowUp",
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent);
      });

      expect(result.current.selectedIndex).toBe(0);
    });

    test("should wrap to last item when ArrowUp is pressed at first item", () => {
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      const mockEvent = {
        key: "ArrowUp",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(result.current.selectedIndex).toBe(2);
    });

    test("should not change selection when ArrowUp is pressed with empty suggestions", () => {
      const propsWithEmptySuggestions = {
        ...mockProps,
        suggestions: [],
      };
      const { result } = renderHook(() => useReviewSuggest(propsWithEmptySuggestions));

      const mockEvent = {
        key: "ArrowUp",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(result.current.selectedIndex).toBe(-1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("キーボードナビゲーション - Enter", () => {
    test("should select suggestion when Enter is pressed with valid selection", () => {
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      // 最初のアイテムを選択
      act(() => {
        result.current.handleKeyDown({
          key: "ArrowDown",
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent);
      });

      const mockEvent = {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockProps.onSuggestionSelectAction).toHaveBeenCalledWith(mockSuggestions[0]);
      expect(mockProps.onSuggestionsToggleAction).toHaveBeenCalledWith(false);
      expect(result.current.selectedIndex).toBe(-1);
    });

    test("should execute search when Enter is pressed without selection", () => {
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      const mockEvent = {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockProps.onSearchExecuteAction).toHaveBeenCalled();
      expect(mockProps.onSuggestionSelectAction).not.toHaveBeenCalled();
      expect(mockProps.onSuggestionsToggleAction).toHaveBeenCalledWith(false);
    });

    test("should execute search when Enter is pressed with invalid selection index", () => {
      // 空のサジェストでEnterを押すケースをテスト
      const propsWithEmptySuggestions = {
        ...mockProps,
        suggestions: [],
      };
      const { result } = renderHook(() => useReviewSuggest(propsWithEmptySuggestions));

      const mockEvent = {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockProps.onSearchExecuteAction).toHaveBeenCalled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("キーボードナビゲーション - Escape", () => {
    test("should close suggestions when Escape is pressed", () => {
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      // まず選択状態にする
      act(() => {
        result.current.handleKeyDown({
          key: "ArrowDown",
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent);
      });

      expect(result.current.selectedIndex).toBe(0);

      const mockEvent = {
        key: "Escape",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockProps.onSuggestionsToggleAction).toHaveBeenCalledWith(false);
      expect(result.current.selectedIndex).toBe(-1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("キーボードナビゲーション - その他のキー", () => {
    test("should not handle other keys", () => {
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      const mockEvent = {
        key: "Tab",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(result.current.selectedIndex).toBe(-1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("フォーム送信", () => {
    test("should execute search and close suggestions when form is submitted", () => {
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      const mockEvent = {
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent;

      act(() => {
        result.current.handleSubmit(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockProps.onSearchExecuteAction).toHaveBeenCalled();
      expect(mockProps.onSuggestionsToggleAction).toHaveBeenCalledWith(false);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("サジェスト変更時の処理", () => {
    test("should reset selected index when suggestions change", () => {
      const { result, rerender } = renderHook((props) => useReviewSuggest(props), { initialProps: mockProps });

      // 選択状態にする
      act(() => {
        result.current.handleKeyDown({
          key: "ArrowDown",
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent);
      });

      expect(result.current.selectedIndex).toBe(0);

      // サジェストを変更
      const newSuggestions = [
        { value: "new1", label: "新しいサジェスト1" },
        { value: "new2", label: "新しいサジェスト2" },
      ];

      rerender({
        ...mockProps,
        suggestions: newSuggestions,
      });

      expect(result.current.selectedIndex).toBe(-1);
    });

    test("should handle empty suggestions array", () => {
      const propsWithEmptySuggestions = {
        ...mockProps,
        suggestions: [],
      };

      const { result } = renderHook(() => useReviewSuggest(propsWithEmptySuggestions));

      expect(result.current.selectedIndex).toBe(-1);

      // キーボード操作をテスト
      act(() => {
        result.current.handleKeyDown({
          key: "ArrowDown",
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent);
      });

      expect(result.current.selectedIndex).toBe(-1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("外部クリック処理", () => {
    test("should close suggestions when clicking outside", () => {
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      // inputRefとsuggestionRefをモック
      const mockInputElement = createMockElement();
      const mockSuggestionElement = createMockElement();

      // refのcurrentプロパティを適切にモック
      Object.defineProperty(result.current.inputRef, "current", {
        writable: true,
        value: mockInputElement,
      });
      Object.defineProperty(result.current.suggestionRef, "current", {
        writable: true,
        value: mockSuggestionElement,
      });

      // 外部要素をクリック
      const outsideElement = document.createElement("div");
      mockInputElement.contains.mockReturnValue(false);
      mockSuggestionElement.contains.mockReturnValue(false);

      // イベントリスナーを取得して実行
      const addEventListenerCalls = vi.mocked(document.addEventListener).mock.calls;
      const mousedownHandler = addEventListenerCalls.find((call) => call[0] === "mousedown")?.[1] as EventListener;

      if (mousedownHandler) {
        const mockMouseEvent = {
          target: outsideElement,
        } as unknown as MouseEvent;

        act(() => {
          mousedownHandler(mockMouseEvent);
        });

        expect(mockProps.onSuggestionsToggleAction).toHaveBeenCalledWith(false);
        expect(result.current.selectedIndex).toBe(-1);
      }
    });

    test("should not close suggestions when clicking inside input", () => {
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      const mockInputElement = createMockElement();
      const mockSuggestionElement = createMockElement();

      // refのcurrentプロパティを適切にモック
      Object.defineProperty(result.current.inputRef, "current", {
        writable: true,
        value: mockInputElement,
      });
      Object.defineProperty(result.current.suggestionRef, "current", {
        writable: true,
        value: mockSuggestionElement,
      });

      mockInputElement.contains.mockReturnValue(true);
      mockSuggestionElement.contains.mockReturnValue(false);

      const addEventListenerCalls = vi.mocked(document.addEventListener).mock.calls;
      const mousedownHandler = addEventListenerCalls.find((call) => call[0] === "mousedown")?.[1] as EventListener;

      if (mousedownHandler) {
        const mockMouseEvent = {
          target: document.createElement("div"),
        } as unknown as MouseEvent;

        act(() => {
          mousedownHandler(mockMouseEvent);
        });

        expect(mockProps.onSuggestionsToggleAction).not.toHaveBeenCalled();
      }
    });

    test("should not close suggestions when clicking inside suggestion area", () => {
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      const mockInputElement = createMockElement();
      const mockSuggestionElement = createMockElement();

      // refのcurrentプロパティを適切にモック
      Object.defineProperty(result.current.inputRef, "current", {
        writable: true,
        value: mockInputElement,
      });
      Object.defineProperty(result.current.suggestionRef, "current", {
        writable: true,
        value: mockSuggestionElement,
      });

      mockInputElement.contains.mockReturnValue(false);
      mockSuggestionElement.contains.mockReturnValue(true);

      const addEventListenerCalls = vi.mocked(document.addEventListener).mock.calls;
      const mousedownHandler = addEventListenerCalls.find((call) => call[0] === "mousedown")?.[1] as EventListener;

      if (mousedownHandler) {
        const mockMouseEvent = {
          target: document.createElement("div"),
        } as unknown as MouseEvent;

        act(() => {
          mousedownHandler(mockMouseEvent);
        });

        expect(mockProps.onSuggestionsToggleAction).not.toHaveBeenCalled();
      }
    });

    test("should handle null refs gracefully", () => {
      renderHook(() => useReviewSuggest(mockProps));

      const addEventListenerCalls = vi.mocked(document.addEventListener).mock.calls;
      const mousedownHandler = addEventListenerCalls.find((call) => call[0] === "mousedown")?.[1] as EventListener;

      if (mousedownHandler) {
        const mockMouseEvent = {
          target: document.createElement("div"),
        } as unknown as MouseEvent;

        // refがnullの状態でイベントを発火
        expect(() => {
          act(() => {
            mousedownHandler(mockMouseEvent);
          });
        }).not.toThrow();
      }
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle suggestions with single item", () => {
      const singleSuggestionProps = {
        ...mockProps,
        suggestions: [{ value: "single", label: "単一サジェスト" }],
      };

      const { result } = renderHook(() => useReviewSuggest(singleSuggestionProps));

      // ArrowDownで選択
      act(() => {
        result.current.handleKeyDown({
          key: "ArrowDown",
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent);
      });

      expect(result.current.selectedIndex).toBe(0);

      // さらにArrowDownで最初に戻る
      act(() => {
        result.current.handleKeyDown({
          key: "ArrowDown",
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent);
      });

      expect(result.current.selectedIndex).toBe(0);
    });

    test("should handle undefined suggestions gracefully", () => {
      const undefinedSuggestionsProps = {
        ...mockProps,
        suggestions: undefined as unknown as typeof mockSuggestions,
      };

      expect(() => {
        renderHook(() => useReviewSuggest(undefinedSuggestionsProps));
      }).not.toThrow();
    });

    test("should handle null callback functions", () => {
      const nullCallbackProps = {
        onSuggestionsToggleAction: vi.fn(),
        suggestions: mockSuggestions,
        onSuggestionSelectAction: null as unknown as typeof mockProps.onSuggestionSelectAction,
        onSearchExecuteAction: null as unknown as typeof mockProps.onSearchExecuteAction,
      };

      const { result } = renderHook(() => useReviewSuggest(nullCallbackProps));

      expect(() => {
        act(() => {
          result.current.handleKeyDown({
            key: "Enter",
            preventDefault: vi.fn(),
          } as unknown as React.KeyboardEvent);
        });
      }).not.toThrow();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系テスト", () => {
    test("should handle invalid selectedIndex gracefully", () => {
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      // 無効なキーイベントでselectedIndexが範囲外になることを想定
      const mockEvent = {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent;

      // selectedIndexが-1の状態でEnterを押す
      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockProps.onSearchExecuteAction).toHaveBeenCalled();
      expect(mockProps.onSuggestionSelectAction).not.toHaveBeenCalled();
    });

    test("should handle event without preventDefault method", () => {
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      const invalidEvent = {
        key: "ArrowDown",
        // preventDefaultがない
      } as unknown as React.KeyboardEvent;

      // preventDefaultがない場合はエラーが発生することを確認
      expect(() => {
        act(() => {
          result.current.handleKeyDown(invalidEvent);
        });
      }).toThrow("e.preventDefault is not a function");
    });
  });
});
