import { act } from "react";
import { type ShortcutConfig } from "@/hooks/utils/use-shortcut";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { useShortcut } from "./use-shortcut";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * KeyboardEventのモックを作成するヘルパー関数
 */
const createKeyboardEvent = (options: {
  code: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}): KeyboardEvent => {
  const event = new KeyboardEvent("keydown", {
    code: options.code,
    ctrlKey: options.ctrlKey ?? false,
    metaKey: options.metaKey ?? false,
    shiftKey: options.shiftKey ?? false,
    altKey: options.altKey ?? false,
    bubbles: true,
    cancelable: true,
  });

  // preventDefaultをモック化
  vi.spyOn(event, "preventDefault");

  return event;
};

/**
 * イベント発火とact処理を統合するヘルパー関数
 */
const triggerShortcut = (eventOptions: Parameters<typeof createKeyboardEvent>[0]) => {
  const event = createKeyboardEvent(eventOptions);
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
};

/**
 * 要素タイプの定義
 */
const INPUT_ELEMENTS = [
  { tagName: "INPUT", isContentEditable: false, description: "INPUT element" },
  { tagName: "TEXTAREA", isContentEditable: false, description: "TEXTAREA element" },
  { tagName: "DIV", isContentEditable: true, description: "contentEditable element" },
] as const;

/**
 * 修飾キーの組み合わせ定義
 */
const MODIFIER_COMBINATIONS = [
  { config: { ctrlOrMeta: true }, event: { ctrlKey: true }, description: "Ctrl+S" },
  { config: { ctrlOrMeta: true }, event: { metaKey: true }, description: "Meta+S (Mac)" },
  { config: { shift: true }, event: { shiftKey: true }, description: "Shift+S" },
  { config: { alt: true }, event: { altKey: true }, description: "Alt+S" },
] as const;

/**
 * 異常値の定義
 */
