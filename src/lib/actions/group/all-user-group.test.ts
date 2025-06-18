// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// モック関数のインポート
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getAllUserGroupsAndCount, getAllUserGroupsCount } from "./all-user-group";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// 外部依存のモック
vi.mock("@/lib/utils", () => ({
  getAuthenticatedSessionUserId: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// モック関数の型定義
const mockGetAuthenticatedSessionUserId = vi.mocked(getAuthenticatedSessionUserId);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// テストデータのファクトリー関数
function createValidGetAllUserGroupsAndCountProps(
  overrides: Partial<{
    page: number;
    sortField: string;
    sortDirection: string;
    searchQuery: string;
    isJoined: "isJoined" | "notJoined" | "all";
    itemPerPage: number;
  }> = {},
) {
  return {
    page: 1,
    sortField: "createdAt",
    sortDirection: "desc",
    searchQuery: "",
    isJoined: "all" as const,
    itemPerPage: 10,
    ...overrides,
  };
}

// グループのモックデータを作成するヘルパー関数
function createGroupMockData(
  groupData: Array<{
    id: string;
    name: string;
    goal: string;
    evaluationMethod: string;
    maxParticipants: number;
    depositPeriod: number;
    createdBy: string;
    memberCount: number;
    isUserJoined: boolean;
    username?: string;
  }>,
) {
  return groupData.map((group) => ({
    id: group.id,
    name: group.name,
    goal: group.goal,
    evaluationMethod: group.evaluationMethod,
    maxParticipants: group.maxParticipants,
    depositPeriod: group.depositPeriod,
    user: {
      settings: {
        username: group.username ?? "テストユーザー",
      },
    },
    members: group.isUserJoined ? [{ id: "membership-1" }] : [],
    _count: {
      members: group.memberCount,
    },
  }));
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("getAllUserGroupsAndCount", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();

    // 認証ユーザーIDのモック設定
    mockGetAuthenticatedSessionUserId.mockResolvedValue("test-user-id");
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系テスト", () => {
    test("should return all user groups and count successfully", async () => {
      // Arrange
      const props = createValidGetAllUserGroupsAndCountProps();

      const mockGroups = createGroupMockData([
        {
          id: "group-1",
          name: "テストグループ1",
          goal: "テスト目標1",
          evaluationMethod: "自動評価",
          maxParticipants: 10,
          depositPeriod: 30,
          createdBy: "user-1",
          memberCount: 5,
          isUserJoined: true,
          username: "作成者1",
        },
        {
          id: "group-2",
          name: "テストグループ2",
          goal: "テスト目標2",
          evaluationMethod: "手動評価",
          maxParticipants: 20,
          depositPeriod: 60,
          createdBy: "user-2",
          memberCount: 3,
          isUserJoined: false,
          username: "作成者2",
        },
      ]);

      prismaMock.group.findMany.mockResolvedValue(
        mockGroups as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>,
      );
      prismaMock.group.count.mockResolvedValue(2);

      // Act
      const result = await getAllUserGroupsAndCount(props);

      // Assert
      expect(result).toStrictEqual({
        AllUserGroupList: [
          {
            id: "group-1",
            name: "テストグループ1",
            goal: "テスト目標1",
            evaluationMethod: "自動評価",
            maxParticipants: 10,
            depositPeriod: 30,
            createdBy: "作成者1",
            joinMembersCount: 5,
            isJoined: true,
          },
          {
            id: "group-2",
            name: "テストグループ2",
            goal: "テスト目標2",
            evaluationMethod: "手動評価",
            maxParticipants: 20,
            depositPeriod: 60,
            createdBy: "作成者2",
            joinMembersCount: 3,
            isJoined: false,
          },
        ],
        AllUserGroupTotalCount: 2,
      });

      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledTimes(1); // getAllUserGroupsAndCount で1回呼ばれる
      expect(prismaMock.group.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        select: {
          id: true,
          name: true,
          goal: true,
          evaluationMethod: true,
          maxParticipants: true,
          depositPeriod: true,
          user: {
            select: {
              settings: {
                select: {
                  username: true,
                },
              },
            },
          },
          members: {
            where: {
              userId: "test-user-id",
            },
            select: {
              id: true,
            },
          },
          _count: {
            select: {
              members: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        where: {},
      });
      expect(prismaMock.group.count).toHaveBeenCalledWith({
        where: {},
      });
    });

    test("should filter groups by isJoined parameter", async () => {
      // Arrange
      const props = createValidGetAllUserGroupsAndCountProps({
        isJoined: "isJoined",
      });

      const mockGroups = createGroupMockData([
        {
          id: "group-1",
          name: "参加済みグループ",
          goal: "テスト目標",
          evaluationMethod: "自動評価",
          maxParticipants: 10,
          depositPeriod: 30,
          createdBy: "user-1",
          memberCount: 5,
          isUserJoined: true,
        },
      ]);

      prismaMock.group.findMany.mockResolvedValue(
        mockGroups as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>,
      );
      prismaMock.group.count.mockResolvedValue(1);

      // Act
      const result = await getAllUserGroupsAndCount(props);

      // Assert
      expect(result.AllUserGroupList).toHaveLength(1);
      expect(result.AllUserGroupList[0].isJoined).toBe(true);

      expect(prismaMock.group.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            members: {
              some: {
                userId: "test-user-id",
              },
            },
          },
        }),
      );
      expect(prismaMock.group.count).toHaveBeenCalledWith({
        where: {
          members: {
            some: {
              userId: "test-user-id",
            },
          },
        },
      });
    });

    test("should filter groups by notJoined parameter", async () => {
      // Arrange
      const props = createValidGetAllUserGroupsAndCountProps({
        isJoined: "notJoined",
      });

      const mockGroups = createGroupMockData([
        {
          id: "group-1",
          name: "未参加グループ",
          goal: "テスト目標",
          evaluationMethod: "自動評価",
          maxParticipants: 10,
          depositPeriod: 30,
          createdBy: "user-1",
          memberCount: 5,
          isUserJoined: false,
        },
      ]);

      prismaMock.group.findMany.mockResolvedValue(
        mockGroups as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>,
      );
      prismaMock.group.count.mockResolvedValue(1);

      // Act
      const result = await getAllUserGroupsAndCount(props);

      // Assert
      expect(result.AllUserGroupList).toHaveLength(1);
      expect(result.AllUserGroupList[0].isJoined).toBe(false);

      expect(prismaMock.group.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            members: {
              none: {
                userId: "test-user-id",
              },
            },
          },
        }),
      );
    });

    test("should filter groups by search query", async () => {
      // Arrange
      const props = createValidGetAllUserGroupsAndCountProps({
        searchQuery: "検索テスト",
      });

      const mockGroups = createGroupMockData([
        {
          id: "group-1",
          name: "検索テストグループ",
          goal: "テスト目標",
          evaluationMethod: "自動評価",
          maxParticipants: 10,
          depositPeriod: 30,
          createdBy: "user-1",
          memberCount: 5,
          isUserJoined: false,
        },
      ]);

      prismaMock.group.findMany.mockResolvedValue(
        mockGroups as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>,
      );
      prismaMock.group.count.mockResolvedValue(1);

      // Act
      const result = await getAllUserGroupsAndCount(props);

      // Assert
      expect(result.AllUserGroupList).toHaveLength(1);
      expect(result.AllUserGroupList[0].name).toContain("検索テスト");

      expect(prismaMock.group.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            name: {
              contains: "検索テスト",
            },
          },
        }),
      );
    });

    test("should sort groups by currentParticipants", async () => {
      // Arrange
      const props = createValidGetAllUserGroupsAndCountProps({
        sortField: "currentParticipants",
        sortDirection: "asc",
      });

      const mockGroups = createGroupMockData([
        {
          id: "group-1",
          name: "グループ1",
          goal: "テスト目標",
          evaluationMethod: "自動評価",
          maxParticipants: 10,
          depositPeriod: 30,
          createdBy: "user-1",
          memberCount: 3,
          isUserJoined: false,
        },
      ]);

      prismaMock.group.findMany.mockResolvedValue(
        mockGroups as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>,
      );
      prismaMock.group.count.mockResolvedValue(1);

      // Act
      await getAllUserGroupsAndCount(props);

      // Assert
      expect(prismaMock.group.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            members: {
              _count: "asc",
            },
          },
        }),
      );
    });

    test("should handle pagination correctly", async () => {
      // Arrange
      const props = createValidGetAllUserGroupsAndCountProps({
        page: 2,
        itemPerPage: 5,
      });

      const mockGroups = createGroupMockData([
        {
          id: "group-6",
          name: "グループ6",
          goal: "テスト目標",
          evaluationMethod: "自動評価",
          maxParticipants: 10,
          depositPeriod: 30,
          createdBy: "user-1",
          memberCount: 3,
          isUserJoined: false,
        },
      ]);

      prismaMock.group.findMany.mockResolvedValue(
        mockGroups as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>,
      );
      prismaMock.group.count.mockResolvedValue(10);

      // Act
      await getAllUserGroupsAndCount(props);

      // Assert
      expect(prismaMock.group.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5, // (page - 1) * itemPerPage = (2 - 1) * 5 = 5
          take: 5,
        }),
      );
    });

    test("should handle groups with null username", async () => {
      // Arrange
      const props = createValidGetAllUserGroupsAndCountProps();

      const mockGroups = [
        {
          id: "group-1",
          name: "テストグループ",
          goal: "テスト目標",
          evaluationMethod: "自動評価",
          maxParticipants: 10,
          depositPeriod: 30,
          user: {
            settings: null, // usernameがnullの場合
          },
          members: [],
          _count: {
            members: 5,
          },
        },
      ];

      prismaMock.group.findMany.mockResolvedValue(
        mockGroups as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>,
      );
      prismaMock.group.count.mockResolvedValue(1);

      // Act
      const result = await getAllUserGroupsAndCount(props);

      // Assert
      expect(result.AllUserGroupList[0].createdBy).toBe("未設定");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系テスト", () => {
    test("should throw error when authentication fails", async () => {
      // Arrange
      const props = createValidGetAllUserGroupsAndCountProps();
      mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("Authentication failed"));

      // Act & Assert
      await expect(getAllUserGroupsAndCount(props)).rejects.toThrow("Authentication failed");
    });

    test("should throw error when database query fails", async () => {
      // Arrange
      const props = createValidGetAllUserGroupsAndCountProps();
      prismaMock.group.findMany.mockRejectedValue(new Error("Database error"));

      // Act & Assert
      await expect(getAllUserGroupsAndCount(props)).rejects.toThrow("Database error");
    });

    test("should throw error when count query fails", async () => {
      // Arrange
      const props = createValidGetAllUserGroupsAndCountProps();
      const mockGroups = createGroupMockData([]);
      prismaMock.group.findMany.mockResolvedValue(
        mockGroups as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>,
      );
      prismaMock.group.count.mockRejectedValue(new Error("Count query failed"));

      // Act & Assert
      await expect(getAllUserGroupsAndCount(props)).rejects.toThrow("Count query failed");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle empty search query", async () => {
      // Arrange
      const props = createValidGetAllUserGroupsAndCountProps({
        searchQuery: "",
      });

      const mockGroups = createGroupMockData([]);
      prismaMock.group.findMany.mockResolvedValue(
        mockGroups as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>,
      );
      prismaMock.group.count.mockResolvedValue(0);

      // Act
      const result = await getAllUserGroupsAndCount(props);

      // Assert
      expect(result.AllUserGroupList).toHaveLength(0);
      expect(result.AllUserGroupTotalCount).toBe(0);
    });

    test("should handle page 0", async () => {
      // Arrange
      const props = createValidGetAllUserGroupsAndCountProps({
        page: 0,
      });

      const mockGroups = createGroupMockData([]);
      prismaMock.group.findMany.mockResolvedValue(
        mockGroups as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>,
      );
      prismaMock.group.count.mockResolvedValue(0);

      // Act
      await getAllUserGroupsAndCount(props);

      // Assert
      expect(prismaMock.group.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: -10, // (0 - 1) * 10 = -10
        }),
      );
    });

    test("should handle very large itemPerPage", async () => {
      // Arrange
      const props = createValidGetAllUserGroupsAndCountProps({
        itemPerPage: 1000,
      });

      const mockGroups = createGroupMockData([]);
      prismaMock.group.findMany.mockResolvedValue(
        mockGroups as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>,
      );
      prismaMock.group.count.mockResolvedValue(0);

      // Act
      await getAllUserGroupsAndCount(props);

      // Assert
      expect(prismaMock.group.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1000,
        }),
      );
    });

    test("should handle very long search query", async () => {
      // Arrange
      const longSearchQuery = "a".repeat(1000);
      const props = createValidGetAllUserGroupsAndCountProps({
        searchQuery: longSearchQuery,
      });

      const mockGroups = createGroupMockData([]);
      prismaMock.group.findMany.mockResolvedValue(
        mockGroups as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>,
      );
      prismaMock.group.count.mockResolvedValue(0);

      // Act
      await getAllUserGroupsAndCount(props);

      // Assert
      expect(prismaMock.group.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            name: {
              contains: longSearchQuery,
            },
          },
        }),
      );
    });

    test("should handle invalid sort field", async () => {
      // Arrange
      const props = createValidGetAllUserGroupsAndCountProps({
        sortField: "invalidField",
        sortDirection: "asc",
      });

      const mockGroups = createGroupMockData([]);
      prismaMock.group.findMany.mockResolvedValue(
        mockGroups as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>,
      );
      prismaMock.group.count.mockResolvedValue(0);

      // Act
      await getAllUserGroupsAndCount(props);

      // Assert
      expect(prismaMock.group.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            invalidField: "asc",
          },
        }),
      );
    });

    test("should handle combined filters", async () => {
      // Arrange
      const props = createValidGetAllUserGroupsAndCountProps({
        isJoined: "isJoined",
        searchQuery: "テスト",
      });

      const mockGroups = createGroupMockData([]);
      prismaMock.group.findMany.mockResolvedValue(
        mockGroups as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>,
      );
      prismaMock.group.count.mockResolvedValue(0);

      // Act
      await getAllUserGroupsAndCount(props);

      // Assert
      expect(prismaMock.group.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            members: {
              some: {
                userId: "test-user-id",
              },
            },
            name: {
              contains: "テスト",
            },
          },
        }),
      );
      expect(prismaMock.group.count).toHaveBeenCalledWith({
        where: {
          members: {
            some: {
              userId: "test-user-id",
            },
          },
          name: {
            contains: "テスト",
          },
        },
      });
    });
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("getAllUserGroupsCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系テスト", () => {
    test("should return correct count for all groups", async () => {
      // Arrange
      const searchQuery = "";
      const isJoined = "all";
      const userId = "test-user-id";

      prismaMock.group.count.mockResolvedValue(5);

      // Act
      const result = await getAllUserGroupsCount(searchQuery, isJoined, userId);

      // Assert
      expect(result).toBe(5);
      expect(prismaMock.group.count).toHaveBeenCalledWith({
        where: {},
      });
    });

    test("should return correct count for joined groups", async () => {
      // Arrange
      const searchQuery = "";
      const isJoined = "isJoined";
      const userId = "test-user-id";

      prismaMock.group.count.mockResolvedValue(3);

      // Act
      const result = await getAllUserGroupsCount(searchQuery, isJoined, userId);

      // Assert
      expect(result).toBe(3);
      expect(prismaMock.group.count).toHaveBeenCalledWith({
        where: {
          members: {
            some: {
              userId: "test-user-id",
            },
          },
        },
      });
    });

    test("should return correct count for not joined groups", async () => {
      // Arrange
      const searchQuery = "";
      const isJoined = "notJoined";
      const userId = "test-user-id";

      prismaMock.group.count.mockResolvedValue(2);

      // Act
      const result = await getAllUserGroupsCount(searchQuery, isJoined, userId);

      // Assert
      expect(result).toBe(2);
      expect(prismaMock.group.count).toHaveBeenCalledWith({
        where: {
          members: {
            none: {
              userId: "test-user-id",
            },
          },
        },
      });
    });

    test("should return correct count with search query", async () => {
      // Arrange
      const searchQuery = "テスト";
      const isJoined = "all";
      const userId = "test-user-id";

      prismaMock.group.count.mockResolvedValue(1);

      // Act
      const result = await getAllUserGroupsCount(searchQuery, isJoined, userId);

      // Assert
      expect(result).toBe(1);
      expect(prismaMock.group.count).toHaveBeenCalledWith({
        where: {
          name: {
            contains: "テスト",
          },
        },
      });
    });
  });

  describe("異常系テスト", () => {
    test("should throw error when database query fails", async () => {
      // Arrange
      const searchQuery = "";
      const isJoined = "all";
      const userId = "test-user-id";

      prismaMock.group.count.mockRejectedValue(new Error("Database error"));

      // Act & Assert
      await expect(getAllUserGroupsCount(searchQuery, isJoined, userId)).rejects.toThrow("Database error");
    });
  });

  describe("境界値テスト", () => {
    test("should handle empty userId", async () => {
      // Arrange
      const searchQuery = "";
      const isJoined = "isJoined";
      const userId = "";

      prismaMock.group.count.mockResolvedValue(0);

      // Act
      const result = await getAllUserGroupsCount(searchQuery, isJoined, userId);

      // Assert
      expect(result).toBe(0);
      expect(prismaMock.group.count).toHaveBeenCalledWith({
        where: {
          members: {
            some: {
              userId: "",
            },
          },
        },
      });
    });

    test("should handle very long search query", async () => {
      // Arrange
      const longSearchQuery = "a".repeat(1000);
      const isJoined = "all";
      const userId = "test-user-id";

      prismaMock.group.count.mockResolvedValue(0);

      // Act
      const result = await getAllUserGroupsCount(longSearchQuery, isJoined, userId);

      // Assert
      expect(result).toBe(0);
      expect(prismaMock.group.count).toHaveBeenCalledWith({
        where: {
          name: {
            contains: longSearchQuery,
          },
        },
      });
    });

    test("should return 0 when no groups found", async () => {
      // Arrange
      const searchQuery = "存在しないグループ";
      const isJoined = "all";
      const userId = "test-user-id";

      prismaMock.group.count.mockResolvedValue(0);

      // Act
      const result = await getAllUserGroupsCount(searchQuery, isJoined, userId);

      // Assert
      expect(result).toBe(0);
    });
  });
});
