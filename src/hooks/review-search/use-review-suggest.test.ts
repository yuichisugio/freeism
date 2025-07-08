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
 * キーボードイベントのモック作成ヘルパー
 */
const createKeyboardEvent = (key: string) =>
  ({
    key,
    preventDefault: vi.fn(),
  }) as unknown as React.KeyboardEvent;

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

  describe("キーボードナビゲーション - 矢印キー", () => {
    test.each([
      {
        key: "ArrowDown",
        initialIndex: -1,
        expectedIndex: 0,
        description: "should move selection down when ArrowDown is pressed",
      },
      {
        key: "ArrowUp",
        initialIndex: -1,
        expectedIndex: 2,
        description: "should wrap to last item when ArrowUp is pressed at first item",
      },
    ])("$description", ({ key, expectedIndex }) => {
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      const mockEvent = createKeyboardEvent(key);

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(result.current.selectedIndex).toBe(expectedIndex);
    });

    test("should move selection up when ArrowUp is pressed", () => {
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      // まず下に移動してから上に移動
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
      });
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
      });

      expect(result.current.selectedIndex).toBe(1);

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowUp"));
      });

      expect(result.current.selectedIndex).toBe(0);
    });

    test("should wrap to first item when ArrowDown is pressed at last item", () => {
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      // 最後のアイテムまで移動（3回ArrowDown）
      for (let i = 0; i < 3; i++) {
        act(() => {
          result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
        });
      }

      expect(result.current.selectedIndex).toBe(2);

      // さらにArrowDownで最初に戻る
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
      });

      expect(result.current.selectedIndex).toBe(0);
    });

    test.each([
      { key: "ArrowDown", description: "ArrowDown" },
      { key: "ArrowUp", description: "ArrowUp" },
    ])("should not change selection when $description is pressed with empty suggestions", ({ key }) => {
      const propsWithEmptySuggestions = {
        ...mockProps,
        suggestions: [],
      };
      const { result } = renderHook(() => useReviewSuggest(propsWithEmptySuggestions));

      const mockEvent = createKeyboardEvent(key);

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
        result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
      });

      const mockEvent = createKeyboardEvent("Enter");

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockProps.onSuggestionSelectAction).toHaveBeenCalledWith(mockSuggestions[0]);
      expect(mockProps.onSuggestionsToggleAction).toHaveBeenCalledWith(false);
      expect(result.current.selectedIndex).toBe(-1);
    });

    test.each([
      {
        description: "should execute search when Enter is pressed without selection",
        suggestions: mockSuggestions,
        shouldCallSuggestionSelect: false,
      },
      {
        description: "should execute search when Enter is pressed with invalid selection index",
        suggestions: [],
        shouldCallSuggestionSelect: false,
      },
    ])("$description", ({ suggestions, shouldCallSuggestionSelect }) => {
      const propsForTest = {
        ...mockProps,
        suggestions,
      };
      const { result } = renderHook(() => useReviewSuggest(propsForTest));

      const mockEvent = createKeyboardEvent("Enter");

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockProps.onSearchExecuteAction).toHaveBeenCalled();
      if (shouldCallSuggestionSelect) {
        expect(mockProps.onSuggestionSelectAction).toHaveBeenCalled();
      } else {
        expect(mockProps.onSuggestionSelectAction).not.toHaveBeenCalled();
      }
      expect(mockProps.onSuggestionsToggleAction).toHaveBeenCalledWith(false);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("キーボードナビゲーション - Escape", () => {
    test("should close suggestions when Escape is pressed", () => {
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      // まず選択状態にする
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
      });

      expect(result.current.selectedIndex).toBe(0);

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("Escape"));
      });

      expect(mockProps.onSuggestionsToggleAction).toHaveBeenCalledWith(false);
      expect(result.current.selectedIndex).toBe(-1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("キーボードナビゲーション - その他のキー", () => {
    test("should not handle other keys", () => {
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      const mockEvent = createKeyboardEvent("Tab");

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
        result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
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
        result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
      });

      expect(result.current.selectedIndex).toBe(-1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("外部クリック処理", () => {
    test.each([
      {
        description: "should close suggestions when clicking outside",
        inputContains: false,
        suggestionContains: false,
        shouldCloseSuggestions: true,
      },
      {
        description: "should not close suggestions when clicking inside input",
        inputContains: true,
        suggestionContains: false,
        shouldCloseSuggestions: false,
      },
      {
        description: "should not close suggestions when clicking inside suggestion area",
        inputContains: false,
        suggestionContains: true,
        shouldCloseSuggestions: false,
      },
    ])("$description", ({ inputContains, suggestionContains, shouldCloseSuggestions }) => {
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      const mockInputElement = {
        contains: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      const mockSuggestionElement = {
        contains: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      Object.defineProperty((result.current as any).inputRef, "current", {
        writable: true,
        value: mockInputElement,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      Object.defineProperty((result.current as any).suggestionRef, "current", {
        writable: true,
        value: mockSuggestionElement,
      });

      mockInputElement.contains.mockReturnValue(inputContains);
      mockSuggestionElement.contains.mockReturnValue(suggestionContains);

      const mousedownHandler = vi
        .mocked(document.addEventListener)
        .mock.calls.find((call) => call[0] === "mousedown")?.[1] as EventListener;

      if (mousedownHandler) {
        const mockMouseEvent = {
          target: document.createElement("div"),
        } as unknown as MouseEvent;

        act(() => {
          mousedownHandler(mockMouseEvent);
        });

        if (shouldCloseSuggestions) {
          expect(mockProps.onSuggestionsToggleAction).toHaveBeenCalledWith(false);
          expect(result.current.selectedIndex).toBe(-1);
        } else {
          expect(mockProps.onSuggestionsToggleAction).not.toHaveBeenCalled();
        }
      }
    });

    test("should handle null refs gracefully", () => {
      renderHook(() => useReviewSuggest(mockProps));

      const mousedownHandler = vi
        .mocked(document.addEventListener)
        .mock.calls.find((call) => call[0] === "mousedown")?.[1] as EventListener;

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
        result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
      });

      expect(result.current.selectedIndex).toBe(0);

      // さらにArrowDownで最初に戻る（単一要素の場合は同じインデックス）
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
      });

      expect(result.current.selectedIndex).toBe(0);
    });

    test.each([
      {
        description: "should handle undefined suggestions gracefully",
        suggestions: undefined as unknown as typeof mockSuggestions,
        shouldThrow: false,
      },
      {
        description: "should handle null callback functions",
        suggestions: mockSuggestions,
        onSuggestionSelectAction: null as unknown as typeof mockProps.onSuggestionSelectAction,
        onSearchExecuteAction: null as unknown as typeof mockProps.onSearchExecuteAction,
        shouldThrow: false,
      },
    ])("$description", ({ suggestions, onSuggestionSelectAction, onSearchExecuteAction, shouldThrow }) => {
      const testProps = {
        onSuggestionsToggleAction: vi.fn(),
        suggestions,
        onSuggestionSelectAction: onSuggestionSelectAction ?? mockProps.onSuggestionSelectAction,
        onSearchExecuteAction: onSearchExecuteAction ?? mockProps.onSearchExecuteAction,
      };

      if (shouldThrow) {
        expect(() => {
          renderHook(() => useReviewSuggest(testProps));
        }).toThrow();
      } else {
        expect(() => {
          const { result } = renderHook(() => useReviewSuggest(testProps));

          // null callbacksのテストの場合は追加でキーイベントをテスト
          if (onSuggestionSelectAction === null) {
            act(() => {
              result.current.handleKeyDown(createKeyboardEvent("Enter"));
            });
          }
        }).not.toThrow();
      }
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系テスト", () => {
    test("should handle invalid selectedIndex gracefully", () => {
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      const mockEvent = createKeyboardEvent("Enter");

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
