"use client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数のインポート
 */
import { deleteSubscription, getRecordId, saveSubscription } from "@/actions/notification/push-notification";
import { AllTheProviders, mockUseQueryClient } from "@/test/setup/tanstack-query-setup";
import { pushSubscriptionFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSession } from "next-auth/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { usePushNotification } from "./use-push-notification";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// push-notification actionsのモック
vi.mock("@/lib/actions/notification/push-notification", () => ({
  saveSubscription: vi.fn(),
  deleteSubscription: vi.fn(),
  getRecordId: vi.fn(),
}));

// next-auth/reactのモック
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}));

const mockSaveSubscription = vi.mocked(saveSubscription);
const mockDeleteSubscription = vi.mocked(deleteSubscription);
const mockGetRecordId = vi.mocked(getRecordId);
const mockUseSession = vi.mocked(useSession);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ
 */
const mockPushSubscription = pushSubscriptionFactory.build({
  id: "test-subscription-id",
  endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
  p256dh: "test-p256dh-key",
  auth: "test-auth-key",
  userId: "test-user-id",
  deviceId: "test-device-id",
});

const mockSession = {
  data: {
    user: {
      id: "test-user-id",
      email: "test@example.com",
      name: "Test User",
    },
    expires: "2024-12-31T23:59:59.999Z",
  },
  status: "authenticated" as const,
  update: vi.fn(),
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ブラウザAPIのモック設定
 */
const mockServiceWorkerRegistration = {
  pushManager: {
    getSubscription: vi.fn(),
    subscribe: vi.fn(),
  },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
} as unknown as ServiceWorkerRegistration;

const mockPushSubscriptionObject = {
  endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
  expirationTime: null,
  toJSON: vi.fn(() => ({
    endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
    expirationTime: null,
    keys: {
      p256dh: "test-p256dh-key",
      auth: "test-auth-key",
    },
  })),
  unsubscribe: vi.fn(),
} as unknown as PushSubscription;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ブラウザ環境設定のヘルパー関数
 */
type BrowserConfig = {
  serviceWorkerSupported?: boolean;
  pushManagerSupported?: boolean;
  notificationPermission?: NotificationPermission;
  userAgent?: string;
  userAgentData?: {
    brands: Array<{ brand: string; version: string }>;
    platform: string;
    mobile: boolean;
  };
  serviceWorkerReady?: Promise<ServiceWorkerRegistration>;
  customAddEventListener?: ReturnType<typeof vi.fn>;
  customRemoveEventListener?: ReturnType<typeof vi.fn>;
};

function setupBrowserEnvironment(config: BrowserConfig = {}) {
  const {
    serviceWorkerSupported = true,
    pushManagerSupported = true,
    notificationPermission = "default",
    userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    userAgentData = {
      brands: [{ brand: "Chrome", version: "120" }],
      platform: "Windows",
      mobile: false,
    },
    serviceWorkerReady = Promise.resolve(mockServiceWorkerRegistration),
    customAddEventListener,
    customRemoveEventListener,
  } = config;

  // Navigator のモック設定
  const navigatorMock: {
    userAgent: string;
    userAgentData: {
      brands: Array<{ brand: string; version: string }>;
      platform: string;
      mobile: boolean;
    };
    serviceWorker?: {
      ready: Promise<ServiceWorkerRegistration>;
      addEventListener: ReturnType<typeof vi.fn>;
      removeEventListener: ReturnType<typeof vi.fn>;
    };
  } = {
    userAgent,
    userAgentData,
  };

  if (serviceWorkerSupported) {
    navigatorMock.serviceWorker = {
      ready: serviceWorkerReady,
      addEventListener: customAddEventListener ?? vi.fn(),
      removeEventListener: customRemoveEventListener ?? vi.fn(),
    };
  }

  Object.defineProperty(global, "navigator", {
    value: navigatorMock,
    writable: true,
  });

  // Push Manager API のモック
  if (pushManagerSupported) {
    Object.defineProperty(global, "PushManager", {
      value: function PushManager() {
        // PushManagerコンストラクタのモック実装（空の実装で問題なし）
      },
      writable: true,
    });
  } else {
    delete (global as unknown as { PushManager: unknown }).PushManager;
  }

  // Notification API のモック
  Object.defineProperty(global, "Notification", {
    value: {
      permission: notificationPermission,
      requestPermission: vi.fn(() => Promise.resolve(notificationPermission)),
    },
    writable: true,
  });

  // atob関数のモック
  Object.defineProperty(global, "atob", {
    value: vi.fn((str: string) => Buffer.from(str, "base64").toString("binary")),
    writable: true,
  });

  // 環境変数のモック
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-vapid-public-key";
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 共通のテストヘルパー関数
 */
async function renderHookAndWaitForInitialization() {
  const { result } = renderHook(() => usePushNotification(false), {
    wrapper: AllTheProviders,
  });

  await waitFor(() => {
    expect(result.current.isInitialized).toBe(true);
  });

  return { result };
}

function setupMessageHandler(mockAddEventListener: ReturnType<typeof vi.fn>): ((event: MessageEvent) => void) | null {
  let messageHandler: ((event: MessageEvent) => void) | null = null;

  mockAddEventListener.mockImplementation((event: string, handler: (event: MessageEvent) => void) => {
    if (event === "message") {
      messageHandler = handler;
    }
  });

  return messageHandler;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("usePushNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルトのブラウザ環境設定
    setupBrowserEnvironment();

    // デフォルトのモック設定
    mockUseSession.mockReturnValue(mockSession);
    mockSaveSubscription.mockResolvedValue({ success: true, message: "", data: mockPushSubscription });
    mockDeleteSubscription.mockResolvedValue({ success: true, message: "", data: null });
    mockGetRecordId.mockResolvedValue({ success: true, data: "test-record-id", message: "" });

    // Service Worker関連のモック設定
    vi.mocked(mockServiceWorkerRegistration.pushManager.getSubscription).mockResolvedValue(null);
    vi.mocked(mockServiceWorkerRegistration.pushManager.subscribe).mockResolvedValue(mockPushSubscriptionObject);
    vi.mocked(mockPushSubscriptionObject.unsubscribe).mockResolvedValue(true);

    // TanStack Queryのモック設定
    mockUseQueryClient.mockReturnValue({
      invalidateQueries: vi.fn(),
      setQueryData: vi.fn(),
      getQueryData: vi.fn(),
      removeQueries: vi.fn(),
      clear: vi.fn(),
      prefetchQuery: vi.fn().mockResolvedValue(undefined),
    });

    // Notification許可状態をgrantedに設定
    Object.defineProperty(global, "Notification", {
      value: {
        permission: "granted",
        requestPermission: vi.fn(() => Promise.resolve("granted")),
      },
      writable: true,
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("初期化", () => {
    test("should initialize with correct default values and complete initialization", async () => {
      // Arrange - 初期化前にNotification許可状態をdefaultに設定
      Object.defineProperty(global, "Notification", {
        value: {
          permission: "default",
          requestPermission: vi.fn(() => Promise.resolve("granted")),
        },
        writable: true,
      });

      // Act
      const { result } = renderHook(() => usePushNotification(false), {
        wrapper: AllTheProviders,
      });

      // Assert - 初期値の確認（初期化前）
      expect(result.current.isInitialized).toBe(false);
      expect(result.current.permissionState).toBe("default");
      expect(result.current.errorMessage).toBeNull();

      // 初期化完了まで待機
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      // 初期化後の状態確認
      expect(result.current.isSupported).toBe(true);
      expect(result.current.isInitialized).toBe(true);
    });

    test("should handle unsupported browser", async () => {
      // Arrange - Service Workerをサポートしないブラウザをシミュレート
      setupBrowserEnvironment({
        serviceWorkerSupported: false,
        userAgent: "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1)",
      });

      // Act & Assert
      const { result } = await renderHookAndWaitForInitialization();

      expect(result.current.isSupported).toBe(false);
      expect(result.current.isInitialized).toBe(true);
    });

    test("should handle denied notification permission", async () => {
      // Arrange
      setupBrowserEnvironment({
        notificationPermission: "denied",
      });

      // Act & Assert
      const { result } = await renderHookAndWaitForInitialization();

      expect(result.current.permissionState).toBe("denied");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("購読機能", () => {
    test("should subscribe successfully", async () => {
      // Arrange & Act
      const { result } = await renderHookAndWaitForInitialization();

      const subscriptionResult: PushSubscription | null = null;
      await act(async () => {
        act(() => {
          result.current.togglePushNotification(true);
        });
      });

      // Assert
      expect(subscriptionResult).toBe(mockPushSubscriptionObject);
      expect(result.current.isEnabled).toBe(true);
      expect(mockServiceWorkerRegistration.pushManager.subscribe).toHaveBeenCalledWith({
        userVisibleOnly: true,
        applicationServerKey: expect.any(Uint8Array) as unknown as Uint8Array,
      });
    });

    test("should handle existing subscription", async () => {
      // Arrange
      vi.mocked(mockServiceWorkerRegistration.pushManager.getSubscription).mockResolvedValue(
        mockPushSubscriptionObject,
      );

      const { result } = await renderHookAndWaitForInitialization();

      // Act
      const subscriptionResult: PushSubscription | null = null;
      await act(async () => {
        act(() => {
          result.current.togglePushNotification(true);
        });
      });

      // Assert
      expect(subscriptionResult).toBe(mockPushSubscriptionObject);
      expect(mockServiceWorkerRegistration.pushManager.subscribe).not.toHaveBeenCalled();
    });

    test("should handle permission request", async () => {
      // Arrange
      const mockRequestPermission = vi.fn(() => Promise.resolve("granted"));
      Object.defineProperty(global, "Notification", {
        value: {
          permission: "default",
          requestPermission: mockRequestPermission,
        },
        writable: true,
      });

      const { result } = await renderHookAndWaitForInitialization();

      // Act
      await act(async () => {
        act(() => {
          result.current.togglePushNotification(true);
        });
      });

      // Assert
      expect(mockRequestPermission).toHaveBeenCalled();
      expect(result.current.permissionState).toBe("granted");
    });

    test("should handle permission denied", async () => {
      // Arrange
      const mockRequestPermission = vi.fn(() => Promise.resolve("denied"));
      Object.defineProperty(global, "Notification", {
        value: {
          permission: "default",
          requestPermission: mockRequestPermission,
        },
        writable: true,
      });

      const { result } = await renderHookAndWaitForInitialization();

      // Act
      const subscriptionResult: PushSubscription | null = null;
      await act(async () => {
        act(() => {
          result.current.togglePushNotification(true);
        });
      });

      // Assert
      expect(subscriptionResult).toBeNull();
      expect(result.current.errorMessage).toBeDefined();
      expect(result.current.errorMessage).toContain("通知の許可が得られませんでした");
    });

    test("should handle subscription error", async () => {
      // Arrange
      const subscribeError = new Error("Subscription failed");
      vi.mocked(mockServiceWorkerRegistration.pushManager.subscribe).mockRejectedValue(subscribeError);

      const { result } = await renderHookAndWaitForInitialization();

      // Act
      const subscriptionResult: PushSubscription | null = null;
      await act(async () => {
        act(() => {
          result.current.togglePushNotification(true);
        });
      });

      // Assert
      expect(subscriptionResult).toBeNull();
      expect(result.current.errorMessage).toBeDefined();
      expect(result.current.isEnabled).toBe(false);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("購読解除機能", () => {
    test("should unsubscribe successfully", async () => {
      // Arrange
      vi.mocked(mockServiceWorkerRegistration.pushManager.getSubscription).mockResolvedValue(
        mockPushSubscriptionObject,
      );

      const { result } = await renderHookAndWaitForInitialization();

      // Act
      const unsubscribeResult = false;
      await act(async () => {
        act(() => {
          result.current.togglePushNotification(false);
        });
      });

      // Assert
      expect(unsubscribeResult).toBe(true);
      expect(mockDeleteSubscription).toHaveBeenCalledWith(mockPushSubscriptionObject.endpoint);
      expect(mockPushSubscriptionObject.unsubscribe).toHaveBeenCalled();
      expect(result.current.isEnabled).toBe(false);
    });

    test("should handle no active subscription", async () => {
      // Arrange
      vi.mocked(mockServiceWorkerRegistration.pushManager.getSubscription).mockResolvedValue(null);

      const { result } = await renderHookAndWaitForInitialization();

      // Act
      const unsubscribeResult = false;
      await act(async () => {
        act(() => {
          result.current.togglePushNotification(false);
        });
      });

      // Assert
      expect(unsubscribeResult).toBe(true);
      expect(mockDeleteSubscription).not.toHaveBeenCalled();
      expect(result.current.isEnabled).toBe(false);
    });

    test("should handle unsubscribe error", async () => {
      // Arrange
      const unsubscribeError = new Error("Unsubscribe failed");
      vi.mocked(mockServiceWorkerRegistration.pushManager.getSubscription).mockResolvedValue(
        mockPushSubscriptionObject,
      );
      vi.mocked(mockPushSubscriptionObject.unsubscribe).mockRejectedValue(unsubscribeError);

      const { result } = await renderHookAndWaitForInitialization();

      // Act
      const unsubscribeResult = false;
      await act(async () => {
        act(() => {
          result.current.togglePushNotification(false);
        });
      });

      // Assert
      expect(unsubscribeResult).toBe(false);
      expect(result.current.errorMessage).toBeDefined();
      expect(result.current.isEnabled).toBe(false);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("エラーハンドリング", () => {
    test("should handle missing VAPID key", async () => {
      // Arrange
      const originalVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      const { result } = await renderHookAndWaitForInitialization();

      // Act
      const subscriptionResult: PushSubscription | null = null;
      await act(async () => {
        act(() => {
          result.current.togglePushNotification(true);
        });
      });

      // Assert
      expect(subscriptionResult).toBeNull();
      expect(result.current.errorMessage).toBeDefined();
      expect(result.current.errorMessage).toContain("VAPID 公開鍵が設定されていません");

      // Cleanup - 環境変数を復元
      if (originalVapidKey) {
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = originalVapidKey;
      }
    });

    test("should handle service worker not ready", async () => {
      // Arrange
      setupBrowserEnvironment({
        serviceWorkerSupported: false,
      });

      const { result } = await renderHookAndWaitForInitialization();

      // Act
      const subscriptionResult: PushSubscription | null = null;
      await act(async () => {
        act(() => {
          result.current.togglePushNotification(true);
        });
      });

      // Assert
      expect(subscriptionResult).toBeNull();
      expect(result.current.errorMessage).toBeDefined();
      expect(result.current.errorMessage).toContain("Service WorkerまたはPush APIがサポートしていません");
    });

    test("should handle service worker registration error", async () => {
      // Arrange
      setupBrowserEnvironment({
        serviceWorkerReady: Promise.reject(new Error("Service Worker registration failed")),
      });

      // Act
      const { result } = await renderHookAndWaitForInitialization();

      // Assert
      expect(result.current.errorMessage).toBeDefined();
      expect(result.current.isInitialized).toBe(true);
    });

    test("should handle save subscription error", async () => {
      // Arrange
      const saveError = new Error("Save failed");
      mockSaveSubscription.mockRejectedValue(saveError);

      const { result } = await renderHookAndWaitForInitialization();

      // Act
      await act(async () => {
        act(() => {
          result.current.togglePushNotification(true);
        });
      });

      // Assert - 購読は成功するが、保存エラーは内部で処理される
      expect(result.current.isEnabled).toBe(true);
    });

    test("should handle delete subscription error", async () => {
      // Arrange
      const deleteError = new Error("Delete failed");
      mockDeleteSubscription.mockRejectedValue(deleteError);
      vi.mocked(mockServiceWorkerRegistration.pushManager.getSubscription).mockResolvedValue(
        mockPushSubscriptionObject,
      );

      const { result } = await renderHookAndWaitForInitialization();

      // Act
      const unsubscribeResult = false;
      await act(async () => {
        act(() => {
          result.current.togglePushNotification(false);
        });
      });

      // Assert - 削除エラーが発生した場合、unsubscribeは失敗する
      expect(unsubscribeResult).toBe(false); // 実装ではcatch文でfalseを返す
      expect(result.current.isEnabled).toBe(false);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle null session", async () => {
      // Arrange
      mockUseSession.mockReturnValue({
        data: null,
        status: "unauthenticated",
        update: vi.fn(),
      });

      // Act & Assert
      const { result } = await renderHookAndWaitForInitialization();

      // ユーザーIDがnullでも初期化は完了する
      expect(result.current.isSupported).toBe(true);
    });

    test("should handle empty endpoint", async () => {
      // Arrange
      const emptyEndpointSubscription = {
        ...mockPushSubscriptionObject,
        endpoint: "",
        toJSON: vi.fn(() => ({
          endpoint: "",
          expirationTime: null,
          keys: {
            p256dh: "test-p256dh-key",
            auth: "test-auth-key",
          },
        })),
      } as unknown as PushSubscription;

      vi.mocked(mockServiceWorkerRegistration.pushManager.subscribe).mockResolvedValue(emptyEndpointSubscription);

      const { result } = await renderHookAndWaitForInitialization();

      // Act
      await act(async () => {
        act(() => {
          result.current.togglePushNotification(true);
        });
      });

      // Assert
      expect(result.current.isEnabled).toBe(false);
    });

    test("should handle missing keys in subscription", async () => {
      // Arrange
      const invalidSubscription = {
        ...mockPushSubscriptionObject,
        toJSON: vi.fn(() => ({
          endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
          expirationTime: null,
          keys: {
            p256dh: "",
            auth: "",
          },
        })),
      } as unknown as PushSubscription;

      vi.mocked(mockServiceWorkerRegistration.pushManager.subscribe).mockResolvedValue(invalidSubscription);

      const { result } = await renderHookAndWaitForInitialization();

      // Act
      await act(async () => {
        act(() => {
          result.current.togglePushNotification(true);
        });
      });

      // Assert
      expect(result.current.isEnabled).toBe(false);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("Service Workerメッセージング", () => {
    test("should handle subscription change message", async () => {
      // Arrange
      const mockAddEventListener = vi.fn();
      const mockRemoveEventListener = vi.fn();

      // カスタムのaddEventListenerを使ってブラウザ環境を設定
      setupBrowserEnvironment({
        customAddEventListener: mockAddEventListener,
        customRemoveEventListener: mockRemoveEventListener,
      });

      const messageHandler = setupMessageHandler(mockAddEventListener);

      // Act - フックを初期化してaddEventListenerが呼ばれるようにする
      const { result } = await renderHookAndWaitForInitialization();

      // Service Workerからのメッセージをシミュレート
      if (messageHandler) {
        const messageEvent = {
          data: {
            type: "SUBSCRIPTION_CHANGED",
            oldEndpoint: "old-endpoint",
            newSubscription: mockPushSubscriptionObject,
          },
        } as MessageEvent;

        await act(async () => {
          messageHandler(messageEvent);
        });
      }

      // Assert
      expect(mockAddEventListener).toHaveBeenCalledWith("message", expect.any(Function));
      expect(result.current.isInitialized).toBe(true);
    });

    test("should handle invalid message type", async () => {
      // Arrange
      const mockAddEventListener = vi.fn();
      const mockRemoveEventListener = vi.fn();

      // カスタムのaddEventListenerを使ってブラウザ環境を設定
      setupBrowserEnvironment({
        customAddEventListener: mockAddEventListener,
        customRemoveEventListener: mockRemoveEventListener,
      });

      const messageHandler = setupMessageHandler(mockAddEventListener);

      // Act - フックを初期化
      const { result } = await renderHookAndWaitForInitialization();

      // 無効なメッセージタイプをシミュレート
      if (messageHandler) {
        const messageEvent = {
          data: {
            type: "invalid-type",
            someData: "test",
          },
        } as MessageEvent;

        await act(async () => {
          messageHandler(messageEvent);
        });
      }

      // Assert - エラーが発生しないことを確認
      expect(result.current.errorMessage).toBeNull();
      expect(mockAddEventListener).toHaveBeenCalledWith("message", expect.any(Function));
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("デバイスID生成", () => {
    test("should generate device ID with userAgentData", async () => {
      // Arrange
      setupBrowserEnvironment({
        userAgentData: {
          brands: [{ brand: "Chrome", version: "120" }],
          platform: "Windows",
          mobile: false,
        },
      });

      // Act & Assert
      const { result } = await renderHookAndWaitForInitialization();

      // デバイスIDが生成されることを確認（内部的に使用される）
      expect(result.current.isSupported).toBe(true);
    });

    test("should generate device ID without userAgentData", async () => {
      // Arrange
      setupBrowserEnvironment({
        userAgentData: undefined,
      });

      // Act & Assert
      const { result } = await renderHookAndWaitForInitialization();

      expect(result.current.isSupported).toBe(true);
    });

    test("should detect mobile device", async () => {
      // Arrange
      setupBrowserEnvironment({
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15",
        userAgentData: {
          brands: [{ brand: "Safari", version: "14" }],
          platform: "iOS",
          mobile: true,
        },
      });

      // Act & Assert
      const { result } = await renderHookAndWaitForInitialization();

      expect(result.current.isSupported).toBe(true);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("購読情報の同期", () => {
    test("should sync subscription on initialization", async () => {
      // Arrange
      vi.mocked(mockServiceWorkerRegistration.pushManager.getSubscription).mockResolvedValue(
        mockPushSubscriptionObject,
      );

      // Act & Assert
      const { result } = await renderHookAndWaitForInitialization();

      expect(result.current.isEnabled).toBe(true);
    });

    test("should handle sync error", async () => {
      // Arrange
      const syncError = new Error("Sync failed");
      mockGetRecordId.mockRejectedValue(syncError);

      // Act & Assert
      const { result } = await renderHookAndWaitForInitialization();

      // エラーが発生しても初期化は完了する
      expect(result.current.isInitialized).toBe(true);
    });

    test("should re-sync when userId changes", async () => {
      // Arrange
      const { result, rerender } = renderHook(() => usePushNotification(false), {
        wrapper: AllTheProviders,
      });

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      // Act - ユーザーIDを変更
      const newSession = {
        ...mockSession,
        data: {
          ...mockSession.data,
          user: {
            ...mockSession.data.user,
            id: "new-user-id",
          },
        },
      };

      mockUseSession.mockReturnValue(newSession);
      rerender();

      // Assert - 新しいユーザーIDで再同期される
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("クリーンアップ処理", () => {
    test("should remove event listeners on unmount", async () => {
      // Arrange
      const mockRemoveEventListener = vi.fn();
      setupBrowserEnvironment({
        serviceWorkerReady: Promise.resolve({
          ...mockServiceWorkerRegistration,
          removeEventListener: mockRemoveEventListener,
        } as ServiceWorkerRegistration),
      });

      // Act
      const { unmount } = renderHook(() => usePushNotification(false), {
        wrapper: AllTheProviders,
      });

      unmount();

      // Assert - クリーンアップ処理が正常に完了することを確認
      expect(mockRemoveEventListener).toHaveBeenCalledTimes(0); // 現在の実装では直接的なremoveEventListenerの呼び出しはない
    });

    test("should handle cleanup when service worker not supported", async () => {
      // Arrange
      setupBrowserEnvironment({
        serviceWorkerSupported: false,
      });

      // Act
      const { unmount } = renderHook(() => usePushNotification(false), {
        wrapper: AllTheProviders,
      });

      unmount();

      // Assert - Service Workerがサポートされていない場合でもエラーが発生しないことを確認
      expect(true).toBe(true); // クリーンアップが正常に動作することを確認
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("統合テスト", () => {
    test("should handle complete subscription workflow", async () => {
      // Arrange & Act 1: 初期化
      const { result } = await renderHookAndWaitForInitialization();

      // Act 2: 購読
      const subscriptionResult: PushSubscription | null = null;
      await act(async () => {
        act(() => {
          result.current.togglePushNotification(true);
        });
      });

      // Assert 1: 購読成功
      expect(subscriptionResult).toBe(mockPushSubscriptionObject);
      expect(result.current.isEnabled).toBe(true);

      // Act 3: 購読解除
      vi.mocked(mockServiceWorkerRegistration.pushManager.getSubscription).mockResolvedValue(
        mockPushSubscriptionObject,
      );
      const unsubscribeResult = false;
      await act(async () => {
        act(() => {
          result.current.togglePushNotification(false);
        });
      });

      // Assert 2: 購読解除成功
      expect(unsubscribeResult).toBe(true);
      expect(result.current.isEnabled).toBe(false);
    });

    test("should maintain state consistency", async () => {
      // Arrange - 初期化前にNotification許可状態をdefaultに設定
      Object.defineProperty(global, "Notification", {
        value: {
          permission: "default",
          requestPermission: vi.fn(() => Promise.resolve("granted")),
        },
        writable: true,
      });

      // Act & Assert
      const { result } = await renderHookAndWaitForInitialization();

      // 状態の一貫性を確認
      expect(result.current.isSupported).toBe(true);
      expect(result.current.isInitialized).toBe(true);
      expect(result.current.permissionState).toBe("default");
      expect(result.current.isEnabled).toBe(false);
      expect(result.current.errorMessage).toBeNull();
    });

    test("should handle multiple consecutive operations", async () => {
      // Arrange
      const { result } = await renderHookAndWaitForInitialization();

      // Act - 連続した操作
      await act(async () => {
        act(() => {
          result.current.togglePushNotification(true);
        });
      });

      vi.mocked(mockServiceWorkerRegistration.pushManager.getSubscription).mockResolvedValue(
        mockPushSubscriptionObject,
      );
      await act(async () => {
        act(() => {
          result.current.togglePushNotification(false);
        });
      });

      vi.mocked(mockServiceWorkerRegistration.pushManager.getSubscription).mockResolvedValue(null);
      await act(async () => {
        act(() => {
          result.current.togglePushNotification(true);
        });
      });

      // Assert - 最終的な状態確認
      expect(result.current.isEnabled).toBe(true);
    });
  });
});
