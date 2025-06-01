import type { AuctionMessage, AuctionPersonInfo } from "@/hooks/auction/bid/use-auction-qa";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { beforeEach, describe, expect, test, vi } from "vitest";

// テスト対象の関数をインポート
import { getCachedAuctionMessageContents, getCachedAuctionSellerInfo } from "./cache-auction-qa";

// Next.jsのキャッシュ機能をモック
vi.mock("next/cache", () => ({
  unstable_cacheLife: vi.fn(),
  unstable_cacheTag: vi.fn(),
}));

// 各テスト前にモックをリセット
beforeEach(() => {
  vi.clearAllMocks();
});

// テストデータの定義
const testAuctionId = "test-auction-id";
const testUserId = "test-user-id";
const testMessageId = "test-message-id";
const testCreatorId = "test-creator-id";
const testReporterId = "test-reporter-id";
const testExecutorId = "test-executor-id";

// 共通のテストデータ
const testAuctionEndDate = new Date("2024-12-31T23:59:59Z");

// Prismaクエリ結果のモックデータ
const mockPrismaMessage = {
  id: testMessageId,
  message: "テストメッセージ",
  createdAt: new Date("2024-01-01T12:00:00Z"),
  sender: {
    id: testUserId,
    image: "https://example.com/user.jpg",
    settings: {
      username: "テストユーザー名",
    },
  },
};

const mockFormattedMessage: AuctionMessage = {
  messageId: testMessageId,
  messageContent: "テストメッセージ",
  createdAt: new Date("2024-01-01T12:00:00Z"),
  person: {
    sender: {
      id: testUserId,
      appUserName: "テストユーザー名",
      image: "https://example.com/user.jpg",
    },
  },
};

// Prismaクエリ結果のモックオークション情報
const mockPrismaAuctionInfo = {
  task: {
    creatorId: testCreatorId,
    creator: {
      id: testCreatorId,
    },
    reporters: [
      {
        user: {
          id: testReporterId,
        },
      },
    ],
    executors: [
      {
        user: {
          id: testExecutorId,
        },
      },
    ],
  },
};

const mockFormattedAuctionPersonInfo: AuctionPersonInfo = {
  creator: {
    id: testCreatorId,
  },
  reporters: [
    {
      id: testReporterId,
    },
  ],
  executors: [
    {
      id: testExecutorId,
    },
  ],
};

