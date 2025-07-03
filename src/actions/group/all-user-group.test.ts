import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getAllUserGroups, getAllUserGroupsCount } from "./all-user-group";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータのファクトリー関数
 */
function createValidGetAllUserGroupsProps(
  overrides: Partial<{
    page: number;
    sortField: string;
    sortDirection: string;
    searchQuery: string;
    isJoined: "isJoined" | "notJoined" | "all";
    itemPerPage: number;
    userId: string;
  }> = {},
) {
  return {
    page: 1,
    sortField: "createdAt",
    sortDirection: "desc",
    searchQuery: "",
    isJoined: "all" as const,
    itemPerPage: 10,
    userId: "test-user-id",
    ...overrides,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 統合されたグループモックデータ作成ヘルパー関数
 */
function createMockGroupsAndSetupPrisma(
  groupData: Array<{
    id: string;
    name: string;
    goal?: string;
    evaluationMethod?: string;
    maxParticipants?: number;
    depositPeriod?: number;
    memberCount?: number;
    isUserJoined?: boolean;
    username?: string;
    userId?: string;
  }>,
) {
  const mockGroups = groupData.map((group) => ({
    id: group.id,
    name: group.name,
    goal: group.goal ?? "テスト目標",
    evaluationMethod: group.evaluationMethod ?? "自動評価",
    maxParticipants: group.maxParticipants ?? 10,
    depositPeriod: group.depositPeriod ?? 30,
    user: {
      id: group.userId ?? group.id,
      settings: group.username
        ? {
            username: group.username,
          }
        : null,
    },
    members: group.isUserJoined ? [{ id: "membership-1" }] : [],
    _count: {
      members: group.memberCount ?? 5,
    },
  }));
  return mockGroups;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("getAllUserGroups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系テスト", () => {
    test("should return all user groups and count successfully", async () => {
      // Arrange
      const props = createValidGetAllUserGroupsProps();
      const groupDataInput = [
        {
          id: "group-1",
          name: "テストグループ1",
          goal: "テスト目標1",
          evaluationMethod: "自動評価",
          maxParticipants: 10,
          depositPeriod: 30,
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
          memberCount: 3,
          isUserJoined: false,
          username: "作成者2",
        },
      ];

      const expectedResult = [
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
      ];

      const mockGroups = createMockGroupsAndSetupPrisma(groupDataInput);
      prismaMock.group.findMany.mockResolvedValue(
        mockGroups as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>,
      );

      // Act
      const result = await getAllUserGroups(props);

      // Assert
      expect(result).toStrictEqual(expectedResult);

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
              id: true,
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
    });

    test.each([
      {
        description: "isJoined filter",
        params: { isJoined: "isJoined" as const },
        expectedWhere: {
          members: {
            some: {
              userId: "test-user-id",
            },
          },
        },
        isUserJoined: true,
      },
      {
        description: "notJoined filter",
        params: { isJoined: "notJoined" as const },
        expectedWhere: {
          members: {
            none: {
              userId: "test-user-id",
            },
          },
        },
        isUserJoined: false,
      },
      {
        description: "all filter",
        params: { isJoined: "all" as const },
        expectedWhere: {},
        isUserJoined: false,
      },
      {
        description: "search query filter",
        params: { searchQuery: "検索テスト" },
        expectedWhere: {
          name: {
            contains: "検索テスト",
          },
        },
        isUserJoined: false,
      },
    ])("should filter groups by $description", async ({ params, expectedWhere, isUserJoined }) => {
      // Arrange
      const props = createValidGetAllUserGroupsProps(params);
      const mockGroups = createMockGroupsAndSetupPrisma([
        {
          id: "group-1",
          name: params.searchQuery ? `${params.searchQuery}グループ` : "テストグループ",
          isUserJoined,
        },
      ]);
      prismaMock.group.findMany.mockResolvedValue(
        mockGroups as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>,
      );

      // Act
      const result = await getAllUserGroups(props);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].isJoined).toBe(isUserJoined);
      expect(prismaMock.group.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expectedWhere,
        }),
      );
    });

    test.each([
      {
        description: "currentParticipants field asc",
        sortField: "currentParticipants",
        sortDirection: "asc",
        expectedOrderBy: {
          members: {
            _count: "asc",
          },
        },
      },
      {
        description: "currentParticipants field desc",
        sortField: "currentParticipants",
        sortDirection: "desc",
        expectedOrderBy: {
          members: {
            _count: "desc",
          },
        },
      },
      {
        description: "other field desc",
        sortField: "name",
        sortDirection: "desc",
        expectedOrderBy: {
          name: "desc",
        },
      },
      {
        description: "other field asc",
        sortField: "name",
        sortDirection: "asc",
        expectedOrderBy: {
          name: "asc",
        },
      },
    ])("should sort groups by $description", async ({ sortField, sortDirection, expectedOrderBy }) => {
      // Arrange
      const props = createValidGetAllUserGroupsProps({
        sortField,
        sortDirection,
      });
      const mockGroups = createMockGroupsAndSetupPrisma([{ id: "group-1", name: "グループ1" }]);
      prismaMock.group.findMany.mockResolvedValue(
        mockGroups as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>,
      );

      // Act
      await getAllUserGroups(props);

      // Assert
      expect(prismaMock.group.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expectedOrderBy,
        }),
      );
    });

    test("should handle pagination correctly", async () => {
      // Arrange
      const props = createValidGetAllUserGroupsProps({
        page: 2,
        itemPerPage: 5,
      });
      const mockGroups = createMockGroupsAndSetupPrisma([{ id: "group-6", name: "グループ6" }]);
      prismaMock.group.findMany.mockResolvedValue(
        mockGroups as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>,
      );

      // Act
      await getAllUserGroups(props);

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
      const props = createValidGetAllUserGroupsProps();
      const mockGroups = [
        {
          id: "group-1",
          name: "テストグループ",
          goal: "テスト目標",
          evaluationMethod: "自動評価",
          maxParticipants: 10,
          depositPeriod: 30,
          user: {
            id: "user-1",
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

      // Act
      const result = await getAllUserGroups(props);

      // Assert
      expect(result[0].createdBy).toBe("未設定_user-1");
    });

    test("should handle combined filters", async () => {
      // Arrange
      const props = createValidGetAllUserGroupsProps({
        isJoined: "isJoined",
        searchQuery: "テスト",
      });
      const mockGroups = createMockGroupsAndSetupPrisma([]);
      prismaMock.group.findMany.mockResolvedValue(
        mockGroups as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>,
      );

      // Act
      await getAllUserGroups(props);

      // Assert
      const expectedWhere = {
        members: {
          some: {
            userId: "test-user-id",
          },
        },
        name: {
          contains: "テスト",
        },
      };
      expect(prismaMock.group.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expectedWhere,
        }),
      );
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系テスト", () => {
    test.each([
      { description: "missing userId", params: createValidGetAllUserGroupsProps({ userId: "" }) },
      { description: "missing sortField", params: createValidGetAllUserGroupsProps({ sortField: "" }) },
      { description: "missing sortDirection", params: createValidGetAllUserGroupsProps({ sortDirection: "" }) },
      { description: "missing page", params: createValidGetAllUserGroupsProps({ page: 0 }) },
      { description: "missing itemPerPage", params: createValidGetAllUserGroupsProps({ itemPerPage: 0 }) },
      {
        description: "missing isJoined",
        params: createValidGetAllUserGroupsProps({ isJoined: "" as unknown as "all" }),
      },
    ])("should throw error with $description", async ({ params }) => {
      // Act & Assert
      await expect(getAllUserGroups(params)).rejects.toThrow("Invalid parameters");
    });

    test("should throw error when database query fails", async () => {
      // Arrange
      const props = createValidGetAllUserGroupsProps();
      prismaMock.group.findMany.mockRejectedValue(new Error("Database error"));

      // Act & Assert
      await expect(getAllUserGroups(props)).rejects.toThrow("Database error");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle empty search query", async () => {
      // Arrange
      const props = createValidGetAllUserGroupsProps({
        searchQuery: "",
      });
      const mockGroups = createMockGroupsAndSetupPrisma([]);
      prismaMock.group.findMany.mockResolvedValue(
        mockGroups as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>,
      );

      // Act
      const result = await getAllUserGroups(props);

      // Assert
      expect(result).toHaveLength(0);
    });
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("getAllUserGroupsCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系テスト", () => {
    test.each([
      {
        description: "all groups",
        params: { searchQuery: "", isJoined: "all" as const, userId: "test-user-id" },
        expectedCount: 5,
        expectedWhere: {},
      },
      {
        description: "joined groups",
        params: { searchQuery: "", isJoined: "isJoined" as const, userId: "test-user-id" },
        expectedCount: 3,
        expectedWhere: {
          members: {
            some: {
              userId: "test-user-id",
            },
          },
        },
      },
      {
        description: "not joined groups",
        params: { searchQuery: "", isJoined: "notJoined" as const, userId: "test-user-id" },
        expectedCount: 2,
        expectedWhere: {
          members: {
            none: {
              userId: "test-user-id",
            },
          },
        },
      },
      {
        description: "groups with search query",
        params: { searchQuery: "テスト", isJoined: "all" as const, userId: "test-user-id" },
        expectedCount: 1,
        expectedWhere: {
          name: {
            contains: "テスト",
          },
        },
      },
    ])("should return correct count for $description", async ({ params, expectedCount, expectedWhere }) => {
      // Arrange
      prismaMock.group.count.mockResolvedValue(expectedCount);

      // Act
      const result = await getAllUserGroupsCount(params.searchQuery, params.isJoined, params.userId);

      // Assert
      expect(result).toBe(expectedCount);
      expect(prismaMock.group.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });
    });
  });

  describe("異常系テスト", () => {
    test.each([
      { description: "missing userId", params: { searchQuery: "", isJoined: "all" as const, userId: "" } },
      {
        description: "missing isJoined",
        params: { searchQuery: "", isJoined: "" as unknown as "all", userId: "test-user-id" },
      },
      {
        description: "invalid isJoined",
        params: { searchQuery: "", isJoined: "invalid" as unknown as "all", userId: "test-user-id" },
      },
    ])("should throw error with $description", async ({ params }) => {
      // Act & Assert
      await expect(getAllUserGroupsCount(params.searchQuery, params.isJoined, params.userId)).rejects.toThrow(
        "Invalid parameters",
      );
    });

    test("should throw error when database query fails", async () => {
      // Arrange
      prismaMock.group.count.mockRejectedValue(new Error("Database error"));

      // Act & Assert
      await expect(getAllUserGroupsCount("", "all", "test-user-id")).rejects.toThrow("Database error");
    });
  });

  describe("境界値テスト", () => {
    test("should return 0 when no groups found", async () => {
      // Arrange
      const searchQuery = "存在しないグループ";
      prismaMock.group.count.mockResolvedValue(0);

      // Act
      const result = await getAllUserGroupsCount(searchQuery, "all", "test-user-id");

      // Assert
      expect(result).toBe(0);
      expect(prismaMock.group.count).toHaveBeenCalledWith({
        where: {
          name: {
            contains: searchQuery,
          },
        },
      });
    });
  });
});
