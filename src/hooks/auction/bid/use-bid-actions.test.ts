// 型定義
import type { BidFormData } from "@/types/auction-types";
import { mockToastError, mockToastSuccess, mockToastWarning } from "@/test/setup/setup";
// テストセットアップ
import { AllTheProviders } from "@/test/setup/tanstack-query-setup";
import { act, renderHook } from "@testing-library/react";
import { Factory } from "fishery";
import { beforeEach, describe, expect, test, vi } from "vitest";

// テスト対象
import { useBidActions } from "./use-bid-actions";

// モック設定
vi.mock("@/lib/auction/action/bid-common", () => ({
  executeBid: vi.fn(),
}));

// executeBidのモック関数を取得
const mockExecuteBid = vi.fn();
vi.mocked(await import("@/lib/auction/action/bid-common")).executeBid = mockExecuteBid;

// テストデータファクトリー
const bidFormDataFactory = Factory.define<BidFormData>(({ sequence, params }) => ({
  auctionId: params.auctionId ?? `auction-${sequence}`,
  amount: params.amount ?? 100,
  isAutoBid: params.isAutoBid ?? false,
}));

describe("useBidActions", () => {
  // 各テスト前にモックをリセット
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteBid.mockReset();
  });

  describe("初期状態", () => {
    test("should return initial state correctly", () => {
      // Act
      const { result } = renderHook(() => useBidActions(), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.submitting).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.warningMessage).toBeNull();
      expect(typeof result.current.clientPlaceBid).toBe("function");
    });
  });

  describe("正常系", () => {
    test("should execute bid successfully with message", async () => {
      // Arrange
      const bidData = bidFormDataFactory.build({
        auctionId: "test-auction-id",
        amount: 150,
        isAutoBid: false,
      });
      const mockCallback = vi.fn();

      mockExecuteBid.mockResolvedValue({
        success: true,
        message: "入札が完了しました",
      });

      // Act
      const { result } = renderHook(() => useBidActions(), {
        wrapper: AllTheProviders,
      });

      let bidResult: boolean;
      await act(async () => {
        bidResult = await result.current.clientPlaceBid(bidData, mockCallback);
      });

      // Assert
      expect(bidResult!).toBe(true);
      expect(result.current.submitting).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.warningMessage).toBe("入札が完了しました");
      expect(mockExecuteBid).toHaveBeenCalledWith("test-auction-id", 150, false);
      expect(mockCallback).toHaveBeenCalledWith(true); // 入札開始
      expect(mockCallback).toHaveBeenCalledWith(false); // 入札終了
      expect(mockToastWarning).toHaveBeenCalledWith("入札が完了しました");
    });

    test("should execute bid successfully without message", async () => {
      // Arrange
      const bidData = bidFormDataFactory.build({
        auctionId: "test-auction-id",
        amount: 150,
        isAutoBid: false,
      });
      const mockCallback = vi.fn();

      mockExecuteBid.mockResolvedValue({
        success: true,
        message: null,
      });

      // Act
      const { result } = renderHook(() => useBidActions(), {
        wrapper: AllTheProviders,
      });

      let bidResult: boolean;
      await act(async () => {
        bidResult = await result.current.clientPlaceBid(bidData, mockCallback);
      });

      // Assert
      expect(bidResult!).toBe(true);
      expect(result.current.submitting).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.warningMessage).toBeNull();
      expect(mockExecuteBid).toHaveBeenCalledWith("test-auction-id", 150, false);
      expect(mockCallback).toHaveBeenCalledWith(true); // 入札開始
      expect(mockCallback).toHaveBeenCalledWith(false); // 入札終了
      expect(mockToastSuccess).toHaveBeenCalledWith(null);
    });

    test("should handle warning message correctly", async () => {
      // Arrange
      const bidData = bidFormDataFactory.build();
      const mockCallback = vi.fn();

      mockExecuteBid.mockResolvedValue({
        success: true,
        message: "警告: 入札額が高額です",
      });

      // Act
      const { result } = renderHook(() => useBidActions(), {
        wrapper: AllTheProviders,
      });

      await act(async () => {
        await result.current.clientPlaceBid(bidData, mockCallback);
      });

      // Assert
      expect(result.current.warningMessage).toBe("警告: 入札額が高額です");
      expect(mockToastWarning).toHaveBeenCalledWith("警告: 入札額が高額です");
    });

    test("should handle auto bid correctly", async () => {
      // Arrange
      const bidData = bidFormDataFactory.build({
        auctionId: "test-auction-id",
        amount: 200,
        isAutoBid: true,
      });
      const mockCallback = vi.fn();

      mockExecuteBid.mockResolvedValue({
        success: true,
        message: "自動入札が完了しました",
      });

      // Act
      const { result } = renderHook(() => useBidActions(), {
        wrapper: AllTheProviders,
      });

      await act(async () => {
        await result.current.clientPlaceBid(bidData, mockCallback);
      });

      // Assert
      expect(mockExecuteBid).toHaveBeenCalledWith("test-auction-id", 200, true);
      expect(result.current.warningMessage).toBe("自動入札が完了しました");
    });
  });

  describe("異常系", () => {
    test("should handle server error correctly", async () => {
      // Arrange
      const bidData = bidFormDataFactory.build();
      const mockCallback = vi.fn();

      mockExecuteBid.mockResolvedValue({
        success: false,
        message: "入札に失敗しました",
      });

      // Act
      const { result } = renderHook(() => useBidActions(), {
        wrapper: AllTheProviders,
      });

      let bidResult: boolean;
      await act(async () => {
        bidResult = await result.current.clientPlaceBid(bidData, mockCallback);
      });

      // Assert
      expect(bidResult!).toBe(false);
      expect(result.current.submitting).toBe(false);
      expect(result.current.error).toBe("入札に失敗しました");
      expect(result.current.warningMessage).toBeNull();
      expect(mockCallback).toHaveBeenCalledWith(true); // 入札開始
      expect(mockCallback).toHaveBeenCalledWith(false); // 入札終了
      expect(mockToastError).toHaveBeenCalledWith("入札に失敗しました");
    });

    test("should handle missing auction ID", async () => {
      // Arrange
      const bidData = bidFormDataFactory.build({
        auctionId: "", // 空文字列
        amount: 100,
      });
      const mockCallback = vi.fn();

      // Act
      const { result } = renderHook(() => useBidActions(), {
        wrapper: AllTheProviders,
      });

      let bidResult: boolean;
      await act(async () => {
        bidResult = await result.current.clientPlaceBid(bidData, mockCallback);
      });

      // Assert
      expect(bidResult!).toBe(false);
      expect(result.current.submitting).toBe(false);
      expect(result.current.error).toBe("useBidActions_clientPlaceBid_入札処理中にエラーが発生しました");
      expect(mockExecuteBid).not.toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledWith("useBidActions_clientPlaceBid_入札処理中にエラーが発生しました");
    });

    test("should handle network error", async () => {
      // Arrange
      const bidData = bidFormDataFactory.build();
      const mockCallback = vi.fn();

      mockExecuteBid.mockRejectedValue(new Error("Network error"));

      // Act
      const { result } = renderHook(() => useBidActions(), {
        wrapper: AllTheProviders,
      });

      let bidResult: boolean;
      await act(async () => {
        bidResult = await result.current.clientPlaceBid(bidData, mockCallback);
      });

      // Assert
      expect(bidResult!).toBe(false);
      expect(result.current.submitting).toBe(false);
      expect(result.current.error).toBe("useBidActions_clientPlaceBid_入札処理中にエラーが発生しました");
      expect(mockCallback).toHaveBeenCalledWith(true); // 入札開始
      expect(mockCallback).toHaveBeenCalledWith(false); // 入札終了
      expect(mockToastError).toHaveBeenCalledWith("useBidActions_clientPlaceBid_入札処理中にエラーが発生しました");
    });

    test("should handle server error without message", async () => {
      // Arrange
      const bidData = bidFormDataFactory.build();
      const mockCallback = vi.fn();

      mockExecuteBid.mockResolvedValue({
        success: false,
        message: null,
      });

      // Act
      const { result } = renderHook(() => useBidActions(), {
        wrapper: AllTheProviders,
      });

      let bidResult: boolean;
      await act(async () => {
        bidResult = await result.current.clientPlaceBid(bidData, mockCallback);
      });

      // Assert
      expect(bidResult!).toBe(false);
      expect(result.current.error).toBe("入札に失敗しました");
      expect(mockToastError).toHaveBeenCalledWith("入札に失敗しました");
    });
  });

  describe("境界値テスト", () => {
    test("should handle minimum bid amount", async () => {
      // Arrange
      const bidData = bidFormDataFactory.build({
        amount: 1, // 最小値
      });
      const mockCallback = vi.fn();

      mockExecuteBid.mockResolvedValue({
        success: true,
        message: "入札が完了しました",
      });

      // Act
      const { result } = renderHook(() => useBidActions(), {
        wrapper: AllTheProviders,
      });

      await act(async () => {
        await result.current.clientPlaceBid(bidData, mockCallback);
      });

      // Assert
      expect(mockExecuteBid).toHaveBeenCalledWith(expect.any(String), 1, false);
    });

    test("should handle maximum bid amount", async () => {
      // Arrange
      const bidData = bidFormDataFactory.build({
        amount: 999999999, // 大きな値
      });
      const mockCallback = vi.fn();

      mockExecuteBid.mockResolvedValue({
        success: true,
        message: "入札が完了しました",
      });

      // Act
      const { result } = renderHook(() => useBidActions(), {
        wrapper: AllTheProviders,
      });

      await act(async () => {
        await result.current.clientPlaceBid(bidData, mockCallback);
      });

      // Assert
      expect(mockExecuteBid).toHaveBeenCalledWith(expect.any(String), 999999999, false);
    });

    test("should handle null auction ID", async () => {
      // Arrange
      const bidData = {
        auctionId: null as unknown as string, // null値
        amount: 100,
        isAutoBid: false,
      };
      const mockCallback = vi.fn();

      // Act
      const { result } = renderHook(() => useBidActions(), {
        wrapper: AllTheProviders,
      });

      let bidResult: boolean;
      await act(async () => {
        bidResult = await result.current.clientPlaceBid(bidData, mockCallback);
      });

      // Assert
      expect(bidResult!).toBe(false);
      expect(result.current.error).toBe("useBidActions_clientPlaceBid_入札処理中にエラーが発生しました");
      expect(mockToastError).toHaveBeenCalledWith("useBidActions_clientPlaceBid_入札処理中にエラーが発生しました");
    });

    test("should handle undefined auction ID", async () => {
      // Arrange
      const bidData = {
        auctionId: undefined as unknown as string, // undefined値
        amount: 100,
        isAutoBid: false,
      };
      const mockCallback = vi.fn();

      // Act
      const { result } = renderHook(() => useBidActions(), {
        wrapper: AllTheProviders,
      });

      let bidResult: boolean;
      await act(async () => {
        bidResult = await result.current.clientPlaceBid(bidData, mockCallback);
      });

      // Assert
      expect(bidResult!).toBe(false);
      expect(result.current.error).toBe("useBidActions_clientPlaceBid_入札処理中にエラーが発生しました");
      expect(mockToastError).toHaveBeenCalledWith("useBidActions_clientPlaceBid_入札処理中にエラーが発生しました");
    });

    test("should handle callback function not provided", async () => {
      // Arrange
      const bidData = bidFormDataFactory.build();

      mockExecuteBid.mockResolvedValue({
        success: true,
        message: "入札が完了しました",
      });

      // Act
      const { result } = renderHook(() => useBidActions(), {
        wrapper: AllTheProviders,
      });

      let bidResult: boolean;
      await act(async () => {
        bidResult = await result.current.clientPlaceBid(bidData, vi.fn());
      });

      // Assert
      expect(bidResult!).toBe(true);
      // コールバックが呼ばれないことを確認（エラーが発生しないことを確認）
    });
  });

  describe("状態管理テスト", () => {
    test("should reset states before each bid", async () => {
      // Arrange
      const bidData = bidFormDataFactory.build();
      const mockCallback = vi.fn();

      // 最初に失敗させて状態を設定
      mockExecuteBid.mockResolvedValueOnce({
        success: false,
        message: "最初のエラー",
      });

      const { result } = renderHook(() => useBidActions(), {
        wrapper: AllTheProviders,
      });

      // 最初の入札（失敗）
      await act(async () => {
        await result.current.clientPlaceBid(bidData, mockCallback);
      });

      expect(result.current.error).toBe("最初のエラー");

      // 2回目の入札（成功）
      mockExecuteBid.mockResolvedValueOnce({
        success: true,
        message: "成功",
      });

      await act(async () => {
        await result.current.clientPlaceBid(bidData, mockCallback);
      });

      // Assert - エラーがリセットされていることを確認
      expect(result.current.error).toBeNull();
      expect(result.current.warningMessage).toBe("成功");
    });

    test("should manage submitting state correctly", async () => {
      // Arrange
      const bidData = bidFormDataFactory.build();
      const mockCallback = vi.fn();

      // executeBidを遅延させる
      let resolveExecuteBid: (value: { success: boolean; message: string }) => void;
      const executeBidPromise = new Promise<{ success: boolean; message: string }>((resolve) => {
        resolveExecuteBid = resolve;
      });
      mockExecuteBid.mockReturnValue(executeBidPromise);

      const { result } = renderHook(() => useBidActions(), {
        wrapper: AllTheProviders,
      });

      // 入札開始
      let bidPromise: Promise<boolean>;
      act(() => {
        bidPromise = result.current.clientPlaceBid(bidData, mockCallback);
      });

      // submittingがtrueになることを確認
      expect(result.current.submitting).toBe(true);

      // executeBidを解決
      resolveExecuteBid!({
        success: true,
        message: "成功",
      });

      await act(async () => {
        await bidPromise!;
      });

      // submittingがfalseに戻ることを確認
      expect(result.current.submitting).toBe(false);
    });
  });
});
