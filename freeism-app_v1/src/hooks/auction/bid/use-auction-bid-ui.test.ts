// 型定義
import type { AuctionWithDetails } from "@/types/auction-types";
// テストセットアップ
import { mockUseSession } from "@/test/setup/setup";
import { AllTheProviders } from "@/test/setup/tanstack-query-setup";
import { TaskStatus } from "@prisma/client";
import { renderHook } from "@testing-library/react";
import { Factory } from "fishery";
import { beforeEach, describe, expect, test, vi } from "vitest";

// テスト対象
import { useAuctionBidUI } from "./use-auction-bid-ui";

// モック設定
vi.mock("nuqs", () => ({
  useQueryState: vi.fn(),
}));

// モック関数を取得
const mockUseQueryState = vi.fn();
vi.mocked(await import("nuqs")).useQueryState = mockUseQueryState;

// テストデータファクトリー
const auctionWithDetailsFactory = Factory.define<AuctionWithDetails>(({ sequence, params }) => {
  const defaultTask = {
    task: "テストタスク",
    detail: "テストタスクの詳細",
    imageUrl: null,
    status: TaskStatus.AUCTION_ACTIVE,
    category: "テスト",
    group: {
      id: "group-1",
      name: "テストグループ",
      depositPeriod: 7,
    },
    creator: {
      id: "creator-1",
      image: null,
      settings: {
        username: "作成者",
      },
    },
    executors: [],
    reporters: [],
  } as const;

  return {
    id: params.id ?? `auction-${sequence}`,
    currentHighestBid: params.currentHighestBid ?? 100,
    currentHighestBidderId: params.currentHighestBidderId ?? null,
    status: params.status ?? TaskStatus.AUCTION_ACTIVE,
    extensionTotalCount: params.extensionTotalCount ?? 0,
    extensionLimitCount: params.extensionLimitCount ?? 3,
    extensionTime: params.extensionTime ?? 5,
    remainingTimeForExtension: params.remainingTimeForExtension ?? 300,
    startTime: params.startTime ?? new Date("2024-01-01T10:00:00Z"),
    endTime: params.endTime ?? new Date("2024-01-01T18:00:00Z"),
    bidHistories: params.bidHistories ?? [],
    task: params.task ?? defaultTask,
  } as AuctionWithDetails;
});

