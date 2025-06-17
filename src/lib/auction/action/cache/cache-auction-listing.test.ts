import type { AuctionListingsConditions } from "@/types/auction-types";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { groupMembershipFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { GetAuctionListingsParams } from "./cache-auction-listing";
// テスト対象の関数をインポート
import { cachedGetAuctionListingsAndCount } from "./cache-auction-listing";

// 各テスト前にモックをリセット
beforeEach(() => {
  vi.clearAllMocks();
});

// テストデータの定義
const testUserId = "test-user-id";
const testGroupId = "test-group-id";
const testAuctionId = "test-auction-id";

// 共通のテストデータ
const mockListingsConditions: AuctionListingsConditions = {
  categories: ["プログラミング"],
  status: ["not_ended"],
  statusConditionJoinType: "OR",
  minBid: 100,
  maxBid: 1000,
  minRemainingTime: 1,
  maxRemainingTime: 24,
  groupIds: [testGroupId],
  searchQuery: "テスト",
  sort: [{ field: "newest", direction: "desc" }],
  page: 1,
};

describe("cache-auction-listing", () => {
  describe("cachedGetAuctionListingsAndCount", () => {
    test("should return auction listings and count successfully", async () => {
      // Arrange
      const mockParams: GetAuctionListingsParams = {
        listingsConditions: mockListingsConditions,
        userId: testUserId,
      };

      const mockGroupMemberships = [groupMembershipFactory.build({ userId: testUserId, groupId: testGroupId })];
      const mockRawAuctionData = [
        {
          id: testAuctionId,
          current_highest_bid: 500,
          end_time: new Date("2024-12-31T23:59:59Z"),
          start_time: new Date("2024-01-01T00:00:00Z"),
          status: TaskStatus.PENDING,
          created_at: new Date("2024-01-01T00:00:00Z"),
          task: "テストタスク",
          detail: "テストタスクの詳細",
          image_url: "https://example.com/image.jpg",
          category: "プログラミング",
          group_id: testGroupId,
          group_name: "テストグループ",
          bids_count: BigInt(5),
          is_watched: false,
          executors_json: JSON.stringify([
            {
              id: "executor-1",
              user_id: "executor-user-1",
              user_image: "https://example.com/executor.jpg",
              username: "実行者1",
              rating: 4.5,
            },
          ]),
          score: 0.95,
          task_highlighted: "<mark>テスト</mark>タスク",
          detail_highlighted: "<mark>テスト</mark>タスクの詳細",
          _dummy: false,
        },
      ];
      const mockCountResult = [{ count: BigInt(1) }];

      prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockRawAuctionData) // listings query
        .mockResolvedValueOnce(mockCountResult); // count query

      // Act
      const result = await cachedGetAuctionListingsAndCount(mockParams);

      // Assert
      expect(result.listings).toHaveLength(1);
      expect(result.count).toBe(1);
      expect(result.listings[0].id).toBe(testAuctionId);
      expect(result.listings[0].bids_count).toBe(5);
      expect(result.listings[0].is_watched).toBe(false);
      expect(prismaMock.groupMembership.findMany).toHaveBeenCalledWith({
        where: { userId: testUserId },
        select: { groupId: true },
      });
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
    });

    test("should return empty results when user has no group memberships", async () => {
      // Arrange
      const mockParams: GetAuctionListingsParams = {
        listingsConditions: mockListingsConditions,
        userId: testUserId,
      };

      prismaMock.groupMembership.findMany.mockResolvedValue([]);

      // Act
      const result = await cachedGetAuctionListingsAndCount(mockParams);

      // Assert
      expect(result.listings).toStrictEqual([]);
      expect(result.count).toBe(0);
      expect(prismaMock.groupMembership.findMany).toHaveBeenCalledWith({
        where: { userId: testUserId },
        select: { groupId: true },
      });
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });

    test("should handle empty auction data", async () => {
      // Arrange
      const mockParams: GetAuctionListingsParams = {
        listingsConditions: mockListingsConditions,
        userId: testUserId,
      };

      const mockGroupMemberships = [groupMembershipFactory.build({ userId: testUserId, groupId: testGroupId })];
      const mockCountResult = [{ count: BigInt(0) }];

      prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
      prismaMock.$queryRaw
        .mockResolvedValueOnce([]) // empty listings
        .mockResolvedValueOnce(mockCountResult); // count query

      // Act
      const result = await cachedGetAuctionListingsAndCount(mockParams);

      // Assert
      expect(result.listings).toStrictEqual([]);
      expect(result.count).toBe(0);
    });

    test("should handle null executors_json", async () => {
      // Arrange
      const mockParams: GetAuctionListingsParams = {
        listingsConditions: mockListingsConditions,
        userId: testUserId,
      };

      const mockGroupMemberships = [groupMembershipFactory.build({ userId: testUserId, groupId: testGroupId })];
      const mockRawAuctionData = [
        {
          id: testAuctionId,
          current_highest_bid: 500,
          end_time: new Date("2024-12-31T23:59:59Z"),
          start_time: new Date("2024-01-01T00:00:00Z"),
          status: TaskStatus.PENDING,
          created_at: new Date("2024-01-01T00:00:00Z"),
          task: "テストタスク",
          detail: "テストタスクの詳細",
          image_url: "https://example.com/image.jpg",
          category: "プログラミング",
          group_id: testGroupId,
          group_name: "テストグループ",
          bids_count: BigInt(0),
          is_watched: false,
          executors_json: null,
          score: null,
          task_highlighted: null,
          detail_highlighted: null,
          _dummy: false,
        },
      ];
      const mockCountResult = [{ count: BigInt(1) }];

      prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
      prismaMock.$queryRaw.mockResolvedValueOnce(mockRawAuctionData).mockResolvedValueOnce(mockCountResult);

      // Act
      const result = await cachedGetAuctionListingsAndCount(mockParams);

      // Assert
      expect(result.listings).toHaveLength(1);
      expect(result.listings[0].executors_json).toStrictEqual([]);
    });

    test("should handle invalid JSON in executors_json", async () => {
      // Arrange
      const mockParams: GetAuctionListingsParams = {
        listingsConditions: mockListingsConditions,
        userId: testUserId,
      };

      const mockGroupMemberships = [groupMembershipFactory.build({ userId: testUserId, groupId: testGroupId })];
      const mockRawAuctionData = [
        {
          id: testAuctionId,
          current_highest_bid: 500,
          end_time: new Date("2024-12-31T23:59:59Z"),
          start_time: new Date("2024-01-01T00:00:00Z"),
          status: TaskStatus.PENDING,
          created_at: new Date("2024-01-01T00:00:00Z"),
          task: "テストタスク",
          detail: null,
          image_url: null,
          category: null,
          group_id: testGroupId,
          group_name: "テストグループ",
          bids_count: null,
          is_watched: null,
          executors_json: "invalid json",
          score: null,
          task_highlighted: null,
          detail_highlighted: null,
          _dummy: false,
        },
      ];
      const mockCountResult = [{ count: BigInt(1) }];

      prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
      prismaMock.$queryRaw.mockResolvedValueOnce(mockRawAuctionData).mockResolvedValueOnce(mockCountResult);

      // Act
      const result = await cachedGetAuctionListingsAndCount(mockParams);

      // Assert
      expect(result.listings).toHaveLength(1);
      expect(result.listings[0].executors_json).toStrictEqual([]);
    });

    test("should handle database error gracefully", async () => {
      // Arrange
      const mockParams: GetAuctionListingsParams = {
        listingsConditions: mockListingsConditions,
        userId: testUserId,
      };

      prismaMock.groupMembership.findMany.mockRejectedValue(new Error("Database connection error"));

      // Act
      const result = await cachedGetAuctionListingsAndCount(mockParams);

      // Assert
      expect(result.listings).toStrictEqual([]);
      expect(result.count).toBe(0);
    });

    test("should handle null listingsConditions", async () => {
      // Arrange
      const mockParams: GetAuctionListingsParams = {
        listingsConditions: null as unknown as AuctionListingsConditions,
        userId: testUserId,
      };

      // Act
      const result = await cachedGetAuctionListingsAndCount(mockParams);

      // Assert
      expect(result.listings).toStrictEqual([]);
      expect(result.count).toBe(0);
    });

    test("should handle undefined userId", async () => {
      // Arrange
      const mockParams: GetAuctionListingsParams = {
        listingsConditions: mockListingsConditions,
        userId: undefined as unknown as string,
      };

      // Act
      const result = await cachedGetAuctionListingsAndCount(mockParams);

      // Assert
      expect(result.listings).toStrictEqual([]);
      expect(result.count).toBe(0);
    });

    test("should handle large count value", async () => {
      // Arrange
      const mockParams: GetAuctionListingsParams = {
        listingsConditions: mockListingsConditions,
        userId: testUserId,
      };

      const mockGroupMemberships = [groupMembershipFactory.build({ userId: testUserId, groupId: testGroupId })];
      const mockCountResult = [{ count: BigInt(999999) }];

      prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
      prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce(mockCountResult);

      // Act
      const result = await cachedGetAuctionListingsAndCount(mockParams);

      // Assert
      expect(result.count).toBe(999999);
    });

    test("should handle different status conditions", async () => {
      // Arrange
      const mockParamsWithDifferentStatus: GetAuctionListingsParams = {
        listingsConditions: {
          ...mockListingsConditions,
          status: ["ended", "watchlist", "bidded"],
          statusConditionJoinType: "AND",
        },
        userId: testUserId,
      };

      const mockGroupMemberships = [groupMembershipFactory.build({ userId: testUserId, groupId: testGroupId })];
      const mockCountResult = [{ count: BigInt(0) }];

      prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
      prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce(mockCountResult);

      // Act
      const result = await cachedGetAuctionListingsAndCount(mockParamsWithDifferentStatus);

      // Assert
      expect(result.listings).toStrictEqual([]);
      expect(result.count).toBe(0);
    });

    test("should handle null categories filter", async () => {
      // Arrange
      const mockParamsWithNullCategories: GetAuctionListingsParams = {
        listingsConditions: {
          ...mockListingsConditions,
          categories: null,
        },
        userId: testUserId,
      };

      const mockGroupMemberships = [groupMembershipFactory.build({ userId: testUserId, groupId: testGroupId })];
      const mockCountResult = [{ count: BigInt(0) }];

      prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
      prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce(mockCountResult);

      // Act
      const result = await cachedGetAuctionListingsAndCount(mockParamsWithNullCategories);

      // Assert
      expect(result.listings).toStrictEqual([]);
      expect(result.count).toBe(0);
    });

    test("should handle bid amount filters", async () => {
      // Arrange
      const mockParamsWithBidFilters: GetAuctionListingsParams = {
        listingsConditions: {
          ...mockListingsConditions,
          minBid: 0,
          maxBid: 0,
        },
        userId: testUserId,
      };

      const mockGroupMemberships = [groupMembershipFactory.build({ userId: testUserId, groupId: testGroupId })];
      const mockCountResult = [{ count: BigInt(0) }];

      prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
      prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce(mockCountResult);

      // Act
      const result = await cachedGetAuctionListingsAndCount(mockParamsWithBidFilters);

      // Assert
      expect(result.listings).toStrictEqual([]);
      expect(result.count).toBe(0);
    });

    test("should handle remaining time filters", async () => {
      // Arrange
      const mockParamsWithTimeFilters: GetAuctionListingsParams = {
        listingsConditions: {
          ...mockListingsConditions,
          minRemainingTime: 0,
          maxRemainingTime: 0,
        },
        userId: testUserId,
      };

      const mockGroupMemberships = [groupMembershipFactory.build({ userId: testUserId, groupId: testGroupId })];
      const mockCountResult = [{ count: BigInt(0) }];

      prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
      prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce(mockCountResult);

      // Act
      const result = await cachedGetAuctionListingsAndCount(mockParamsWithTimeFilters);

      // Assert
      expect(result.listings).toStrictEqual([]);
      expect(result.count).toBe(0);
    });

    test("should handle different sort options", async () => {
      // Arrange
      const mockParamsWithSort: GetAuctionListingsParams = {
        listingsConditions: {
          ...mockListingsConditions,
          sort: [{ field: "price", direction: "asc" }],
        },
        userId: testUserId,
      };

      const mockGroupMemberships = [groupMembershipFactory.build({ userId: testUserId, groupId: testGroupId })];
      const mockCountResult = [{ count: BigInt(0) }];

      prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
      prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce(mockCountResult);

      // Act
      const result = await cachedGetAuctionListingsAndCount(mockParamsWithSort);

      // Assert
      expect(result.listings).toStrictEqual([]);
      expect(result.count).toBe(0);
    });

    test("should handle pagination", async () => {
      // Arrange
      const mockParamsWithPagination: GetAuctionListingsParams = {
        listingsConditions: {
          ...mockListingsConditions,
          page: 2,
        },
        userId: testUserId,
      };

      const mockGroupMemberships = [groupMembershipFactory.build({ userId: testUserId, groupId: testGroupId })];
      const mockCountResult = [{ count: BigInt(0) }];

      prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
      prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce(mockCountResult);

      // Act
      const result = await cachedGetAuctionListingsAndCount(mockParamsWithPagination);

      // Assert
      expect(result.listings).toStrictEqual([]);
      expect(result.count).toBe(0);
    });
  });

  // 境界値テスト
  describe("boundary value tests", () => {
    test("should handle maximum integer count", async () => {
      // Arrange
      const mockParams: GetAuctionListingsParams = {
        listingsConditions: mockListingsConditions,
        userId: testUserId,
      };

      const mockGroupMemberships = [groupMembershipFactory.build({ userId: testUserId, groupId: testGroupId })];
      const maxCount = Number.MAX_SAFE_INTEGER;
      const mockCountResult = [{ count: BigInt(maxCount) }];

      prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
      prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce(mockCountResult);

      // Act
      const result = await cachedGetAuctionListingsAndCount(mockParams);

      // Assert
      expect(result.count).toBe(maxCount);
    });
  });

  // 異常系テスト（不正な引数）
  describe("invalid input tests", () => {
    test("should handle malformed listingsConditions object", async () => {
      // Arrange
      const malformedParams = {
        listingsConditions: { invalidField: "invalid" } as unknown as AuctionListingsConditions,
        userId: testUserId,
      };

      // Act
      const result = await cachedGetAuctionListingsAndCount(malformedParams);

      // Assert
      expect(result.listings).toStrictEqual([]);
      expect(result.count).toBe(0);
    });

    test("should handle non-string userId parameter in cachedGetAuctionListingsAndCount", async () => {
      // Arrange
      const malformedParams = {
        listingsConditions: mockListingsConditions,
        userId: 123 as unknown as string,
      };

      // Act
      const result = await cachedGetAuctionListingsAndCount(malformedParams);

      // Assert
      expect(result.listings).toStrictEqual([]);
      expect(result.count).toBe(0);
    });
  });
});
