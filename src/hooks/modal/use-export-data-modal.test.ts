import { mockToastError } from "@/test/setup/setup";
import { AllTheProviders } from "@/test/setup/tanstack-query-setup";
import { act, renderHook, waitFor } from "@testing-library/react";
import { addMonths } from "date-fns";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useExportDataModal } from "./use-export-data-modal";

// 外部ライブラリのモック
vi.mock("file-saver", () => ({
  saveAs: vi.fn(),
}));

vi.mock("fflate", () => ({
  zip: vi.fn(),
}));

vi.mock("papaparse", () => ({
  default: {
    unparse: vi.fn(),
  },
}));

// アクション関数のモック
vi.mock("@/actions/task/export-modal", () => ({
  exportGroupTask: vi.fn(),
  exportGroupAnalytics: vi.fn(),
}));

describe("useExportDataModal", () => {
  const defaultProps = {
    isOpen: true,
    onCloseAction: vi.fn(),
    groupId: "test-group-id",
    groupName: "テストグループ",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("初期状態", () => {
    test("should initialize with default state", () => {
      const { result } = renderHook(() => useExportDataModal(defaultProps), {
        wrapper: AllTheProviders,
      });

      expect(result.current.state).toStrictEqual({
        exportType: "",
        exportPurpose: "",
        isExporting: false,
        startDate: undefined,
        endDate: undefined,
        isStartDateOpen: false,
        isEndDateOpen: false,
        step: 1,
        direction: 1,
        page: 1,
        onlyFixed: false,
      });
    });

    test("should provide all required functions", () => {
      const { result } = renderHook(() => useExportDataModal(defaultProps), {
        wrapper: AllTheProviders,
      });

      expect(result.current.updateState).toBeInstanceOf(Function);
      expect(result.current.dateUtils.isDateRangeValid).toBeInstanceOf(Function);
      expect(result.current.dateUtils.isStartDateDisabled).toBeInstanceOf(Function);
      expect(result.current.dateUtils.isEndDateDisabled).toBeInstanceOf(Function);
      expect(result.current.exportFunctions.handleExport).toBeInstanceOf(Function);
      expect(result.current.exportFunctions.handleAnalyticsExport).toBeInstanceOf(Function);
      expect(result.current.navigationFunctions.prevStep).toBeInstanceOf(Function);
      expect(result.current.navigationFunctions.nextStep).toBeInstanceOf(Function);
      expect(result.current.navigationFunctions.getCurrentStepTitle).toBeInstanceOf(Function);
    });
  });

  describe("状態更新", () => {
    test("should update state correctly", () => {
      const { result } = renderHook(() => useExportDataModal(defaultProps), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.updateState({
          exportType: "TASK",
          exportPurpose: "ANALYSIS",
          step: 2,
        });
      });

      expect(result.current.state.exportType).toBe("TASK");
      expect(result.current.state.exportPurpose).toBe("ANALYSIS");
      expect(result.current.state.step).toBe(2);
    });

    test("should reset state when modal is closed", async () => {
      const { result, rerender } = renderHook((props) => useExportDataModal(props), {
        wrapper: AllTheProviders,
        initialProps: defaultProps,
      });

      act(() => {
        result.current.updateState({
          exportType: "TASK",
          step: 2,
          isExporting: true,
        });
      });

      rerender({ ...defaultProps, isOpen: false });

      await waitFor(
        () => {
          expect(result.current.state.step).toBe(1);
          expect(result.current.state.isExporting).toBe(false);
          expect(result.current.state.exportPurpose).toBe("");
        },
        { timeout: 500 },
      );
    });
  });

  describe("日付ユーティリティ", () => {
    test("should validate date range correctly for TASK export", () => {
      const { result } = renderHook(() => useExportDataModal(defaultProps), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.updateState({ exportType: "TASK" });
      });

      expect(result.current.dateUtils.isDateRangeValid()).toBe(false);
      expect(mockToastError).toHaveBeenCalledWith("開始日と終了日を設定してください");
    });

    test("should validate start date is before end date", () => {
      const { result } = renderHook(() => useExportDataModal(defaultProps), {
        wrapper: AllTheProviders,
      });

      const startDate = new Date("2024-02-01");
      const endDate = new Date("2024-01-01");

      act(() => {
        result.current.updateState({
          exportType: "TASK",
          startDate,
          endDate,
        });
      });

      expect(result.current.dateUtils.isDateRangeValid()).toBe(false);
      expect(mockToastError).toHaveBeenCalledWith("開始日は終了日より前に設定してください");
    });

    test("should validate maximum period of 6 months", () => {
      const { result } = renderHook(() => useExportDataModal(defaultProps), {
        wrapper: AllTheProviders,
      });

      const startDate = new Date("2024-01-01");
      const endDate = addMonths(startDate, 7);

      act(() => {
        result.current.updateState({
          exportType: "TASK",
          startDate,
          endDate,
        });
      });

      expect(result.current.dateUtils.isDateRangeValid()).toBe(false);
      expect(mockToastError).toHaveBeenCalledWith("期間は最大6ヶ月までです");
    });

    test("should return true for valid date range", () => {
      const { result } = renderHook(() => useExportDataModal(defaultProps), {
        wrapper: AllTheProviders,
      });

      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-02-01");

      act(() => {
        result.current.updateState({
          exportType: "TASK",
          startDate,
          endDate,
        });
      });

      expect(result.current.dateUtils.isDateRangeValid()).toBe(true);
    });

    test("should return true for ANALYTICS export without date validation", () => {
      const { result } = renderHook(() => useExportDataModal(defaultProps), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.updateState({ exportType: "ANALYTICS" });
      });

      expect(result.current.dateUtils.isDateRangeValid()).toBe(true);
    });

    test("should disable future dates for start date", () => {
      const { result } = renderHook(() => useExportDataModal(defaultProps), {
        wrapper: AllTheProviders,
      });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      expect(result.current.dateUtils.isStartDateDisabled(futureDate)).toBe(true);
      expect(result.current.dateUtils.isStartDateDisabled(new Date())).toBe(false);
    });

    test("should disable end dates before start date and beyond 6 months", () => {
      const { result } = renderHook(() => useExportDataModal(defaultProps), {
        wrapper: AllTheProviders,
      });

      const startDate = new Date("2024-01-01");

      act(() => {
        result.current.updateState({ startDate });
      });

      const beforeStartDate = new Date("2023-12-31");
      const validEndDate = new Date("2024-02-01");
      const tooFarEndDate = addMonths(startDate, 7);

      expect(result.current.dateUtils.isEndDateDisabled(beforeStartDate)).toBe(true);
      expect(result.current.dateUtils.isEndDateDisabled(validEndDate)).toBe(false);
      expect(result.current.dateUtils.isEndDateDisabled(tooFarEndDate)).toBe(true);
    });

    test("should not disable end dates when start date is not set", () => {
      const { result } = renderHook(() => useExportDataModal(defaultProps), {
        wrapper: AllTheProviders,
      });

      const anyDate = new Date("2024-01-01");
      expect(result.current.dateUtils.isEndDateDisabled(anyDate)).toBe(false);
    });
  });

  describe("ナビゲーション機能", () => {
    test("should move to next step correctly", () => {
      const { result } = renderHook(() => useExportDataModal(defaultProps), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.updateState({ exportType: "ANALYTICS" });
        result.current.navigationFunctions.nextStep();
      });

      expect(result.current.state.step).toBe(2);
      expect(result.current.state.direction).toBe(1);
    });

    test("should require purpose selection for TASK export", () => {
      const { result } = renderHook(() => useExportDataModal(defaultProps), {
        wrapper: AllTheProviders,
      });

      // 最初にexportTypeを設定
      act(() => {
        result.current.updateState({ exportType: "TASK" });
      });

      // 状態を確認
      expect(result.current.state.exportType).toBe("TASK");
      expect(result.current.state.exportPurpose).toBe("");
      expect(result.current.state.step).toBe(1);

      // nextStepを実行
      act(() => {
        result.current.navigationFunctions.nextStep();
      });

      // ステップが進まないことを確認
      expect(result.current.state.step).toBe(1);
      expect(mockToastError).toHaveBeenCalledWith("エクスポートの目的を選択してください");
    });

    test("should move to next step when TASK purpose is selected", () => {
      const { result } = renderHook(() => useExportDataModal(defaultProps), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.updateState({
          exportType: "TASK",
          exportPurpose: "ANALYSIS",
        });
        result.current.navigationFunctions.nextStep();
      });

      expect(result.current.state.step).toBe(2);
    });

    test("should move to previous step correctly", () => {
      const { result } = renderHook(() => useExportDataModal(defaultProps), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.updateState({ step: 2 });
      });

      act(() => {
        result.current.navigationFunctions.prevStep();
      });

      expect(result.current.state.step).toBe(1);
      expect(result.current.state.direction).toBe(-1);
    });

    test("should not go below step 1", () => {
      const { result } = renderHook(() => useExportDataModal(defaultProps), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.navigationFunctions.prevStep();
      });

      expect(result.current.state.step).toBe(1);
    });

    test("should not go above step 3", () => {
      const { result } = renderHook(() => useExportDataModal(defaultProps), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.updateState({ step: 3 });
      });

      act(() => {
        result.current.navigationFunctions.nextStep();
      });

      expect(result.current.state.step).toBe(3); // ステップ3を超えない
    });

    test("should return correct step titles", () => {
      const { result } = renderHook(() => useExportDataModal(defaultProps), {
        wrapper: AllTheProviders,
      });

      expect(result.current.navigationFunctions.getCurrentStepTitle()).toBe("データ選択");

      act(() => {
        result.current.updateState({ step: 2, exportType: "TASK" });
      });
      expect(result.current.navigationFunctions.getCurrentStepTitle()).toBe("期間指定");

      act(() => {
        result.current.updateState({ exportType: "ANALYTICS" });
      });
      expect(result.current.navigationFunctions.getCurrentStepTitle()).toBe("ページ指定");
    });
  });

  describe("境界値テスト", () => {
    test("should handle empty groupId", () => {
      const propsWithEmptyGroupId = {
        ...defaultProps,
        groupId: "",
        groupName: "",
      };

      const { result } = renderHook(() => useExportDataModal(propsWithEmptyGroupId), {
        wrapper: AllTheProviders,
      });

      expect(result.current.state).toBeDefined();
    });

    test("should handle undefined dates", () => {
      const { result } = renderHook(() => useExportDataModal(defaultProps), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.updateState({
          startDate: undefined,
          endDate: undefined,
        });
      });

      expect(result.current.dateUtils.isEndDateDisabled(new Date())).toBe(false);
    });

    test("should handle exactly 6 months period", () => {
      const { result } = renderHook(() => useExportDataModal(defaultProps), {
        wrapper: AllTheProviders,
      });

      const startDate = new Date("2024-01-01");
      const endDate = addMonths(startDate, 6); // ちょうど6ヶ月後は有効

      act(() => {
        result.current.updateState({
          exportType: "TASK",
          startDate,
          endDate,
        });
      });

      expect(result.current.dateUtils.isDateRangeValid()).toBe(true);
    });

    test("should handle more than 6 months period", () => {
      const { result } = renderHook(() => useExportDataModal(defaultProps), {
        wrapper: AllTheProviders,
      });

      const startDate = new Date("2024-01-01");
      const endDate = addMonths(startDate, 6);
      endDate.setDate(endDate.getDate() + 1); // 6ヶ月+1日後は無効

      act(() => {
        result.current.updateState({
          exportType: "TASK",
          startDate,
          endDate,
        });
      });

      expect(result.current.dateUtils.isDateRangeValid()).toBe(false);
      expect(mockToastError).toHaveBeenCalledWith("期間は最大6ヶ月までです");
    });

    test("should handle same start and end date", () => {
      const { result } = renderHook(() => useExportDataModal(defaultProps), {
        wrapper: AllTheProviders,
      });

      const sameDate = new Date("2024-01-01");

      act(() => {
        result.current.updateState({
          exportType: "TASK",
          startDate: sameDate,
          endDate: sameDate,
        });
      });

      expect(result.current.dateUtils.isDateRangeValid()).toBe(true);
    });
  });

  describe("異常系", () => {
    test("should handle null props", () => {
      const nullProps = {
        isOpen: true,
        onCloseAction: vi.fn(),
        groupId: null as unknown as string,
        groupName: null as unknown as string,
      };

      const { result } = renderHook(() => useExportDataModal(nullProps), {
        wrapper: AllTheProviders,
      });

      expect(result.current.state).toBeDefined();
    });

    test("should handle invalid export type", () => {
      const { result } = renderHook(() => useExportDataModal(defaultProps), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.updateState({
          exportType: "INVALID" as "TASK" | "ANALYTICS" | "",
        });
      });

      expect(result.current.dateUtils.isDateRangeValid()).toBe(true);
    });
  });
});
