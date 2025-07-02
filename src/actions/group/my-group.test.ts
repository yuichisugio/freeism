import { revalidatePath } from "next/cache";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import {
  groupFactory,
  groupMembershipFactory,
  groupPointFactory,
  userFactory,
} from "@/test/test-utils/test-utils-prisma-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getUserJoinGroup, getUserJoinGroupCount, leaveGroup } from "./my-group";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */
vi.mock("@/actions/permission/permission", () => ({
  checkGroupMembership: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数の型定義
 */
const mockCheckGroupMembership = vi.mocked((await import("@/actions/permission/permission")).checkGroupMembership);
const mockRevalidatePath = vi.mocked(revalidatePath);

/**
 * 型定義
 */
type GroupPointMockData = {
  group: {
    id: string;
    name: string;
    goal: string;
    evaluationMethod: string;
    depositPeriod: number;
    members: { isGroupOwner: boolean }[];
  };
  balance: number;
  fixedTotalPoints: number;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("my-group.ts", () => {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テストデータ
   */
  const testUser = userFactory.build({ id: "user-1" });
  const testGroup1 = groupFactory.build({ id: "group-1", name: "テストグループ1" });

  const testGroupMembership1 = groupMembershipFactory.build({
    id: "membership-1",
    userId: testUser.id,
    groupId: testGroup1.id,
    isGroupOwner: true,
  });

  const testGroupPoint1 = groupPointFactory.build({
    userId: testUser.id,
    groupId: testGroup1.id,
    balance: 100,
    fixedTotalPoints: 500,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データベースエラーを発生させるヘルパー関数
   */
  const setupDatabaseError = (method: "findMany" | "count" | "delete", errorMessage = "Database error") => {
    if (method === "findMany") {
      prismaMock.groupPoint.findMany.mockRejectedValue(new Error(errorMessage));
    } else if (method === "count") {
      prismaMock.group.count.mockRejectedValue(new Error(errorMessage));
    } else if (method === "delete") {
      prismaMock.groupMembership.delete.mockRejectedValue(new Error(errorMessage));
    }
  };

  /**
   * グループポイントのモックデータを生成するヘルパー関数
   */
  const createGroupPointMockData = (
    groupData: typeof testGroup1,
    pointData: typeof testGroupPoint1,
    isGroupOwner = false,
  ): GroupPointMockData => ({
    group: {
      id: groupData.id,
      name: groupData.name,
      goal: groupData.goal,
      evaluationMethod: groupData.evaluationMethod,
      depositPeriod: groupData.depositPeriod,
      members: [{ isGroupOwner }],
    },
    balance: pointData.balance,
    fixedTotalPoints: pointData.fixedTotalPoints,
  });

  /**
   * 期待される結果データを生成するヘルパー関数
   */
  const createExpectedGroupData = (
    groupData: typeof testGroup1,
    pointData: typeof testGroupPoint1,
    isGroupOwner = false,
  ) => ({
    id: groupData.id,
    groupName: groupData.name,
    groupGoal: groupData.goal,
    groupEvaluationMethod: groupData.evaluationMethod,
    groupDepositPeriod: groupData.depositPeriod,
    groupPointBalance: pointData.balance,
    groupPointFixedTotalPoints: pointData.fixedTotalPoints,
    isGroupOwner,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getUserJoinGroup", () => {
    describe("正常系", () => {
      test("should return formatted group list", async () => {
        // Arrange
        const mockData = [createGroupPointMockData(testGroup1, testGroupPoint1, true)];
        const expectedResult = [createExpectedGroupData(testGroup1, testGroupPoint1, true)];

        prismaMock.groupPoint.findMany.mockResolvedValue(
          mockData as unknown as Awaited<ReturnType<typeof prismaMock.groupPoint.findMany>>,
        );

        // Act
        const result = await getUserJoinGroup({
          page: 1,
          sortField: "name",
          sortDirection: "asc",
          searchQuery: "search",
          userId: testUser.id,
          itemPerPage: 10,
        });

        // Assert
        expect(result).toStrictEqual(expectedResult);
      });

      test.each([
        { sortField: "groupPointBalance", sortDirection: "asc" },
        { sortField: "groupPointBalance", sortDirection: "desc" },
        { sortField: "groupPointFixedTotalPoints", sortDirection: "asc" },
        { sortField: "groupPointFixedTotalPoints", sortDirection: "desc" },
        { sortField: "groupDepositPeriod", sortDirection: "asc" },
        { sortField: "groupDepositPeriod", sortDirection: "desc" },
      ])("should return formatted group list %s", async ({ sortField, sortDirection }) => {
        // Arrange
        const mockData = [createGroupPointMockData(testGroup1, testGroupPoint1, true)];
        const expectedResult = [createExpectedGroupData(testGroup1, testGroupPoint1, true)];

        prismaMock.groupPoint.findMany.mockResolvedValue(
          mockData as unknown as Awaited<ReturnType<typeof prismaMock.groupPoint.findMany>>,
        );

        // Act
        const result = await getUserJoinGroup({
          page: 1,
          sortField,
          sortDirection,
          searchQuery: "search",
          userId: testUser.id,
          itemPerPage: 10,
        });

        // 期待されるorderBy構造を動的に生成
        let expectedOrderBy: Record<string, unknown>;
        if (sortField === "groupPointBalance") {
          expectedOrderBy = { balance: sortDirection };
        } else if (sortField === "groupPointFixedTotalPoints") {
          expectedOrderBy = { fixedTotalPoints: sortDirection };
        } else if (sortField === "groupDepositPeriod") {
          expectedOrderBy = { group: { depositPeriod: sortDirection } };
        } else {
          expectedOrderBy = { group: { [sortField]: sortDirection } };
        }

        // Assert
        expect(result).toStrictEqual(expectedResult);
        expect(prismaMock.groupPoint.findMany).toHaveBeenCalledWith({
          skip: 0,
          take: 10,
          orderBy: expectedOrderBy,
          where: {
            group: {
              name: { contains: "search" },
            },
          },
          select: {
            group: {
              select: {
                id: true,
                name: true,
                goal: true,
                evaluationMethod: true,
                depositPeriod: true,
                members: {
                  select: {
                    isGroupOwner: true,
                  },
                  where: {
                    userId: testUser.id,
                  },
                },
              },
            },
            balance: true,
            fixedTotalPoints: true,
          },
        });
      });
    });

    describe("異常系", () => {
      test("should handle database error", async () => {
        setupDatabaseError("findMany");
        await expect(
          getUserJoinGroup({
            page: 1,
            sortField: "name",
            sortDirection: "asc",
            searchQuery: "search",
            userId: testUser.id,
            itemPerPage: 10,
          }),
        ).rejects.toThrow("Database error");
      });

      test.each([
        ["userId", ""],
        ["userId", undefined],
        ["userId", null],
        ["page", null],
        ["page", undefined],
        ["page", 0],
        ["page", -1],
        ["sortField", undefined],
        ["sortField", null],
        ["sortField", ""],
        ["sortDirection", undefined],
        ["sortDirection", null],
        ["sortDirection", "invalid"],
        ["itemPerPage", null],
        ["itemPerPage", 0],
        ["itemPerPage", -1],
      ])("should throw error when %s is invalid", async (paramName, paramValue) => {
        const params = {
          page: 1,
          sortField: "name",
          sortDirection: "asc",
          searchQuery: "search",
          userId: testUser.id,
          itemPerPage: 10,
        };

        if (paramName === "userId") {
          params.userId = paramValue as string;
        } else {
          (params as Record<string, unknown>)[paramName] = paramValue;
        }

        await expect(
          getUserJoinGroup({
            page: params.page,
            sortField: params.sortField,
            sortDirection: params.sortDirection,
            searchQuery: params.searchQuery,
            userId: params.userId,
            itemPerPage: params.itemPerPage,
          }),
        ).rejects.toThrow("Invalid parameters");
      });
    });
  });

  describe("getUserJoinGroupCount", () => {
    describe("正常系", () => {
      test.each([
        ["without search query", null, { members: { some: { userId: testUser.id } } }],
        ["with search query", "テスト", { members: { some: { userId: testUser.id } }, name: { contains: "テスト" } }],
        ["with empty string search query", "", { members: { some: { userId: testUser.id } } }],
      ])("should return group count %s", async (_, searchQuery, expectedWhere) => {
        // Arrange
        const expectedCount = searchQuery === "テスト" ? 2 : searchQuery === null ? 5 : 3;
        prismaMock.group.count.mockResolvedValue(expectedCount);

        // Act
        const result = await getUserJoinGroupCount(searchQuery, testUser.id);

        // Assert
        expect(result).toBe(expectedCount);
        expect(prismaMock.group.count).toHaveBeenCalledWith({ where: expectedWhere });
      });
    });

    describe("異常系", () => {
      test("should handle database error", async () => {
        setupDatabaseError("count");
        await expect(getUserJoinGroupCount("search", testUser.id)).rejects.toThrow("Database error");
      });

      test("should throw error when userId is empty", async () => {
        await expect(getUserJoinGroupCount("search", "")).rejects.toThrow("ユーザーIDがありません");
      });
    });
  });

  describe("leaveGroup", () => {
    const groupId = "group-1";

    describe("正常系", () => {
      test("should leave group successfully", async () => {
        // Arrange
        mockCheckGroupMembership.mockResolvedValue(testGroupMembership1);
        prismaMock.groupMembership.delete.mockResolvedValue(testGroupMembership1);

        // Act
        const result = await leaveGroup(groupId, testUser.id);

        // Assert
        expect(result).toStrictEqual({ success: true, message: "グループから脱退しました" });
        expect(mockCheckGroupMembership).toHaveBeenCalledWith(testUser.id, groupId);
        expect(prismaMock.groupMembership.delete).toHaveBeenCalledWith({
          where: { id: testGroupMembership1.id },
        });
        expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/group-list");
        expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/my-groups");
      });
    });

    describe("異常系", () => {
      test.each([
        ["empty groupId", ""],
        ["null groupId", null],
        ["undefined groupId", undefined],
      ])("should handle %s", async (_, invalidGroupId) => {
        // Act
        const result = await leaveGroup(invalidGroupId!, testUser.id);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: "グループから脱退中にエラーが発生しました: グループIDがありません",
        });
      });

      test.each([
        [
          "user is not a member",
          () => {
            mockCheckGroupMembership.mockResolvedValue(null);
          },
          { success: false, message: "グループから脱退中にエラーが発生しました: グループに参加していません" },
          false,
        ],
        [
          "checkGroupMembership failure",
          () => {
            mockCheckGroupMembership.mockRejectedValue(new Error("Database error"));
          },
          { success: false, message: "グループから脱退中にエラーが発生しました: Database error" },
          false,
        ],
        [
          "database delete failure",
          () => {
            mockCheckGroupMembership.mockResolvedValue(testGroupMembership1);
            setupDatabaseError("delete");
          },
          { success: false, message: "グループから脱退中にエラーが発生しました: Database error" },
          false,
        ],
      ])("should handle %s", async (_, setupError, expectedResult, shouldCallRevalidate) => {
        // Arrange
        setupError();

        // Act
        const result = await leaveGroup(groupId, testUser.id);

        // Assert
        expect(result).toStrictEqual(expectedResult);
        if (!shouldCallRevalidate) {
          expect(mockRevalidatePath).not.toHaveBeenCalled();
        }
      });
    });
  });
});
