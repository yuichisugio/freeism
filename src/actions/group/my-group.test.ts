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

vi.mock("@/lib/actions/permission", () => ({
  checkGroupMembership: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// モック関数の型定義
const mockGetAuthenticatedSessionUserId = vi.mocked((await import("@/lib/utils")).getAuthenticatedSessionUserId);
const mockCheckGroupMembership = vi.mocked((await import("@/actions/permission/permission")).checkGroupMembership);
const mockRevalidatePath = vi.mocked(revalidatePath);

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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUserJoinGroupAndCount", () => {
    const defaultParams = {
      page: 1,
      sortField: "name",
      sortDirection: "asc",
      searchQuery: "",
      itemPerPage: 10,
    };

    describe("正常系", () => {
      test("should return user joined groups and count successfully", async () => {
        // Arrange
        const expectedGroupList = [
          {
            id: testGroup1.id,
            groupName: testGroup1.name,
            groupGoal: testGroup1.goal,
            groupEvaluationMethod: testGroup1.evaluationMethod,
            groupDepositPeriod: testGroup1.depositPeriod,
            groupPointBalance: testGroupPoint1.balance,
            groupPointFixedTotalPoints: testGroupPoint1.fixedTotalPoints,
            isGroupOwner: true,
          },
          {
            id: testGroup2.id,
            groupName: testGroup2.name,
            groupGoal: testGroup2.goal,
            groupEvaluationMethod: testGroup2.evaluationMethod,
            groupDepositPeriod: testGroup2.depositPeriod,
            groupPointBalance: testGroupPoint2.balance,
            groupPointFixedTotalPoints: testGroupPoint2.fixedTotalPoints,
            isGroupOwner: false,
          },
        ];

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.groupPoint.findMany.mockResolvedValue([
          {
            group: {
              id: testGroup1.id,
              name: testGroup1.name,
              goal: testGroup1.goal,
              evaluationMethod: testGroup1.evaluationMethod,
              depositPeriod: testGroup1.depositPeriod,
              members: [{ isGroupOwner: true }],
            },
            balance: testGroupPoint1.balance,
            fixedTotalPoints: testGroupPoint1.fixedTotalPoints,
          },
          {
            group: {
              id: testGroup2.id,
              name: testGroup2.name,
              goal: testGroup2.goal,
              evaluationMethod: testGroup2.evaluationMethod,
              depositPeriod: testGroup2.depositPeriod,
              members: [{ isGroupOwner: false }],
            },
            balance: testGroupPoint2.balance,
            fixedTotalPoints: testGroupPoint2.fixedTotalPoints,
          },
        ] as unknown as Awaited<ReturnType<typeof prismaMock.groupPoint.findMany>>);
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
        // Arrange
        const paginationParams = { ...defaultParams, page: 2, itemPerPage: 5 };

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.groupPoint.findMany.mockResolvedValue([]);
        prismaMock.group.count.mockResolvedValue(0);

        // Act
        await getUserJoinGroupAndCount(paginationParams);

        // Assert
        expect(prismaMock.groupPoint.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 5, // (page - 1) * itemPerPage = (2 - 1) * 5
            take: 5,
          }),
        );
      });

      test("should handle different sort fields correctly", async () => {
        // Arrange
        const sortParams = { ...defaultParams, sortField: "groupPointBalance", sortDirection: "desc" };

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.groupPoint.findMany.mockResolvedValue([]);
        prismaMock.group.count.mockResolvedValue(0);

        // Act
        await getUserJoinGroupAndCount(sortParams);

        // Assert
        expect(prismaMock.groupPoint.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: {
              balance: "desc",
            },
          }),
        );
      });

      test("should handle groupPointFixedTotalPoints sort field", async () => {
        // Arrange
        const sortParams = { ...defaultParams, sortField: "groupPointFixedTotalPoints", sortDirection: "asc" };

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.groupPoint.findMany.mockResolvedValue([]);
        prismaMock.group.count.mockResolvedValue(0);

        // Act
        await getUserJoinGroupAndCount(sortParams);

        // Assert
        expect(prismaMock.groupPoint.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: {
              fixedTotalPoints: "asc",
            },
          }),
        );
      });

      test("should handle groupDepositPeriod sort field", async () => {
        // Arrange
        const sortParams = { ...defaultParams, sortField: "groupDepositPeriod", sortDirection: "desc" };

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.groupPoint.findMany.mockResolvedValue([]);
        prismaMock.group.count.mockResolvedValue(0);

        // Act
        await getUserJoinGroupAndCount(sortParams);

        // Assert
        expect(prismaMock.groupPoint.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: {
              group: {
                depositPeriod: "desc",
              },
            },
          }),
        );
      });

      test("should handle default sort field", async () => {
        // Arrange
        const sortParams = { ...defaultParams, sortField: "name", sortDirection: "asc" };

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.groupPoint.findMany.mockResolvedValue([]);
        prismaMock.group.count.mockResolvedValue(0);

        // Act
        await getUserJoinGroupAndCount(sortParams);

        // Assert
        expect(prismaMock.groupPoint.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: {
              group: {
                name: "asc",
              },
            },
          }),
        );
      });

      test("should handle empty members array correctly", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.groupPoint.findMany.mockResolvedValue([
          {
            group: {
              id: testGroup1.id,
              name: testGroup1.name,
              goal: testGroup1.goal,
              evaluationMethod: testGroup1.evaluationMethod,
              depositPeriod: testGroup1.depositPeriod,
              members: [], // 空の配列
            },
            balance: testGroupPoint1.balance,
            fixedTotalPoints: testGroupPoint1.fixedTotalPoints,
          },
        ] as unknown as Awaited<ReturnType<typeof prismaMock.groupPoint.findMany>>);
        prismaMock.group.count.mockResolvedValue(1);

        // Act
        const result = await getUserJoinGroupAndCount(defaultParams);

        // Assert
        expect(result.returnUserJoinGroupList[0].isGroupOwner).toBe(false);
      });
    });

    describe("異常系", () => {
      test("should handle authentication failure", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("Authentication failed"));

        // Act & Assert
        await expect(getUserJoinGroupAndCount(defaultParams)).rejects.toThrow("Authentication failed");
      });

      test("should handle database error in getUserJoinGroup", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.groupPoint.findMany.mockRejectedValue(new Error("Database error"));

        // Act & Assert
        await expect(getUserJoinGroupAndCount(defaultParams)).rejects.toThrow("Database error");
      });

      test("should handle database error in getUserJoinGroupCount", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.groupPoint.findMany.mockResolvedValue([]);
        prismaMock.group.count.mockRejectedValue(new Error("Database error"));

        // Act & Assert
        await expect(getUserJoinGroupAndCount(defaultParams)).rejects.toThrow("Database error");
      });
    });

    describe("境界値テスト", () => {
      test("should handle page 0", async () => {
        // Arrange
        const boundaryParams = { ...defaultParams, page: 0 };

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.groupPoint.findMany.mockResolvedValue([]);
        prismaMock.group.count.mockResolvedValue(0);

        // Act
        await getUserJoinGroupAndCount(boundaryParams);

        // Assert
        expect(prismaMock.groupPoint.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: -10, // (0 - 1) * 10
          }),
        );
      });

      test("should handle itemPerPage 0", async () => {
        // Arrange
        const boundaryParams = { ...defaultParams, itemPerPage: 0 };

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.groupPoint.findMany.mockResolvedValue([]);
        prismaMock.group.count.mockResolvedValue(0);

        // Act
        await getUserJoinGroupAndCount(boundaryParams);

        // Assert
        expect(prismaMock.groupPoint.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 0,
          }),
        );
      });

      test("should handle empty search query", async () => {
        // Arrange
        const emptySearchParams = { ...defaultParams, searchQuery: "" };

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.groupPoint.findMany.mockResolvedValue([]);
        prismaMock.group.count.mockResolvedValue(0);

        // Act
        await getUserJoinGroupAndCount(emptySearchParams);

        // Assert
        expect(prismaMock.groupPoint.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.not.objectContaining({
              group: expect.objectContaining({
                name: expect.anything() as unknown as object,
              }) as unknown as object,
            }) as unknown as object,
          }) as unknown as object,
        );
      });
    });
  });

  describe("getUserJoinGroup", () => {
    describe("正常系", () => {
      test("should return formatted group list", async () => {
        // Arrange
        prismaMock.groupPoint.findMany.mockResolvedValue([
          {
            group: {
              id: testGroup1.id,
              name: testGroup1.name,
              goal: testGroup1.goal,
              evaluationMethod: testGroup1.evaluationMethod,
              depositPeriod: testGroup1.depositPeriod,
              members: [{ isGroupOwner: true }],
            },
            balance: testGroupPoint1.balance,
            fixedTotalPoints: testGroupPoint1.fixedTotalPoints,
          },
        ] as unknown as Awaited<ReturnType<typeof prismaMock.groupPoint.findMany>>);

        // Act
        const result = await getUserJoinGroup(1, "name", "asc", "", testUser.id, 10);

        // Assert
        expect(result).toStrictEqual([
          {
            id: testGroup1.id,
            groupName: testGroup1.name,
            groupGoal: testGroup1.goal,
            groupEvaluationMethod: testGroup1.evaluationMethod,
            groupDepositPeriod: testGroup1.depositPeriod,
            groupPointBalance: testGroupPoint1.balance,
            groupPointFixedTotalPoints: testGroupPoint1.fixedTotalPoints,
            isGroupOwner: true,
          },
        ]);
      });
    });

    describe("異常系", () => {
      test("should handle database error", async () => {
        // Arrange
        prismaMock.groupPoint.findMany.mockRejectedValue(new Error("Database error"));

        // Act & Assert
        await expect(getUserJoinGroup(1, "name", "asc", "", testUser.id, 10)).rejects.toThrow("Database error");
      });
    });
  });

  describe("getUserJoinGroupCount", () => {
    describe("正常系", () => {
      test("should return group count without search query", async () => {
        // Arrange
        prismaMock.group.count.mockResolvedValue(5);

        // Act
        const result = await getUserJoinGroupCount(null, testUser.id);

        // Assert
        expect(result).toBe(5);
        expect(prismaMock.group.count).toHaveBeenCalledWith({
          where: {
            members: {
              some: {
                userId: testUser.id,
              },
            },
          },
        });
      });

      test("should return group count with search query", async () => {
        // Arrange
        prismaMock.group.count.mockResolvedValue(2);

        // Act
        const result = await getUserJoinGroupCount("テスト", testUser.id);

        // Assert
        expect(result).toBe(2);
        expect(prismaMock.group.count).toHaveBeenCalledWith({
          where: {
            members: {
              some: {
                userId: testUser.id,
              },
            },
            name: {
              contains: "テスト",
            },
          },
        });
      });

      test("should handle empty string search query", async () => {
        // Arrange
        prismaMock.group.count.mockResolvedValue(3);

        // Act
        const result = await getUserJoinGroupCount("", testUser.id);

        // Assert
        expect(result).toBe(3);
        expect(prismaMock.group.count).toHaveBeenCalledWith({
          where: {
            members: {
              some: {
                userId: testUser.id,
              },
            },
          },
        });
      });
    });

    describe("異常系", () => {
      test("should handle database error", async () => {
        // Arrange
        prismaMock.group.count.mockRejectedValue(new Error("Database error"));

        // Act & Assert
        await expect(getUserJoinGroupCount("", testUser.id)).rejects.toThrow("Database error");
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
        expect(result).toStrictEqual({ success: true });
        expect(mockCheckGroupMembership).toHaveBeenCalledWith(testUser.id, groupId);
        expect(prismaMock.groupMembership.delete).toHaveBeenCalledWith({
          where: {
            id: testGroupMembership1.id,
          },
        });
        expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/group-list");
        expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/my-groups");
      });
    });

    describe("異常系", () => {
      test("should return error when user is not a member", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        mockCheckGroupMembership.mockResolvedValue(null);

        // Act
        const result = await leaveGroup(groupId);

        // Assert
        expect(result).toStrictEqual({ error: "グループに参加していません" });
        expect(prismaMock.groupMembership.delete).not.toHaveBeenCalled();
        expect(mockRevalidatePath).not.toHaveBeenCalled();
      });

      test("should handle authentication failure", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("Authentication failed"));

        // Act
        const result = await leaveGroup(groupId);

        // Assert
        expect(result).toStrictEqual({ error: "エラーが発生しました" });
        expect(mockCheckGroupMembership).not.toHaveBeenCalled();
        expect(prismaMock.groupMembership.delete).not.toHaveBeenCalled();
        expect(mockRevalidatePath).not.toHaveBeenCalled();
      });

      test("should handle checkGroupMembership failure", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        mockCheckGroupMembership.mockRejectedValue(new Error("Database error"));

        // Act
        const result = await leaveGroup(groupId);

        // Assert
        expect(result).toStrictEqual({ error: "エラーが発生しました" });
        expect(prismaMock.groupMembership.delete).not.toHaveBeenCalled();
        expect(mockRevalidatePath).not.toHaveBeenCalled();
      });

      test("should handle database delete failure", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        mockCheckGroupMembership.mockResolvedValue(testGroupMembership1);
        prismaMock.groupMembership.delete.mockRejectedValue(new Error("Database error"));

        // Act
        const result = await leaveGroup(groupId);

        // Assert
        expect(result).toStrictEqual({ error: "エラーが発生しました" });
        expect(mockRevalidatePath).not.toHaveBeenCalled();
      });
    });

    describe("境界値テスト", () => {
      test("should handle empty groupId", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        mockCheckGroupMembership.mockResolvedValue(null);

        // Act
        const result = await leaveGroup("");

        // Assert
        expect(result).toStrictEqual({ error: "グループに参加していません" });
        expect(mockCheckGroupMembership).toHaveBeenCalledWith(testUser.id, "");
      });

      test("should handle null groupId", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        mockCheckGroupMembership.mockResolvedValue(null);

        // Act
        const result = await leaveGroup(null as unknown as string);

        // Assert
        expect(result).toStrictEqual({ error: "グループに参加していません" });
        expect(mockCheckGroupMembership).toHaveBeenCalledWith(testUser.id, null);
      });

      test("should handle undefined groupId", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        mockCheckGroupMembership.mockResolvedValue(null);

        // Act
        const result = await leaveGroup(undefined as unknown as string);

        // Assert
        expect(result).toStrictEqual({ error: "グループに参加していません" });
        expect(mockCheckGroupMembership).toHaveBeenCalledWith(testUser.id, undefined);
      });
    });
  });
});
