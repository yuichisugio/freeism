import { createTask } from "@/actions/task/create-task-form";
import { mockPush, mockToastError, mockToastSuccess } from "@/test/setup/setup";
import { AllTheProviders, mockUseQuery } from "@/test/setup/tanstack-query-setup";
import { ContributionType } from "@prisma/client";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useTaskInputForm } from "./use-create-task-form";

// モック設定
vi.mock("@/actions/task/create-task-form", () => ({
  createTask: vi.fn(),
  prepareCreateTaskForm: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: vi.fn(),
  }),
}));

describe("useTaskInputForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルトのクエリレスポンスを設定
    mockUseQuery.mockReturnValue({
      data: {
        groups: [
          { id: "group-1", name: "テストグループ1" },
          { id: "group-2", name: "テストグループ2" },
        ],
        users: [
          { id: "user-1", name: "テストユーザー1" },
          { id: "user-2", name: "テストユーザー2" },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  test("should initialize with default values", () => {
    const { result } = renderHook(() => useTaskInputForm(), {
      wrapper: AllTheProviders,
    });

    expect(result.current.groups).toEqual([
      { id: "group-1", name: "テストグループ1" },
      { id: "group-2", name: "テストグループ2" },
    ]);
    expect(result.current.users).toEqual([
      { id: "user-1", name: "テストユーザー1" },
      { id: "user-2", name: "テストユーザー2" },
    ]);
    expect(result.current.open).toBe(false);
    expect(result.current.categoryOpen).toBe(false);
    expect(result.current.executors).toEqual([]);
    expect(result.current.reporters).toEqual([]);
    expect(result.current.isRewardType).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  test("should handle open state changes", () => {
    const { result } = renderHook(() => useTaskInputForm(), {
      wrapper: AllTheProviders,
    });

    act(() => {
      result.current.setOpen(true);
    });

    expect(result.current.open).toBe(true);

    act(() => {
      result.current.setOpen(false);
    });

    expect(result.current.open).toBe(false);
  });

  test("should handle category open state changes", () => {
    const { result } = renderHook(() => useTaskInputForm(), {
      wrapper: AllTheProviders,
    });

    act(() => {
      result.current.setCategoryOpen(true);
    });

    expect(result.current.categoryOpen).toBe(true);

    act(() => {
      result.current.setCategoryOpen(false);
    });

    expect(result.current.categoryOpen).toBe(false);
  });

  describe("executor management", () => {
    test("should add registered executor by userId", () => {
      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.addExecutor("user-1");
      });

      expect(result.current.executors).toEqual([{ userId: "user-1", name: "テストユーザー1" }]);
    });

    test("should add non-registered executor by name", () => {
      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.addExecutor(undefined, "未登録ユーザー");
      });

      expect(result.current.executors).toEqual([{ name: "未登録ユーザー" }]);
    });

    test("should not add duplicate registered executor", () => {
      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.addExecutor("user-1");
        result.current.addExecutor("user-1");
      });

      expect(result.current.executors).toEqual([{ userId: "user-1", name: "テストユーザー1" }]);
    });

    test("should not add executor with empty name", () => {
      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.addExecutor(undefined, "");
      });

      expect(result.current.executors).toEqual([]);
    });

    test("should remove executor by index", () => {
      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      // 2つの異なるユーザーを追加
      act(() => {
        result.current.addExecutor("user-1");
      });

      act(() => {
        result.current.addExecutor("user-2");
      });

      expect(result.current.executors).toHaveLength(2);

      // 最初のユーザーを削除
      act(() => {
        result.current.removeExecutor(0);
      });

      expect(result.current.executors).toHaveLength(1);
      expect(result.current.executors).toEqual([{ userId: "user-2", name: "テストユーザー2" }]);
    });
  });

  describe("reporter management", () => {
    test("should add registered reporter by userId", () => {
      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.addReporter("user-1");
      });

      expect(result.current.reporters).toEqual([{ userId: "user-1", name: "テストユーザー1" }]);
    });

    test("should add non-registered reporter by name", () => {
      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.addReporter(undefined, "未登録報告者");
      });

      expect(result.current.reporters).toEqual([{ name: "未登録報告者" }]);
    });

    test("should not add duplicate registered reporter", () => {
      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.addReporter("user-1");
        result.current.addReporter("user-1");
      });

      expect(result.current.reporters).toEqual([{ userId: "user-1", name: "テストユーザー1" }]);
    });

    test("should not add reporter with empty name", () => {
      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.addReporter(undefined, "");
      });

      expect(result.current.reporters).toEqual([]);
    });

    test("should remove reporter by index", () => {
      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      // 2つの異なるユーザーを追加
      act(() => {
        result.current.addReporter("user-1");
      });

      act(() => {
        result.current.addReporter("user-2");
      });

      expect(result.current.reporters).toHaveLength(2);

      // 最初のユーザーを削除
      act(() => {
        result.current.removeReporter(0);
      });

      expect(result.current.reporters).toHaveLength(1);
      expect(result.current.reporters).toEqual([{ userId: "user-2", name: "テストユーザー2" }]);
    });
  });

  describe("image handling", () => {
    test("should handle image upload", () => {
      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      const imageUrl = "https://example.com/image.jpg";

      act(() => {
        result.current.handleImageUploaded(imageUrl);
      });

      expect(result.current.form.getValues("imageUrl")).toBe(imageUrl);
    });

    test("should handle image removal", () => {
      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      // 最初に画像を設定
      act(() => {
        result.current.handleImageUploaded("https://example.com/image.jpg");
      });

      expect(result.current.form.getValues("imageUrl")).toBe("https://example.com/image.jpg");

      // 画像を削除
      act(() => {
        result.current.handleImageRemoved();
      });

      expect(result.current.form.getValues("imageUrl")).toBe("");
    });
  });

  describe("combobox state management", () => {
    test("should handle reporter combobox open state", () => {
      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.setReporterComboboxOpen(true);
      });

      expect(result.current.reporterComboboxOpen).toBe(true);

      act(() => {
        result.current.setReporterComboboxOpen(false);
      });

      expect(result.current.reporterComboboxOpen).toBe(false);
    });

    test("should handle executor combobox open state", () => {
      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.setExecutorsComboboxOpen(true);
      });

      expect(result.current.executorsComboboxOpen).toBe(true);

      act(() => {
        result.current.setExecutorsComboboxOpen(false);
      });

      expect(result.current.executorsComboboxOpen).toBe(false);
    });
  });

  describe("non-registered user input", () => {
    test("should handle non-registered executor input", () => {
      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.setNonRegisteredExecutor("新しい実行者");
      });

      expect(result.current.nonRegisteredExecutor).toBe("新しい実行者");
    });

    test("should handle non-registered reporter input", () => {
      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.setNonRegisteredReporter("新しい報告者");
      });

      expect(result.current.nonRegisteredReporter).toBe("新しい報告者");
    });

    test("should clear non-registered executor input when adding", () => {
      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      // 未登録実行者の名前を設定
      act(() => {
        result.current.setNonRegisteredExecutor("未登録実行者");
      });

      expect(result.current.nonRegisteredExecutor).toBe("未登録実行者");

      // 未登録実行者を追加
      act(() => {
        result.current.addExecutor(undefined, "未登録実行者");
      });

      // 入力フィールドがクリアされることを確認
      expect(result.current.nonRegisteredExecutor).toBe("");
      expect(result.current.executors).toEqual([{ name: "未登録実行者" }]);
    });
  });

  describe("combobox select functionality", () => {
    test("should handle reporter selection", () => {
      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.handleReporterSelect("user-1");
      });

      expect(result.current.reporters).toEqual([{ userId: "user-1", name: "テストユーザー1" }]);
      expect(result.current.selectedReporterId).toBe("user-1");
      expect(result.current.reporterComboboxOpen).toBe(false);
    });

    test("should handle executor selection", () => {
      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.handleExecutorSelect("user-1");
      });

      expect(result.current.executors).toEqual([{ userId: "user-1", name: "テストユーザー1" }]);
      expect(result.current.selectedExecutorId).toBe("user-1");
      expect(result.current.executorsComboboxOpen).toBe(false);
    });

    test("should handle reporter deselection", () => {
      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      // 最初にユーザーを選択
      act(() => {
        result.current.handleReporterSelect("user-1");
      });

      expect(result.current.reporters).toHaveLength(1);
      expect(result.current.selectedReporterId).toBe("user-1");

      // 選択を解除
      act(() => {
        result.current.handleReporterSelect("");
      });

      expect(result.current.reporters).toHaveLength(0);
      expect(result.current.selectedReporterId).toBeUndefined();
      expect(result.current.reporterComboboxOpen).toBe(false);
    });

    test("should handle executor deselection", () => {
      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      // 最初にユーザーを選択
      act(() => {
        result.current.handleExecutorSelect("user-1");
      });

      expect(result.current.executors).toHaveLength(1);
      expect(result.current.selectedExecutorId).toBe("user-1");

      // 選択を解除
      act(() => {
        result.current.handleExecutorSelect("");
      });

      expect(result.current.executors).toHaveLength(0);
      expect(result.current.selectedExecutorId).toBeUndefined();
      expect(result.current.executorsComboboxOpen).toBe(false);
    });

    test("should not add duplicate reporter via combobox", () => {
      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      // 同じユーザーを2回選択
      act(() => {
        result.current.handleReporterSelect("user-1");
      });

      act(() => {
        result.current.handleReporterSelect("user-1");
      });

      // 1つだけ追加されることを確認
      expect(result.current.reporters).toEqual([{ userId: "user-1", name: "テストユーザー1" }]);
    });

    test("should not add duplicate executor via combobox", () => {
      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      // 同じユーザーを2回選択
      act(() => {
        result.current.handleExecutorSelect("user-1");
      });

      act(() => {
        result.current.handleExecutorSelect("user-1");
      });

      // 1つだけ追加されることを確認
      expect(result.current.executors).toEqual([{ userId: "user-1", name: "テストユーザー1" }]);
    });
  });

  describe("error cases and edge cases", () => {
    test("should handle non-existent user selection", () => {
      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.handleReporterSelect("non-existent-user");
      });

      // 存在しないユーザーは追加されない
      expect(result.current.reporters).toHaveLength(0);
    });

    test("should handle whitespace-only name for executor", () => {
      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.addExecutor(undefined, "   ");
      });

      expect(result.current.executors).toHaveLength(0);
    });

    test("should handle whitespace-only name for reporter", () => {
      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.addReporter(undefined, "   ");
      });

      expect(result.current.reporters).toHaveLength(0);
    });

    test("should handle duplicate non-registered reporter names", () => {
      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      // 同じ名前の未登録報告者を2回追加
      act(() => {
        result.current.addReporter(undefined, "同じ名前");
      });

      act(() => {
        result.current.addReporter(undefined, "同じ名前");
      });

      // 重複チェックにより1つだけ追加される
      expect(result.current.reporters).toEqual([{ name: "同じ名前" }]);
    });
  });

  describe("loading state", () => {
    test("should handle loading state", () => {
      // ローディング状態をモック
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
      });

      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.groups).toEqual([]);
      expect(result.current.users).toEqual([]);
    });

    test("should handle empty data", () => {
      // 空のデータをモック
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
        isError: false,
        error: null,
      });

      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.groups).toEqual([]);
      expect(result.current.users).toEqual([]);
    });
  });

  describe("form submission", () => {
    beforeEach(() => {
      // デフォルトのクエリレスポンスを再設定
      mockUseQuery.mockReturnValue({
        data: {
          groups: [
            { id: "group-1", name: "テストグループ1" },
            { id: "group-2", name: "テストグループ2" },
          ],
          users: [
            { id: "user-1", name: "テストユーザー1" },
            { id: "user-2", name: "テストユーザー2" },
          ],
        },
        isLoading: false,
        isError: false,
        error: null,
      });
    });

    test("should submit form successfully", async () => {
      vi.mocked(createTask).mockResolvedValue({
        success: true,
        message: "タスクを保存しました",
        data: null,
      });

      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      const formData = {
        task: "テストタスク",
        detail: "詳細説明",
        reference: "参考資料",
        info: "追加情報",
        contributionType: ContributionType.REWARD,
        category: "テスト",
        groupId: "group-1",
        auctionStartTime: new Date(),
        auctionEndTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deliveryMethod: "配送方法",
        isExtension: "false",
        imageUrl: "",
      };

      await act(async () => {
        await result.current.onSubmit(formData);
      });

      expect(vi.mocked(createTask)).toHaveBeenCalledWith(
        expect.objectContaining({
          task: "テストタスク",
          detail: "詳細説明",
          reference: "参考資料",
          info: "追加情報",
          contributionType: ContributionType.REWARD,
          category: "テスト",
          groupId: "group-1",
          deliveryMethod: "配送方法",
          isExtension: "false",
        }),
      );
      expect(mockToastSuccess).toHaveBeenCalledWith("タスクを保存しました");
      expect(mockPush).toHaveBeenCalledWith("/dashboard/group/group-1");
    });

    test("should handle form submission error", async () => {
      vi.mocked(createTask).mockResolvedValue({
        success: false,
        message: "エラーが発生しました",
        data: null,
      });

      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      const formData = {
        task: "テストタスク",
        detail: "詳細説明",
        reference: "参考資料",
        info: "追加情報",
        contributionType: ContributionType.REWARD,
        category: "テスト",
        groupId: "group-1",
        auctionStartTime: new Date(),
        auctionEndTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deliveryMethod: "配送方法",
        isExtension: "false",
        imageUrl: "",
      };

      await act(async () => {
        await result.current.onSubmit(formData);
      });

      expect(mockToastError).toHaveBeenCalledWith("エラーが発生しました");
    });

    test("should handle form submission exception", async () => {
      vi.mocked(createTask).mockRejectedValue(new Error("ネットワークエラー"));
      vi.mocked(createTask).mockResolvedValue({
        success: false,
        message: "タスクの保存に失敗しました",
        data: null,
      });

      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      const formData = {
        task: "テストタスク",
        detail: "詳細説明",
        reference: "参考資料",
        info: "追加情報",
        contributionType: ContributionType.REWARD,
        category: "テスト",
        groupId: "group-1",
        auctionStartTime: new Date(),
        auctionEndTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deliveryMethod: "配送方法",
        isExtension: "false",
        imageUrl: "",
      };

      await act(async () => {
        await result.current.onSubmit(formData);
      });

      expect(mockToastError).toHaveBeenCalledWith("タスクの保存に失敗しました");
    });

    test("should submit form with executors and reporters", async () => {
      vi.mocked(createTask).mockResolvedValue({
        success: true,
        message: "タスクを保存しました",
        data: null,
      });

      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      // 実行者と報告者を追加
      act(() => {
        result.current.addExecutor("user-1");
        result.current.addReporter("user-2");
      });

      const formData = {
        task: "テストタスク",
        detail: "詳細説明",
        reference: "参考資料",
        info: "追加情報",
        contributionType: ContributionType.REWARD,
        category: "テスト",
        groupId: "group-1",
        auctionStartTime: new Date(),
        auctionEndTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deliveryMethod: "配送方法",
        isExtension: "false",
        imageUrl: "",
      };

      await act(async () => {
        await result.current.onSubmit(formData);
      });

      expect(vi.mocked(createTask)).toHaveBeenCalledWith(
        expect.objectContaining({
          executors: [{ userId: "user-1", name: "テストユーザー1" }],
          reporters: [{ userId: "user-2", name: "テストユーザー2" }],
        }),
      );
    });

    test("should submit form with NON_REWARD contribution type", async () => {
      vi.mocked(createTask).mockResolvedValue({
        success: true,
        message: "タスクを保存しました",
        data: null,
      });

      const { result } = renderHook(() => useTaskInputForm(), {
        wrapper: AllTheProviders,
      });

      const formData = {
        task: "テストタスク",
        detail: "詳細説明",
        reference: "参考資料",
        info: "追加情報",
        contributionType: ContributionType.NON_REWARD,
        category: "テスト",
        groupId: "group-1",
        isExtension: "false",
        imageUrl: "",
      };

      await act(async () => {
        await result.current.onSubmit(formData);
      });

      expect(vi.mocked(createTask)).toHaveBeenCalledWith(
        expect.objectContaining({
          contributionType: ContributionType.NON_REWARD,
          auctionStartTime: undefined,
          auctionEndTime: undefined,
          deliveryMethod: undefined,
        }),
      );
    });
  });
});
