"use client";

import { TaskStatus } from "@prisma/client";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { taskStatuses, useTaskStatus } from "./use-task-status";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// updateTaskStatusのモック
vi.mock("@/lib/actions/task/task", () => ({
  updateTaskStatus: vi.fn(),
}));

// sonnerのモック
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数の型定義
 */
const mockUpdateTaskStatus = vi.mocked(await import("@/actions/task/task")).updateTaskStatus;
const mockToast = vi.mocked(await import("sonner")).toast;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ
 */
type TestData = {
  id: string;
  status: TaskStatus;
  name: string;
};

const mockTableData: TestData[] = [
  { id: "task-1", status: TaskStatus.PENDING, name: "タスク1" },
  { id: "task-2", status: TaskStatus.AUCTION_ACTIVE, name: "タスク2" },
  { id: "task-3", status: TaskStatus.TASK_COMPLETED, name: "タスク3" },
];

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("useTaskStatus", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("初期化", () => {
    test("should initialize with correct default values", () => {
      // Act
      const { result } = renderHook(() => useTaskStatus());

      // Assert
      expect(result.current.openStatus).toBe(null);
      expect(result.current.taskStatuses).toStrictEqual(taskStatuses);
      expect(typeof result.current.setOpenStatus).toBe("function");
      expect(typeof result.current.handleStatusChange).toBe("function");
    });

    test("should initialize with onDataChange callback", () => {
      // Arrange
      const mockOnDataChange = vi.fn();

      // Act
      const { result } = renderHook(() => useTaskStatus(mockOnDataChange));

      // Assert
      expect(result.current.openStatus).toBe(null);
      expect(result.current.taskStatuses).toStrictEqual(taskStatuses);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("setOpenStatus", () => {
    test("should update openStatus correctly", () => {
      // Arrange
      const { result } = renderHook(() => useTaskStatus());

      // Act
      act(() => {
        result.current.setOpenStatus("task-1");
      });

      // Assert
      expect(result.current.openStatus).toBe("task-1");
    });

    test("should set openStatus to null", () => {
      // Arrange
      const { result } = renderHook(() => useTaskStatus());

      // 初期状態を設定
      act(() => {
        result.current.setOpenStatus("task-1");
      });

      // Act
      act(() => {
        result.current.setOpenStatus(null);
      });

      // Assert
      expect(result.current.openStatus).toBe(null);
    });

    test("should handle multiple status changes", () => {
      // Arrange
      const { result } = renderHook(() => useTaskStatus());

      // Act & Assert
      act(() => {
        result.current.setOpenStatus("task-1");
      });
      expect(result.current.openStatus).toBe("task-1");

      act(() => {
        result.current.setOpenStatus("task-2");
      });
      expect(result.current.openStatus).toBe("task-2");

      act(() => {
        result.current.setOpenStatus(null);
      });
      expect(result.current.openStatus).toBe(null);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("handleStatusChange - 正常系", () => {
    test("should handle successful status change with onDataChange callback", async () => {
      // Arrange
      const mockOnDataChange = vi.fn();
      const { result } = renderHook(() => useTaskStatus(mockOnDataChange));

      mockUpdateTaskStatus.mockResolvedValue({ success: true, message: "タスクのステータスを更新しました" });

      // Act
      await act(async () => {
        await result.current.handleStatusChange(
          "task-1",
          TaskStatus.TASK_COMPLETED,
          mockTableData as unknown as Record<string, unknown>[],
        );
      });

      // Assert
      expect(mockUpdateTaskStatus).toHaveBeenCalledWith("task-1", TaskStatus.TASK_COMPLETED);
      expect(mockOnDataChange).toHaveBeenCalledWith([
        { id: "task-1", status: TaskStatus.TASK_COMPLETED, name: "タスク1" },
        { id: "task-2", status: TaskStatus.AUCTION_ACTIVE, name: "タスク2" },
        { id: "task-3", status: TaskStatus.TASK_COMPLETED, name: "タスク3" },
      ]);
      expect(mockToast.success).toHaveBeenCalledWith("ステータスを更新しました");
      expect(result.current.openStatus).toBe(null);
    });

    test("should handle successful status change without onDataChange callback", async () => {
      // Arrange
      const { result } = renderHook(() => useTaskStatus());

      mockUpdateTaskStatus.mockResolvedValue({ success: true, message: "タスクのステータスを更新しました" });

      // Act
      await act(async () => {
        await result.current.handleStatusChange(
          "task-1",
          TaskStatus.TASK_COMPLETED,
          mockTableData as unknown as Record<string, unknown>[],
        );
      });

      // Assert
      expect(mockUpdateTaskStatus).toHaveBeenCalledWith("task-1", TaskStatus.TASK_COMPLETED);
      expect(mockToast.success).toHaveBeenCalledWith("ステータスを更新しました");
      expect(result.current.openStatus).toBe(null);
    });

    test("should handle all valid task statuses", async () => {
      // Arrange
      const mockOnDataChange = vi.fn();
      const { result } = renderHook(() => useTaskStatus(mockOnDataChange));

      mockUpdateTaskStatus.mockResolvedValue({ success: true, message: "タスクのステータスを更新しました" });

      // 全ての有効なステータスをテスト
      const validStatuses = [
        TaskStatus.PENDING,
        TaskStatus.AUCTION_ACTIVE,
        TaskStatus.AUCTION_ENDED,
        TaskStatus.POINTS_DEPOSITED,
        TaskStatus.SUPPLIER_DONE,
        TaskStatus.TASK_COMPLETED,
        TaskStatus.FIXED_EVALUATED,
        TaskStatus.POINTS_AWARDED,
        TaskStatus.ARCHIVED,
        TaskStatus.AUCTION_CANCELED,
      ];

      for (const status of validStatuses) {
        // Act
        await act(async () => {
          await result.current.handleStatusChange(
            "task-1",
            status,
            mockTableData as unknown as Record<string, unknown>[],
          );
        });

        // Assert
        expect(mockUpdateTaskStatus).toHaveBeenCalledWith("task-1", status);
        expect(mockToast.success).toHaveBeenCalledWith("ステータスを更新しました");
      }
    });

    test("should update correct task in data array", async () => {
      // Arrange
      const mockOnDataChange = vi.fn();
      const { result } = renderHook(() => useTaskStatus(mockOnDataChange));

      mockUpdateTaskStatus.mockResolvedValue({ success: true, message: "タスクのステータスを更新しました" });

      // Act - task-2のステータスを変更
      await act(async () => {
        await result.current.handleStatusChange(
          "task-2",
          TaskStatus.POINTS_DEPOSITED,
          mockTableData as unknown as Record<string, unknown>[],
        );
      });

      // Assert
      expect(mockOnDataChange).toHaveBeenCalledWith([
        { id: "task-1", status: TaskStatus.PENDING, name: "タスク1" },
        { id: "task-2", status: TaskStatus.POINTS_DEPOSITED, name: "タスク2" },
        { id: "task-3", status: TaskStatus.TASK_COMPLETED, name: "タスク3" },
      ]);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("handleStatusChange - 異常系", () => {
    test("should handle error response from updateTaskStatus", async () => {
      // Arrange
      const mockOnDataChange = vi.fn();
      const { result } = renderHook(() => useTaskStatus(mockOnDataChange));

      mockUpdateTaskStatus.mockResolvedValue({
        success: false,
        error: "このステータスのタスクは変更できません",
      } as unknown as Awaited<ReturnType<typeof mockUpdateTaskStatus>>);

      // Act
      await act(async () => {
        await result.current.handleStatusChange(
          "task-1",
          TaskStatus.ARCHIVED,
          mockTableData as unknown as Record<string, unknown>[],
        );
      });

      // Assert
      expect(mockUpdateTaskStatus).toHaveBeenCalledWith("task-1", TaskStatus.ARCHIVED);
      expect(mockOnDataChange).not.toHaveBeenCalled();
      expect(mockToast.error).toHaveBeenCalledWith("このステータスのタスクは変更できません");
      expect(mockToast.success).not.toHaveBeenCalled();
      expect(result.current.openStatus).toBe(null);
    });

    test("should handle updateTaskStatus throwing an error", async () => {
      // Arrange
      const mockOnDataChange = vi.fn();
      const { result } = renderHook(() => useTaskStatus(mockOnDataChange));

      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockUpdateTaskStatus.mockRejectedValue(new Error("Network error"));

      // Act
      await act(async () => {
        await result.current.handleStatusChange(
          "task-1",
          TaskStatus.TASK_COMPLETED,
          mockTableData as unknown as Record<string, unknown>[],
        );
      });

      // Assert
      expect(mockUpdateTaskStatus).toHaveBeenCalledWith("task-1", TaskStatus.TASK_COMPLETED);
      expect(mockOnDataChange).not.toHaveBeenCalled();
      expect(mockToast.error).toHaveBeenCalledWith("ステータスの更新に失敗しました");
      expect(mockToast.success).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(new Error("Network error"));
      expect(result.current.openStatus).toBe(null);

      consoleErrorSpy.mockRestore();
    });

    test("should handle response without success or error properties", async () => {
      // Arrange
      const mockOnDataChange = vi.fn();
      const { result } = renderHook(() => useTaskStatus(mockOnDataChange));

      mockUpdateTaskStatus.mockResolvedValue({} as unknown as Awaited<ReturnType<typeof mockUpdateTaskStatus>>);

      // Act
      await act(async () => {
        await result.current.handleStatusChange(
          "task-1",
          TaskStatus.TASK_COMPLETED,
          mockTableData as unknown as Record<string, unknown>[],
        );
      });

      // Assert
      expect(mockUpdateTaskStatus).toHaveBeenCalledWith("task-1", TaskStatus.TASK_COMPLETED);
      expect(mockOnDataChange).not.toHaveBeenCalled();
      expect(mockToast.success).not.toHaveBeenCalled();
      expect(mockToast.error).not.toHaveBeenCalled();
      expect(result.current.openStatus).toBe(null);
    });

    test("should handle permission error", async () => {
      // Arrange
      const mockOnDataChange = vi.fn();
      const { result } = renderHook(() => useTaskStatus(mockOnDataChange));

      mockUpdateTaskStatus.mockResolvedValue({
        success: false,
        error: "このタスクのステータスを変更する権限がありません",
      } as unknown as Awaited<ReturnType<typeof mockUpdateTaskStatus>>);

      // Act
      await act(async () => {
        await result.current.handleStatusChange(
          "task-1",
          TaskStatus.TASK_COMPLETED,
          mockTableData as unknown as Record<string, unknown>[],
        );
      });

      // Assert
      expect(mockToast.error).toHaveBeenCalledWith("このタスクのステータスを変更する権限がありません");
      expect(mockOnDataChange).not.toHaveBeenCalled();
    });

    test("should handle database error", async () => {
      // Arrange
      const mockOnDataChange = vi.fn();
      const { result } = renderHook(() => useTaskStatus(mockOnDataChange));

      mockUpdateTaskStatus.mockResolvedValue({
        success: false,
        error: "タスクのステータスの更新中にエラーが発生しました",
      } as unknown as Awaited<ReturnType<typeof mockUpdateTaskStatus>>);

      // Act
      await act(async () => {
        await result.current.handleStatusChange(
          "task-1",
          TaskStatus.TASK_COMPLETED,
          mockTableData as unknown as Record<string, unknown>[],
        );
      });

      // Assert
      expect(mockToast.error).toHaveBeenCalledWith("タスクのステータスの更新中にエラーが発生しました");
      expect(mockOnDataChange).not.toHaveBeenCalled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle empty data array", async () => {
      // Arrange
      const mockOnDataChange = vi.fn();
      const { result } = renderHook(() => useTaskStatus(mockOnDataChange));

      mockUpdateTaskStatus.mockResolvedValue({ success: true, message: "タスクのステータスを更新しました" });

      // Act
      await act(async () => {
        await result.current.handleStatusChange(
          "task-1",
          TaskStatus.TASK_COMPLETED,
          [] as unknown as Record<string, unknown>[],
        );
      });

      // Assert
      expect(mockUpdateTaskStatus).toHaveBeenCalledWith("task-1", TaskStatus.TASK_COMPLETED);
      expect(mockOnDataChange).toHaveBeenCalledWith([]);
      expect(mockToast.success).toHaveBeenCalledWith("ステータスを更新しました");
    });

    test("should handle null taskId", async () => {
      // Arrange
      const mockOnDataChange = vi.fn();
      const { result } = renderHook(() => useTaskStatus(mockOnDataChange));

      mockUpdateTaskStatus.mockResolvedValue({ success: true, message: "タスクのステータスを更新しました" });

      // Act
      await act(async () => {
        await result.current.handleStatusChange(
          null as unknown as string,
          TaskStatus.TASK_COMPLETED,
          mockTableData as unknown as Record<string, unknown>[],
        );
      });

      // Assert
      expect(mockUpdateTaskStatus).toHaveBeenCalledWith(null, TaskStatus.TASK_COMPLETED);
    });

    test("should handle undefined taskId", async () => {
      // Arrange
      const mockOnDataChange = vi.fn();
      const { result } = renderHook(() => useTaskStatus(mockOnDataChange));

      mockUpdateTaskStatus.mockResolvedValue({ success: true, message: "タスクのステータスを更新しました" });

      // Act
      await act(async () => {
        await result.current.handleStatusChange(
          undefined as unknown as string,
          TaskStatus.TASK_COMPLETED,
          mockTableData as unknown as Record<string, unknown>[],
        );
      });

      // Assert
      expect(mockUpdateTaskStatus).toHaveBeenCalledWith(undefined, TaskStatus.TASK_COMPLETED);
    });

    test("should handle null newStatus", async () => {
      // Arrange
      const mockOnDataChange = vi.fn();
      const { result } = renderHook(() => useTaskStatus(mockOnDataChange));

      mockUpdateTaskStatus.mockResolvedValue({ success: true, message: "タスクのステータスを更新しました" });

      // Act
      await act(async () => {
        await result.current.handleStatusChange(
          "task-1",
          null as unknown as TaskStatus,
          mockTableData as unknown as Record<string, unknown>[],
        );
      });

      // Assert
      expect(mockUpdateTaskStatus).toHaveBeenCalledWith("task-1", null);
    });

    test("should handle undefined newStatus", async () => {
      // Arrange
      const mockOnDataChange = vi.fn();
      const { result } = renderHook(() => useTaskStatus(mockOnDataChange));

      mockUpdateTaskStatus.mockResolvedValue({ success: true, message: "タスクのステータスを更新しました" });

      // Act
      await act(async () => {
        await result.current.handleStatusChange(
          "task-1",
          undefined as unknown as TaskStatus,
          mockTableData as unknown as Record<string, unknown>[],
        );
      });

      // Assert
      expect(mockUpdateTaskStatus).toHaveBeenCalledWith("task-1", undefined);
    });

    test("should handle null data array", async () => {
      // Arrange
      const mockOnDataChange = vi.fn();
      const { result } = renderHook(() => useTaskStatus(mockOnDataChange));

      mockUpdateTaskStatus.mockResolvedValue({ success: true, message: "タスクのステータスを更新しました" });

      // Act
      await act(async () => {
        await result.current.handleStatusChange(
          "task-1",
          TaskStatus.TASK_COMPLETED,
          null as unknown as Record<string, unknown>[],
        );
      });

      // Assert
      expect(mockUpdateTaskStatus).toHaveBeenCalledWith("task-1", TaskStatus.TASK_COMPLETED);
      // nullの場合はmapが呼べないためエラーが発生する可能性があるが、
      // 実際の使用では配列が渡されることを想定
    });

    test("should handle undefined data array", async () => {
      // Arrange
      const mockOnDataChange = vi.fn();
      const { result } = renderHook(() => useTaskStatus(mockOnDataChange));

      mockUpdateTaskStatus.mockResolvedValue({ success: true, message: "タスクのステータスを更新しました" });

      // Act
      await act(async () => {
        await result.current.handleStatusChange(
          "task-1",
          TaskStatus.TASK_COMPLETED,
          undefined as unknown as Record<string, unknown>[],
        );
      });

      // Assert
      expect(mockUpdateTaskStatus).toHaveBeenCalledWith("task-1", TaskStatus.TASK_COMPLETED);
    });

    test("should handle task not found in data array", async () => {
      // Arrange
      const mockOnDataChange = vi.fn();
      const { result } = renderHook(() => useTaskStatus(mockOnDataChange));

      mockUpdateTaskStatus.mockResolvedValue({ success: true, message: "タスクのステータスを更新しました" });

      // Act - 存在しないタスクIDを指定
      await act(async () => {
        await result.current.handleStatusChange(
          "non-existent-task",
          TaskStatus.TASK_COMPLETED,
          mockTableData as unknown as Record<string, unknown>[],
        );
      });

      // Assert
      expect(mockUpdateTaskStatus).toHaveBeenCalledWith("non-existent-task", TaskStatus.TASK_COMPLETED);
      expect(mockOnDataChange).toHaveBeenCalledWith(mockTableData); // 元のデータがそのまま返される
      expect(mockToast.success).toHaveBeenCalledWith("ステータスを更新しました");
    });

    test("should handle large data array", async () => {
      // Arrange
      const mockOnDataChange = vi.fn();
      const { result } = renderHook(() => useTaskStatus(mockOnDataChange));

      const largeDataArray = Array.from({ length: 1000 }, (_, index) => ({
        id: `task-${index}`,
        status: TaskStatus.PENDING,
        name: `タスク${index}`,
      }));

      mockUpdateTaskStatus.mockResolvedValue({ success: true, message: "タスクのステータスを更新しました" });

      // Act
      await act(async () => {
        await result.current.handleStatusChange("task-500", TaskStatus.TASK_COMPLETED, largeDataArray);
      });

      // Assert
      expect(mockUpdateTaskStatus).toHaveBeenCalledWith("task-500", TaskStatus.TASK_COMPLETED);
      expect(mockOnDataChange).toHaveBeenCalled();
      const updatedData = mockOnDataChange.mock.calls[0][0] as unknown as TestData[];
      expect(updatedData[500].status).toBe(TaskStatus.TASK_COMPLETED);
      expect(mockToast.success).toHaveBeenCalledWith("ステータスを更新しました");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("taskStatuses定数", () => {
    test("should contain all expected task statuses", () => {
      // Assert
      expect(taskStatuses).toHaveLength(10);

      const expectedStatuses = [
        { label: "タスク実施前", value: TaskStatus.PENDING },
        { label: "オークション中", value: TaskStatus.AUCTION_ACTIVE },
        { label: "オークション終了", value: TaskStatus.AUCTION_ENDED },
        { label: "ポイント預け済み", value: TaskStatus.POINTS_DEPOSITED },
        { label: "供給側の提供完了", value: TaskStatus.SUPPLIER_DONE },
        { label: "タスク完了確認済み", value: TaskStatus.TASK_COMPLETED },
        { label: "固定評価者による評価完了", value: TaskStatus.FIXED_EVALUATED },
        { label: "ポイント付与完了", value: TaskStatus.POINTS_AWARDED },
        { label: "アーカイブ済み", value: TaskStatus.ARCHIVED },
        { label: "キャンセル済み", value: TaskStatus.AUCTION_CANCELED },
      ];

      expect(taskStatuses).toStrictEqual(expectedStatuses);
    });

    test("should have unique values", () => {
      // Assert
      const values = taskStatuses.map((status) => status.value);
      const uniqueValues = [...new Set(values)];
      expect(values).toHaveLength(uniqueValues.length);
    });

    test("should have unique labels", () => {
      // Assert
      const labels = taskStatuses.map((status) => status.label);
      const uniqueLabels = [...new Set(labels)];
      expect(labels).toHaveLength(uniqueLabels.length);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("統合テスト", () => {
    test("should handle multiple status changes in sequence", async () => {
      // Arrange
      const mockOnDataChange = vi.fn();
      const { result } = renderHook(() => useTaskStatus(mockOnDataChange));

      mockUpdateTaskStatus.mockResolvedValue({ success: true, message: "タスクのステータスを更新しました" });

      // Act - 複数のステータス変更を順次実行
      await act(async () => {
        await result.current.handleStatusChange(
          "task-1",
          TaskStatus.AUCTION_ACTIVE,
          mockTableData as unknown as Record<string, unknown>[],
        );
      });

      await act(async () => {
        await result.current.handleStatusChange(
          "task-2",
          TaskStatus.POINTS_DEPOSITED,
          mockTableData as unknown as Record<string, unknown>[],
        );
      });

      await act(async () => {
        await result.current.handleStatusChange(
          "task-3",
          TaskStatus.ARCHIVED,
          mockTableData as unknown as Record<string, unknown>[],
        );
      });

      // Assert
      expect(mockUpdateTaskStatus).toHaveBeenCalledTimes(3);
      expect(mockOnDataChange).toHaveBeenCalledTimes(3);
      expect(mockToast.success).toHaveBeenCalledTimes(3);
    });

    test("should handle mixed success and error responses", async () => {
      // Arrange
      const mockOnDataChange = vi.fn();
      const { result } = renderHook(() => useTaskStatus(mockOnDataChange));

      // Act & Assert - 成功ケース
      mockUpdateTaskStatus.mockResolvedValueOnce({ success: true, message: "タスクのステータスを更新しました" });
      await act(async () => {
        await result.current.handleStatusChange(
          "task-1",
          TaskStatus.TASK_COMPLETED,
          mockTableData as unknown as Record<string, unknown>[],
        );
      });
      expect(mockToast.success).toHaveBeenCalledWith("ステータスを更新しました");

      // Act & Assert - エラーケース
      mockUpdateTaskStatus.mockResolvedValueOnce({
        success: false,
        error: "権限がありません",
      } as unknown as Awaited<ReturnType<typeof mockUpdateTaskStatus>>);
      await act(async () => {
        await result.current.handleStatusChange(
          "task-2",
          TaskStatus.ARCHIVED,
          mockTableData as unknown as Record<string, unknown>[],
        );
      });
      expect(mockToast.error).toHaveBeenCalledWith("権限がありません");

      // Act & Assert - 例外ケース
      mockUpdateTaskStatus.mockRejectedValueOnce(new Error("Network error"));
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // console.errorの出力を抑制するためのモック実装
      });
      await act(async () => {
        await result.current.handleStatusChange(
          "task-3",
          TaskStatus.POINTS_AWARDED,
          mockTableData as unknown as Record<string, unknown>[],
        );
      });
      expect(mockToast.error).toHaveBeenCalledWith("ステータスの更新に失敗しました");
      consoleErrorSpy.mockRestore();
    });

    test("should maintain state consistency across operations", async () => {
      // Arrange
      const mockOnDataChange = vi.fn();
      const { result } = renderHook(() => useTaskStatus(mockOnDataChange));

      // Act - openStatusを設定
      act(() => {
        result.current.setOpenStatus("task-1");
      });
      expect(result.current.openStatus).toBe("task-1");

      // Act - ステータス変更（成功）
      mockUpdateTaskStatus.mockResolvedValue({ success: true, message: "タスクのステータスを更新しました" });
      await act(async () => {
        await result.current.handleStatusChange(
          "task-1",
          TaskStatus.TASK_COMPLETED,
          mockTableData as unknown as Record<string, unknown>[],
        );
      });

      // Assert - openStatusがnullにリセットされる
      expect(result.current.openStatus).toBe(null);

      // Act - openStatusを再設定
      act(() => {
        result.current.setOpenStatus("task-2");
      });
      expect(result.current.openStatus).toBe("task-2");

      // Act - ステータス変更（エラー）
      mockUpdateTaskStatus.mockResolvedValue({
        success: false,
        error: "エラーが発生しました",
      } as unknown as Awaited<ReturnType<typeof mockUpdateTaskStatus>>);
      await act(async () => {
        await result.current.handleStatusChange(
          "task-2",
          TaskStatus.ARCHIVED,
          mockTableData as unknown as Record<string, unknown>[],
        );
      });

      // Assert - エラーの場合でもopenStatusがnullにリセットされる
      expect(result.current.openStatus).toBe(null);
    });
  });
});
