import type React from "react";
import { createElement } from "react";
import { fetchMock, mockToastSuccess, mockUseSession } from "@/test/setup/setup";
import { mockUseQuery } from "@/test/setup/tanstack-query-setup";
import { NotificationSendMethod } from "@prisma/client";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useCreateNotification } from "./use-create-notification";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ホイストされたモック関数の宣言
 */
const { mockCheckIsAppOwner, mockCheckOneGroupOwner, mockPrepareCreateNotificationForm } = vi.hoisted(() => ({
  mockCheckIsAppOwner: vi.fn(),
  mockCheckOneGroupOwner: vi.fn(),
  mockPrepareCreateNotificationForm: vi.fn(),
}));

/**
 * モジュールのモック設定
 */
vi.mock("@/actions/permission", () => ({
  checkIsAppOwner: mockCheckIsAppOwner,
  checkOneGroupOwner: mockCheckOneGroupOwner,
}));

vi.mock("@/actions/notification/create-notification-form", () => ({
  prepareCreateNotificationForm: mockPrepareCreateNotificationForm,
}));

beforeEach(() => {
  vi.resetAllMocks();
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テスト用のプロバイダー
 */
function TestProvider({ children }: { children: React.ReactNode }) {
  return createElement("div", null, children);
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("useCreateNotification", () => {
  const userId = "test-user-id";

  // UserForForm型に合わせたモックデータ
  const mockUsers = [
    { id: userId, name: "テストユーザー" },
    { id: "user-2", name: "テストユーザー2" },
  ];

  const mockGroups = [
    { id: "group-1", name: "テストグループ" },
    { id: "group-2", name: "テストグループ2" },
  ];

  const mockTasks = [
    { id: "task-1", task: "テストタスク" },
    { id: "task-2", task: "テストタスク2" },
  ];

  beforeEach(() => {
    // 全てのモックをクリア
    vi.clearAllMocks();

    // セッションのモック設定
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: userId,
          email: "test@example.com",
          name: "Test User",
        },
      },
      status: "authenticated",
    });

    // permission APIのモック設定
    mockCheckIsAppOwner.mockResolvedValue({ success: true });
    mockCheckOneGroupOwner.mockResolvedValue({ success: true });

    // 通知フォームAPIのデフォルトモック
    mockPrepareCreateNotificationForm.mockResolvedValue({
      users: mockUsers,
      groups: mockGroups,
      tasks: mockTasks,
    });

    // fetchのデフォルトモック（成功レスポンス）
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  // Providerラップ関数
  function wrapper({ children }: { children: React.ReactNode }) {
    return createElement(TestProvider, null, children);
  }

  // useQueryのモックヘルパー関数
  function setupUseQueryMock(appOwnerSuccess: boolean, groupOwnerSuccess: boolean) {
    mockUseQuery.mockImplementation((options: unknown) => {
      const baseResult = {
        isLoading: false,
        isPending: false,
        isError: false,
        error: null,
        isLoadingError: false,
        isRefetchError: false,
        isSuccess: true,
        status: "success" as const,
        dataUpdatedAt: Date.now(),
        errorUpdatedAt: 0,
        failureCount: 0,
        failureReason: null,
        fetchStatus: "idle" as const,
        isFetched: true,
        isFetchedAfterMount: true,
        isFetching: false,
        isInitialLoading: false,
        isPlaceholderData: false,
        isPreviousData: false,
        isRefetching: false,
        isStale: false,
        refetch: vi.fn(),
        remove: vi.fn(),
      };

      const typedOptions = options as { queryKey?: unknown[] };

      if (
        typedOptions.queryKey &&
        Array.isArray(typedOptions.queryKey) &&
        typedOptions.queryKey.some((key: unknown) => typeof key === "string" && key.includes("appOwner"))
      ) {
        return {
          ...baseResult,
          data: { success: appOwnerSuccess },
        };
      }
      if (
        typedOptions.queryKey &&
        Array.isArray(typedOptions.queryKey) &&
        typedOptions.queryKey.some((key: unknown) => typeof key === "string" && key.includes("oneGroupOwner"))
      ) {
        return {
          ...baseResult,
          data: { success: groupOwnerSuccess },
        };
      }
      if (
        typedOptions.queryKey &&
        Array.isArray(typedOptions.queryKey) &&
        typedOptions.queryKey.some(
          (key: unknown) => typeof key === "string" && key.includes("prepareCreateNotificationForm"),
        )
      ) {
        return {
          ...baseResult,
          data: { users: mockUsers, groups: mockGroups, tasks: mockTasks },
        };
      }
      return {
        ...baseResult,
        data: undefined,
      };
    });
  }

  describe("初期化テスト", () => {
    test("基本的なテスト", () => {
      setupUseQueryMock(true, true);

      const { result } = renderHook(() => useCreateNotification(), { wrapper });

      // 基本的な関数が存在することを確認
      expect(typeof result.current.handleSubmit).toBe("function");
      expect(typeof result.current.form).toBe("object");
    });

    test("正常系: 即時送信（アプリ内通知のみ）", async () => {
      setupUseQueryMock(true, true);

      const { result } = renderHook(() => useCreateNotification(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const formData = {
        title: "テスト通知",
        message: "テストメッセージ",
        targetType: "SYSTEM" as const,
        sendTiming: "NOW" as const,
        sendScheduledDate: null,
        expiresAt: new Date("2024-12-31T23:59:59Z"),
        actionUrl: "",
        userId: "",
        groupId: "",
        taskId: "",
        sendPushNotification: false,
        sendEmailNotification: false,
      };

      await act(async () => {
        await result.current.handleSubmit(formData);
      });

      expect(fetchMock).toHaveBeenCalledWith("/api/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "テスト通知",
          message: "テストメッセージ",
          targetType: "SYSTEM",
          sendMethods: [NotificationSendMethod.IN_APP],
          recipientUserIds: null,
          groupId: "",
          taskId: "",
          auctionId: null,
          actionUrl: "",
          sendTiming: "NOW",
          sendScheduledDate: null,
          expiresAt: formData.expiresAt,
          notificationId: null,
        }),
      });

      expect(mockToastSuccess).toHaveBeenCalledWith("「アプリ内通知」を作成しました");
    });
  });
});
