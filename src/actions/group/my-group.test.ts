import { revalidatePath } from "next/cache";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import {
  groupFactory,
  groupMembershipFactory,
  groupPointFactory,
  userFactory,
} from "@/test/test-utils/test-utils-prisma-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getUserJoinGroup, getUserJoinGroupAndCount, getUserJoinGroupCount, leaveGroup } from "./my-group";

// モック設定
vi.mock("@/lib/utils", () => ({
  getAuthenticatedSessionUserId: vi.fn(),
}));

vi.mock("@/actions/permission/permission", () => ({
  checkGroupMembership: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// モック関数の型定義
const mockGetAuthenticatedSessionUserId = vi.mocked((await import("@/lib/utils")).getAuthenticatedSessionUserId);
const mockCheckGroupMembership = vi.mocked((await import("@/actions/permission/permission")).checkGroupMembership);
const mockRevalidatePath = vi.mocked(revalidatePath);

// 型定義
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

describe("my-group.ts", () => {
  // テストデータ
  const testUser = userFactory.build({ id: "user-1" });
  const testGroup1 = groupFactory.build({ id: "group-1", name: "テストグループ1" });
  const testGroup2 = groupFactory.build({ id: "group-2", name: "テストグループ2" });
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
  const testGroupPoint2 = groupPointFactory.build({
    userId: testUser.id,
    groupId: testGroup2.id,
    balance: 200,
    fixedTotalPoints: 300,
  });

  // 共通のパラメータ
  const defaultParams = {
    page: 1,
    sortField: "name",
    sortDirection: "asc",
    searchQuery: "search", // 空文字列はバリデーションエラーになるため
    itemPerPage: 10,
  };

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

  describe("getUserJoinGroupAndCount", () => {
    describe("正常系", () => {
      test("should return user joined groups and count successfully", async () => {
        // Arrange
        const mockData = [
          createGroupPointMockData(testGroup1, testGroupPoint1, true),
          createGroupPointMockData(testGroup2, testGroupPoint2, false),
        ];
        const expectedGroupList = [
          createExpectedGroupData(testGroup1, testGroupPoint1, true),
          createExpectedGroupData(testGroup2, testGroupPoint2, false),
        ];

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.groupPoint.findMany.mockResolvedValue(
          mockData as unknown as Awaited<ReturnType<typeof prismaMock.groupPoint.findMany>>,
        );
        prismaMock.group.count.mockResolvedValue(2);

        // Act
        const result = await getUserJoinGroupAndCount(defaultParams);

        // Assert
        expect(result).toStrictEqual({
          returnUserJoinGroupList: expectedGroupList,
          userJoinGroupTotalCount: 2,
        });
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalled();
      });

      test("should handle search query correctly", async () => {
        // Arrange
        const searchParams = { ...defaultParams, searchQuery: "テスト" };
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.groupPoint.findMany.mockResolvedValue([]);
        prismaMock.group.count.mockResolvedValue(0);

        // Act
        await getUserJoinGroupAndCount(searchParams);

        // Assert
        expect(prismaMock.groupPoint.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              group: expect.objectContaining({
                name: {
                  contains: "テスト",
                },
              }) as unknown as object,
            }) as unknown as object,
          }) as unknown as object,
        );
      });

      test("should handle pagination correctly", async () => {
        // testParameterBoundaryは元のパラメータのsearchQueryも空文字列なので修正
        const paginationParams1 = { ...defaultParams, page: 2, itemPerPage: 5 };
        const paginationParams2 = { ...defaultParams, itemPerPage: 5 };

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.groupPoint.findMany.mockResolvedValue([]);
        prismaMock.group.count.mockResolvedValue(0);

        await getUserJoinGroupAndCount(paginationParams1);

        expect(prismaMock.groupPoint.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 5, // (page - 1) * itemPerPage = (2 - 1) * 5
            take: 5,
          }),
        );

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.groupPoint.findMany.mockResolvedValue([]);
        prismaMock.group.count.mockResolvedValue(0);

        await getUserJoinGroupAndCount(paginationParams2);

        expect(prismaMock.groupPoint.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 5,
          }),
        );
      });

      test("should handle empty members array correctly", async () => {
        // Arrange
        const mockDataWithEmptyMembers = [createGroupPointMockData(testGroup1, testGroupPoint1, false)];
        mockDataWithEmptyMembers[0].group.members = []; // 空の配列

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.groupPoint.findMany.mockResolvedValue(
          mockDataWithEmptyMembers as unknown as Awaited<ReturnType<typeof prismaMock.groupPoint.findMany>>,
        );
        prismaMock.group.count.mockResolvedValue(1);

        // Act
        const result = await getUserJoinGroupAndCount(defaultParams);

        // Assert
        expect(result.returnUserJoinGroupList[0].isGroupOwner).toBe(false);
      });
    });

    describe("ソートフィールドのテスト", () => {
      test.each([
        ["groupPointBalance", "desc", { balance: "desc" }],
        ["groupPointFixedTotalPoints", "asc", { fixedTotalPoints: "asc" }],
        ["groupDepositPeriod", "desc", { group: { depositPeriod: "desc" } }],
        ["name", "asc", { group: { name: "asc" } }],
      ])("should handle %s sort field with %s direction", async (sortField, sortDirection, expectedOrderBy) => {
        // Arrange
        const sortParams = { ...defaultParams, sortField, sortDirection };
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.groupPoint.findMany.mockResolvedValue([]);
        prismaMock.group.count.mockResolvedValue(0);

        // Act
        await getUserJoinGroupAndCount(sortParams);

        // Assert
        expect(prismaMock.groupPoint.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: expectedOrderBy,
          }),
        );
      });
    });

    describe("異常系", () => {
      test.each([
        [
          "authentication failure",
          () => mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("Authentication failed")),
          "Authentication failed",
        ],
        [
          "database error in getUserJoinGroup",
          () => {
            mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
            setupDatabaseError("findMany");
          },
          "Database error",
        ],
        [
          "database error in getUserJoinGroupCount",
          () => {
            mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
            prismaMock.groupPoint.findMany.mockResolvedValue([]);
            setupDatabaseError("count");
          },
          "Database error",
        ],
      ])("should handle %s", async (_, setupError, expectedError) => {
        setupError();
        await expect(getUserJoinGroupAndCount(defaultParams)).rejects.toThrow(expectedError);
      });
    });

    describe("境界値テスト", () => {
      test.each([
        ["page 0", { page: 0 }],
        ["itemPerPage 0", { itemPerPage: 0 }],
      ])("should throw error for %s", async (_, paramOverride) => {
        // Arrange
        const boundaryParams = { ...defaultParams, ...paramOverride };

        // Act & Assert
        await expect(getUserJoinGroupAndCount(boundaryParams)).rejects.toThrow("Invalid parameters");
      });

      test("should throw error when searchQuery is empty string", async () => {
        // Arrange
        const emptySearchParams = { ...defaultParams, searchQuery: "" };

        // Act & Assert
        await expect(getUserJoinGroupAndCount(emptySearchParams)).rejects.toThrow("Invalid parameters");
      });

      test.each([
        ["page", null],
        ["sortField", null],
        ["sortDirection", null],
        ["itemPerPage", null],
      ])("should throw error when %s is null", async (paramName, paramValue) => {
        await expect(getUserJoinGroupAndCount({ ...defaultParams, [paramName]: paramValue })).rejects.toThrow(
          "Invalid parameters",
        );
      });

      test("should throw error when searchQuery is null", async () => {
        await expect(
          getUserJoinGroupAndCount({ ...defaultParams, searchQuery: null as unknown as string }),
        ).rejects.toThrow("Invalid parameters");
      });
    });
  });

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
        const result = await getUserJoinGroup(1, "name", "asc", "search", testUser.id, 10);

        // Assert
        expect(result).toStrictEqual(expectedResult);
      });
    });

    describe("異常系", () => {
      test("should handle database error", async () => {
        setupDatabaseError("findMany");
        await expect(getUserJoinGroup(1, "name", "asc", "search", testUser.id, 10)).rejects.toThrow("Database error");
      });

      test.each([
        ["userId", ""],
        ["page", null],
        ["sortField", null],
        ["sortDirection", null],
        ["searchQuery", null],
        ["searchQuery", ""], // 空文字列のテスト
        ["itemPerPage", null],
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
          params.userId = paramValue!;
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
          (params as any)[paramName] = paramValue;
        }

        await expect(
          getUserJoinGroup(
            params.page,
            params.sortField,
            params.sortDirection,
            params.searchQuery,
            params.userId,
            params.itemPerPage,
          ),
        ).rejects.toThrow("ユーザーIDがありません");
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
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        mockCheckGroupMembership.mockResolvedValue(testGroupMembership1);
        prismaMock.groupMembership.delete.mockResolvedValue(testGroupMembership1);

        // Act
        const result = await leaveGroup(groupId);

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
        [
          "user is not a member",
          () => {
            mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
            mockCheckGroupMembership.mockResolvedValue(null);
          },
          { success: false, message: "グループに参加していません" },
          false,
        ],
        [
          "authentication failure",
          () => mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("Authentication failed")),
          { success: false, message: "グループから脱退中にエラーが発生しました: Authentication failed" },
          false,
        ],
        [
          "checkGroupMembership failure",
          () => {
            mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
            mockCheckGroupMembership.mockRejectedValue(new Error("Database error"));
          },
          { success: false, message: "グループから脱退中にエラーが発生しました: Database error" },
          false,
        ],
        [
          "database delete failure",
          () => {
            mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
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
        const result = await leaveGroup(groupId);

        // Assert
        expect(result).toStrictEqual(expectedResult);
        if (!shouldCallRevalidate) {
          expect(mockRevalidatePath).not.toHaveBeenCalled();
        }
      });
    });

    describe("境界値テスト", () => {
      test.each([
        ["empty groupId", ""],
        ["null groupId", null],
        ["undefined groupId", undefined],
      ])("should handle %s", async (_, invalidGroupId) => {
        // Act
        const result = await leaveGroup(invalidGroupId!);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: "グループから脱退中にエラーが発生しました: グループIDがありません",
        });
      });
    });
  });
});
