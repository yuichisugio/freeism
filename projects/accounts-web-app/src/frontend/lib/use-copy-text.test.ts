// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCopyText } from "./use-copy-text";

const writeText = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
  vi.useFakeTimers();
  writeText.mockReset();
  vi.stubGlobal("navigator", { clipboard: { writeText } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useCopyText", () => {
  it("コピーできたら「コピーした」状態にし、3秒後に元へ戻す", async () => {
    writeText.mockResolvedValue();
    const { result } = renderHook(() => useCopyText());

    await act(() => result.current.copy("https://accounts.example/profiles/ausr_alice"));
    expect(writeText).toHaveBeenCalledWith("https://accounts.example/profiles/ausr_alice");
    expect(result.current.status).toBe("copied");

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(result.current.status).toBe("copied");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.status).toBe("idle");
  });

  it("続けてコピーしたときは、最後のコピーから3秒間表示する", async () => {
    writeText.mockResolvedValue();
    const { result } = renderHook(() => useCopyText());

    await act(() => result.current.copy("a"));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    await act(() => result.current.copy("a"));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.status).toBe("copied");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.status).toBe("idle");
  });

  it("コピーできなかったときは、失敗の状態を残す", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    const { result } = renderHook(() => useCopyText());

    await act(() => result.current.copy("a"));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.status).toBe("failed");
  });

  it("表示を戻す前に画面から外れたら、タイマーを解除する", async () => {
    writeText.mockResolvedValue();
    const { result, unmount } = renderHook(() => useCopyText());

    await act(() => result.current.copy("a"));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
