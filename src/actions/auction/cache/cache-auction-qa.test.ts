import type { AuctionMessage, AuctionPersonInfo } from "@/hooks/auction/bid/use-auction-qa";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getCachedAuctionMessageContents, getCachedAuctionSellerInfo } from "./cache-auction-qa";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Next.jsのキャッシュ機能をモック
 */
vi.mock("next/cache", () => ({
  unstable_cacheLife: vi.fn(),
  unstable_cacheTag: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 各テスト前にモックをリセット
 */
beforeEach(() => {
  vi.clearAllMocks();
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// 共通のテストデータ
const VALID_AUCTION_ID = "test-auction-id";
const VALID_USER_ID = "test-user-id";
const VALID_MESSAGE_ID = "test-message-id";
const VALID_CREATOR_ID = "test-creator-id";
const VALID_REPORTER_ID = "test-reporter-id";
const VALID_EXECUTOR_ID = "test-executor-id";
const VALID_AUCTION_END_DATE = new Date("2024-12-31T23:59:59Z");

// テスト用モックデータの型定義
type MockPrismaMessage = {
  id: string;
  message: string;
  createdAt: Date;
  sender: {
    id: string;
    image: string;
    settings: {
      username?: string;
    } | null;
  };
};

// テスト用モックデータファクトリー
const createMockPrismaMessage = (overrides: Partial<MockPrismaMessage> = {}): MockPrismaMessage => ({
  id: VALID_MESSAGE_ID,
  message: "テストメッセージ",
  createdAt: new Date("2024-01-01T12:00:00Z"),
  sender: {
    id: VALID_USER_ID,
    image: "https://example.com/user.jpg",
    settings: {
      username: "テストユーザー名",
    },
  },
  ...overrides,
});

const createMockFormattedMessage = (overrides: Partial<AuctionMessage> = {}): AuctionMessage => ({
  messageId: VALID_MESSAGE_ID,
  messageContent: "テストメッセージ",
  createdAt: new Date("2024-01-01T12:00:00Z"),
  person: {
    sender: {
      id: VALID_USER_ID,
      appUserName: "テストユーザー名",
      image: "https://example.com/user.jpg",
    },
  },
  ...overrides,
});

const createMockPrismaAuctionInfo = (overrides = {}) => ({
  task: {
    creatorId: VALID_CREATOR_ID,
    creator: {
      id: VALID_CREATOR_ID,
    },
    reporters: [
      {
        user: {
          id: VALID_REPORTER_ID,
        },
      },
    ],
    executors: [
      {
        user: {
          id: VALID_EXECUTOR_ID,
        },
      },
    ],
  },
  ...overrides,
});

const createMockFormattedAuctionPersonInfo = (): AuctionPersonInfo => ({
  creator: {
    id: VALID_CREATOR_ID,
  },
  reporters: [
    {
      id: VALID_REPORTER_ID,
    },
  ],
  executors: [
    {
      id: VALID_EXECUTOR_ID,
    },
  ],
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 基本のモックデータ
 */
const mockPrismaMessage = createMockPrismaMessage();
const mockFormattedMessage = createMockFormattedMessage();
const mockPrismaAuctionInfo = createMockPrismaAuctionInfo();
const mockFormattedAuctionPersonInfo = createMockFormattedAuctionPersonInfo();

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テスト
 */
describe("cache-auction-qa", () => {
  describe("getCachedAuctionMessageContents", () => {
    describe("異常系", () => {
      describe("パラメータ検証", () => {
        test.each([
          {
            description: "auctionId が空文字列の場合",
            auctionId: "",
            isDisplayAfterEnd: false,
            auctionEndDate: VALID_AUCTION_END_DATE,
          },
          {
            description: "auctionId が null の場合",
            auctionId: null as unknown as string,
            isDisplayAfterEnd: false,
            auctionEndDate: VALID_AUCTION_END_DATE,
          },
          {
            description: "auctionId が undefined の場合",
            auctionId: undefined as unknown as string,
            isDisplayAfterEnd: false,
            auctionEndDate: VALID_AUCTION_END_DATE,
          },
          {
            description: "isDisplayAfterEnd が boolean でない場合",
            auctionId: VALID_AUCTION_ID,
            isDisplayAfterEnd: "true" as unknown as boolean,
            auctionEndDate: VALID_AUCTION_END_DATE,
          },
          {
            description: "auctionEndDate が無効な日付の場合",
            auctionId: VALID_AUCTION_ID,
            isDisplayAfterEnd: false,
            auctionEndDate: new Date("invalid-date"),
          },
          {
            description: "auctionEndDate が null の場合",
            auctionId: VALID_AUCTION_ID,
            isDisplayAfterEnd: false,
            auctionEndDate: null as unknown as Date,
          },
        ])("should throw error when $description", async ({ auctionId, isDisplayAfterEnd, auctionEndDate }) => {
          // Act & Assert
          await expect(getCachedAuctionMessageContents(auctionId, isDisplayAfterEnd, auctionEndDate)).rejects.toThrow(
            "パラメータが不正です",
          );
        });
      });

      describe("データベースエラー", () => {
        test("should propagate database error", async () => {
          // Arrange
          const mockError = new Error("Database connection error");
          prismaMock.auctionMessage.findMany.mockRejectedValue(mockError);

          // Act & Assert
          await expect(
            getCachedAuctionMessageContents(VALID_AUCTION_ID, false, VALID_AUCTION_END_DATE),
          ).rejects.toThrow(mockError);
        });
      });
    });

    describe("正常系", () => {
      test.each([
        {
          description: "isDisplayAfterEnd が false の場合",
          isDisplayAfterEnd: false,
          expectedCondition: { lte: new Date(VALID_AUCTION_END_DATE) },
        },
        {
          description: "isDisplayAfterEnd が true の場合",
          isDisplayAfterEnd: true,
          expectedCondition: { gte: new Date(VALID_AUCTION_END_DATE) },
        },
      ])("should return messages successfully when $description", async ({ isDisplayAfterEnd, expectedCondition }) => {
        // Arrange
        prismaMock.auctionMessage.findMany.mockResolvedValue([mockPrismaMessage] as unknown as Awaited<
          ReturnType<typeof prismaMock.auctionMessage.findMany>
        >);

        // Act
        const result = await getCachedAuctionMessageContents(
          VALID_AUCTION_ID,
          isDisplayAfterEnd,
          VALID_AUCTION_END_DATE,
        );

        // Assert
        expect(result).toStrictEqual({
          success: true,
          messages: [mockFormattedMessage],
          error: "",
        });

        expect(prismaMock.auctionMessage.findMany).toHaveBeenCalledWith({
          where: {
            auctionId: VALID_AUCTION_ID,
            createdAt: expectedCondition,
          },
          select: {
            id: true,
            message: true,
            createdAt: true,
            sender: {
              select: {
                settings: {
                  select: {
                    username: true,
                  },
                },
                id: true,
                image: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        });
      });

      test("should handle empty messages array", async () => {
        // Arrange
        prismaMock.auctionMessage.findMany.mockResolvedValue(
          [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionMessage.findMany>>,
        );

        // Act
        const result = await getCachedAuctionMessageContents(VALID_AUCTION_ID, false, VALID_AUCTION_END_DATE);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          messages: [],
          error: "",
        });
      });

      test("should handle multiple messages", async () => {
        // Arrange
        const mockMessage2 = createMockPrismaMessage({
          id: "message-2",
          message: "テストメッセージ2",
          createdAt: new Date("2024-01-02T12:00:00Z"),
        });

        const mockFormattedMessage2 = createMockFormattedMessage({
          messageId: "message-2",
          messageContent: "テストメッセージ2",
          createdAt: new Date("2024-01-02T12:00:00Z"),
        });

        prismaMock.auctionMessage.findMany.mockResolvedValue([mockPrismaMessage, mockMessage2] as unknown as Awaited<
          ReturnType<typeof prismaMock.auctionMessage.findMany>
        >);

        // Act
        const result = await getCachedAuctionMessageContents(VALID_AUCTION_ID, false, VALID_AUCTION_END_DATE);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          messages: [mockFormattedMessage, mockFormattedMessage2],
          error: "",
        });
      });

      test.each([
        {
          description: "settings が null の場合",
          senderSettings: null,
          expectedUsername: "未設定",
        },
        {
          description: "username が undefined の場合",
          senderSettings: { username: undefined },
          expectedUsername: "未設定",
        },
      ])("should handle message with $description", async ({ senderSettings, expectedUsername }) => {
        // Arrange
        const mockMessageWithNullUsername = createMockPrismaMessage({
          sender: {
            ...mockPrismaMessage.sender,
            settings: senderSettings,
          },
        });

        const mockFormattedMessageWithDefaultUsername = createMockFormattedMessage({
          person: {
            sender: {
              id: VALID_USER_ID,
              appUserName: expectedUsername,
              image: "https://example.com/user.jpg",
            },
          },
        });

        prismaMock.auctionMessage.findMany.mockResolvedValue([mockMessageWithNullUsername] as unknown as Awaited<
          ReturnType<typeof prismaMock.auctionMessage.findMany>
        >);

        // Act
        const result = await getCachedAuctionMessageContents(VALID_AUCTION_ID, false, VALID_AUCTION_END_DATE);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          messages: [mockFormattedMessageWithDefaultUsername],
          error: "",
        });
      });
    });
  });

  describe("getCachedAuctionSellerInfo", () => {
    describe("正常系", () => {
      test("should return auction seller info successfully", async () => {
        // Arrange
        prismaMock.auction.findUnique.mockResolvedValue(
          mockPrismaAuctionInfo as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );

        // Act
        const result = await getCachedAuctionSellerInfo(VALID_AUCTION_ID);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          auctionPersonInfo: mockFormattedAuctionPersonInfo,
          error: "",
        });

        expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
          where: {
            id: VALID_AUCTION_ID,
          },
          select: {
            task: {
              select: {
                creatorId: true,
                creator: {
                  select: {
                    id: true,
                  },
                },
                reporters: {
                  select: {
                    user: {
                      select: {
                        id: true,
                      },
                    },
                  },
                },
                executors: {
                  select: {
                    user: {
                      select: {
                        id: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });
      });

      test("should handle auction with null task", async () => {
        // Arrange
        const mockAuctionWithNullTask = createMockPrismaAuctionInfo({ task: null });
        prismaMock.auction.findUnique.mockResolvedValue(
          mockAuctionWithNullTask as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );

        // Act
        const result = await getCachedAuctionSellerInfo(VALID_AUCTION_ID);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          auctionPersonInfo: {
            creator: {
              id: undefined,
            },
            reporters: undefined,
            executors: undefined,
          },
          error: "",
        });
      });

      test("should handle auction with empty reporters and executors", async () => {
        // Arrange
        const mockAuctionWithEmptyArrays = createMockPrismaAuctionInfo({
          task: {
            creatorId: VALID_CREATOR_ID,
            creator: {
              id: VALID_CREATOR_ID,
            },
            reporters: [],
            executors: [],
          },
        });
        prismaMock.auction.findUnique.mockResolvedValue(
          mockAuctionWithEmptyArrays as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );

        // Act
        const result = await getCachedAuctionSellerInfo(VALID_AUCTION_ID);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          auctionPersonInfo: {
            creator: {
              id: VALID_CREATOR_ID,
            },
            reporters: [],
            executors: [],
          },
          error: "",
        });
      });

      test("should handle reporters and executors with null user", async () => {
        // Arrange
        const mockAuctionWithNullUsers = createMockPrismaAuctionInfo({
          task: {
            creatorId: VALID_CREATOR_ID,
            creator: {
              id: VALID_CREATOR_ID,
            },
            reporters: [{ user: null }],
            executors: [{ user: null }],
          },
        });
        prismaMock.auction.findUnique.mockResolvedValue(
          mockAuctionWithNullUsers as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );

        // Act
        const result = await getCachedAuctionSellerInfo(VALID_AUCTION_ID);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          auctionPersonInfo: {
            creator: {
              id: VALID_CREATOR_ID,
            },
            reporters: [{ id: null }],
            executors: [{ id: null }],
          },
          error: "",
        });
      });

      test("should handle multiple reporters and executors", async () => {
        // Arrange
        const mockAuctionWithMultipleUsers = createMockPrismaAuctionInfo({
          task: {
            creatorId: VALID_CREATOR_ID,
            creator: {
              id: VALID_CREATOR_ID,
            },
            reporters: [{ user: { id: "reporter-1" } }, { user: { id: "reporter-2" } }],
            executors: [{ user: { id: "executor-1" } }, { user: { id: "executor-2" } }],
          },
        });
        prismaMock.auction.findUnique.mockResolvedValue(
          mockAuctionWithMultipleUsers as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );

        // Act
        const result = await getCachedAuctionSellerInfo(VALID_AUCTION_ID);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          auctionPersonInfo: {
            creator: {
              id: VALID_CREATOR_ID,
            },
            reporters: [{ id: "reporter-1" }, { id: "reporter-2" }],
            executors: [{ id: "executor-1" }, { id: "executor-2" }],
          },
          error: "",
        });
      });
    });

    describe("異常系", () => {
      test.each([
        {
          description: "auctionId が空文字列の場合",
          auctionId: "",
          expectedError: "パラメータが不正です",
        },
        {
          description: "auctionId が null の場合",
          auctionId: null as unknown as string,
          expectedError: "パラメータが不正です",
        },
        {
          description: "auctionId が undefined の場合",
          auctionId: undefined as unknown as string,
          expectedError: "パラメータが不正です",
        },
      ])("should throw error when $description", async ({ auctionId, expectedError }) => {
        // Act & Assert
        await expect(getCachedAuctionSellerInfo(auctionId)).rejects.toThrow(expectedError);
      });

      test("should throw error when auction not found", async () => {
        // Arrange
        prismaMock.auction.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(getCachedAuctionSellerInfo(VALID_AUCTION_ID)).rejects.toThrow("オークションが見つかりません");
      });

      test("should propagate database error", async () => {
        // Arrange
        const mockError = new Error("Database connection error");
        prismaMock.auction.findUnique.mockRejectedValue(mockError);

        // Act & Assert
        await expect(getCachedAuctionSellerInfo(VALID_AUCTION_ID)).rejects.toThrow(mockError);
      });
    });
  });
});