const INVALID_CODES = [
  { value: undefined, description: "undefined" },
  { value: null, description: "null" },
  { value: "", description: "empty string" },
] as const;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("useShortcut", () => {
  // モック関数を定義
  const mockCallback1 = vi.fn();
  const mockCallback2 = vi.fn();

  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
    // activeElementをリセット
    vi.spyOn(document, "activeElement", "get").mockReturnValue(null);
  });

  afterEach(() => {
    // イベントリスナーのクリーンアップを確認するため、すべてのモックをリストア
    vi.restoreAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("基本的なショートカット機能", () => {
    test("should register and trigger simple shortcut", () => {
      const configs = [{ code: "KeyS", callback: mockCallback1 }];
      renderHook(() => useShortcut(configs));

      triggerShortcut({ code: "KeyS" });

      expect(mockCallback1).toHaveBeenCalledTimes(1);
    });

    test("should handle multiple shortcuts", () => {
      const configs = [
        { code: "KeyS", callback: mockCallback1 },
        { code: "KeyA", callback: mockCallback2 },
      ];
      renderHook(() => useShortcut(configs));

      triggerShortcut({ code: "KeyS" });
      triggerShortcut({ code: "KeyA" });

      expect(mockCallback1).toHaveBeenCalledTimes(1);
      expect(mockCallback2).toHaveBeenCalledTimes(1);
    });

    test("should not trigger callback for non-matching keys", () => {
      const configs = [{ code: "KeyS", callback: mockCallback1 }];
      renderHook(() => useShortcut(configs));

      triggerShortcut({ code: "KeyA" });

      expect(mockCallback1).toHaveBeenCalledTimes(0);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("修飾キーの組み合わせ", () => {
    test("should handle modifier key combinations", () => {
      MODIFIER_COMBINATIONS.forEach(({ config, event }) => {
        const configs = [{ code: "KeyS", ...config, callback: mockCallback1 }];
        renderHook(() => useShortcut(configs));

        triggerShortcut({ code: "KeyS", ...event });

        expect(mockCallback1).toHaveBeenCalledTimes(1);

        // 次のテストのためにモックをリセット
        vi.clearAllMocks();
      });
    });

    test("should handle complex modifier combination (Ctrl+Shift+Alt+S)", () => {
      const configs = [
        {
          code: "KeyS",
          ctrlOrMeta: true,
          shift: true,
          alt: true,
          callback: mockCallback1,
        },
      ];
      renderHook(() => useShortcut(configs));

      triggerShortcut({
        code: "KeyS",
        ctrlKey: true,
        shiftKey: true,
        altKey: true,
      });

      expect(mockCallback1).toHaveBeenCalledTimes(1);
    });

    test("should not trigger when required modifiers are missing", () => {
      const configs = [
        {
          code: "KeyS",
          ctrlOrMeta: true,
          shift: true,
          callback: mockCallback1,
        },
      ];
      renderHook(() => useShortcut(configs));

      // 各種不完全な修飾キーの組み合わせをテスト
      const incompleteModifiers = [
        { ctrlKey: true }, // Shiftが不足
        { shiftKey: true }, // Ctrlが不足
        {}, // 修飾キーなし
      ];

      incompleteModifiers.forEach((modifiers) => {
        triggerShortcut({ code: "KeyS", ...modifiers });
      });

      expect(mockCallback1).toHaveBeenCalledTimes(0);
    });

    test("should not trigger when unwanted modifiers are present", () => {
      const configs = [{ code: "KeyS", callback: mockCallback1 }];
      renderHook(() => useShortcut(configs));

      triggerShortcut({ code: "KeyS", ctrlKey: true });

      expect(mockCallback1).toHaveBeenCalledTimes(0);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("preventDefault機能", () => {
    test("should handle preventDefault configuration", () => {
      const preventDefaultCases = [
        { preventDefault: true, shouldPrevent: true, description: "when configured" },
        { preventDefault: false, shouldPrevent: false, description: "when explicitly set to false" },
        { preventDefault: undefined, shouldPrevent: false, description: "when not configured" },
      ];

      preventDefaultCases.forEach(({ preventDefault, shouldPrevent }) => {
        const configs = [
          {
            code: "KeyS",
            ctrlOrMeta: true,
            preventDefault,
            callback: mockCallback1,
          },
        ];
        renderHook(() => useShortcut(configs));

        const event = triggerShortcut({ code: "KeyS", ctrlKey: true });

        if (shouldPrevent) {
          expect(event.preventDefault).toHaveBeenCalledTimes(1);
        } else {
          expect(event.preventDefault).not.toHaveBeenCalled();
        }
        expect(mockCallback1).toHaveBeenCalledTimes(1);

        // 次のテストのためにモックをリセット
        vi.clearAllMocks();
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("disableOnInputs機能", () => {
    test("should disable shortcut when focused on input elements", () => {
      INPUT_ELEMENTS.forEach(({ tagName, isContentEditable }) => {
        const configs = [
          {
            code: "KeyS",
            disableOnInputs: true,
            callback: mockCallback1,
          },
        ];
        renderHook(() => useShortcut(configs));

        // 要素にフォーカスがある状態をモック
        const element = { tagName, isContentEditable } as HTMLElement;
        vi.spyOn(document, "activeElement", "get").mockReturnValue(element);

        triggerShortcut({ code: "KeyS" });

        expect(mockCallback1).toHaveBeenCalledTimes(0);

        // 次のテストのためにモックをリセット
        vi.clearAllMocks();
      });
    });

    test("should work normally when disableOnInputs is configured differently", () => {
      const disableOnInputsCases = [
        { disableOnInputs: false, shouldWork: true, description: "when disableOnInputs is false" },
        { disableOnInputs: undefined, shouldWork: true, description: "when disableOnInputs is not configured" },
      ];

      disableOnInputsCases.forEach(({ disableOnInputs, shouldWork }) => {
        const configs = [{ code: "KeyS", disableOnInputs, callback: mockCallback1 }];
        renderHook(() => useShortcut(configs));

        // INPUT要素にフォーカスがある状態でもショートカットが動作する
        const element = { tagName: "INPUT", isContentEditable: false } as HTMLElement;
        vi.spyOn(document, "activeElement", "get").mockReturnValue(element);

        triggerShortcut({ code: "KeyS" });

        expect(mockCallback1).toHaveBeenCalledTimes(shouldWork ? 1 : 0);

        // 次のテストのためにモックをリセット
        vi.clearAllMocks();
      });
    });

    test("should work normally when focused on non-input elements or no element", () => {
      const focusStates = [
        { element: { tagName: "DIV", isContentEditable: false } as HTMLElement, description: "non-input element" },
        { element: null, description: "no element focused" },
      ];

      focusStates.forEach(({ element }) => {
        const configs = [{ code: "KeyS", disableOnInputs: true, callback: mockCallback1 }];
        renderHook(() => useShortcut(configs));

        vi.spyOn(document, "activeElement", "get").mockReturnValue(element);

        triggerShortcut({ code: "KeyS" });

        expect(mockCallback1).toHaveBeenCalledTimes(1);

        // 次のテストのためにモックをリセット
        vi.clearAllMocks();
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("大文字小文字の区別", () => {
    test("should handle case-insensitive key codes", () => {
      const caseCombinations = [
        { configCode: "keys", eventCode: "KeyS", description: "lowercase config, uppercase event" },
        { configCode: "KEYS", eventCode: "keys", description: "uppercase config, lowercase event" },
      ];

      caseCombinations.forEach(({ configCode, eventCode }) => {
        const configs = [{ code: configCode, callback: mockCallback1 }];
        renderHook(() => useShortcut(configs));

        triggerShortcut({ code: eventCode });

        expect(mockCallback1).toHaveBeenCalledTimes(1);

        // 次のテストのためにモックをリセット
        vi.clearAllMocks();
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("特殊キーのテスト", () => {
    test("should handle special keys", () => {
      const specialKeys = [
        { code: "Enter", description: "Enter key" },
        { code: "ArrowUp", description: "Arrow up key" },
        { code: "ArrowDown", description: "Arrow down key" },
        { code: "Escape", description: "Escape key" },
      ];

      specialKeys.forEach(({ code }) => {
        const configs = [{ code, callback: mockCallback1 }];
        renderHook(() => useShortcut(configs));

        triggerShortcut({ code });

        expect(mockCallback1).toHaveBeenCalledTimes(1);

        // 次のテストのためにモックをリセット
        vi.clearAllMocks();
      });
    });

    test("should handle multiple arrow keys", () => {
      const configs = [
        { code: "ArrowUp", callback: mockCallback1 },
        { code: "ArrowDown", callback: mockCallback2 },
      ];
      renderHook(() => useShortcut(configs));

      triggerShortcut({ code: "ArrowUp" });
      triggerShortcut({ code: "ArrowDown" });

      expect(mockCallback1).toHaveBeenCalledTimes(1);
      expect(mockCallback2).toHaveBeenCalledTimes(1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("エッジケースと異常系", () => {
    test("should handle empty configs array", () => {
      const configs: ShortcutConfig[] = [];
      renderHook(() => useShortcut(configs));

      triggerShortcut({ code: "KeyS" });

      expect(mockCallback1).toHaveBeenCalledTimes(0);
    });

    test("should handle invalid code values", () => {
      INVALID_CODES.forEach(({ value }) => {
        const configs = [{ code: value as unknown as string, callback: mockCallback1 }];
        renderHook(() => useShortcut(configs));

        triggerShortcut({ code: "KeyS" });

        expect(mockCallback1).toHaveBeenCalledTimes(0);

        // 次のテストのためにモックをリセット
        vi.clearAllMocks();
      });
    });

    test("should handle event without code property", () => {
      const configs = [{ code: "KeyS", callback: mockCallback1 }];
      renderHook(() => useShortcut(configs));

      // codeプロパティがないイベントを作成
      const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true });
      act(() => {
        window.dispatchEvent(event);
      });

      expect(mockCallback1).toHaveBeenCalledTimes(0);
    });

    test("should stop at first matching shortcut", () => {
      const configs = [
        { code: "KeyS", callback: mockCallback1 },
        { code: "KeyS", callback: mockCallback2 }, // 同じキーの設定
      ];
      renderHook(() => useShortcut(configs));

      triggerShortcut({ code: "KeyS" });

      // 最初のコールバックのみが呼ばれる
      expect(mockCallback1).toHaveBeenCalledTimes(1);
      expect(mockCallback2).toHaveBeenCalledTimes(0);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("イベントリスナーの管理", () => {
    test("should add event listener on mount", () => {
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");
      const configs = [{ code: "KeyS", callback: mockCallback1 }];

      renderHook(() => useShortcut(configs));

      expect(addEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    });

    test("should remove event listener on unmount", () => {
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
      const configs = [{ code: "KeyS", callback: mockCallback1 }];

      const { unmount } = renderHook(() => useShortcut(configs));
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    });

    test("should update event listener when configs change", () => {
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      let configs = [{ code: "KeyS", callback: mockCallback1 }];
      const { rerender } = renderHook(() => useShortcut(configs));

      // 初回レンダリング
      expect(addEventListenerSpy).toHaveBeenCalledTimes(1);

      // configsを変更
      configs = [{ code: "KeyA", callback: mockCallback2 }];
      rerender();

      // 古いリスナーが削除され、新しいリスナーが追加される
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(1);
      expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("実際の使用例のテスト", () => {
    test("should handle common save shortcut (Ctrl+S)", () => {
      const saveCallback = vi.fn();
      const configs = [
        {
          code: "KeyS",
          ctrlOrMeta: true,
          preventDefault: true,
          disableOnInputs: true,
          callback: saveCallback,
        },
      ];
      renderHook(() => useShortcut(configs));

      const event = triggerShortcut({ code: "KeyS", ctrlKey: true });

      expect(saveCallback).toHaveBeenCalledTimes(1);
      expect(event.preventDefault).toHaveBeenCalledTimes(1);
    });

    test("should handle navigation shortcuts", () => {
      const nextCallback = vi.fn();
      const prevCallback = vi.fn();
      const configs = [
        { code: "ArrowRight", callback: nextCallback },
        { code: "ArrowLeft", callback: prevCallback },
      ];
      renderHook(() => useShortcut(configs));

      triggerShortcut({ code: "ArrowRight" });
      triggerShortcut({ code: "ArrowLeft" });

      expect(nextCallback).toHaveBeenCalledTimes(1);
      expect(prevCallback).toHaveBeenCalledTimes(1);
    });

    test("should handle modal close shortcut (Escape)", () => {
      const closeCallback = vi.fn();
      const configs = [{ code: "Escape", callback: closeCallback }];
      renderHook(() => useShortcut(configs));

      triggerShortcut({ code: "Escape" });

      expect(closeCallback).toHaveBeenCalledTimes(1);
    });
  });
});
