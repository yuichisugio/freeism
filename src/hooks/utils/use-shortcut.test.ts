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
      const configs = [
        {
          code: "KeyS",
          callback: mockCallback1,
        },
      ];

      renderHook(() => useShortcut(configs));

      // KeySを押下
      const event = createKeyboardEvent({ code: "KeyS" });
      act(() => {
        window.dispatchEvent(event);
      });

      expect(mockCallback1).toHaveBeenCalledTimes(1);
    });

    test("should handle multiple shortcuts", () => {
      const configs = [
        {
          code: "KeyS",
          callback: mockCallback1,
        },
        {
          code: "KeyA",
          callback: mockCallback2,
        },
      ];

      renderHook(() => useShortcut(configs));

      // KeySを押下
      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "KeyS" }));
      });

      // KeyAを押下
      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "KeyA" }));
      });

      expect(mockCallback1).toHaveBeenCalledTimes(1);
      expect(mockCallback2).toHaveBeenCalledTimes(1);
    });

    test("should not trigger callback for non-matching keys", () => {
      const configs = [
        {
          code: "KeyS",
          callback: mockCallback1,
        },
      ];

      renderHook(() => useShortcut(configs));

      // 異なるキーを押下
      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "KeyA" }));
      });

      expect(mockCallback1).not.toHaveBeenCalled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("修飾キーの組み合わせ", () => {
    test("should handle Ctrl+S shortcut", () => {
      const configs = [
        {
          code: "KeyS",
          ctrlOrMeta: true,
          callback: mockCallback1,
        },
      ];

      renderHook(() => useShortcut(configs));

      // Ctrl+Sを押下
      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "KeyS", ctrlKey: true }));
      });

      expect(mockCallback1).toHaveBeenCalledTimes(1);
    });

    test("should handle Meta+S shortcut (Mac)", () => {
      const configs = [
        {
          code: "KeyS",
          ctrlOrMeta: true,
          callback: mockCallback1,
        },
      ];

      renderHook(() => useShortcut(configs));

      // Meta+Sを押下
      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "KeyS", metaKey: true }));
      });

      expect(mockCallback1).toHaveBeenCalledTimes(1);
    });

    test("should handle Shift+S shortcut", () => {
      const configs = [
        {
          code: "KeyS",
          shift: true,
          callback: mockCallback1,
        },
      ];

      renderHook(() => useShortcut(configs));

      // Shift+Sを押下
      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "KeyS", shiftKey: true }));
      });

      expect(mockCallback1).toHaveBeenCalledTimes(1);
    });

    test("should handle Alt+S shortcut", () => {
      const configs = [
        {
          code: "KeyS",
          alt: true,
          callback: mockCallback1,
        },
      ];

      renderHook(() => useShortcut(configs));

      // Alt+Sを押下
      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "KeyS", altKey: true }));
      });

      expect(mockCallback1).toHaveBeenCalledTimes(1);
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

      // Ctrl+Shift+Alt+Sを押下
      act(() => {
        window.dispatchEvent(
          createKeyboardEvent({
            code: "KeyS",
            ctrlKey: true,
            shiftKey: true,
            altKey: true,
          }),
        );
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

      // Ctrlのみ（Shiftが不足）
      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "KeyS", ctrlKey: true }));
      });

      // Shiftのみ（Ctrlが不足）
      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "KeyS", shiftKey: true }));
      });

      // 修飾キーなし
      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "KeyS" }));
      });

      expect(mockCallback1).not.toHaveBeenCalled();
    });

    test("should not trigger when unwanted modifiers are present", () => {
      const configs = [
        {
          code: "KeyS",
          callback: mockCallback1, // 修飾キーなしのショートカット
        },
      ];

      renderHook(() => useShortcut(configs));

      // 不要なCtrlキーが押されている
      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "KeyS", ctrlKey: true }));
      });

      expect(mockCallback1).not.toHaveBeenCalled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("preventDefault機能", () => {
    test("should call preventDefault when configured", () => {
      const configs = [
        {
          code: "KeyS",
          ctrlOrMeta: true,
          preventDefault: true,
          callback: mockCallback1,
        },
      ];

      renderHook(() => useShortcut(configs));

      const event = createKeyboardEvent({ code: "KeyS", ctrlKey: true });
      act(() => {
        window.dispatchEvent(event);
      });

      expect(event.preventDefault).toHaveBeenCalledTimes(1);
      expect(mockCallback1).toHaveBeenCalledTimes(1);
    });

    test("should not call preventDefault when not configured", () => {
      const configs = [
        {
          code: "KeyS",
          callback: mockCallback1,
        },
      ];

      renderHook(() => useShortcut(configs));

      const event = createKeyboardEvent({ code: "KeyS" });
      act(() => {
        window.dispatchEvent(event);
      });

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(mockCallback1).toHaveBeenCalledTimes(1);
    });

    test("should not call preventDefault when explicitly set to false", () => {
      const configs = [
        {
          code: "KeyS",
          preventDefault: false,
          callback: mockCallback1,
        },
      ];

      renderHook(() => useShortcut(configs));

      const event = createKeyboardEvent({ code: "KeyS" });
      act(() => {
        window.dispatchEvent(event);
      });

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(mockCallback1).toHaveBeenCalledTimes(1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("disableOnInputs機能", () => {
    test("should disable shortcut when focused on INPUT element", () => {
      const configs = [
        {
          code: "KeyS",
          disableOnInputs: true,
          callback: mockCallback1,
        },
      ];

      renderHook(() => useShortcut(configs));

      // INPUT要素にフォーカスがある状態をモック
      const element = {
        tagName: "INPUT",
        isContentEditable: false,
      } as HTMLElement;

      vi.spyOn(document, "activeElement", "get").mockReturnValue(element);

      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "KeyS" }));
      });

      expect(mockCallback1).not.toHaveBeenCalled();
    });

    test("should disable shortcut when focused on TEXTAREA element", () => {
      const configs = [
        {
          code: "KeyS",
          disableOnInputs: true,
          callback: mockCallback1,
        },
      ];

      renderHook(() => useShortcut(configs));

      // TEXTAREA要素にフォーカスがある状態をモック
      const element = {
        tagName: "TEXTAREA",
        isContentEditable: false,
      } as HTMLElement;

      vi.spyOn(document, "activeElement", "get").mockReturnValue(element);

      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "KeyS" }));
      });

      expect(mockCallback1).not.toHaveBeenCalled();
    });

    test("should disable shortcut when focused on contentEditable element", () => {
      const configs = [
        {
          code: "KeyS",
          disableOnInputs: true,
          callback: mockCallback1,
        },
      ];

      renderHook(() => useShortcut(configs));

      // contentEditable要素にフォーカスがある状態をモック
      const element = {
        tagName: "DIV",
        isContentEditable: true,
      } as HTMLElement;

      vi.spyOn(document, "activeElement", "get").mockReturnValue(element);

      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "KeyS" }));
      });

      expect(mockCallback1).not.toHaveBeenCalled();
    });

    test("should work normally when disableOnInputs is false", () => {
      const configs = [
        {
          code: "KeyS",
          disableOnInputs: false,
          callback: mockCallback1,
        },
      ];

      renderHook(() => useShortcut(configs));

      // INPUT要素にフォーカスがある状態でもショートカットが動作する
      const element = {
        tagName: "INPUT",
        isContentEditable: false,
      } as HTMLElement;

      vi.spyOn(document, "activeElement", "get").mockReturnValue(element);

      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "KeyS" }));
      });

      expect(mockCallback1).toHaveBeenCalledTimes(1);
    });

    test("should work normally when disableOnInputs is not configured", () => {
      const configs = [
        {
          code: "KeyS",
          callback: mockCallback1,
        },
      ];

      renderHook(() => useShortcut(configs));

      // INPUT要素にフォーカスがある状態でもショートカットが動作する
      const element = {
        tagName: "INPUT",
        isContentEditable: false,
      } as HTMLElement;

      vi.spyOn(document, "activeElement", "get").mockReturnValue(element);

      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "KeyS" }));
      });

      expect(mockCallback1).toHaveBeenCalledTimes(1);
    });

    test("should work normally when focused on non-input elements", () => {
      const configs = [
        {
          code: "KeyS",
          disableOnInputs: true,
          callback: mockCallback1,
        },
      ];

      renderHook(() => useShortcut(configs));

      // DIV要素にフォーカスがある状態（contentEditableではない）
      const element = {
        tagName: "DIV",
        isContentEditable: false,
      } as HTMLElement;

      vi.spyOn(document, "activeElement", "get").mockReturnValue(element);

      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "KeyS" }));
      });

      expect(mockCallback1).toHaveBeenCalledTimes(1);
    });

    test("should work normally when no element is focused", () => {
      const configs = [
        {
          code: "KeyS",
          disableOnInputs: true,
          callback: mockCallback1,
        },
      ];

      renderHook(() => useShortcut(configs));

      // activeElementがnullの状態
      vi.spyOn(document, "activeElement", "get").mockReturnValue(null);

      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "KeyS" }));
      });

      expect(mockCallback1).toHaveBeenCalledTimes(1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("大文字小文字の区別", () => {
    test("should handle case-insensitive key codes", () => {
      const configs = [
        {
          code: "keys", // 小文字
          callback: mockCallback1,
        },
      ];

      renderHook(() => useShortcut(configs));

      // 大文字のKeyCodeで押下
      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "KeyS" }));
      });

      expect(mockCallback1).toHaveBeenCalledTimes(1);
    });

    test("should handle uppercase key codes in config", () => {
      const configs = [
        {
          code: "KEYS", // 大文字
          callback: mockCallback1,
        },
      ];

      renderHook(() => useShortcut(configs));

      // 小文字のKeyCodeで押下
      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "keys" }));
      });

      expect(mockCallback1).toHaveBeenCalledTimes(1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("特殊キーのテスト", () => {
    test("should handle Enter key", () => {
      const configs = [
        {
          code: "Enter",
          callback: mockCallback1,
        },
      ];

      renderHook(() => useShortcut(configs));

      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "Enter" }));
      });

      expect(mockCallback1).toHaveBeenCalledTimes(1);
    });

    test("should handle Arrow keys", () => {
      const configs = [
        {
          code: "ArrowUp",
          callback: mockCallback1,
        },
        {
          code: "ArrowDown",
          callback: mockCallback2,
        },
      ];

      renderHook(() => useShortcut(configs));

      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "ArrowUp" }));
      });

      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "ArrowDown" }));
      });

      expect(mockCallback1).toHaveBeenCalledTimes(1);
      expect(mockCallback2).toHaveBeenCalledTimes(1);
    });

    test("should handle Escape key", () => {
      const configs = [
        {
          code: "Escape",
          callback: mockCallback1,
        },
      ];

      renderHook(() => useShortcut(configs));

      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "Escape" }));
      });

      expect(mockCallback1).toHaveBeenCalledTimes(1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("エッジケースと異常系", () => {
    test("should handle empty configs array", () => {
      const configs: ShortcutConfig[] = [];

      renderHook(() => useShortcut(configs));

      // 何かキーを押下しても何も起こらない
      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "KeyS" }));
      });

      // エラーが発生しないことを確認
      expect(mockCallback1).not.toHaveBeenCalled();
    });

    test("should handle undefined code in config", () => {
      const configs = [
        {
          code: undefined as unknown as string,
          callback: mockCallback1,
        },
      ];

      renderHook(() => useShortcut(configs));

      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "KeyS" }));
      });

      expect(mockCallback1).not.toHaveBeenCalled();
    });

    test("should handle null code in config", () => {
      const configs = [
        {
          code: null as unknown as string,
          callback: mockCallback1,
        },
      ];

      renderHook(() => useShortcut(configs));

      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "KeyS" }));
      });

      expect(mockCallback1).not.toHaveBeenCalled();
    });

    test("should handle empty string code in config", () => {
      const configs = [
        {
          code: "",
          callback: mockCallback1,
        },
      ];

      renderHook(() => useShortcut(configs));

      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "KeyS" }));
      });

      expect(mockCallback1).not.toHaveBeenCalled();
    });

    test("should handle event without code property", () => {
      const configs = [
        {
          code: "KeyS",
          callback: mockCallback1,
        },
      ];

      renderHook(() => useShortcut(configs));

      // codeプロパティがないイベントを作成
      const event = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
      });

      act(() => {
        window.dispatchEvent(event);
      });

      expect(mockCallback1).not.toHaveBeenCalled();
    });

    test("should stop at first matching shortcut", () => {
      const configs = [
        {
          code: "KeyS",
          callback: mockCallback1,
        },
        {
          code: "KeyS", // 同じキーの設定
          callback: mockCallback2,
        },
      ];

      renderHook(() => useShortcut(configs));

      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "KeyS" }));
      });

      // 最初のコールバックのみが呼ばれる
      expect(mockCallback1).toHaveBeenCalledTimes(1);
      expect(mockCallback2).not.toHaveBeenCalled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("イベントリスナーの管理", () => {
    test("should add event listener on mount", () => {
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");
      const configs = [
        {
          code: "KeyS",
          callback: mockCallback1,
        },
      ];

      renderHook(() => useShortcut(configs));

      expect(addEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    });

    test("should remove event listener on unmount", () => {
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
      const configs = [
        {
          code: "KeyS",
          callback: mockCallback1,
        },
      ];

      const { unmount } = renderHook(() => useShortcut(configs));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    });

    test("should update event listener when configs change", () => {
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      let configs = [
        {
          code: "KeyS",
          callback: mockCallback1,
        },
      ];

      const { rerender } = renderHook(() => useShortcut(configs));

      // 初回レンダリング
      expect(addEventListenerSpy).toHaveBeenCalledTimes(1);

      // configsを変更
      configs = [
        {
          code: "KeyA",
          callback: mockCallback2,
        },
      ];

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

      const event = createKeyboardEvent({ code: "KeyS", ctrlKey: true });
      act(() => {
        window.dispatchEvent(event);
      });

      expect(saveCallback).toHaveBeenCalledTimes(1);
      expect(event.preventDefault).toHaveBeenCalledTimes(1);
    });

    test("should handle navigation shortcuts", () => {
      const nextCallback = vi.fn();
      const prevCallback = vi.fn();
      const configs = [
        {
          code: "ArrowRight",
          callback: nextCallback,
        },
        {
          code: "ArrowLeft",
          callback: prevCallback,
        },
      ];

      renderHook(() => useShortcut(configs));

      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "ArrowRight" }));
      });

      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "ArrowLeft" }));
      });

      expect(nextCallback).toHaveBeenCalledTimes(1);
      expect(prevCallback).toHaveBeenCalledTimes(1);
    });

    test("should handle modal close shortcut (Escape)", () => {
      const closeCallback = vi.fn();
      const configs = [
        {
          code: "Escape",
          callback: closeCallback,
        },
      ];

      renderHook(() => useShortcut(configs));

      act(() => {
        window.dispatchEvent(createKeyboardEvent({ code: "Escape" }));
      });

      expect(closeCallback).toHaveBeenCalledTimes(1);
    });
  });
});
