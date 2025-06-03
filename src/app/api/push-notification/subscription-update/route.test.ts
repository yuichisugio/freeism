import type { PushSubscription } from "@prisma/client";
import type { Session } from "next-auth";
import type { NextRequest } from "next/server";
// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// テスト対象のインポート（モック設定後にインポート）
import { getRecordId, saveSubscription } from "@/lib/actions/notification/push-notification";
import { getAuthSession } from "@/lib/utils";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { POST } from "./route";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// Next.js server関連のモック
vi.mock("next/server", () => ({
  NextRequest: vi.fn(),
  NextResponse: {
    json: vi.fn((data: unknown, options: { status?: number } = {}) => ({
      json: vi.fn().mockResolvedValue(data),
      status: options.status ?? 200,
    })),
  },
}));

// 外部依存のモック
vi.mock("@/lib/actions/notification/push-notification", () => ({
  getRecordId: vi.fn(),
  saveSubscription: vi.fn(),
}));

vi.mock("@/lib/utils", () => ({
  getAuthSession: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数の型定義
 */
const mockGetAuthSession = vi.mocked(getAuthSession);
const mockGetRecordId = vi.mocked(getRecordId);
const mockSaveSubscription = vi.mocked(saveSubscription);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ
 */
const validRequestBody = {
  oldEndpoint: "https://fcm.googleapis.com/fcm/send/old-endpoint",
  newSubscription: {
    endpoint: "https://fcm.googleapis.com/fcm/send/new-endpoint",
    expirationTime: 1234567890000,
    keys: {
      p256dh: "test-p256dh-key",
      auth: "test-auth-key",
    },
  },
};

const mockSession: Session = {
  user: {
    id: "test-user-id",
    email: "test@example.com",
    name: "Test User",
  },
  expires: "2024-12-31T23:59:59.999Z",
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ヘルパー関数
 */
function createMockRequest(body: unknown): NextRequest {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as NextRequest;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("POST /api/push-notification/subscription-update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系テスト", () => {
    test("should update subscription successfully with valid request", async () => {
      // Arrange
      const request = createMockRequest(validRequestBody);

      mockGetAuthSession.mockResolvedValue(mockSession);
      mockGetRecordId.mockResolvedValue("test-record-id");
      mockSaveSubscription.mockResolvedValue({
        id: "test-subscription-id",
        endpoint: validRequestBody.newSubscription.endpoint,
        p256dh: validRequestBody.newSubscription.keys.p256dh,
        auth: validRequestBody.newSubscription.keys.auth,
        userId: mockSession.user?.id,
      } as PushSubscription);

      // Act
      const response = await POST(request);
      const responseData = (await response.json()) as {
        success: boolean;
        message: string;
        subscription?: PushSubscription;
      };

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe("購読情報が更新されました");
      expect(mockGetAuthSession).toHaveBeenCalledOnce();
      expect(mockGetRecordId).toHaveBeenCalledWith(validRequestBody.oldEndpoint);
      expect(mockSaveSubscription).toHaveBeenCalledWith({
        endpoint: validRequestBody.newSubscription.endpoint,
        expirationTime: validRequestBody.newSubscription.expirationTime,
        keys: validRequestBody.newSubscription.keys,
        recordId: "test-record-id",
      });
    });
  });

  describe("異常系テスト", () => {
    test("should return 401 when user is not authenticated", async () => {
      // Arrange
      const request = createMockRequest(validRequestBody);
      mockGetAuthSession.mockResolvedValue(null);

      // Act
      const response = await POST(request);
      const responseData = (await response.json()) as { error: string };

      // Assert
      expect(response.status).toBe(401);
      expect(responseData.error).toBe("Unauthorized: User not authenticated");
      expect(mockGetRecordId).not.toHaveBeenCalled();
      expect(mockSaveSubscription).not.toHaveBeenCalled();
    });

    test("should return 401 when session user id is missing", async () => {
      // Arrange
      const request = createMockRequest(validRequestBody);
      mockGetAuthSession.mockResolvedValue({
        user: null,
        expires: "2024-12-31T23:59:59.999Z",
      } as unknown as Session);

      // Act
      const response = await POST(request);
      const responseData = (await response.json()) as { error: string };

      // Assert
      expect(response.status).toBe(401);
      expect(responseData.error).toBe("Unauthorized: User not authenticated");
      expect(mockGetRecordId).not.toHaveBeenCalled();
      expect(mockSaveSubscription).not.toHaveBeenCalled();
    });

    test("should return 400 when newSubscription is missing", async () => {
      // Arrange
      const requestBody = {
        oldEndpoint: "https://fcm.googleapis.com/fcm/send/old-endpoint",
      };
      const request = createMockRequest(requestBody);
      mockGetAuthSession.mockResolvedValue(mockSession);

      // Act
      const response = await POST(request);
      const responseData = (await response.json()) as { error: string };

      // Assert
      expect(response.status).toBe(400);
      expect(responseData.error).toBe("New subscription data is missing or invalid");
      expect(mockGetAuthSession).toHaveBeenCalledOnce();
      expect(mockGetRecordId).not.toHaveBeenCalled();
      expect(mockSaveSubscription).not.toHaveBeenCalled();
    });

    test("should return 400 when newSubscription endpoint is empty", async () => {
      // Arrange
      const requestBody = {
        oldEndpoint: "https://fcm.googleapis.com/fcm/send/old-endpoint",
        newSubscription: {
          endpoint: "",
          expirationTime: 1234567890000,
          keys: {
            p256dh: "test-p256dh-key",
            auth: "test-auth-key",
          },
        },
      };
      const request = createMockRequest(requestBody);
      mockGetAuthSession.mockResolvedValue(mockSession);

      // Act
      const response = await POST(request);
      const responseData = (await response.json()) as { error: string };

      // Assert
      expect(response.status).toBe(400);
      expect(responseData.error).toBe("New subscription data is missing or invalid");
      expect(mockGetAuthSession).toHaveBeenCalledOnce();
      expect(mockGetRecordId).not.toHaveBeenCalled();
      expect(mockSaveSubscription).not.toHaveBeenCalled();
    });

    test("should return 400 when old subscription not found", async () => {
      // Arrange
      const request = createMockRequest(validRequestBody);
      mockGetAuthSession.mockResolvedValue(mockSession);
      mockGetRecordId.mockResolvedValue(null);

      // Act
      const response = await POST(request);
      const responseData = (await response.json()) as { error: string };

      // Assert
      expect(response.status).toBe(400);
      expect(responseData.error).toBe("Old subscription not found");
      expect(mockGetRecordId).toHaveBeenCalledWith(validRequestBody.oldEndpoint);
      expect(mockSaveSubscription).not.toHaveBeenCalled();
    });

    test("should return 400 when saveSubscription returns error", async () => {
      // Arrange
      const request = createMockRequest(validRequestBody);
      mockGetAuthSession.mockResolvedValue(mockSession);
      mockGetRecordId.mockResolvedValue("test-record-id");
      mockSaveSubscription.mockResolvedValue({ error: "Database error" });

      // Act
      const response = await POST(request);
      const responseData = (await response.json()) as { error: string };

      // Assert
      expect(response.status).toBe(400);
      expect(responseData.error).toBe("Database error");
      expect(mockSaveSubscription).toHaveBeenCalledWith({
        endpoint: validRequestBody.newSubscription.endpoint,
        expirationTime: validRequestBody.newSubscription.expirationTime,
        keys: validRequestBody.newSubscription.keys,
        recordId: "test-record-id",
      });
    });

    test("should return 500 when unexpected error occurs", async () => {
      // Arrange
      const request = createMockRequest(validRequestBody);
      mockGetAuthSession.mockRejectedValue(new Error("Unexpected error"));

      // Act
      const response = await POST(request);
      const responseData = (await response.json()) as { error: string };

      // Assert
      expect(response.status).toBe(500);
      expect(responseData.error).toBe("購読の更新に失敗しました");
    });
  });

  describe("境界値テスト", () => {
    test("should handle oldEndpoint being null", async () => {
      // Arrange
      const requestBody = {
        oldEndpoint: null,
        newSubscription: {
          endpoint: "https://fcm.googleapis.com/fcm/send/new-endpoint",
          expirationTime: 1234567890000,
          keys: {
            p256dh: "test-p256dh-key",
            auth: "test-auth-key",
          },
        },
      };
      const request = createMockRequest(requestBody);
      mockGetAuthSession.mockResolvedValue(mockSession);

      // Act
      const response = await POST(request);
      const responseData = (await response.json()) as { error: string };

      // Assert
      expect(response.status).toBe(400);
      expect(responseData.error).toBe("Old subscription not found");
      expect(mockGetRecordId).not.toHaveBeenCalled();
    });

    test("should handle newSubscription with null expirationTime", async () => {
      // Arrange
      const requestBody = {
        oldEndpoint: "https://fcm.googleapis.com/fcm/send/old-endpoint",
        newSubscription: {
          endpoint: "https://fcm.googleapis.com/fcm/send/new-endpoint",
          expirationTime: null,
          keys: {
            p256dh: "test-p256dh-key",
            auth: "test-auth-key",
          },
        },
      };
      const request = createMockRequest(requestBody);
      mockGetAuthSession.mockResolvedValue(mockSession);
      mockGetRecordId.mockResolvedValue("test-record-id");
      mockSaveSubscription.mockResolvedValue({
        id: "test-subscription-id",
        endpoint: requestBody.newSubscription.endpoint,
        p256dh: requestBody.newSubscription.keys.p256dh,
        auth: requestBody.newSubscription.keys.auth,
        userId: mockSession.user?.id,
      } as PushSubscription);

      // Act
      const response = await POST(request);
      const responseData = (await response.json()) as {
        success: boolean;
        message: string;
        subscription?: PushSubscription;
      };

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(mockSaveSubscription).toHaveBeenCalledWith({
        endpoint: requestBody.newSubscription.endpoint,
        expirationTime: null,
        keys: requestBody.newSubscription.keys,
        recordId: "test-record-id",
      });
    });

    test("should handle newSubscription with undefined expirationTime", async () => {
      // Arrange
      const requestBody = {
        oldEndpoint: "https://fcm.googleapis.com/fcm/send/old-endpoint",
        newSubscription: {
          endpoint: "https://fcm.googleapis.com/fcm/send/new-endpoint",
          expirationTime: undefined,
          keys: {
            p256dh: "test-p256dh-key",
            auth: "test-auth-key",
          },
        },
      };
      const request = createMockRequest(requestBody);
      mockGetAuthSession.mockResolvedValue(mockSession);
      mockGetRecordId.mockResolvedValue("test-record-id");
      mockSaveSubscription.mockResolvedValue({
        id: "test-subscription-id",
        endpoint: requestBody.newSubscription.endpoint,
        p256dh: requestBody.newSubscription.keys.p256dh,
        auth: requestBody.newSubscription.keys.auth,
        userId: mockSession.user?.id,
      } as PushSubscription);

      // Act
      const response = await POST(request);
      const responseData = (await response.json()) as {
        success: boolean;
        message: string;
        subscription?: PushSubscription;
      };

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(mockSaveSubscription).toHaveBeenCalledWith({
        endpoint: requestBody.newSubscription.endpoint,
        expirationTime: undefined,
        keys: requestBody.newSubscription.keys,
        recordId: "test-record-id",
      });
    });

    test("should handle newSubscription without keys", async () => {
      // Arrange
      const requestBody = {
        oldEndpoint: "https://fcm.googleapis.com/fcm/send/old-endpoint",
        newSubscription: {
          endpoint: "https://fcm.googleapis.com/fcm/send/new-endpoint",
          expirationTime: 1234567890000,
        },
      };
      const request = createMockRequest(requestBody);
      mockGetAuthSession.mockResolvedValue(mockSession);

      // Act & Assert
      // この場合はJSエラーが発生するため、500エラーが期待される
      const response = await POST(request);
      const responseData = (await response.json()) as { error: string };

      expect(response.status).toBe(500);
      expect(responseData.error).toBe("購読の更新に失敗しました");
    });

    test("should handle very long endpoint strings", async () => {
      // Arrange
      const longEndpoint = "https://fcm.googleapis.com/fcm/send/" + "a".repeat(1000);
      const requestBody = {
        oldEndpoint: "https://fcm.googleapis.com/fcm/send/old-endpoint",
        newSubscription: {
          endpoint: longEndpoint,
          expirationTime: 1234567890000,
          keys: {
            p256dh: "test-p256dh-key",
            auth: "test-auth-key",
          },
        },
      };
      const request = createMockRequest(requestBody);
      mockGetAuthSession.mockResolvedValue(mockSession);
      mockGetRecordId.mockResolvedValue("test-record-id");
      mockSaveSubscription.mockResolvedValue({
        id: "test-subscription-id",
        endpoint: longEndpoint,
        p256dh: requestBody.newSubscription.keys.p256dh,
        auth: requestBody.newSubscription.keys.auth,
        userId: mockSession.user?.id,
      } as PushSubscription);

      // Act
      const response = await POST(request);
      const responseData = (await response.json()) as {
        success: boolean;
        message: string;
        subscription?: PushSubscription;
      };

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
    });

    test("should handle empty string keys", async () => {
      // Arrange
      const requestBody = {
        oldEndpoint: "https://fcm.googleapis.com/fcm/send/old-endpoint",
        newSubscription: {
          endpoint: "https://fcm.googleapis.com/fcm/send/new-endpoint",
          expirationTime: 1234567890000,
          keys: {
            p256dh: "",
            auth: "",
          },
        },
      };
      const request = createMockRequest(requestBody);
      mockGetAuthSession.mockResolvedValue(mockSession);
      mockGetRecordId.mockResolvedValue("test-record-id");
      mockSaveSubscription.mockResolvedValue({
        id: "test-subscription-id",
        endpoint: requestBody.newSubscription.endpoint,
        p256dh: "",
        auth: "",
        userId: mockSession.user?.id,
      } as PushSubscription);

      // Act
      const response = await POST(request);
      const responseData = (await response.json()) as {
        success: boolean;
        message: string;
        subscription?: PushSubscription;
      };

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
    });

    test("should handle negative expirationTime", async () => {
      // Arrange
      const requestBody = {
        oldEndpoint: "https://fcm.googleapis.com/fcm/send/old-endpoint",
        newSubscription: {
          endpoint: "https://fcm.googleapis.com/fcm/send/new-endpoint",
          expirationTime: -1,
          keys: {
            p256dh: "test-p256dh-key",
            auth: "test-auth-key",
          },
        },
      };
      const request = createMockRequest(requestBody);
      mockGetAuthSession.mockResolvedValue(mockSession);
      mockGetRecordId.mockResolvedValue("test-record-id");
      mockSaveSubscription.mockResolvedValue({
        id: "test-subscription-id",
        endpoint: requestBody.newSubscription.endpoint,
        p256dh: requestBody.newSubscription.keys.p256dh,
        auth: requestBody.newSubscription.keys.auth,
        userId: mockSession.user?.id,
      } as PushSubscription);

      // Act
      const response = await POST(request);
      const responseData = (await response.json()) as {
        success: boolean;
        message: string;
        subscription?: PushSubscription;
      };

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
    });

    test("should handle whitespace-only endpoints", async () => {
      // Arrange
      const requestBody = {
        oldEndpoint: "https://fcm.googleapis.com/fcm/send/old-endpoint",
        newSubscription: {
          endpoint: "   ",
          expirationTime: 1234567890000,
          keys: {
            p256dh: "test-p256dh-key",
            auth: "test-auth-key",
          },
        },
      };
      const request = createMockRequest(requestBody);
      mockGetAuthSession.mockResolvedValue(mockSession);
      mockGetRecordId.mockResolvedValue("test-record-id");
      mockSaveSubscription.mockResolvedValue({
        id: "test-subscription-id",
        endpoint: requestBody.newSubscription.endpoint,
        p256dh: requestBody.newSubscription.keys.p256dh,
        auth: requestBody.newSubscription.keys.auth,
        userId: mockSession.user?.id,
      } as PushSubscription);

      // Act
      const response = await POST(request);
      const responseData = (await response.json()) as {
        success: boolean;
        message: string;
        subscription?: PushSubscription;
      };

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
    });

    test("should handle oldEndpoint being empty string", async () => {
      // Arrange
      const requestBody = {
        oldEndpoint: "",
        newSubscription: {
          endpoint: "https://fcm.googleapis.com/fcm/send/new-endpoint",
          expirationTime: 1234567890000,
          keys: {
            p256dh: "test-p256dh-key",
            auth: "test-auth-key",
          },
        },
      };
      const request = createMockRequest(requestBody);
      mockGetAuthSession.mockResolvedValue(mockSession);

      // Act
      const response = await POST(request);
      const responseData = (await response.json()) as { error: string };

      // Assert
      expect(response.status).toBe(400);
      expect(responseData.error).toBe("Old subscription not found");
      expect(mockGetRecordId).not.toHaveBeenCalled();
    });
  });
});
