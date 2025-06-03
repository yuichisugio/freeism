import type { GeneralNotificationParams } from "@/lib/actions/notification/general-notification";
import type { Session } from "next-auth";
import { sendGeneralNotification } from "@/lib/actions/notification/general-notification";
// モック設定
import { getAuthSession } from "@/lib/utils";
import { NotificationSendMethod, NotificationSendTiming, NotificationTargetType } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { POST } from "./route";

// 外部依存のモック
vi.mock("@/lib/utils", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/actions/notification/general-notification", () => ({
  sendGeneralNotification: vi.fn(),
}));

// NextResponseのモック
vi.mock("next/server", () => ({
  NextRequest: class MockNextRequest {
    constructor(
      public url: string,
      public init: RequestInit,
    ) {}

    async json(): Promise<unknown> {
      return JSON.parse(this.init.body as string);
    }
  },
  NextResponse: {
    json: vi.fn((data: unknown, options?: { status?: number }) => {
      const response = {
        json: async () => data,
        status: options?.status ?? 200,
      };
      return response;
    }),
  },
}));

// モック関数の型定義
const mockGetAuthSession = vi.mocked(getAuthSession);
const mockSendGeneralNotification = vi.mocked(sendGeneralNotification);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 有効なセッションデータを作成するヘルパー関数
 */
function createValidSession(overrides: Partial<Session> = {}): Session {
  return {
    user: {
      id: "test-user-id",
      email: "test@example.com",
      name: "Test User",
    },
    expires: "2024-12-31",
    ...overrides,
  };
}

/**
 * 有効な通知パラメータを作成するヘルパー関数
 */
function createValidNotificationParams(overrides: Partial<GeneralNotificationParams> = {}): GeneralNotificationParams {
  return {
    title: "テスト通知",
    message: "テストメッセージ",
    sendMethods: [NotificationSendMethod.IN_APP],
    targetType: NotificationTargetType.USER,
    recipientUserIds: ["user-1"],
    groupId: null,
    taskId: null,
    auctionId: null,
    actionUrl: null,
    sendTiming: NotificationSendTiming.NOW,
    sendScheduledDate: null,
    expiresAt: null,
    notificationId: null,
    ...overrides,
  };
}

/**
 * リクエストオブジェクトを作成するヘルパー関数
 */
function createMockRequest(body: unknown): Request {
  const mockRequest = {
    json: async () => body,
  } as Request;
  return mockRequest;
}

/**
 * JSONパースエラーを発生させるリクエストを作成するヘルパー関数
 */