describe("useAuctionBidUI", () => {
  // 各テスト前にモックをリセット
  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルトのモック設定
    mockUseQueryState.mockReturnValue(["details", vi.fn()]);
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: "test-user-id",
          email: "test@example.com",
          name: "Test User",
        },
      },
      status: "authenticated",
    });
  });

  describe("初期状態", () => {
    test("should return initial state correctly", () => {
      // Arrange
      const auction = auctionWithDetailsFactory.build();

      // Act
      const { result } = renderHook(() => useAuctionBidUI(auction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.activeTab).toBe("details");
      expect(typeof result.current.currentUserId).toBe("string");
      expect(result.current.currentUserId).toBeTruthy();
      expect(result.current.usersWithRoles).toStrictEqual([
        {
          id: "creator-1",
          image: null,
          username: "作成者",
          roles: ["SUPPLIER"],
        },
      ]);
      expect(result.current.isActive).toBe(false);
      expect(result.current.isExecutor).toBe(false);
      expect(typeof result.current.setActiveTab).toBe("function");
    });
  });

  describe("ユーザー役割の取得", () => {
    test("should return creator with SUPPLIER role", () => {
      // Arrange
      const auction = auctionWithDetailsFactory.build({
        task: {
          task: "テストタスク",
          detail: "テストタスクの詳細",
          imageUrl: null,
          status: TaskStatus.AUCTION_ACTIVE,
          category: "テスト",
          group: {
            id: "group-1",
            name: "テストグループ",
            depositPeriod: 7,
          },
          creator: {
            id: "creator-1",
            image: "https://example.com/avatar.jpg",
            settings: {
              username: "作成者ユーザー",
            },
          },
          executors: [],
          reporters: [],
        },
      });

      // Act
      const { result } = renderHook(() => useAuctionBidUI(auction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.usersWithRoles).toStrictEqual([
        {
          id: "creator-1",
          image: "https://example.com/avatar.jpg",
          username: "作成者ユーザー",
          roles: ["SUPPLIER"],
        },
      ]);
    });

    test("should return executor with EXECUTOR role", () => {
      // Arrange
      const auction = auctionWithDetailsFactory.build({
        task: {
          task: "テストタスク",
          detail: "テストタスクの詳細",
          imageUrl: null,
          status: TaskStatus.AUCTION_ACTIVE,
          category: "テスト",
          group: {
            id: "group-1",
            name: "テストグループ",
            depositPeriod: 7,
          },
          creator: {
            id: "creator-1",
            image: null,
            settings: {
              username: "作成者",
            },
          },
          executors: [
            {
              user: {
                id: "executor-1",
                image: null,
                settings: {
                  username: "実行者",
                },
              },
            },
          ],
          reporters: [],
        },
      });

      // Act
      const { result } = renderHook(() => useAuctionBidUI(auction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.usersWithRoles).toStrictEqual([
        {
          id: "creator-1",
          image: null,
          username: "作成者",
          roles: ["SUPPLIER"],
        },
        {
          id: "executor-1",
          image: null,
          username: "実行者",
          roles: ["EXECUTOR"],
        },
      ]);
    });

    test("should return reporter with REPORTER role", () => {
      // Arrange
      const auction = auctionWithDetailsFactory.build({
        task: {
          task: "テストタスク",
          detail: "テストタスクの詳細",
          imageUrl: null,
          status: TaskStatus.AUCTION_ACTIVE,
          category: "テスト",
          group: {
            id: "group-1",
            name: "テストグループ",
            depositPeriod: 7,
          },
          creator: {
            id: "creator-1",
            image: null,
            settings: {
              username: "作成者",
            },
          },
          executors: [],
          reporters: [
            {
              user: {
                id: "reporter-1",
                image: null,
                settings: {
                  username: "報告者",
                },
              },
            },
          ],
        },
      });

      // Act
      const { result } = renderHook(() => useAuctionBidUI(auction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.usersWithRoles).toStrictEqual([
        {
          id: "creator-1",
          image: null,
          username: "作成者",
          roles: ["SUPPLIER"],
        },
        {
          id: "reporter-1",
          image: null,
          username: "報告者",
          roles: ["REPORTER"],
        },
      ]);
    });

    test("should handle user with multiple roles", () => {
      // Arrange
      const auction = auctionWithDetailsFactory.build({
        task: {
          task: "テストタスク",
          detail: "テストタスクの詳細",
          imageUrl: null,
          status: TaskStatus.AUCTION_ACTIVE,
          category: "テスト",
          group: {
            id: "group-1",
            name: "テストグループ",
            depositPeriod: 7,
          },
          creator: {
            id: "user-1",
            image: null,
            settings: {
              username: "マルチロールユーザー",
            },
          },
          executors: [
            {
              user: {
                id: "user-1",
                image: null,
                settings: {
                  username: "マルチロールユーザー",
                },
              },
            },
          ],
          reporters: [
            {
              user: {
                id: "user-1",
                image: null,
                settings: {
                  username: "マルチロールユーザー",
                },
              },
            },
          ],
        },
      });

      // Act
      const { result } = renderHook(() => useAuctionBidUI(auction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.usersWithRoles).toStrictEqual([
        {
          id: "user-1",
          image: null,
          username: "マルチロールユーザー",
          roles: ["SUPPLIER", "EXECUTOR", "REPORTER"],
        },
      ]);
    });

    test("should handle missing username with fallback", () => {
      // Arrange
      const auction = auctionWithDetailsFactory.build({
        task: {
          task: "テストタスク",
          detail: "テストタスクの詳細",
          imageUrl: null,
          status: TaskStatus.AUCTION_ACTIVE,
          category: "テスト",
          group: {
            id: "group-1",
            name: "テストグループ",
            depositPeriod: 7,
          },
          creator: {
            id: "creator-1",
            image: null,
            settings: null,
          },
          executors: [],
          reporters: [],
        },
      });

      // Act
      const { result } = renderHook(() => useAuctionBidUI(auction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.usersWithRoles).toStrictEqual([
        {
          id: "creator-1",
          image: null,
          username: "不明なユーザー",
          roles: ["SUPPLIER"],
        },
      ]);
    });
  });

  describe("オークション状態の判定", () => {
    test("should return isActive true when auction is active and within time range", () => {
      // Arrange
      const now = new Date();
      const startTime = new Date(now.getTime() - 60 * 60 * 1000); // 1時間前
      const endTime = new Date(now.getTime() + 60 * 60 * 1000); // 1時間後

      const auction = auctionWithDetailsFactory.build({
        status: TaskStatus.AUCTION_ACTIVE,
        startTime,
        endTime,
      });

      // Act
      const { result } = renderHook(() => useAuctionBidUI(auction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.isActive).toBe(true);
    });

    test("should return isActive false when auction status is not AUCTION_ACTIVE", () => {
      // Arrange
      const now = new Date();
      const startTime = new Date(now.getTime() - 60 * 60 * 1000); // 1時間前
      const endTime = new Date(now.getTime() + 60 * 60 * 1000); // 1時間後

      const auction = auctionWithDetailsFactory.build({
        status: TaskStatus.AUCTION_ENDED,
        startTime,
        endTime,
      });

      // Act
      const { result } = renderHook(() => useAuctionBidUI(auction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.isActive).toBe(false);
    });

    test("should return isActive false when auction has not started yet", () => {
      // Arrange
      const now = new Date();
      const startTime = new Date(now.getTime() + 60 * 60 * 1000); // 1時間後
      const endTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2時間後

      const auction = auctionWithDetailsFactory.build({
        status: TaskStatus.AUCTION_ACTIVE,
        startTime,
        endTime,
      });

      // Act
      const { result } = renderHook(() => useAuctionBidUI(auction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.isActive).toBe(false);
    });

    test("should return isActive false when auction has already ended", () => {
      // Arrange
      const now = new Date();
      const startTime = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2時間前
      const endTime = new Date(now.getTime() - 60 * 60 * 1000); // 1時間前

      const auction = auctionWithDetailsFactory.build({
        status: TaskStatus.AUCTION_ACTIVE,
        startTime,
        endTime,
      });

      // Act
      const { result } = renderHook(() => useAuctionBidUI(auction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.isActive).toBe(false);
    });

    test("should handle string date format for startTime and endTime", () => {
      // Arrange
      const now = new Date();
      const startTime = new Date(now.getTime() - 60 * 60 * 1000).toISOString(); // 1時間前
      const endTime = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // 1時間後

      const auction = auctionWithDetailsFactory.build({
        status: TaskStatus.AUCTION_ACTIVE,
        startTime: startTime as unknown as Date,
        endTime: endTime as unknown as Date,
      });

      // Act
      const { result } = renderHook(() => useAuctionBidUI(auction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.isActive).toBe(true);
    });
  });

  describe("実行者判定", () => {
    test("should return isExecutor true when current user is an executor", () => {
      // Arrange
      const auction = auctionWithDetailsFactory.build();

      // Act
      const { result } = renderHook(() => useAuctionBidUI(auction), {
        wrapper: AllTheProviders,
      });

      // 実際のcurrentUserIdを取得
      const actualCurrentUserId = result.current.currentUserId;

      // executorにcurrentUserIdを設定したオークションを再作成
      const auctionWithExecutor = auctionWithDetailsFactory.build({
        task: {
          task: "テストタスク",
          detail: "テストタスクの詳細",
          imageUrl: null,
          status: TaskStatus.AUCTION_ACTIVE,
          category: "テスト",
          group: {
            id: "group-1",
            name: "テストグループ",
            depositPeriod: 7,
          },
          creator: {
            id: "creator-1",
            image: null,
            settings: {
              username: "作成者",
            },
          },
          executors: [
            {
              user: {
                id: actualCurrentUserId,
                image: null,
                settings: {
                  username: "実行者",
                },
              },
            },
          ],
          reporters: [],
        },
      });

      // Act - 再実行
      const { result: result2 } = renderHook(() => useAuctionBidUI(auctionWithExecutor), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result2.current.isExecutor).toBe(true);
    });

    test("should return isExecutor false when current user is not an executor", () => {
      // Arrange
      const auction = auctionWithDetailsFactory.build({
        task: {
          task: "テストタスク",
          detail: "テストタスクの詳細",
          imageUrl: null,
          status: TaskStatus.AUCTION_ACTIVE,
          category: "テスト",
          group: {
            id: "group-1",
            name: "テストグループ",
            depositPeriod: 7,
          },
          creator: {
            id: "creator-1",
            image: null,
            settings: {
              username: "作成者",
            },
          },
          executors: [
            {
              user: {
                id: "other-user-id",
                image: null,
                settings: {
                  username: "他の実行者",
                },
              },
            },
          ],
          reporters: [],
        },
      });

      // Act
      const { result } = renderHook(() => useAuctionBidUI(auction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.isExecutor).toBe(false);
    });

    test("should return isExecutor false when no executors exist", () => {
      // Arrange
      const auction = auctionWithDetailsFactory.build({
        task: {
          task: "テストタスク",
          detail: "テストタスクの詳細",
          imageUrl: null,
          status: TaskStatus.AUCTION_ACTIVE,
          category: "テスト",
          group: {
            id: "group-1",
            name: "テストグループ",
            depositPeriod: 7,
          },
          creator: {
            id: "creator-1",
            image: null,
            settings: {
              username: "作成者",
            },
          },
          executors: [],
          reporters: [],
        },
      });

      // Act
      const { result } = renderHook(() => useAuctionBidUI(auction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.isExecutor).toBe(false);
    });

    test("should handle executor with null user", () => {
      // Arrange
      const auction = auctionWithDetailsFactory.build({
        task: {
          task: "テストタスク",
          detail: "テストタスクの詳細",
          imageUrl: null,
          status: TaskStatus.AUCTION_ACTIVE,
          category: "テスト",
          group: {
            id: "group-1",
            name: "テストグループ",
            depositPeriod: 7,
          },
          creator: {
            id: "creator-1",
            image: null,
            settings: {
              username: "作成者",
            },
          },
          executors: [
            {
              user: null,
            },
          ],
          reporters: [],
        },
      });

      // Act
      const { result } = renderHook(() => useAuctionBidUI(auction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.isExecutor).toBe(false);
    });
  });

  describe("タブ管理", () => {
    test("should use default tab value from useQueryState", () => {
      // Arrange
      mockUseQueryState.mockReturnValue(["bid", vi.fn()]);
      const auction = auctionWithDetailsFactory.build();

      // Act
      const { result } = renderHook(() => useAuctionBidUI(auction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.activeTab).toBe("bid");
    });

    test("should provide setActiveTab function", () => {
      // Arrange
      const mockSetActiveTab = vi.fn();
      mockUseQueryState.mockReturnValue(["details", mockSetActiveTab]);
      const auction = auctionWithDetailsFactory.build();

      // Act
      const { result } = renderHook(() => useAuctionBidUI(auction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.setActiveTab).toBe(mockSetActiveTab);
    });
  });

  describe("エラーケース・境界値", () => {
    test("should handle empty auction data gracefully", () => {
      // Arrange
      const auction = auctionWithDetailsFactory.build({
        task: {
          task: "",
          detail: null,
          imageUrl: null,
          status: TaskStatus.AUCTION_ACTIVE,
          category: null,
          group: {
            id: "",
            name: "",
            depositPeriod: 0,
          },
          creator: {
            id: "",
            image: null,
            settings: null,
          },
          executors: [],
          reporters: [],
        },
      });

      // Act
      const { result } = renderHook(() => useAuctionBidUI(auction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.usersWithRoles).toStrictEqual([
        {
          id: "",
          image: null,
          username: "不明なユーザー",
          roles: ["SUPPLIER"],
        },
      ]);
      expect(result.current.isActive).toBe(false);
      expect(result.current.isExecutor).toBe(false);
    });

    test("should handle auction with very large numbers", () => {
      // Arrange
      const auction = auctionWithDetailsFactory.build({
        currentHighestBid: Number.MAX_SAFE_INTEGER,
        extensionTotalCount: 999999,
        extensionLimitCount: 999999,
        extensionTime: 999999,
        remainingTimeForExtension: 999999,
      });

      // Act
      const { result } = renderHook(() => useAuctionBidUI(auction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(typeof result.current.currentUserId).toBe("string");
      expect(result.current.usersWithRoles).toBeDefined();
      expect(typeof result.current.isActive).toBe("boolean");
      expect(typeof result.current.isExecutor).toBe("boolean");
    });

    test("should handle auction with past dates", () => {
      // Arrange
      const veryOldDate = new Date("1900-01-01");
      const auction = auctionWithDetailsFactory.build({
        startTime: veryOldDate,
        endTime: veryOldDate,
        status: TaskStatus.AUCTION_ACTIVE,
      });

      // Act
      const { result } = renderHook(() => useAuctionBidUI(auction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.isActive).toBe(false);
    });

    test("should handle auction with future dates", () => {
      // Arrange
      const veryFutureDate = new Date("2100-01-01");
      const auction = auctionWithDetailsFactory.build({
        startTime: veryFutureDate,
        endTime: veryFutureDate,
        status: TaskStatus.AUCTION_ACTIVE,
      });

      // Act
      const { result } = renderHook(() => useAuctionBidUI(auction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.isActive).toBe(false);
    });

    test("should handle multiple executors and reporters with same user", () => {
      // Arrange
      const auction = auctionWithDetailsFactory.build();
      const actualCurrentUserId = renderHook(() => useAuctionBidUI(auction), {
        wrapper: AllTheProviders,
      }).result.current.currentUserId;

      const complexAuction = auctionWithDetailsFactory.build({
        task: {
          task: "複雑なタスク",
          detail: "複雑なタスクの詳細",
          imageUrl: null,
          status: TaskStatus.AUCTION_ACTIVE,
          category: "複雑",
          group: {
            id: "group-1",
            name: "テストグループ",
            depositPeriod: 7,
          },
          creator: {
            id: "creator-1",
            image: null,
            settings: {
              username: "作成者",
            },
          },
          executors: [
            {
              user: {
                id: actualCurrentUserId,
                image: null,
                settings: {
                  username: "ユーザー1",
                },
              },
            },
            {
              user: {
                id: "user-2",
                image: null,
                settings: {
                  username: "ユーザー2",
                },
              },
            },
            {
              user: {
                id: actualCurrentUserId, // 重複
                image: null,
                settings: {
                  username: "ユーザー1",
                },
              },
            },
          ],
          reporters: [
            {
              user: {
                id: actualCurrentUserId, // 同じユーザーが複数の役割
                image: null,
                settings: {
                  username: "ユーザー1",
                },
              },
            },
            {
              user: {
                id: "user-3",
                image: null,
                settings: {
                  username: "ユーザー3",
                },
              },
            },
          ],
        },
      });

      // Act
      const { result } = renderHook(() => useAuctionBidUI(complexAuction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.isExecutor).toBe(true);
      // ユーザーが重複していても、正しく統合されることを確認
      const userWithMultipleRoles = result.current.usersWithRoles.find((user) => user.id === actualCurrentUserId);
      expect(userWithMultipleRoles?.roles).toContain("EXECUTOR");
      expect(userWithMultipleRoles?.roles).toContain("REPORTER");
    });

    test("should handle all possible TaskStatus values", () => {
      // Arrange & Act & Assert
      const statusesToTest = [
        TaskStatus.PENDING,
        TaskStatus.AUCTION_ACTIVE,
        TaskStatus.AUCTION_ENDED,
        TaskStatus.POINTS_DEPOSITED,
        TaskStatus.SUPPLIER_DONE,
        TaskStatus.TASK_COMPLETED,
        TaskStatus.FIXED_EVALUATED,
        TaskStatus.POINTS_AWARDED,
        TaskStatus.AUCTION_CANCELED,
        TaskStatus.ARCHIVED,
      ];

      statusesToTest.forEach((status) => {
        const auction = auctionWithDetailsFactory.build({
          status,
        });

        const { result } = renderHook(() => useAuctionBidUI(auction), {
          wrapper: AllTheProviders,
        });

        // AUCTION_ACTIVEの場合のみ、時間範囲内であればアクティブになる可能性がある
        if (status === TaskStatus.AUCTION_ACTIVE) {
          expect(typeof result.current.isActive).toBe("boolean");
        } else {
          expect(result.current.isActive).toBe(false);
        }
      });
    });

    test("should handle edge case with exact time boundaries", () => {
      // Arrange
      const now = new Date();
      const auction = auctionWithDetailsFactory.build({
        status: TaskStatus.AUCTION_ACTIVE,
        startTime: now, // 現在時刻と同じ
        endTime: now, // 現在時刻と同じ
      });

      // Act
      const { result } = renderHook(() => useAuctionBidUI(auction), {
        wrapper: AllTheProviders,
      });

      // Assert
      // 開始時刻と終了時刻が同じ場合はアクティブではない
      expect(result.current.isActive).toBe(false);
    });
  });
});
