import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { useGroupDetailModal } from "./use-group-detail-modal";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("useGroupDetailModal", () => {
  test("should initialize with default values", () => {
    // フックをレンダリング
    const { result } = renderHook(() => useGroupDetailModal());

    // 初期状態の検証
    expect(result.current.isUploadModalOpen).toBe(false);
    expect(result.current.isExportModalOpen).toBe(false);
    expect(typeof result.current.setIsUploadModalOpen).toBe("function");
    expect(typeof result.current.setIsExportModalOpen).toBe("function");
  });

  test("should update isUploadModalOpen when setIsUploadModalOpen is called", () => {
    // フックをレンダリング
    const { result } = renderHook(() => useGroupDetailModal());

    // 初期状態の確認
    expect(result.current.isUploadModalOpen).toBe(false);

    // モーダルを開く
    act(() => {
      result.current.setIsUploadModalOpen(true);
    });

    // 状態が更新されたことを確認
    expect(result.current.isUploadModalOpen).toBe(true);

    // モーダルを閉じる
    act(() => {
      result.current.setIsUploadModalOpen(false);
    });

    // 状態が更新されたことを確認
    expect(result.current.isUploadModalOpen).toBe(false);
  });

  test("should update isExportModalOpen when setIsExportModalOpen is called", () => {
    // フックをレンダリング
    const { result } = renderHook(() => useGroupDetailModal());

    // 初期状態の確認
    expect(result.current.isExportModalOpen).toBe(false);

    // モーダルを開く
    act(() => {
      result.current.setIsExportModalOpen(true);
    });

    // 状態が更新されたことを確認
    expect(result.current.isExportModalOpen).toBe(true);

    // モーダルを閉じる
    act(() => {
      result.current.setIsExportModalOpen(false);
    });

    // 状態が更新されたことを確認
    expect(result.current.isExportModalOpen).toBe(false);
  });

  test("should handle multiple state changes correctly", () => {
    // フックをレンダリング
    const { result } = renderHook(() => useGroupDetailModal());

    // 両方のモーダルを同時に開く
    act(() => {
      result.current.setIsUploadModalOpen(true);
      result.current.setIsExportModalOpen(true);
    });

    // 両方が開いていることを確認
    expect(result.current.isUploadModalOpen).toBe(true);
    expect(result.current.isExportModalOpen).toBe(true);

    // 片方だけ閉じる
    act(() => {
      result.current.setIsUploadModalOpen(false);
    });

    // 状態が独立していることを確認
    expect(result.current.isUploadModalOpen).toBe(false);
    expect(result.current.isExportModalOpen).toBe(true);

    // もう片方も閉じる
    act(() => {
      result.current.setIsExportModalOpen(false);
    });

    // 両方が閉じていることを確認
    expect(result.current.isUploadModalOpen).toBe(false);
    expect(result.current.isExportModalOpen).toBe(false);
  });

  test("should handle rapid state changes", () => {
    // フックをレンダリング
    const { result } = renderHook(() => useGroupDetailModal());

    // 連続して状態を変更
    act(() => {
      result.current.setIsUploadModalOpen(true);
      result.current.setIsUploadModalOpen(false);
      result.current.setIsUploadModalOpen(true);
    });

    // 最後の状態が反映されていることを確認
    expect(result.current.isUploadModalOpen).toBe(true);

    // エクスポートモーダルでも同様のテスト
    act(() => {
      result.current.setIsExportModalOpen(true);
      result.current.setIsExportModalOpen(false);
      result.current.setIsExportModalOpen(true);
    });

    // 最後の状態が反映されていることを確認
    expect(result.current.isExportModalOpen).toBe(true);
  });

  test("should maintain state consistency across re-renders", () => {
    // フックをレンダリング
    const { result, rerender } = renderHook(() => useGroupDetailModal());

    // 状態を変更
    act(() => {
      result.current.setIsUploadModalOpen(true);
      result.current.setIsExportModalOpen(true);
    });

    // 状態を確認
    expect(result.current.isUploadModalOpen).toBe(true);
    expect(result.current.isExportModalOpen).toBe(true);

    // 再レンダリング
    rerender();

    // 状態が保持されていることを確認
    expect(result.current.isUploadModalOpen).toBe(true);
    expect(result.current.isExportModalOpen).toBe(true);
  });

  test("should return function references on re-renders", () => {
    // フックをレンダリング
    const { result, rerender } = renderHook(() => useGroupDetailModal());

    // 再レンダリング
    rerender();

    // 関数が正しく返されることを確認
    expect(typeof result.current.setIsUploadModalOpen).toBe("function");
    expect(typeof result.current.setIsExportModalOpen).toBe("function");
  });
});