function createMockRequestWithJsonError(): Request {
  const mockRequest = {
    json: async () => {
      throw new Error("JSON parse error");
    },
  } as unknown as Request;
  return mockRequest;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("POST /api/notifications", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系テスト", () => {
    test("should create notification successfully when user is authenticated", async () => {
      // Arrange
      const validSession = createValidSession();
      const validParams = createValidNotificationParams();
      const request = createMockRequest(validParams);

      mockGetAuthSession.mockResolvedValue(validSession);
      mockSendGeneralNotification.mockResolvedValue({ success: true });

      // Act
      const response = await POST(request);
      const responseData = (await response.json()) as { success: boolean; error?: string };

      // Assert
      expect(response.status).toBe(200);
      expect(responseData).toStrictEqual({ success: true });
      expect(mockGetAuthSession).toHaveBeenCalledOnce();
      expect(mockSendGeneralNotification).toHaveBeenCalledWith(validParams);
    });

    test("should return sendGeneralNotification result when it contains error", async () => {
      // Arrange
      const validSession = createValidSession();
      const validParams = createValidNotificationParams();
      const request = createMockRequest(validParams);

      mockGetAuthSession.mockResolvedValue(validSession);
      mockSendGeneralNotification.mockResolvedValue({ success: false, error: "通知送信に失敗しました" });

      // Act
      const response = await POST(request);
      const responseData = (await response.json()) as { success: boolean; error?: string };

      // Assert
      expect(response.status).toBe(200);
      expect(responseData).toStrictEqual({ success: false, error: "通知送信に失敗しました" });
      expect(mockGetAuthSession).toHaveBeenCalledOnce();
      expect(mockSendGeneralNotification).toHaveBeenCalledWith(validParams);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系テスト", () => {
    test("should return 401 when session is null", async () => {
      // Arrange
      const validParams = createValidNotificationParams();
      const request = createMockRequest(validParams);

      mockGetAuthSession.mockResolvedValue(null);

      // Act
      const response = await POST(request);
      const responseData = (await response.json()) as { success: boolean; error: string };

      // Assert
      expect(response.status).toBe(401);
      expect(responseData).toStrictEqual({
        success: false,
        error: "認証が必要です",
      });
      expect(mockGetAuthSession).toHaveBeenCalledOnce();
      expect(mockSendGeneralNotification).not.toHaveBeenCalled();
    });

    test("should return 401 when session user is undefined", async () => {
      // Arrange
      const sessionWithoutUser = createValidSession({ user: undefined });
      const validParams = createValidNotificationParams();
      const request = createMockRequest(validParams);

      mockGetAuthSession.mockResolvedValue(sessionWithoutUser);

      // Act
      const response = await POST(request);
      const responseData = (await response.json()) as { success: boolean; error: string };

      // Assert
      expect(response.status).toBe(401);
      expect(responseData).toStrictEqual({
        success: false,
        error: "認証が必要です",
      });
      expect(mockGetAuthSession).toHaveBeenCalledOnce();
      expect(mockSendGeneralNotification).not.toHaveBeenCalled();
    });

    test("should return 500 when JSON parsing fails", async () => {
      // Arrange
      const validSession = createValidSession();
      const request = createMockRequestWithJsonError();

      mockGetAuthSession.mockResolvedValue(validSession);

      // Act
      const response = await POST(request);
      const responseData = (await response.json()) as { success: boolean; error: string };

      // Assert
      expect(response.status).toBe(500);
      expect(responseData).toStrictEqual({
        success: false,
        error: "通知の作成中にエラーが発生しました",
      });
      expect(mockGetAuthSession).toHaveBeenCalledOnce();
      expect(mockSendGeneralNotification).not.toHaveBeenCalled();
    });

    test("should return 500 when getAuthSession throws error", async () => {
      // Arrange
      const validParams = createValidNotificationParams();
      const request = createMockRequest(validParams);

      mockGetAuthSession.mockRejectedValue(new Error("Auth session error"));

      // Act
      const response = await POST(request);
      const responseData = (await response.json()) as { success: boolean; error: string };

      // Assert
      expect(response.status).toBe(500);
      expect(responseData).toStrictEqual({
        success: false,
        error: "通知の作成中にエラーが発生しました",
      });
      expect(mockGetAuthSession).toHaveBeenCalledOnce();
      expect(mockSendGeneralNotification).not.toHaveBeenCalled();
    });

    test("should return 500 when sendGeneralNotification throws error", async () => {
      // Arrange
      const validSession = createValidSession();
      const validParams = createValidNotificationParams();
      const request = createMockRequest(validParams);

      mockGetAuthSession.mockResolvedValue(validSession);
      mockSendGeneralNotification.mockRejectedValue(new Error("Notification service error"));

      // Act
      const response = await POST(request);
      const responseData = (await response.json()) as { success: boolean; error: string };

      // Assert
      expect(response.status).toBe(500);
      expect(responseData).toStrictEqual({
        success: false,
        error: "通知の作成中にエラーが発生しました",
      });
      expect(mockGetAuthSession).toHaveBeenCalledOnce();
      expect(mockSendGeneralNotification).toHaveBeenCalledWith(validParams);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle session with user but without id", async () => {
      // Arrange
      const sessionWithoutUserId = createValidSession({
        user: {
          email: "test@example.com",
          name: "Test User",
        },
      });
      const validParams = createValidNotificationParams();
      const request = createMockRequest(validParams);

      mockGetAuthSession.mockResolvedValue(sessionWithoutUserId);

      // Act
      const response = await POST(request);
      const responseData = (await response.json()) as { success: boolean; error: string };

      // Assert - user.idがない場合、内部エラーで500が返される
      expect(response.status).toBe(500);
      expect(responseData).toStrictEqual({
        success: false,
        error: "通知の作成中にエラーが発生しました",
      });
      expect(mockGetAuthSession).toHaveBeenCalledOnce();
      // sendGeneralNotificationは呼ばれるが、内部でエラーが発生する可能性がある
    });

    test("should handle empty notification parameters", async () => {
      // Arrange
      const validSession = createValidSession();
      const emptyParams = {};
      const request = createMockRequest(emptyParams);

      mockGetAuthSession.mockResolvedValue(validSession);
      mockSendGeneralNotification.mockResolvedValue({ success: true });

      // Act
      const response = await POST(request);
      const responseData = (await response.json()) as { success: boolean };

      // Assert
      expect(response.status).toBe(200);
      expect(responseData).toStrictEqual({ success: true });
      expect(mockGetAuthSession).toHaveBeenCalledOnce();
      expect(mockSendGeneralNotification).toHaveBeenCalledWith(emptyParams);
    });

    test("should handle null request body", async () => {
      // Arrange
      const validSession = createValidSession();
      const request = createMockRequest(null);

      mockGetAuthSession.mockResolvedValue(validSession);
      mockSendGeneralNotification.mockResolvedValue({ success: true });

      // Act
      const response = await POST(request);
      const responseData = (await response.json()) as { success: boolean };

      // Assert
      expect(response.status).toBe(200);
      expect(responseData).toStrictEqual({ success: true });
      expect(mockGetAuthSession).toHaveBeenCalledOnce();
      expect(mockSendGeneralNotification).toHaveBeenCalledWith(null);
    });
  });
});