describe("cache-auction-qa", () => {
  describe("getCachedAuctionMessageContents", () => {
    test("should return messages successfully when isDisplayAfterEnd is false", async () => {
      // Arrange
      const isDisplayAfterEnd = false;
      prismaMock.auctionMessage.findMany.mockResolvedValue([mockPrismaMessage] as unknown as Awaited<
        ReturnType<typeof prismaMock.auctionMessage.findMany>
      >);

      // Act
      const result = await getCachedAuctionMessageContents(testAuctionId, isDisplayAfterEnd, testAuctionEndDate);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        messages: [mockFormattedMessage],
        error: "",
      });

      expect(prismaMock.auctionMessage.findMany).toHaveBeenCalledWith({
        where: {
          auctionId: testAuctionId,
          createdAt: { lte: new Date(testAuctionEndDate) },
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

    test("should return messages successfully when isDisplayAfterEnd is true", async () => {
      // Arrange
      const isDisplayAfterEnd = true;
      prismaMock.auctionMessage.findMany.mockResolvedValue([mockPrismaMessage] as unknown as Awaited<
        ReturnType<typeof prismaMock.auctionMessage.findMany>
      >);

      // Act
      const result = await getCachedAuctionMessageContents(testAuctionId, isDisplayAfterEnd, testAuctionEndDate);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        messages: [mockFormattedMessage],
        error: "",
      });

      expect(prismaMock.auctionMessage.findMany).toHaveBeenCalledWith({
        where: {
          auctionId: testAuctionId,
          createdAt: { gte: new Date(testAuctionEndDate) },
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
      const isDisplayAfterEnd = false;
      prismaMock.auctionMessage.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.auctionMessage.findMany>>);

      // Act
      const result = await getCachedAuctionMessageContents(testAuctionId, isDisplayAfterEnd, testAuctionEndDate);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        messages: [],
        error: "",
      });
    });

    test("should handle null messages result", async () => {
      // Arrange
      const isDisplayAfterEnd = false;
      prismaMock.auctionMessage.findMany.mockResolvedValue(null as unknown as Awaited<ReturnType<typeof prismaMock.auctionMessage.findMany>>);

      // Act
      const result = await getCachedAuctionMessageContents(testAuctionId, isDisplayAfterEnd, testAuctionEndDate);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        error: "メッセージが見つかりません",
        messages: [],
      });
    });

    test("should handle multiple messages", async () => {
      // Arrange
      const isDisplayAfterEnd = false;
      const mockMessage2 = {
        ...mockPrismaMessage,
        id: "message-2",
        message: "テストメッセージ2",
        createdAt: new Date("2024-01-02T12:00:00Z"),
      };

      const mockFormattedMessage2: AuctionMessage = {
        messageId: "message-2",
        messageContent: "テストメッセージ2",
        createdAt: new Date("2024-01-02T12:00:00Z"),
        person: {
          sender: {
            id: testUserId,
            appUserName: "テストユーザー名",
            image: "https://example.com/user.jpg",
          },
        },
      };

      prismaMock.auctionMessage.findMany.mockResolvedValue([mockPrismaMessage, mockMessage2] as unknown as Awaited<
        ReturnType<typeof prismaMock.auctionMessage.findMany>
      >);

      // Act
      const result = await getCachedAuctionMessageContents(testAuctionId, isDisplayAfterEnd, testAuctionEndDate);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        messages: [mockFormattedMessage, mockFormattedMessage2],
        error: "",
      });
    });

    test("should handle message with null username", async () => {
      // Arrange
      const isDisplayAfterEnd = false;
      const mockMessageWithNullUsername = {
        ...mockPrismaMessage,
        sender: {
          ...mockPrismaMessage.sender,
          settings: null,
        },
      };

      const mockFormattedMessageWithDefaultUsername: AuctionMessage = {
        messageId: testMessageId,
        messageContent: "テストメッセージ",
        createdAt: new Date("2024-01-01T12:00:00Z"),
        person: {
          sender: {
            id: testUserId,
            appUserName: "未設定",
            image: "https://example.com/user.jpg",
          },
        },
      };

      prismaMock.auctionMessage.findMany.mockResolvedValue([mockMessageWithNullUsername] as unknown as Awaited<
        ReturnType<typeof prismaMock.auctionMessage.findMany>
      >);

      // Act
      const result = await getCachedAuctionMessageContents(testAuctionId, isDisplayAfterEnd, testAuctionEndDate);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        messages: [mockFormattedMessageWithDefaultUsername],
        error: "",
      });
    });

    test("should handle message with undefined username", async () => {
      // Arrange
      const isDisplayAfterEnd = false;
      const mockMessageWithUndefinedUsername = {
        ...mockPrismaMessage,
        sender: {
          ...mockPrismaMessage.sender,
          settings: {
            username: undefined,
          },
        },
      };

      const mockFormattedMessageWithDefaultUsername: AuctionMessage = {
        messageId: testMessageId,
        messageContent: "テストメッセージ",
        createdAt: new Date("2024-01-01T12:00:00Z"),
        person: {
          sender: {
            id: testUserId,
            appUserName: "未設定",
            image: "https://example.com/user.jpg",
          },
        },
      };

      prismaMock.auctionMessage.findMany.mockResolvedValue([mockMessageWithUndefinedUsername] as unknown as Awaited<
        ReturnType<typeof prismaMock.auctionMessage.findMany>
      >);

      // Act
      const result = await getCachedAuctionMessageContents(testAuctionId, isDisplayAfterEnd, testAuctionEndDate);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        messages: [mockFormattedMessageWithDefaultUsername],
        error: "",
      });
    });

    test("should propagate database error", async () => {
      // Arrange
      const isDisplayAfterEnd = false;
      const mockError = new Error("Database connection error");
      prismaMock.auctionMessage.findMany.mockRejectedValue(mockError);

      // Act
      const result = await getCachedAuctionMessageContents(testAuctionId, isDisplayAfterEnd, testAuctionEndDate);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        error: "メッセージの取得に失敗しました",
        messages: [],
      });
    });

    test("should handle empty auctionId", async () => {
      // Arrange
      const emptyAuctionId = "";
      const isDisplayAfterEnd = false;
      prismaMock.auctionMessage.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.auctionMessage.findMany>>);

      // Act
      const result = await getCachedAuctionMessageContents(emptyAuctionId, isDisplayAfterEnd, testAuctionEndDate);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        messages: [],
        error: "",
      });

      expect(prismaMock.auctionMessage.findMany).toHaveBeenCalledWith({
        where: {
          auctionId: emptyAuctionId,
          createdAt: { lte: new Date(testAuctionEndDate) },
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

    test("should handle null auctionId", async () => {
      // Arrange
      const nullAuctionId = null as unknown as string;
      const isDisplayAfterEnd = false;
      prismaMock.auctionMessage.findMany.mockRejectedValue(new Error("Invalid auctionId"));

      // Act
      const result = await getCachedAuctionMessageContents(nullAuctionId, isDisplayAfterEnd, testAuctionEndDate);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        error: "メッセージの取得に失敗しました",
        messages: [],
      });
    });

    test("should handle undefined auctionId", async () => {
      // Arrange
      const undefinedAuctionId = undefined as unknown as string;
      const isDisplayAfterEnd = false;
      prismaMock.auctionMessage.findMany.mockRejectedValue(new Error("Invalid auctionId"));

      // Act
      const result = await getCachedAuctionMessageContents(undefinedAuctionId, isDisplayAfterEnd, testAuctionEndDate);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        error: "メッセージの取得に失敗しました",
        messages: [],
      });
    });

    test("should handle invalid date", async () => {
      // Arrange
      const isDisplayAfterEnd = false;
      const invalidDate = new Date("invalid-date");
      prismaMock.auctionMessage.findMany.mockRejectedValue(new Error("Invalid date"));

      // Act
      const result = await getCachedAuctionMessageContents(testAuctionId, isDisplayAfterEnd, invalidDate);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        error: "メッセージの取得に失敗しました",
        messages: [],
      });
    });
  });

  describe("getCachedAuctionSellerInfo", () => {
    test("should return auction seller info successfully", async () => {
      // Arrange
      prismaMock.auction.findUnique.mockResolvedValue(mockPrismaAuctionInfo as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getCachedAuctionSellerInfo(testAuctionId);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        auctionPersonInfo: mockFormattedAuctionPersonInfo,
        error: "",
      });

      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: {
          id: testAuctionId,
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

    test("should handle auction not found", async () => {
      // Arrange
      prismaMock.auction.findUnique.mockResolvedValue(null);

      // Act
      const result = await getCachedAuctionSellerInfo(testAuctionId);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        error: "オークションが見つかりません",
        auctionPersonInfo: null,
      });
    });

    test("should handle auction with null task", async () => {
      // Arrange
      const mockAuctionWithNullTask = {
        task: null,
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockAuctionWithNullTask as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionSellerInfo(testAuctionId);

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
      const mockAuctionWithEmptyArrays = {
        task: {
          creatorId: testCreatorId,
          creator: {
            id: testCreatorId,
          },
          reporters: [],
          executors: [],
        },
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockAuctionWithEmptyArrays as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionSellerInfo(testAuctionId);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        auctionPersonInfo: {
          creator: {
            id: testCreatorId,
          },
          reporters: [],
          executors: [],
        },
        error: "",
      });
    });

    test("should handle reporters and executors with null user", async () => {
      // Arrange
      const mockAuctionWithNullUsers = {
        task: {
          creatorId: testCreatorId,
          creator: {
            id: testCreatorId,
          },
          reporters: [
            {
              user: null,
            },
          ],
          executors: [
            {
              user: null,
            },
          ],
        },
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockAuctionWithNullUsers as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionSellerInfo(testAuctionId);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        auctionPersonInfo: {
          creator: {
            id: testCreatorId,
          },
          reporters: [
            {
              id: null,
            },
          ],
          executors: [
            {
              id: null,
            },
          ],
        },
        error: "",
      });
    });

    test("should handle multiple reporters and executors", async () => {
      // Arrange
      const mockAuctionWithMultipleUsers = {
        task: {
          creatorId: testCreatorId,
          creator: {
            id: testCreatorId,
          },
          reporters: [
            {
              user: {
                id: "reporter-1",
              },
            },
            {
              user: {
                id: "reporter-2",
              },
            },
          ],
          executors: [
            {
              user: {
                id: "executor-1",
              },
            },
            {
              user: {
                id: "executor-2",
              },
            },
          ],
        },
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockAuctionWithMultipleUsers as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionSellerInfo(testAuctionId);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        auctionPersonInfo: {
          creator: {
            id: testCreatorId,
          },
          reporters: [
            {
              id: "reporter-1",
            },
            {
              id: "reporter-2",
            },
          ],
          executors: [
            {
              id: "executor-1",
            },
            {
              id: "executor-2",
            },
          ],
        },
        error: "",
      });
    });

    test("should propagate database error", async () => {
      // Arrange
      const mockError = new Error("Database connection error");
      prismaMock.auction.findUnique.mockRejectedValue(mockError);

      // Act
      const result = await getCachedAuctionSellerInfo(testAuctionId);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        error: "出品者情報の取得に失敗しました",
        auctionPersonInfo: null,
      });
    });

    test("should handle empty auctionId", async () => {
      // Arrange
      const emptyAuctionId = "";
      prismaMock.auction.findUnique.mockResolvedValue(null);

      // Act
      const result = await getCachedAuctionSellerInfo(emptyAuctionId);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        error: "オークションが見つかりません",
        auctionPersonInfo: null,
      });

      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: {
          id: emptyAuctionId,
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

    test("should handle null auctionId", async () => {
      // Arrange
      const nullAuctionId = null as unknown as string;
      prismaMock.auction.findUnique.mockRejectedValue(new Error("Invalid auctionId"));

      // Act
      const result = await getCachedAuctionSellerInfo(nullAuctionId);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        error: "出品者情報の取得に失敗しました",
        auctionPersonInfo: null,
      });
    });

    test("should handle undefined auctionId", async () => {
      // Arrange
      const undefinedAuctionId = undefined as unknown as string;
      prismaMock.auction.findUnique.mockRejectedValue(new Error("Invalid auctionId"));

      // Act
      const result = await getCachedAuctionSellerInfo(undefinedAuctionId);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        error: "出品者情報の取得に失敗しました",
        auctionPersonInfo: null,
      });
    });
  });

  // 境界値テスト
  describe("boundary value tests", () => {
    test("should handle very long auctionId", async () => {
      // Arrange
      const longAuctionId = "a".repeat(1000);
      prismaMock.auctionMessage.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.auctionMessage.findMany>>);

      // Act
      const result = await getCachedAuctionMessageContents(longAuctionId, false, testAuctionEndDate);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        messages: [],
        error: "",
      });
    });

    test("should handle special characters in auctionId", async () => {
      // Arrange
      const specialAuctionId = "!@#$%^&*()_+-=[]{}|;':\",./<>?";
      prismaMock.auction.findUnique.mockResolvedValue(null);

      // Act
      const result = await getCachedAuctionSellerInfo(specialAuctionId);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        error: "オークションが見つかりません",
        auctionPersonInfo: null,
      });
    });

    test("should handle very old date", async () => {
      // Arrange
      const veryOldDate = new Date("1900-01-01T00:00:00Z");
      prismaMock.auctionMessage.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.auctionMessage.findMany>>);

      // Act
      const result = await getCachedAuctionMessageContents(testAuctionId, false, veryOldDate);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        messages: [],
        error: "",
      });
    });

    test("should handle very future date", async () => {
      // Arrange
      const veryFutureDate = new Date("2100-12-31T23:59:59Z");
      prismaMock.auctionMessage.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.auctionMessage.findMany>>);

      // Act
      const result = await getCachedAuctionMessageContents(testAuctionId, true, veryFutureDate);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        messages: [],
        error: "",
      });
    });
  });

  // 異常系テスト（不正な引数）
  describe("invalid input tests", () => {
    test("should handle non-string auctionId in getCachedAuctionMessageContents", async () => {
      // Arrange
      const nonStringAuctionId = 123 as unknown as string;
      prismaMock.auctionMessage.findMany.mockRejectedValue(new Error("AuctionId must be string"));

      // Act
      const result = await getCachedAuctionMessageContents(nonStringAuctionId, false, testAuctionEndDate);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        error: "メッセージの取得に失敗しました",
        messages: [],
      });
    });

    test("should handle non-string auctionId in getCachedAuctionSellerInfo", async () => {
      // Arrange
      const nonStringAuctionId = 123 as unknown as string;
      prismaMock.auction.findUnique.mockRejectedValue(new Error("AuctionId must be string"));

      // Act
      const result = await getCachedAuctionSellerInfo(nonStringAuctionId);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        error: "出品者情報の取得に失敗しました",
        auctionPersonInfo: null,
      });
    });

    test("should handle non-boolean isDisplayAfterEnd", async () => {
      // Arrange
      const nonBooleanFlag = "true" as unknown as boolean;
      prismaMock.auctionMessage.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.auctionMessage.findMany>>);

      // Act
      const result = await getCachedAuctionMessageContents(testAuctionId, nonBooleanFlag, testAuctionEndDate);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        messages: [],
        error: "",
      });
    });

    test("should handle non-date auctionEndDate", async () => {
      // Arrange
      const nonDateEndDate = "2024-12-31" as unknown as Date;
      prismaMock.auctionMessage.findMany.mockRejectedValue(new Error("Invalid date"));

      // Act
      const result = await getCachedAuctionMessageContents(testAuctionId, false, nonDateEndDate);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        error: "メッセージの取得に失敗しました",
        messages: [],
      });
    });
  });
});
