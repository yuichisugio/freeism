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
vi.mock("@/actions/task/task", () => ({
  updateTaskStatus: vi.fn(),
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
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("初期化", () => {
    test.each([
      {
        description: "should initialize with correct default values",
        onDataChange: undefined,
        expectedOpenStatus: null,
        expectedTaskStatuses: taskStatuses,
      },
      {
        description: "should initialize with onDataChange callback",
        onDataChange: vi.fn(),
        expectedOpenStatus: null,
        expectedTaskStatuses: taskStatuses,
      },
    ])("$description", ({ onDataChange, expectedOpenStatus, expectedTaskStatuses }) => {
      // Act
      const { result } = renderHook(() => useTaskStatus(onDataChange));

      // Assert
      expect(result.current).toStrictEqual({
        openStatus: expectedOpenStatus,
        taskStatuses: expectedTaskStatuses,
        setOpenStatus: expect.any(Function) as (value: string | null) => void,
        handleStatusChange: expect.any(Function) as (
          taskId: string,
          newStatus: TaskStatus,
          data: TestData[],
        ) => Promise<void>,
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("setOpenStatus", () => {
    test.each([
      {
        description: "should update openStatus correctly",
        setValue: "task-1",
        expectedValue: "task-1",
      },
      {
        description: "should set openStatus to null",
        setValue: null,
        expectedValue: null,
      },
      {
        description: "should set openStatus to empty string",
        setValue: "",
        expectedValue: "",
      },
    ])("$description", ({ setValue, expectedValue }) => {
      // Arrange
      const { result } = renderHook(() => useTaskStatus());

      // Act
      act(() => {
        result.current.setOpenStatus(setValue);
      });

      // Assert
      expect(result.current.openStatus).toBe(expectedValue);
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
    test.each([
      {
        description: "should handle successful status change with onDataChange callback",
        hasOnDataChange: true,
        taskId: "task-1",
        newStatus: TaskStatus.TASK_COMPLETED,
        mockResponse: { success: true, message: "タスクのステータスを更新しました" },
        expectedToastSuccess: "ステータスを更新しました",
        expectedToastError: null,
        expectOnDataChangeCalled: true,
      },
      {
        description: "should handle successful status change without onDataChange callback",
        hasOnDataChange: false,
        taskId: "task-1",
        newStatus: TaskStatus.TASK_COMPLETED,
        mockResponse: { success: true, message: "タスクのステータスを更新しました" },
        expectedToastSuccess: "ステータスを更新しました",
        expectedToastError: null,
        expectOnDataChangeCalled: false,
      },
      {
        description: "should update correct task in data array",
        hasOnDataChange: true,
        taskId: "task-2",
        newStatus: TaskStatus.POINTS_DEPOSITED,
        mockResponse: { success: true, message: "タスクのステータスを更新しました" },
        expectedToastSuccess: "ステータスを更新しました",
        expectedToastError: null,
        expectOnDataChangeCalled: true,
      },
    ])(
      "$description",
      async ({
        hasOnDataChange,
        taskId,
        newStatus,
        mockResponse,
        expectedToastSuccess,
        expectedToastError,
        expectOnDataChangeCalled,
      }) => {
        // Arrange
        const mockOnDataChange = hasOnDataChange ? vi.fn() : undefined;
        const { result } = renderHook(() => useTaskStatus(mockOnDataChange));

        mockUpdateTaskStatus.mockResolvedValue(mockResponse);

        // Act
        await act(async () => {
          await result.current.handleStatusChange(
            taskId,
            newStatus,
            mockTableData as unknown as Record<string, unknown>[],
          );
        });

        // Assert
        expect(mockUpdateTaskStatus).toHaveBeenCalledWith(taskId, newStatus);
        if (expectedToastSuccess) {
          expect(mockToast.success).toHaveBeenCalledWith(expectedToastSuccess);
        }
        if (expectedToastError) {
          expect(mockToast.error).toHaveBeenCalledWith(expectedToastError);
        }
        if (expectOnDataChangeCalled && mockOnDataChange) {
          expect(mockOnDataChange).toHaveBeenCalled();
        }
        expect(result.current.openStatus).toBe(null);
      },
    );

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
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("handleStatusChange - 異常系", () => {
    test.each([
      {
        description: "should handle error response with message",
        mockResponse: { success: false, message: "このステータスのタスクは変更できません" },
        isThrowError: false,
        expectedToastError: "このステータスのタスクは変更できません",
        expectOnDataChangeCalled: false,
      },
      {
        description: "should handle error response with error field",
        mockResponse: { success: false, message: "権限がありません" },
        isThrowError: false,
        expectedToastError: "権限がありません",
        expectOnDataChangeCalled: false,
      },
      {
        description: "should handle response without success or error properties",
        mockResponse: {},
        isThrowError: false,
        expectedToastError: null,
        expectOnDataChangeCalled: false,
      },
    ])("$description", async ({ mockResponse, isThrowError, expectedToastError, expectOnDataChangeCalled }) => {
      // Arrange
      const mockOnDataChange = vi.fn();
      const { result } = renderHook(() => useTaskStatus(mockOnDataChange));

      if (isThrowError) {
        mockUpdateTaskStatus.mockRejectedValue(new Error("Network error"));
      } else {
        mockUpdateTaskStatus.mockResolvedValue(
          mockResponse as unknown as Awaited<ReturnType<typeof mockUpdateTaskStatus>>,
        );
      }

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
      if (expectedToastError) {
        expect(mockToast.error).toHaveBeenCalledWith(expectedToastError);
      }
      if (expectOnDataChangeCalled) {
        expect(mockOnDataChange).toHaveBeenCalled();
      } else {
        expect(mockOnDataChange).not.toHaveBeenCalled();
      }
      expect(result.current.openStatus).toBe(null);
    });

    test("should handle updateTaskStatus throwing an error", async () => {
      // Arrange
      const mockOnDataChange = vi.fn();
      const { result } = renderHook(() => useTaskStatus(mockOnDataChange));

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // console.errorの出力を抑制するためのモック実装
      });
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
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test.each([
      {
        description: "should handle empty data array",
        taskId: "task-1",
        newStatus: TaskStatus.TASK_COMPLETED,
        data: [],
        expectedSuccess: true,
      },
      {
        description: "should handle null taskId",
        taskId: null,
        newStatus: TaskStatus.TASK_COMPLETED,
        data: mockTableData,
        expectedSuccess: true,
      },
      {
        description: "should handle undefined taskId",
        taskId: undefined,
        newStatus: TaskStatus.TASK_COMPLETED,
        data: mockTableData,
        expectedSuccess: true,
      },
      {
        description: "should handle null newStatus",
        taskId: "task-1",
        newStatus: null,
        data: mockTableData,
        expectedSuccess: true,
      },
      {
        description: "should handle undefined newStatus",
        taskId: "task-1",
        newStatus: undefined,
        data: mockTableData,
        expectedSuccess: true,
      },
      {
        description: "should handle task not found in data array",
        taskId: "non-existent-task",
        newStatus: TaskStatus.TASK_COMPLETED,
        data: mockTableData,
        expectedSuccess: true,
      },
    ])("$description", async ({ taskId, newStatus, data, expectedSuccess }) => {
      // Arrange
      const mockOnDataChange = vi.fn();
      const { result } = renderHook(() => useTaskStatus(mockOnDataChange));

      mockUpdateTaskStatus.mockResolvedValue({ success: expectedSuccess, message: "タスクのステータスを更新しました" });

      // Act
      await act(async () => {
        await result.current.handleStatusChange(
          taskId as unknown as string,
          newStatus as unknown as TaskStatus,
          data as unknown as Record<string, unknown>[],
        );
      });

      // Assert
      expect(mockUpdateTaskStatus).toHaveBeenCalledWith(taskId, newStatus);
      if (expectedSuccess) {
        expect(mockToast.success).toHaveBeenCalledWith("ステータスを更新しました");
      }
    });

    test.each([
      {
        description: "should handle null data array",
        data: null,
        shouldThrow: true,
      },
      {
        description: "should handle undefined data array",
        data: undefined,
        shouldThrow: true,
      },
    ])("$description", async ({ data, shouldThrow }) => {
      // Arrange
      const mockOnDataChange = vi.fn();
      const { result } = renderHook(() => useTaskStatus(mockOnDataChange));

      mockUpdateTaskStatus.mockResolvedValue({ success: true, message: "タスクのステータスを更新しました" });

      if (shouldThrow) {
        // Act & Assert - エラーが発生することを期待
        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
          // console.errorの出力を抑制するためのモック実装
        });

        await act(async () => {
          await result.current.handleStatusChange(
            "task-1",
            TaskStatus.TASK_COMPLETED,
            data as unknown as Record<string, unknown>[],
          );
        });

        // Assert - エラーが発生してもupdateTaskStatusは呼ばれる
        expect(mockUpdateTaskStatus).toHaveBeenCalledWith("task-1", TaskStatus.TASK_COMPLETED);
        expect(mockToast.error).toHaveBeenCalledWith("ステータスの更新に失敗しました");

        consoleErrorSpy.mockRestore();
      } else {
        // Act
        await act(async () => {
          await result.current.handleStatusChange(
            "task-1",
            TaskStatus.TASK_COMPLETED,
            data as unknown as Record<string, unknown>[],
          );
        });

        // Assert
        expect(mockUpdateTaskStatus).toHaveBeenCalledWith("task-1", TaskStatus.TASK_COMPLETED);
      }
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
        { label: "オークションキャンセル", value: TaskStatus.AUCTION_CANCELED },
      ];

      expect(taskStatuses).toStrictEqual(expectedStatuses);
    });

    test.each([
      {
        description: "should have unique values",
        checkProperty: "value",
      },
      {
        description: "should have unique labels",
        checkProperty: "label",
      },
    ])("$description", ({ checkProperty }) => {
      // Assert
      const values = taskStatuses.map((status) => status[checkProperty as keyof typeof status]);
      const uniqueValues = [...new Set(values)];
      expect(values).toHaveLength(uniqueValues.length);
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
        message: "権限がありません",
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
        message: "エラーが発生しました",
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
