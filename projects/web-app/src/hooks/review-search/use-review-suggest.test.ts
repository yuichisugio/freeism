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
  // propsの型定義
  let mockProps: {
    onSuggestionsToggleAction: (show: boolean) => void;
    suggestions: Array<{ value: string; label: string }>;
    onSuggestionSelectAction: (suggestion: { value: string; label: string }) => void;
    onSearchExecuteAction: () => void;
  };

  // テスト前の設定
  beforeEach(() => {
    // propsのモック化
    mockProps = {
      onSuggestionsToggleAction: vi.fn(),
      suggestions: mockSuggestions,
      onSuggestionSelectAction: vi.fn(),
      onSearchExecuteAction: vi.fn(),
    };

    // モックのクリア
    vi.clearAllMocks();

    // documentのイベントリスナーをモック化
    vi.spyOn(document, "addEventListener");
    vi.spyOn(document, "removeEventListener");
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("初期化", () => {
    test("should initialize with correct default values", () => {
      // Arrange & Act
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      // Assert
      expect(result.current.inputRef.current).toBeNull();
      expect(result.current.suggestionRef.current).toBeNull();
      expect(result.current.selectedIndex).toBe(-1);
      expect(typeof result.current.handleKeyDown).toBe("function");
      expect(typeof result.current.handleSubmit).toBe("function");
      expect(document.addEventListener).toHaveBeenCalledWith("mousedown", expect.any(Function));
    });

    test("should cleanup event listener on unmount", () => {
      const { unmount } = renderHook(() => useReviewSuggest(mockProps));

      unmount();

      expect(document.removeEventListener).toHaveBeenCalledWith("mousedown", expect.any(Function));
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("キーボードナビゲーション - ↑↓矢印キー", () => {
    test.each([
      {
        key: "ArrowDown",
        expectedIndex: 0,
        description: "initialIndex: -1, should move selection down when ArrowDown is pressed",
      },
      {
        key: "ArrowUp",
        expectedIndex: 2,
        description: "initialIndex: -1, should wrap to last item when ArrowUp is pressed at first item",
      },
    ])("$description", ({ key, expectedIndex }) => {
      // Arrange
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      const mockEvent = createKeyboardEvent(key);

      // Act
      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      // Assert
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(result.current.selectedIndex).toBe(expectedIndex);
    });

    test("should move selection up when ArrowUp is pressed", () => {
      // Arrange
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      // Act
      // まず下に移動してから上に移動。初期値-1の場合は、次が0、その次が1になる
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
      });
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
      });

      // Assert
      expect(result.current.selectedIndex).toBe(1);

      // Act
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowUp"));
      });

      // Assert
      expect(result.current.selectedIndex).toBe(0);
    });

    test("should wrap to first item when ArrowDown is pressed at last item", () => {
      // Arrange
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      // Act
      // 最後のアイテムまで移動（3回ArrowDown）
      for (let i = 0; i < 3; i++) {
        act(() => {
          result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
        });
      }

      // Assert
      expect(result.current.selectedIndex).toBe(2);

      // Act
      // さらにArrowDownで最初に戻る
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
      });

      // Assert
      expect(result.current.selectedIndex).toBe(0);
    });

    test("should wrap to last item when ArrowUp is pressed at first item", () => {
      // Arrange
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      // Act
      // 2回目の最初のアイテムまで移動（4回ArrowUp）
      for (let i = 0; i < 3; i++) {
        act(() => {
          result.current.handleKeyDown(createKeyboardEvent("ArrowUp"));
        });
      }

      // Assert
      expect(result.current.selectedIndex).toBe(0);

      // Act
      // さらにArrowUpで最後に戻る
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowUp"));
      });

      // Assert
      expect(result.current.selectedIndex).toBe(2);
    });

    test.each([
      { key: "ArrowDown", description: "ArrowDown" },
      { key: "ArrowUp", description: "ArrowUp" },
    ])("should not change selection when $description is pressed with empty suggestions", ({ key }) => {
      // Arrange
      const propsWithEmptySuggestions = {
        ...mockProps,
        suggestions: [],
      };
      const { result } = renderHook(() => useReviewSuggest(propsWithEmptySuggestions));

      const mockEvent = createKeyboardEvent(key);

      // Act
      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      // Assert
      expect(result.current.selectedIndex).toBe(-1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("キーボードナビゲーション - Enter", () => {
    test("should select suggestion when Enter is pressed with valid selection", () => {
      // Arrange
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      const mockEnterEvent = createKeyboardEvent("Enter");

      // Act - 最初のアイテムを選択。初期値-1の場合は、次が0になる
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
      });

      // Act - Enterキーを押す
      act(() => {
        result.current.handleKeyDown(mockEnterEvent);
      });

      // Assert
      expect(mockEnterEvent.preventDefault).toHaveBeenCalled();
      expect(mockProps.onSuggestionSelectAction).toHaveBeenCalledWith(mockSuggestions[0]);
      expect(mockProps.onSuggestionsToggleAction).toHaveBeenCalledWith(false);
      expect(result.current.selectedIndex).toBe(-1);
    });

    test("should execute search when Enter is pressed with empty suggestions", () => {
      // Arrange
      const { result } = renderHook(() => useReviewSuggest({ ...mockProps, suggestions: [] }));

      const mockEvent = createKeyboardEvent("Enter");

      // Act
      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      // Assert
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockProps.onSearchExecuteAction).toHaveBeenCalled();
      expect(mockProps.onSuggestionSelectAction).not.toHaveBeenCalled();
      expect(mockProps.onSuggestionsToggleAction).toHaveBeenCalledWith(false);
    });

    test("should execute search when Enter is pressed without selection", () => {
      // Arrange
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      const mockEvent = createKeyboardEvent("Enter");

      // Act
      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      // Assert
      expect(result.current.selectedIndex).toBe(-1);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockProps.onSearchExecuteAction).toHaveBeenCalled();
      expect(mockProps.onSuggestionSelectAction).not.toHaveBeenCalled();
      expect(mockProps.onSuggestionsToggleAction).toHaveBeenCalledWith(false);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("キーボードナビゲーション - Escape", () => {
    test("should close suggestions when Escape is pressed", () => {
      // Arrange
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      // Act - まず選択状態にする
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
      });

      // Assert
      expect(result.current.selectedIndex).toBe(0);

      // Act - Escapeキーを押す
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("Escape"));
      });

      // Assert
      expect(mockProps.onSuggestionsToggleAction).toHaveBeenCalledWith(false);
      expect(result.current.selectedIndex).toBe(-1);
    });

    test("should not close suggestions when Escape is pressed without selection", () => {
      // Arrange
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      const mockEvent = createKeyboardEvent("Escape");

      // Act - 選択状態にしないで、Escapeキーを押す
      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      // Assert
      expect(mockProps.onSuggestionsToggleAction).toHaveBeenCalledWith(false);
      expect(result.current.selectedIndex).toBe(-1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("キーボードナビゲーション - その他のキー", () => {
    test("should not handle other keys", () => {
      // Arrange
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      const mockEvent = createKeyboardEvent("Tab");

      // Act
      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      // Assert
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(result.current.selectedIndex).toBe(-1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("フォーム送信", () => {
    test("should execute search and close suggestions when form is submitted", () => {
      // Arrange
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      const mockEvent = {
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent;

      // Act
      act(() => {
        result.current.handleSubmit(mockEvent);
      });

      // Assert
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockProps.onSearchExecuteAction).toHaveBeenCalled();
      expect(mockProps.onSuggestionsToggleAction).toHaveBeenCalledWith(false);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("サジェスト変更時の処理", () => {
    test("should reset selected index when suggestions change", () => {
      // Arrange
      const { result, rerender } = renderHook((props) => useReviewSuggest(props), { initialProps: mockProps });

      // Act - 選択状態にする
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
      });

      // Assert
      expect(result.current.selectedIndex).toBe(0);

      // Arrange - サジェストを変更
      const newSuggestions = [
        { value: "new1", label: "新しいサジェスト1" },
        { value: "new2", label: "新しいサジェスト2" },
      ];

      // Act - サジェストを変更
      rerender({
        ...mockProps,
        suggestions: newSuggestions,
      });

      // Assert
      expect(result.current.selectedIndex).toBe(-1);
    });

    test("should handle empty suggestions array", () => {
      // Arrange
      const propsWithEmptySuggestions = {
        ...mockProps,
        suggestions: [],
      };

      const { result } = renderHook(() => useReviewSuggest(propsWithEmptySuggestions));

      // Assert
      expect(result.current.selectedIndex).toBe(-1);

      // Act - キーボード操作をテスト
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
      });

      // Assert
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
      // Arrange
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

      Object.defineProperty(result.current.inputRef, "current", {
        writable: true,
        value: mockInputElement,
      });

      Object.defineProperty(result.current.suggestionRef, "current", {
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
      // Arrange
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
          // Act
          act(() => {
            mousedownHandler(mockMouseEvent);
          });
        }).not.toThrow();

        // Assert
        expect(mockProps.onSuggestionsToggleAction).not.toHaveBeenCalled();
      }
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle suggestions with single item", () => {
      // Arrange
      const singleSuggestionProps = {
        ...mockProps,
        suggestions: [{ value: "single", label: "単一サジェスト" }],
      };

      const { result } = renderHook(() => useReviewSuggest(singleSuggestionProps));

      // Act - ArrowDownで選択
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
      });

      // Assert
      expect(result.current.selectedIndex).toBe(0);

      // Act - さらにArrowDownで最初に戻る（単一要素の場合は同じインデックス）
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
      });

      // Assert
      expect(result.current.selectedIndex).toBe(0);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系テスト", () => {
    test.each([
      {
        description: "should handle undefined suggestions gracefully",
        suggestions: undefined as unknown as typeof mockSuggestions,
      },
      {
        description: "should handle null callback functions",
        suggestions: mockSuggestions,
        onSuggestionSelectAction: null as unknown as typeof mockProps.onSuggestionSelectAction,
        onSearchExecuteAction: null as unknown as typeof mockProps.onSearchExecuteAction,
      },
    ])("$description", ({ suggestions, onSuggestionSelectAction, onSearchExecuteAction }) => {
      // Arrange
      const testProps = {
        onSuggestionsToggleAction: vi.fn(),
        suggestions,
        onSuggestionSelectAction: onSuggestionSelectAction ?? mockProps.onSuggestionSelectAction,
        onSearchExecuteAction: onSearchExecuteAction ?? mockProps.onSearchExecuteAction,
      };

      // Act & Assert
      expect(() => {
        const { result } = renderHook(() => useReviewSuggest(testProps));

        // null callbacksのテストの場合は追加でキーイベントをテスト
        if (onSuggestionSelectAction === null) {
          act(() => {
            result.current.handleKeyDown(createKeyboardEvent("Enter"));
          });
        }
      }).not.toThrow();
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    test("should handle invalid selectedIndex gracefully", () => {
      // Arrange
      const { result } = renderHook(() => useReviewSuggest(mockProps));

      const mockEvent = createKeyboardEvent("Enter");

      // Act - selectedIndexが-1の状態でEnterを押す
      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      // Assert
      expect(mockProps.onSearchExecuteAction).toHaveBeenCalled();
      expect(mockProps.onSuggestionSelectAction).not.toHaveBeenCalled();
    });
  });
});
