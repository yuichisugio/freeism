import { act } from "react";
import { type ShortcutConfig } from "@/hooks/utils/use-shortcut";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { useShortcut } from "./use-shortcut";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("useShortcut", () => {
  // モック関数を定義
  let mockCallback1: ReturnType<typeof vi.fn>;
  let mockCallback2: ReturnType<typeof vi.fn>;
  let activeElementSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // 各テスト前にモック関数を新しく作成
    mockCallback1 = vi.fn();
    mockCallback2 = vi.fn();
    // activeElementをリセット
    activeElementSpy = vi.spyOn(document, "activeElement", "get").mockReturnValue(null);
  });

  afterEach(() => {
    // 個別のモックのみをリセット
    vi.clearAllMocks();
    activeElementSpy.mockRestore();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("基本的なショートカット機能", () => {
    test("should register and trigger simple shortcut", () => {
      const configs = [{ code: "KeyS", callback: mockCallback1 }];
      const { unmount } = renderHook(() => useShortcut(configs));

      const event = new KeyboardEvent("keydown", {
        code: "KeyS",
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        bubbles: true,
        cancelable: true,
      });

      act(() => {
        window.dispatchEvent(event);
      });

      expect(mockCallback1).toHaveBeenCalledTimes(1);
      unmount();
    });

    test("should handle multiple shortcuts", () => {
      const configs = [
        { code: "KeyS", callback: mockCallback1 },
        { code: "KeyA", callback: mockCallback2 },
      ];
      const { unmount } = renderHook(() => useShortcut(configs));

      const event1 = new KeyboardEvent("keydown", {
        code: "KeyS",
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        window.dispatchEvent(event1);
      });

      const event2 = new KeyboardEvent("keydown", {
        code: "KeyA",
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        window.dispatchEvent(event2);
      });

      expect(mockCallback1).toHaveBeenCalledTimes(1);
      expect(mockCallback2).toHaveBeenCalledTimes(1);
      unmount();
    });

    test("should not trigger callback for non-matching keys", () => {
      const configs = [{ code: "KeyS", callback: mockCallback1 }];
      const { unmount } = renderHook(() => useShortcut(configs));

      const event = new KeyboardEvent("keydown", {
        code: "KeyA",
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        window.dispatchEvent(event);
      });

      expect(mockCallback1).toHaveBeenCalledTimes(0);
      unmount();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("修飾キーの組み合わせ", () => {
    test.each([
      { config: { ctrlOrCommand: true }, event: { ctrlKey: true }, description: "Ctrl+S (Windows)" },
      { config: { ctrlOrCommand: true }, event: { metaKey: true }, description: "Meta+S (Mac)" },
      { config: { shift: true }, event: { shiftKey: true }, description: "Shift+S" },
      { config: { altOrOption: true }, event: { altKey: true }, description: "Alt+S" },
    ])("should handle modifier key combinations $description", ({ config, event: eventModifiers }) => {
      // Arrange
      const configs = [{ code: "KeyS", ...config, callback: mockCallback1 }];
      const { unmount } = renderHook(() => useShortcut(configs));

      const event = new KeyboardEvent("keydown", {
        code: "KeyS",
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        ...eventModifiers,
        bubbles: true,
        cancelable: true,
      });

      // Act
      act(() => {
        window.dispatchEvent(event);
      });

      // Assert
      expect(mockCallback1).toHaveBeenCalledTimes(1);
      unmount();
    });

    test("should handle complex modifier combination (Ctrl+Shift+Alt+S)", () => {
      // Arrange
      const configs = [
        {
          code: "KeyS",
          ctrlOrCommand: true,
          shift: true,
          altOrOption: true,
          callback: mockCallback1,
        },
      ];
      const { unmount } = renderHook(() => useShortcut(configs));

      const event = new KeyboardEvent("keydown", {
        code: "KeyS",
        ctrlKey: true,
        metaKey: false,
        shiftKey: true,
        altKey: true,
        bubbles: true,
        cancelable: true,
      });

      // Act
      act(() => {
        window.dispatchEvent(event);
      });

      // Assert
      expect(mockCallback1).toHaveBeenCalledTimes(1);
      unmount();
    });

    test.each([
      { ctrlKey: true }, // Shiftが不足
      { shiftKey: true }, // Ctrlが不足
      {}, // 修飾キーなし
    ])("should not trigger when required modifiers are missing", ({ ctrlKey, shiftKey }) => {
      // Arrange
      const configs = [
        {
          code: "KeyS",
          ctrlOrCommand: true,
          shift: true,
          callback: mockCallback1,
        },
      ];
      const { unmount } = renderHook(() => useShortcut(configs));

      const event = new KeyboardEvent("keydown", {
        code: "KeyS",
        ctrlKey,
        shiftKey,
        bubbles: true,
        cancelable: true,
      });

      // Act
      act(() => {
        window.dispatchEvent(event);
      });

      // Assert
      expect(mockCallback1).toHaveBeenCalledTimes(0);
      unmount();
    });

    test("should not trigger when unwanted modifiers are present", () => {
      // Arrange
      const configs = [{ code: "KeyS", callback: mockCallback1 }];
      const { unmount } = renderHook(() => useShortcut(configs));

      const event = new KeyboardEvent("keydown", {
        code: "KeyS",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });

      // Act
      act(() => {
        window.dispatchEvent(event);
      });

      // Assert
      expect(mockCallback1).toHaveBeenCalledTimes(0);
      unmount();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("preventDefault機能", () => {
    test.each([
      { preventDefault: true, shouldPrevent: true, description: "when configured" },
      { preventDefault: false, shouldPrevent: false, description: "when explicitly set to false" },
      { preventDefault: undefined, shouldPrevent: false, description: "when not configured" },
    ])("should handle preventDefault configuration", ({ preventDefault, shouldPrevent }) => {
      // Arrange
      const configs = [
        {
          code: "KeyS",
          ctrlOrCommand: true,
          preventDefault,
          callback: mockCallback1,
        },
      ];

      const { unmount } = renderHook(() => useShortcut(configs));

      const event = new KeyboardEvent("keydown", {
        code: "KeyS",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");

      // Act
      act(() => {
        window.dispatchEvent(event);
      });

      // Assert
      if (shouldPrevent) {
        expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
      } else {
        expect(preventDefaultSpy).not.toHaveBeenCalled();
      }

      unmount();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("disableOnInputs機能", () => {
    test.each([
      { tagName: "INPUT", isContentEditable: false, description: "INPUT element" },
      { tagName: "TEXTAREA", isContentEditable: false, description: "TEXTAREA element" },
      { tagName: "DIV", isContentEditable: true, description: "contentEditable element" },
    ])("should disable shortcut when focused on input elements", ({ tagName, isContentEditable }) => {
      // Arrange
      const configs = [
        {
          code: "KeyS",
          disableOnInputs: true,
          callback: mockCallback1,
        },
      ];
      const { unmount } = renderHook(() => useShortcut(configs));

      // 要素にフォーカスがある状態をモック
      const element = { tagName, isContentEditable } as HTMLElement;
      activeElementSpy.mockReturnValue(element);

      const event = new KeyboardEvent("keydown", {
        code: "KeyS",
        bubbles: true,
        cancelable: true,
      });

      // Act
      act(() => {
        window.dispatchEvent(event);
      });

      // Assert
      expect(mockCallback1).toHaveBeenCalledTimes(0);
      unmount();
    });

    test.each([
      { disableOnInputs: false, description: "when disableOnInputs is false" },
      { disableOnInputs: undefined, description: "when disableOnInputs is not configured" },
    ])("should work normally when disableOnInputs is configured differently", ({ disableOnInputs }) => {
      // Arrange
      const configs = [{ code: "KeyS", disableOnInputs, callback: mockCallback1 }];
      const { unmount } = renderHook(() => useShortcut(configs));

      // INPUT要素にフォーカスがある状態でもショートカットが動作する
      const element = { tagName: "INPUT", isContentEditable: false } as HTMLElement;
      activeElementSpy.mockReturnValue(element);

      const event = new KeyboardEvent("keydown", {
        code: "KeyS",
        bubbles: true,
        cancelable: true,
      });

      // Act
      act(() => {
        window.dispatchEvent(event);
      });

      // Assert
      expect(mockCallback1).toHaveBeenCalledTimes(1);
      unmount();
    });

    test.each([
      { element: { tagName: "DIV", isContentEditable: false } as HTMLElement, description: "non-input element" },
      { element: null, description: "no element focused" },
    ])("should work normally when focused on non-input elements or no element", ({ element }) => {
      // Arrange
      const configs = [{ code: "KeyS", disableOnInputs: true, callback: mockCallback1 }];
      const { unmount } = renderHook(() => useShortcut(configs));

      activeElementSpy.mockReturnValue(element);

      const event = new KeyboardEvent("keydown", {
        code: "KeyS",
        bubbles: true,
        cancelable: true,
      });

      // Act
      act(() => {
        window.dispatchEvent(event);
      });

      // Assert
      expect(mockCallback1).toHaveBeenCalledTimes(1);
      unmount();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("大文字小文字の区別", () => {
    test.each([
      { configCode: "keys", eventCode: "KeyS", description: "lowercase config, uppercase event" },
      { configCode: "KEYS", eventCode: "keys", description: "uppercase config, lowercase event" },
      { configCode: "KeyS", eventCode: "Keys", description: "uppercase event, lowercase config" },
      { configCode: "KeyS", eventCode: "KEYS", description: "uppercase event, uppercase config" },
    ])("should handle case-insensitive key codes $description", ({ configCode, eventCode }) => {
      // Arrange
      const configs = [{ code: configCode, callback: mockCallback1 }];
      const { unmount } = renderHook(() => useShortcut(configs));

      const event = new KeyboardEvent("keydown", {
        code: eventCode,
        bubbles: true,
        cancelable: true,
      });

      // Act
      act(() => {
        window.dispatchEvent(event);
      });

      // Assert
      expect(mockCallback1).toHaveBeenCalledTimes(1);
      unmount();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("特殊キーのテスト", () => {
    test.each([
      { code: "Enter", description: "Enter key" },
      { code: "ArrowUp", description: "Arrow up key" },
      { code: "ArrowDown", description: "Arrow down key" },
      { code: "Escape", description: "Escape key" },
    ])("should handle special keys", ({ code }) => {
      // Arrange
      const configs = [{ code, callback: mockCallback1 }];
      const { unmount } = renderHook(() => useShortcut(configs));

      const event = new KeyboardEvent("keydown", {
        code,
        bubbles: true,
        cancelable: true,
      });

      // Act
      act(() => {
        window.dispatchEvent(event);
      });

      // Assert
      expect(mockCallback1).toHaveBeenCalledTimes(1);
      unmount();
    });
  });

  describe("複数の矢印キーのテスト", () => {
    test("should handle multiple arrow keys with different configs", () => {
      // Arrange
      const configs = [
        { code: "ArrowUp", callback: mockCallback1 },
        { code: "ArrowDown", callback: mockCallback2 },
      ];

      const { unmount } = renderHook(() => useShortcut(configs));

      const event1 = new KeyboardEvent("keydown", {
        code: "ArrowUp",
        bubbles: true,
        cancelable: true,
      });

      const event2 = new KeyboardEvent("keydown", {
        code: "ArrowDown",
        bubbles: true,
        cancelable: true,
      });

      // Act
      act(() => {
        window.dispatchEvent(event1);
      });

      // Act
      act(() => {
        window.dispatchEvent(event2);
      });

      // Assert
      expect(mockCallback1).toHaveBeenCalledTimes(1);
      expect(mockCallback2).toHaveBeenCalledTimes(1);
      unmount();
    });

    test("should stop at first matching shortcut when same key is configured multiple times", () => {
      // Arrange
      const configs = [
        { code: "ArrowUp", callback: mockCallback1 },
        { code: "ArrowUp", callback: mockCallback2 }, // 同じキーの設定
      ];
      const { unmount } = renderHook(() => useShortcut(configs));

      const event = new KeyboardEvent("keydown", {
        code: "ArrowUp",
        bubbles: true,
        cancelable: true,
      });

      // Act
      act(() => {
        window.dispatchEvent(event);
      });

      // Assert
      // 最初のコールバックのみが呼ばれる
      expect(mockCallback1).toHaveBeenCalledTimes(1);
      expect(mockCallback2).toHaveBeenCalledTimes(0);
      unmount();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("エッジケースと異常系", () => {
    test("should handle empty configs array", () => {
      // Arrange
      const configs: ShortcutConfig[] = [];
      const { unmount } = renderHook(() => useShortcut(configs));

      const event = new KeyboardEvent("keydown", {
        code: "KeyS",
        bubbles: true,
        cancelable: true,
      });

      // Act
      act(() => {
        window.dispatchEvent(event);
      });

      // Assert
      expect(mockCallback1).toHaveBeenCalledTimes(0);
      unmount();
    });

    test.each([
      { value: undefined, description: "undefined code" },
      { value: null, description: "null code" },
      { value: "", description: "empty string code" },
    ])("should handle invalid code values", ({ value }) => {
      // Arrange
      const configs = [{ code: value as unknown as string, callback: mockCallback1 }];
      const { unmount } = renderHook(() => useShortcut(configs));

      const event = new KeyboardEvent("keydown", {
        code: "KeyS",
        bubbles: true,
        cancelable: true,
      });

      // Act
      act(() => {
        window.dispatchEvent(event);
      });

      // Assert
      expect(mockCallback1).toHaveBeenCalledTimes(0);
      unmount();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("イベントリスナーの管理", () => {
    test("should add event listener on mount", () => {
      // Arrange
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");
      const configs = [{ code: "KeyS", callback: mockCallback1 }];

      // Act
      const { unmount } = renderHook(() => useShortcut(configs));

      // Assert
      expect(addEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
      unmount();
      addEventListenerSpy.mockRestore();
    });

    test("should remove event listener on unmount", () => {
      // Arrange
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
      const configs = [{ code: "KeyS", callback: mockCallback1 }];

      const { unmount } = renderHook(() => useShortcut(configs));

      // Act
      unmount();

      // Assert
      expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });

    test("should update event listener when configs change", () => {
      // Arrange
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      let configs = [{ code: "KeyS", callback: mockCallback1 }];

      // Act
      const { rerender, unmount } = renderHook(() => useShortcut(configs));

      // Assert
      // 初回レンダリング
      expect(addEventListenerSpy).toHaveBeenCalledTimes(1);

      // configsを変更
      configs = [{ code: "KeyA", callback: mockCallback2 }];
      rerender();

      // 古いリスナーが削除され、新しいリスナーが追加される
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(1);
      expect(addEventListenerSpy).toHaveBeenCalledTimes(2);

      unmount();
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("実際の使用例のテスト", () => {
    let saveCallback: ReturnType<typeof vi.fn>;
    let nextCallback: ReturnType<typeof vi.fn>;
    let prevCallback: ReturnType<typeof vi.fn>;
    let closeCallback: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      saveCallback = vi.fn();
      nextCallback = vi.fn();
      prevCallback = vi.fn();
      closeCallback = vi.fn();
    });

    test("should handle common save shortcut (Ctrl+S)", () => {
      // Arrange
      const configs = [
        {
          code: "KeyS",
          ctrlOrCommand: true,
          preventDefault: true,
          disableOnInputs: true,
          callback: saveCallback,
        },
      ];
      const { unmount } = renderHook(() => useShortcut(configs));

      const event = new KeyboardEvent("keydown", {
        code: "KeyS",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");

      // Act
      act(() => {
        window.dispatchEvent(event);
      });

      // Assert
      expect(saveCallback).toHaveBeenCalledTimes(1);
      expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
      unmount();
    });

    test("should handle navigation shortcuts", () => {
      // Arrange
      const configs = [
        { code: "ArrowRight", callback: nextCallback },
        { code: "ArrowLeft", callback: prevCallback },
      ];
      const { unmount } = renderHook(() => useShortcut(configs));

      const event1 = new KeyboardEvent("keydown", {
        code: "ArrowRight",
        bubbles: true,
        cancelable: true,
      });

      const event2 = new KeyboardEvent("keydown", {
        code: "ArrowLeft",
        bubbles: true,
        cancelable: true,
      });

      // Act
      act(() => {
        window.dispatchEvent(event1);
      });

      act(() => {
        window.dispatchEvent(event2);
      });

      // Assert
      expect(nextCallback).toHaveBeenCalledTimes(1);
      expect(prevCallback).toHaveBeenCalledTimes(1);
      unmount();
    });

    test("should handle modal close shortcut (Escape)", () => {
      // Arrange
      const configs = [{ code: "Escape", callback: closeCallback }];
      const { unmount } = renderHook(() => useShortcut(configs));

      const event = new KeyboardEvent("keydown", {
        code: "Escape",
        bubbles: true,
        cancelable: true,
      });

      // Act
      act(() => {
        window.dispatchEvent(event);
      });

      // Assert
      expect(closeCallback).toHaveBeenCalledTimes(1);
      unmount();
    });
  });
});
