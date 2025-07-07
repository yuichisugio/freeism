import type { PrismaClient } from "@prisma/client";
import type { DeepMockProxy } from "vitest-mock-extended";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";

import type { ProcessAuctionExtensionParams } from "./extend-auction-time";
import { processAuctionExtension } from "./extend-auction-time";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// Prismaモックの設定
const prismaMock: DeepMockProxy<PrismaClient> = mockDeep<PrismaClient>();

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// テスト用定数
const TEST_AUCTION_ID = "test-auction-id";
const TEST_EXTENSION_TIME = 10; // 分
const TEST_EXTENSION_LIMIT_COUNT = 3;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// オークションデータを作成するヘルパー関数
const createAuctionData = (
  overrides: Partial<ProcessAuctionExtensionParams["auction"]> = {},
): ProcessAuctionExtensionParams["auction"] => ({
  isExtension: true,
  extensionTotalCount: 0,
  extensionLimitCount: TEST_EXTENSION_LIMIT_COUNT,
  extensionTime: TEST_EXTENSION_TIME,
  endTime: new Date(Date.now() + 300000), // 5分後
  startTime: new Date(Date.now() - 3600000), // 1時間前
  ...overrides,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// パラメータを作成するヘルパー関数
const createProcessAuctionExtensionParams = (
  overrides: Partial<ProcessAuctionExtensionParams> = {},
): ProcessAuctionExtensionParams => ({
  auctionId: TEST_AUCTION_ID,
  auction: createAuctionData(),
  tx: prismaMock as ProcessAuctionExtensionParams["tx"],
  ...overrides,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// 各テスト前にモックをリセット
beforeEach(() => {
  mockReset(prismaMock);
  vi.clearAllMocks();
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("extend-auction-time.ts_processAuctionExtension", () => {
  describe("正常系", () => {
    test("should successfully extend auction when all conditions are met", async () => {
      // Arrange
      const now = new Date();
      const startTime = new Date(now.getTime() - 3600000); // 1時間前
      const endTime = new Date(now.getTime() + 300000); // 5分後（延長トリガー条件を満たす）

      const auctionData = createAuctionData({
        isExtension: true,
        extensionTotalCount: 0,
        extensionLimitCount: 3,
        extensionTime: 10,
        endTime,
        startTime,
      });

      const params = createProcessAuctionExtensionParams({
        auction: auctionData,
      });

      // モックの設定
      const mockUpdatedAuction = {
        id: TEST_AUCTION_ID,
        endTime: new Date(endTime.getTime() + 10 * 60 * 1000), // 10分延長
        extensionTotalCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        isExtension: true,
        extensionLimitCount: 3,
        extensionTime: 10,
        startTime,
        currentHighestBid: 100,
        currentHighestBidderId: "user-1",
        version: 1,
        remainingTimeForExtension: 5,
        groupId: "group-1",
        taskId: "task-1",
        winnerId: null,
      };
      prismaMock.auction.update.mockResolvedValue(mockUpdatedAuction);

      // Act
      const result = await processAuctionExtension(params);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        newEndTime: expect.any(Date) as Date,
        message: "オークションが10分延長されました",
      });
    });
  });

  describe("異常系", () => {
    test("should fail when auction is not extensible (isExtension is false)", async () => {
      // Arrange
      const auctionData = createAuctionData({
        isExtension: false, // 延長不可
      });

      const params = createProcessAuctionExtensionParams({
        auction: auctionData,
      });

      // Act
      const result = await processAuctionExtension(params);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        newEndTime: null,
        message: "延長不可のオークションです",
      });
    });

    test("should fail when extension limit is reached", async () => {
      // Arrange
      const auctionData = createAuctionData({
        isExtension: true,
        extensionTotalCount: 3, // 上限に達している
        extensionLimitCount: 3,
      });

      const params = createProcessAuctionExtensionParams({
        auction: auctionData,
      });

      // Act
      const result = await processAuctionExtension(params);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        newEndTime: null,
        message: "延長回数の上限に達しています",
      });
    });

    test("should fail when extension trigger condition is not met", async () => {
      // Arrange
      const now = new Date();
      const startTime = new Date(now.getTime() - 3600000); // 1時間前
      const endTime = new Date(now.getTime() + 1800000); // 30分後（延長トリガー条件を満たさない）

      const auctionData = createAuctionData({
        isExtension: true,
        extensionTotalCount: 0,
        extensionLimitCount: 3,
        extensionTime: 10,
        endTime,
        startTime,
      });

      const params = createProcessAuctionExtensionParams({
        auction: auctionData,
      });

      // Act
      const result = await processAuctionExtension(params);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        newEndTime: null,
        message: "延長トリガーの条件を満たしていません",
      });
    });

    test("should handle database update error gracefully", async () => {
      // Arrange
      const now = new Date();
      const startTime = new Date(now.getTime() - 3600000); // 1時間前
      const endTime = new Date(now.getTime() + 300000); // 5分後（延長トリガー条件を満たす）

      const auctionData = createAuctionData({
        isExtension: true,
        extensionTotalCount: 0,
        extensionLimitCount: 3,
        extensionTime: 10,
        endTime,
        startTime,
      });

      const params = createProcessAuctionExtensionParams({
        auction: auctionData,
      });

      // モックでエラーを発生させる
      const dbError = new Error("Database connection failed");
      prismaMock.auction.update.mockRejectedValue(dbError);

      // Act
      const result = await processAuctionExtension(params);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        newEndTime: null,
        message: "Database connection failed",
      });
    });
  });

  describe("境界値テスト", () => {
    test("should extend when extension count is exactly at limit minus one", async () => {
      // Arrange
      const now = new Date();
      const startTime = new Date(now.getTime() - 3600000); // 1時間前
      const endTime = new Date(now.getTime() + 300000); // 5分後

      const auctionData = createAuctionData({
        isExtension: true,
        extensionTotalCount: 2, // 上限3の1つ手前
        extensionLimitCount: 3,
        extensionTime: 10,
        endTime,
        startTime,
      });

      const params = createProcessAuctionExtensionParams({
        auction: auctionData,
      });

      // モックの設定
      const mockUpdatedAuction = {
        id: TEST_AUCTION_ID,
        endTime: new Date(endTime.getTime() + 600000),
        extensionTotalCount: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
        isExtension: true,
        extensionLimitCount: 3,
        extensionTime: 10,
        startTime,
        currentHighestBid: 100,
        currentHighestBidderId: "user-1",
        version: 1,
        remainingTimeForExtension: 5,
        groupId: "group-1",
        taskId: "task-1",
        winnerId: null,
      };
      prismaMock.auction.update.mockResolvedValue(mockUpdatedAuction);

      // Act
      const result = await processAuctionExtension(params);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        newEndTime: expect.any(Date) as Date,
        message: "オークションが10分延長されました",
      });
    });

    test("should fail when extension count equals limit", async () => {
      // Arrange
      const auctionData = createAuctionData({
        isExtension: true,
        extensionTotalCount: 3, // 上限と同じ
        extensionLimitCount: 3,
      });

      const params = createProcessAuctionExtensionParams({
        auction: auctionData,
      });

      // Act
      const result = await processAuctionExtension(params);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        newEndTime: null,
        message: "延長回数の上限に達しています",
      });
    });

    test("should handle zero extension time correctly", async () => {
      // Arrange
      const now = new Date();
      const startTime = new Date(now.getTime() - 3600000); // 1時間前
      const endTime = new Date(now.getTime() + 180000); // 3分後（5%時間以下でトリガー条件を満たす）

      const auctionData = createAuctionData({
        isExtension: true,
        extensionTotalCount: 0,
        extensionLimitCount: 3,
        extensionTime: 0, // 0分
        endTime,
        startTime,
      });

      const params = createProcessAuctionExtensionParams({
        auction: auctionData,
      });

      // モックの設定
      const mockUpdatedAuction = {
        id: TEST_AUCTION_ID,
        endTime: new Date(endTime.getTime() + 180000), // 5%延長（3分）
        extensionTotalCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        isExtension: true,
        extensionLimitCount: 3,
        extensionTime: 0,
        startTime,
        currentHighestBid: 100,
        currentHighestBidderId: "user-1",
        version: 1,
        remainingTimeForExtension: 5,
        groupId: "group-1",
        taskId: "task-1",
        winnerId: null,
      };
      prismaMock.auction.update.mockResolvedValue(mockUpdatedAuction);

      // Act
      const result = await processAuctionExtension(params);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        newEndTime: expect.any(Date) as Date,
        message: "オークションが3分延長されました",
      });
    });

    test("should handle very large extension time", async () => {
      // Arrange
      const now = new Date();
      const startTime = new Date(now.getTime() - 3600000); // 1時間前
      const endTime = new Date(now.getTime() + 300000); // 5分後

      const auctionData = createAuctionData({
        isExtension: true,
        extensionTotalCount: 0,
        extensionLimitCount: 3,
        extensionTime: 1440, // 24時間
        endTime,
        startTime,
      });

      const params = createProcessAuctionExtensionParams({
        auction: auctionData,
      });

      // モックの設定
      const mockUpdatedAuction = {
        id: TEST_AUCTION_ID,
        endTime: new Date(endTime.getTime() + 86400000), // 24時間延長
        extensionTotalCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        isExtension: true,
        extensionLimitCount: 3,
        extensionTime: 1440,
        startTime,
        currentHighestBid: 100,
        currentHighestBidderId: "user-1",
        version: 1,
        remainingTimeForExtension: 5,
        groupId: "group-1",
        taskId: "task-1",
        winnerId: null,
      };
      prismaMock.auction.update.mockResolvedValue(mockUpdatedAuction);

      // Act
      const result = await processAuctionExtension(params);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        newEndTime: expect.any(Date) as Date,
        message: "オークションが1440分延長されました",
      });
    });

    test("should handle minimum auction duration", async () => {
      // Arrange
      const now = new Date();
      const startTime = new Date(now.getTime() - 60000); // 1分前
      const endTime = new Date(now.getTime() + 30000); // 30秒後

      const auctionData = createAuctionData({
        isExtension: true,
        extensionTotalCount: 0,
        extensionLimitCount: 3,
        extensionTime: 10,
        endTime,
        startTime,
      });

      const params = createProcessAuctionExtensionParams({
        auction: auctionData,
      });

      // モックの設定
      const mockUpdatedAuction = {
        id: TEST_AUCTION_ID,
        endTime: new Date(endTime.getTime() + 600000), // 10分延長
        extensionTotalCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        isExtension: true,
        extensionLimitCount: 3,
        extensionTime: 10,
        startTime,
        currentHighestBid: 100,
        currentHighestBidderId: "user-1",
        version: 1,
        remainingTimeForExtension: 5,
        groupId: "group-1",
        taskId: "task-1",
        winnerId: null,
      };
      prismaMock.auction.update.mockResolvedValue(mockUpdatedAuction);

      // Act
      const result = await processAuctionExtension(params);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Date);
    });
  });

  describe("エッジケースとエラーハンドリング", () => {
    test("should handle extension when exactly at trigger time", async () => {
      // Arrange
      const now = new Date();
      const startTime = new Date(now.getTime() - 3600000); // 1時間前
      const totalAuctionTime = 3600000; // 1時間
      const fivePercentTime = totalAuctionTime * 0.05; // 3分
      const extensionTimeMs = 10 * 60 * 1000; // 10分
      const triggerTime = Math.max(fivePercentTime, extensionTimeMs); // 10分
      const endTime = new Date(now.getTime() + triggerTime); // ちょうどトリガー時間後

      const auctionData = createAuctionData({
        isExtension: true,
        extensionTotalCount: 0,
        extensionLimitCount: 3,
        extensionTime: 10,
        endTime,
        startTime,
      });

      const params = createProcessAuctionExtensionParams({
        auction: auctionData,
      });

      // モックの設定
      const mockUpdatedAuction = {
        id: TEST_AUCTION_ID,
        endTime: new Date(endTime.getTime() + 600000), // 10分延長
        extensionTotalCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        isExtension: true,
        extensionLimitCount: 3,
        extensionTime: 10,
        startTime,
        currentHighestBid: 100,
        currentHighestBidderId: "user-1",
        version: 1,
        remainingTimeForExtension: 5,
        groupId: "group-1",
        taskId: "task-1",
        winnerId: null,
      };
      prismaMock.auction.update.mockResolvedValue(mockUpdatedAuction);

      // Act
      const result = await processAuctionExtension(params);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        newEndTime: expect.any(Date) as Date,
        message: "オークションが10分延長されました",
      });
    });

    test("should handle extension when remaining time is exactly zero", async () => {
      // Arrange
      const now = new Date();
      const startTime = new Date(now.getTime() - 3600000); // 1時間前
      const endTime = new Date(now.getTime()); // 現在時刻（残り時間0）

      const auctionData = createAuctionData({
        isExtension: true,
        extensionTotalCount: 0,
        extensionLimitCount: 3,
        extensionTime: 10,
        endTime,
        startTime,
      });

      const params = createProcessAuctionExtensionParams({
        auction: auctionData,
      });

      // モックの設定
      const mockUpdatedAuction = {
        id: TEST_AUCTION_ID,
        endTime: new Date(endTime.getTime() + 600000), // 10分延長
        extensionTotalCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        isExtension: true,
        extensionLimitCount: 3,
        extensionTime: 10,
        startTime,
        currentHighestBid: 100,
        currentHighestBidderId: "user-1",
        version: 1,
        remainingTimeForExtension: 5,
        groupId: "group-1",
        taskId: "task-1",
        winnerId: null,
      };
      prismaMock.auction.update.mockResolvedValue(mockUpdatedAuction);

      // Act
      const result = await processAuctionExtension(params);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        newEndTime: expect.any(Date) as Date,
        message: "オークションが10分延長されました",
      });
    });

    test("should handle extension when auction has already ended", async () => {
      // Arrange
      const now = new Date();
      const startTime = new Date(now.getTime() - 3600000); // 1時間前
      const endTime = new Date(now.getTime() - 300000); // 5分前（既に終了）

      const auctionData = createAuctionData({
        isExtension: true,
        extensionTotalCount: 0,
        extensionLimitCount: 3,
        extensionTime: 10,
        endTime,
        startTime,
      });

      const params = createProcessAuctionExtensionParams({
        auction: auctionData,
      });

      // モックの設定
      const mockUpdatedAuction = {
        id: TEST_AUCTION_ID,
        endTime: new Date(endTime.getTime() + 600000), // 10分延長
        extensionTotalCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        isExtension: true,
        extensionLimitCount: 3,
        extensionTime: 10,
        startTime,
        currentHighestBid: 100,
        currentHighestBidderId: "user-1",
        version: 1,
        remainingTimeForExtension: 5,
        groupId: "group-1",
        taskId: "task-1",
        winnerId: null,
      };
      prismaMock.auction.update.mockResolvedValue(mockUpdatedAuction);

      // Act
      const result = await processAuctionExtension(params);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        newEndTime: expect.any(Date) as Date,
        message: "オークションが10分延長されました",
      });
    });

    test("should handle non-Error thrown objects", async () => {
      // Arrange
      const now = new Date();
      const startTime = new Date(now.getTime() - 3600000); // 1時間前
      const endTime = new Date(now.getTime() + 300000); // 5分後

      const auctionData = createAuctionData({
        isExtension: true,
        extensionTotalCount: 0,
        extensionLimitCount: 3,
        extensionTime: 10,
        endTime,
        startTime,
      });

      const params = createProcessAuctionExtensionParams({
        auction: auctionData,
      });

      // モックで非Errorオブジェクトを投げる
      prismaMock.auction.update.mockRejectedValue("String error");

      // Act
      const result = await processAuctionExtension(params);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        newEndTime: null,
        message: "オークション延長中に不明なエラーが発生しました",
      });
    });

    test("should handle extension with maximum limit count", async () => {
      // Arrange
      const now = new Date();
      const startTime = new Date(now.getTime() - 3600000); // 1時間前
      const endTime = new Date(now.getTime() + 300000); // 5分後

      const auctionData = createAuctionData({
        isExtension: true,
        extensionTotalCount: 999, // 上限1000の1つ手前
        extensionLimitCount: 1000,
        extensionTime: 10,
        endTime,
        startTime,
      });

      const params = createProcessAuctionExtensionParams({
        auction: auctionData,
      });

      // モックの設定
      const mockUpdatedAuction = {
        id: TEST_AUCTION_ID,
        endTime: new Date(endTime.getTime() + 600000), // 10分延長
        extensionTotalCount: 1000,
        createdAt: new Date(),
        updatedAt: new Date(),
        isExtension: true,
        extensionLimitCount: 1000,
        extensionTime: 10,
        startTime,
        currentHighestBid: 100,
        currentHighestBidderId: "user-1",
        version: 1,
        remainingTimeForExtension: 5,
        groupId: "group-1",
        taskId: "task-1",
        winnerId: null,
      };
      prismaMock.auction.update.mockResolvedValue(mockUpdatedAuction);

      // Act
      const result = await processAuctionExtension(params);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        newEndTime: expect.any(Date) as Date,
        message: "オークションが10分延長されました",
      });
    });

    test("should handle very short auction duration", async () => {
      // Arrange
      const now = new Date();
      const startTime = new Date(now.getTime() - 1000); // 1秒前
      const endTime = new Date(now.getTime() + 500); // 0.5秒後

      const auctionData = createAuctionData({
        isExtension: true,
        extensionTotalCount: 0,
        extensionLimitCount: 3,
        extensionTime: 1, // 1分
        endTime,
        startTime,
      });

      const params = createProcessAuctionExtensionParams({
        auction: auctionData,
      });

      // モックの設定
      const mockUpdatedAuction = {
        id: TEST_AUCTION_ID,
        endTime: new Date(endTime.getTime() + 60000), // 1分延長
        extensionTotalCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        isExtension: true,
        extensionLimitCount: 3,
        extensionTime: 1,
        startTime,
        currentHighestBid: 100,
        currentHighestBidderId: "user-1",
        version: 1,
        remainingTimeForExtension: 5,
        groupId: "group-1",
        taskId: "task-1",
        winnerId: null,
      };
      prismaMock.auction.update.mockResolvedValue(mockUpdatedAuction);

      // Act
      const result = await processAuctionExtension(params);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        newEndTime: expect.any(Date) as Date,
        message: "オークションが1分延長されました",
      });
    });
  });
});
