import { type CreateGroupFormData } from "@/components/group/create-group-form";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { createInvalidGroupData, groupFactory, groupMembershipFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  checkGroupExistByName,
  createGroup,
  deleteGroup,
  getGroupMembers,
  joinGroup,
  removeMember,
  updateGroup,
} from "./group";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */
vi.mock("@/lib/utils", () => ({
  getAuthenticatedSessionUserId: vi.fn(),
}));

vi.mock("@/actions/permission/permission", () => ({
  checkGroupMembership: vi.fn(),
  checkIsPermission: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数のインポート
 */
const mockGetAuthenticatedSessionUserId = vi.mocked((await import("@/lib/utils")).getAuthenticatedSessionUserId);
const mockCheckGroupMembership = vi.mocked((await import("@/actions/permission/permission")).checkGroupMembership);
const mockCheckIsPermission = vi.mocked((await import("@/actions/permission/permission")).checkIsPermission);
const mockRevalidatePath = vi.mocked((await import("next/cache")).revalidatePath);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ
 */
const validGroupData = {
  name: "テストグループ",
  goal: "テスト目標",
  depositPeriod: 30,
  maxParticipants: 10,
  evaluationMethod: "自動評価",
};

const testUsers = {
  user1: "user-1",
  user2: "user-2",
  owner: "owner-user",
  target: "target-user",
};

const testGroupId = "group-1";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("group.test.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createGroup", () => {
    describe("正常系", () => {
      test("should create group successfully with valid data", async () => {
        // Arrange
        const expectedGroup = groupFactory.build(validGroupData);
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.user1);
        prismaMock.group.create.mockResolvedValue(expectedGroup);

        // Act
        const result = await createGroup(validGroupData);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          message: "グループを作成しました",
          data: null,
        });
        expect(prismaMock.group.create).toHaveBeenCalledWith({
          data: {
            ...validGroupData,
            createdBy: testUsers.user1,
            members: {
              create: {
                userId: testUsers.user1,
                isGroupOwner: true,
              },
            },
          },
        });
        expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/group-list");
      });
    });

    describe("異常系", () => {
      test("should return error when authentication fails", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("Authentication failed"));

        // Act & Assert
        await expect(createGroup(validGroupData)).rejects.toThrow(
          "createGroup中にエラーが発生しました: Authentication failed",
        );
        expect(prismaMock.group.create).not.toHaveBeenCalled();
      });

      test("should return validation error for invalid data", async () => {
        // Arrange
        const invalidData = { name: "", goal: "", evaluationMethod: "" };
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.user1);

        // Act
        const result = await createGroup(invalidData as unknown as CreateGroupFormData);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: "入力内容に誤りがあります",
          data: null,
        });
        expect(prismaMock.group.create).not.toHaveBeenCalled();
      });

      test("should handle database error during group creation", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.user1);
        prismaMock.group.create.mockRejectedValue(new Error("Database error"));

        // Act & Assert
        await expect(createGroup(validGroupData)).rejects.toThrow(
          "createGroup中にエラーが発生しました: Database error",
        );
      });

      test("should handle missing required fields", async () => {
        // Arrange
        const invalidData = createInvalidGroupData();
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.user1);

        // Act
        const result = await createGroup(invalidData as unknown as CreateGroupFormData);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: "入力内容に誤りがあります",
          data: null,
        });
      });

      test("should handle unique constraint error", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.user1);
        prismaMock.group.create.mockRejectedValue({ code: "P2002" });

        // Act
        const result = await createGroup(validGroupData);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: "このグループ名は既に使用されています",
          data: null,
        });
      });

      test("should handle boundary values for maxParticipants", async () => {
        // Arrange
        const boundaryData = { ...validGroupData, maxParticipants: 1 };
        const expectedGroup = groupFactory.build(boundaryData);
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.user1);
        prismaMock.group.create.mockResolvedValue(expectedGroup);

        // Act
        const result = await createGroup(boundaryData);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          message: "グループを作成しました",
          data: null,
        });
      });
    });
  });

  describe("joinGroup", () => {
    describe("正常系", () => {
      test("should join group successfully", async () => {
        // Arrange
        const group = groupFactory.build({ id: testGroupId, maxParticipants: 10 });
        const membership = groupMembershipFactory.build();

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.user1);
        prismaMock.group.findUnique.mockResolvedValue(group);
        // checkGroupMembershipが false を返すようにモック（まだ参加していない状態）
        mockCheckGroupMembership.mockResolvedValue({
          success: false,
          message: "グループメンバーシップが存在しません",
          data: null,
        });
        prismaMock.groupMembership.count.mockResolvedValue(5);
        prismaMock.groupMembership.create.mockResolvedValue(membership);

        // Act
        const result = await joinGroup(testGroupId);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          message: "グループに参加しました",
          data: null,
        });
        expect(prismaMock.groupMembership.create).toHaveBeenCalledWith({
          data: {
            userId: testUsers.user1,
            groupId: testGroupId,
          },
        });
        expect(prismaMock.group.findUnique).toHaveBeenCalledWith({
          where: { id: testGroupId },
        });
        expect(mockCheckGroupMembership).toHaveBeenCalledWith(testUsers.user1, testGroupId);
        expect(prismaMock.groupMembership.count).toHaveBeenCalledWith({
          where: { groupId: testGroupId },
        });
        expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/group-list");
        expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/my-groups");
      });
    });

    describe("異常系", () => {
      test("should return error when groupId is not provided", async () => {
        // Act & Assert
        await expect(joinGroup("")).rejects.toThrow("グループIDがありません");
      });

      test("should return error when group not found", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.user1);
        prismaMock.group.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(joinGroup(testGroupId)).rejects.toThrow("グループが見つかりません");
        expect(prismaMock.groupMembership.create).not.toHaveBeenCalled();
      });

      test("should return error when user already joined", async () => {
        // Arrange
        const group = groupFactory.build({ id: testGroupId });
        const existingMembership = groupMembershipFactory.build();

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.user1);
        prismaMock.group.findUnique.mockResolvedValue(group);
        // checkGroupMembershipが true を返すようにモック（既に参加している状態）
        mockCheckGroupMembership.mockResolvedValue({
          success: true,
          message: "グループメンバーシップを取得しました",
          data: { id: existingMembership.id, isGroupOwner: existingMembership.isGroupOwner },
        });

        // Act
        const result = await joinGroup(testGroupId);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: "既に参加済みです",
          data: null,
        });
        expect(prismaMock.groupMembership.create).not.toHaveBeenCalled();
      });

      test("should return error when group is full", async () => {
        // Arrange
        const group = groupFactory.build({ id: testGroupId, maxParticipants: 5 });

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.user1);
        prismaMock.group.findUnique.mockResolvedValue(group);
        // checkGroupMembershipが false を返すようにモック（まだ参加していない状態）
        mockCheckGroupMembership.mockResolvedValue({
          success: false,
          message: "グループメンバーシップが存在しません",
          data: null,
        });
        prismaMock.groupMembership.count.mockResolvedValue(5);

        // Act
        const result = await joinGroup(testGroupId);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: "参加人数が上限に達しています",
          data: null,
        });
        expect(prismaMock.groupMembership.create).not.toHaveBeenCalled();
      });

      test("should handle authentication failure", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("Authentication failed"));

        // Act & Assert
        await expect(joinGroup(testGroupId)).rejects.toThrow("Authentication failed");
      });

      test("should handle database error during join", async () => {
        // Arrange
        const group = groupFactory.build({ id: testGroupId, maxParticipants: 10 });

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.user1);
        prismaMock.group.findUnique.mockResolvedValue(group);
        // checkGroupMembershipが false を返すようにモック（まだ参加していない状態）
        mockCheckGroupMembership.mockResolvedValue({
          success: false,
          message: "グループメンバーシップが存在しません",
          data: null,
        });
        prismaMock.groupMembership.count.mockResolvedValue(5);
        prismaMock.groupMembership.create.mockRejectedValue(new Error("Database error"));

        // Act & Assert
        await expect(joinGroup(testGroupId)).rejects.toThrow("Database error");
      });

      test("should handle boundary case when group is exactly at capacity", async () => {
        // Arrange
        const group = groupFactory.build({ id: testGroupId, maxParticipants: 1 });

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.user1);
        prismaMock.group.findUnique.mockResolvedValue(group);
        // checkGroupMembershipが false を返すようにモック（まだ参加していない状態）
        mockCheckGroupMembership.mockResolvedValue({
          success: false,
          message: "グループメンバーシップが存在しません",
          data: null,
        });
        prismaMock.groupMembership.count.mockResolvedValue(1);

        // Act
        const result = await joinGroup(testGroupId);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: "参加人数が上限に達しています",
          data: null,
        });
      });
    });
  });

  describe("deleteGroup", () => {
    describe("正常系", () => {
      test("should delete group successfully", async () => {
        // Arrange
        const group = groupFactory.build({ id: testGroupId, createdBy: testUsers.user1 });

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.user1);
        prismaMock.group.findUnique.mockResolvedValue(group);
        mockCheckIsPermission.mockResolvedValue({ success: true, message: "グループの削除権限があります", data: true });
        prismaMock.group.delete.mockResolvedValue(group);

        // Act
        const result = await deleteGroup(testGroupId);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          message: "グループを削除しました",
          data: null,
        });
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalled();
        expect(prismaMock.group.findUnique).toHaveBeenCalledWith({
          where: { id: testGroupId },
          select: {
            createdBy: true,
          },
        });
        expect(mockCheckIsPermission).toHaveBeenCalledWith(testUsers.user1, testGroupId, undefined, false);
        expect(prismaMock.group.delete).toHaveBeenCalledWith({
          where: { id: testGroupId },
        });
        expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/group-list");
        expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/my-groups");
      });
    });

    describe("異常系", () => {
      test("should return error when groupId is not provided", async () => {
        // Act & Assert
        await expect(deleteGroup("")).rejects.toThrow("グループIDがありません");
      });

      test("should return error when group not found", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.user1);
        prismaMock.group.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(deleteGroup(testGroupId)).rejects.toThrow("グループが見つかりません");
        expect(prismaMock.group.delete).not.toHaveBeenCalled();
      });

      test("should return error when user is not group creator", async () => {
        // Arrange
        const group = groupFactory.build({ id: testGroupId, createdBy: "other-user" });

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.user1);
        prismaMock.group.findUnique.mockResolvedValue(group);
        mockCheckIsPermission.mockResolvedValue({
          success: false,
          message: "グループの削除権限がありません",
          data: false,
        });

        // Act
        const result = await deleteGroup(testGroupId);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: "グループの削除権限がありません",
          data: null,
        });
        expect(prismaMock.group.delete).not.toHaveBeenCalled();
      });

      test("should handle authentication failure", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("Authentication failed"));

        // Act & Assert
        await expect(deleteGroup(testGroupId)).rejects.toThrow("Authentication failed");
      });

      test("should handle database error during deletion", async () => {
        // Arrange
        const group = groupFactory.build({ id: testGroupId, createdBy: testUsers.user1 });

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.user1);
        prismaMock.group.findUnique.mockResolvedValue(group);
        mockCheckIsPermission.mockResolvedValue({ success: true, message: "グループの削除権限があります", data: true });
        prismaMock.group.delete.mockRejectedValue(new Error("Database error"));

        // Act & Assert
        await expect(deleteGroup(testGroupId)).rejects.toThrow("Database error");
      });
    });
  });

  describe("checkGroupExistByName", () => {
    describe("正常系", () => {
      test("should return true when group exists", async () => {
        // Arrange
        const groupName = "既存グループ";
        const existingGroup = groupFactory.build({ name: groupName });
        prismaMock.group.findFirst.mockResolvedValue(existingGroup);

        // Act
        const result = await checkGroupExistByName(groupName);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          message: "グループ名の重複をチェックしました",
          data: true,
        });
        expect(prismaMock.group.findFirst).toHaveBeenCalledWith({
          where: { name: groupName },
        });
      });

      test("should return false when group does not exist", async () => {
        // Arrange
        const groupName = "存在しないグループ";
        prismaMock.group.findFirst.mockResolvedValue(null);

        // Act
        const result = await checkGroupExistByName(groupName);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          message: "グループ名の重複をチェックしました",
          data: false,
        });
        expect(prismaMock.group.findFirst).toHaveBeenCalledWith({
          where: { name: groupName },
        });
      });
    });

    describe("異常系", () => {
      test("should throw error when database error occurs", async () => {
        // Arrange
        const groupName = "テストグループ";
        const dbError = new Error("Database connection failed");
        prismaMock.group.findFirst.mockRejectedValue(dbError);

        // Act & Assert
        await expect(checkGroupExistByName(groupName)).rejects.toThrow("Database connection failed");
      });

      test("should handle empty string name", async () => {
        // Arrange
        const groupName = "";

        // Act & Assert
        await expect(checkGroupExistByName(groupName)).rejects.toThrow("グループ名がありません");
      });
    });
  });

  describe("updateGroup", () => {
    const validUpdateData = {
      name: "更新されたグループ",
      goal: "更新された目標",
      depositPeriod: 30,
      maxParticipants: 15,
      evaluationMethod: "手動評価",
    };

    describe("正常系", () => {
      test("should update group successfully", async () => {
        // Arrange
        const existingGroup = groupFactory.build({
          id: testGroupId,
          createdBy: testUsers.user1,
          name: "元のグループ名",
        });
        const updatedGroup = groupFactory.build({ ...validUpdateData, id: testGroupId });

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.user1);
        mockCheckIsPermission.mockResolvedValue({ success: true, message: "グループの編集権限があります", data: true });
        prismaMock.group.findUnique.mockResolvedValue(existingGroup);
        prismaMock.group.findFirst.mockResolvedValue(null);
        prismaMock.group.update.mockResolvedValue(updatedGroup);

        // Act
        const result = await updateGroup(testGroupId, validUpdateData);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          message: "グループを更新しました",
          data: null,
        });
        expect(prismaMock.group.update).toHaveBeenCalledWith({
          where: { id: testGroupId },
          data: validUpdateData,
        });
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalled();
        expect(prismaMock.group.findUnique).toHaveBeenCalledWith({
          where: { id: testGroupId },
          select: {
            name: true,
          },
        });
        expect(prismaMock.group.findFirst).toHaveBeenCalledWith({
          where: {
            name: validUpdateData.name,
            NOT: {
              id: testGroupId,
            },
          },
        });
        expect(mockCheckIsPermission).toHaveBeenCalledWith(testUsers.user1, testGroupId, undefined, false);
        expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/group-list");
        expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/my-groups");
      });
    });

    describe("異常系", () => {
      test("should return error when groupId is not provided", async () => {
        // Act & Assert
        await expect(updateGroup("", validUpdateData)).rejects.toThrow("グループIDがありません");
      });

      test("should return error when group not found", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.user1);
        prismaMock.group.findUnique.mockResolvedValue(null);
        mockCheckIsPermission.mockResolvedValue({ success: true, message: "グループの編集権限があります", data: true });

        // Act & Assert
        await expect(updateGroup(testGroupId, validUpdateData)).rejects.toThrow("グループが見つかりません");
        expect(prismaMock.group.update).not.toHaveBeenCalled();
      });

      test("should return error when user is not group creator", async () => {
        // Arrange
        const existingGroup = groupFactory.build({
          id: testGroupId,
          createdBy: "other-user",
        });

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.user1);
        prismaMock.group.findUnique.mockResolvedValue(existingGroup);
        mockCheckIsPermission.mockResolvedValue({
          success: false,
          message: "グループの編集権限がありません",
          data: false,
        });

        // Act
        const result = await updateGroup(testGroupId, validUpdateData);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: "グループの編集権限がありません",
          data: null,
        });
        expect(prismaMock.group.update).not.toHaveBeenCalled();
      });

      test("should return error when group name already exists", async () => {
        // Arrange
        const existingGroup = groupFactory.build({
          id: testGroupId,
          createdBy: testUsers.user1,
          name: "元のグループ名",
        });
        const duplicateGroup = groupFactory.build({
          id: "other-group",
          name: validUpdateData.name,
        });

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.user1);
        prismaMock.group.findUnique.mockResolvedValue(existingGroup);
        prismaMock.group.findFirst.mockResolvedValue(duplicateGroup);
        mockCheckIsPermission.mockResolvedValue({ success: true, message: "グループの編集権限があります", data: true });

        // Act & Assert
        await expect(updateGroup(testGroupId, validUpdateData)).rejects.toThrow("このグループ名は既に使用されています");
        expect(prismaMock.group.update).not.toHaveBeenCalled();
      });

      test("should allow updating with same name", async () => {
        // Arrange
        const existingGroup = groupFactory.build({
          id: testGroupId,
          createdBy: testUsers.user1,
          name: validUpdateData.name,
        });
        const updateDataWithSameName = { ...validUpdateData };

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.user1);
        prismaMock.group.findUnique.mockResolvedValue(existingGroup);
        prismaMock.group.update.mockResolvedValue(existingGroup);
        mockCheckIsPermission.mockResolvedValue({ success: true, message: "グループの編集権限があります", data: true });
        // Act
        const result = await updateGroup(testGroupId, updateDataWithSameName);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          message: "グループを更新しました",
          data: null,
        });
        expect(prismaMock.group.findFirst).not.toHaveBeenCalled();
      });

      test("should return validation error for invalid data", async () => {
        // Arrange
        const invalidData = { name: "", goal: "", evaluationMethod: "" };

        // Act & Assert
        await expect(updateGroup(testGroupId, invalidData as unknown as CreateGroupFormData)).rejects.toThrow();
        expect(prismaMock.group.update).not.toHaveBeenCalled();
      });

      test("should handle database error during update", async () => {
        // Arrange
        const existingGroup = groupFactory.build({
          id: testGroupId,
          createdBy: testUsers.user1,
          name: "元のグループ名",
        });

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.user1);
        prismaMock.group.findUnique.mockResolvedValue(existingGroup);
        prismaMock.group.findFirst.mockResolvedValue(null);
        prismaMock.group.update.mockRejectedValue(new Error("Database error"));
        mockCheckIsPermission.mockResolvedValue({ success: true, message: "グループの編集権限があります", data: true });

        // Act & Assert
        await expect(updateGroup(testGroupId, validUpdateData)).rejects.toThrow("Database error");
      });
    });
  });

  describe("getGroupMembers", () => {
    describe("正常系", () => {
      test("should return group members successfully", async () => {
        // Arrange
        const mockMembers = [
          {
            isGroupOwner: true,
            user: { id: "user-1", settings: { username: "オーナーユーザー" } },
          },
          {
            isGroupOwner: false,
            user: { id: "user-2", settings: { username: "一般ユーザー" } },
          },
          {
            isGroupOwner: false,
            user: { id: "user-3", settings: null },
          },
        ];

        prismaMock.groupMembership.findMany.mockResolvedValue(
          mockMembers as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
        );

        // Act
        const result = await getGroupMembers(testGroupId);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          message: "グループメンバーを取得しました",
          data: [
            {
              isGroupOwner: true,
              userId: "user-1",
              appUserName: "オーナーユーザー",
            },
            {
              isGroupOwner: false,
              userId: "user-2",
              appUserName: "一般ユーザー",
            },
            {
              isGroupOwner: false,
              userId: "user-3",
              appUserName: "未設定_user-3",
            },
          ],
        });

        expect(prismaMock.groupMembership.findMany).toHaveBeenCalledWith({
          where: { groupId: testGroupId },
          select: {
            isGroupOwner: true,
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
          },
          orderBy: {
            joinedAt: "asc",
          },
        });
      });

      test("should return empty array when no members found", async () => {
        // Arrange
        prismaMock.groupMembership.findMany.mockResolvedValue([]);

        // Act
        const result = await getGroupMembers(testGroupId);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          message: "グループメンバーを取得しました",
          data: [],
        });
      });
    });

    describe("異常系", () => {
      test("should return error when groupId is not provided", async () => {
        // Arrange & Act & Assert
        await expect(getGroupMembers("")).rejects.toThrow("グループIDがありません");
      });

      test("should throw error when database error occurs", async () => {
        // Arrange
        const dbError = new Error("Database connection failed");
        prismaMock.groupMembership.findMany.mockRejectedValue(dbError);

        // Act & Assert
        await expect(getGroupMembers(testGroupId)).rejects.toThrow("Database connection failed");
      });

      test("should handle members with null names", async () => {
        // Arrange
        const mockMembers = [
          {
            isGroupOwner: false,
            user: { id: "user-1", settings: null },
          },
        ];

        prismaMock.groupMembership.findMany.mockResolvedValue(
          mockMembers as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
        );

        // Act
        const result = await getGroupMembers(testGroupId);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          message: "グループメンバーを取得しました",
          data: [
            {
              isGroupOwner: false,
              userId: "user-1",
              appUserName: "未設定_user-1",
            },
          ],
        });
      });
    });
  });

  describe("removeMember", () => {
    describe("正常系", () => {
      test("should remove member successfully without blacklist", async () => {
        // Arrange
        const membership = groupMembershipFactory.build({
          id: "membership-1",
          userId: testUsers.target,
          isGroupOwner: false,
        });

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.owner);
        mockCheckIsPermission.mockResolvedValue({
          success: true,
          message: "Permission check successfully",
          data: true,
        });
        mockCheckGroupMembership.mockResolvedValue({
          success: true,
          message: "グループメンバーシップを取得しました",
          data: { id: membership.id, isGroupOwner: membership.isGroupOwner },
        });
        prismaMock.$transaction.mockImplementation(async (callback) => {
          return await callback(prismaMock);
        });
        prismaMock.groupMembership.delete.mockResolvedValue(membership);

        // Act
        const result = await removeMember(testGroupId, testUsers.target, false);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          message: "メンバーを削除しました",
          data: null,
        });
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledWith();
        expect(mockCheckIsPermission).toHaveBeenCalledWith(testUsers.owner, testGroupId, undefined, false);
        expect(mockCheckGroupMembership).toHaveBeenCalledWith(testUsers.target, testGroupId);
        expect(prismaMock.groupMembership.delete).toHaveBeenCalledWith({
          where: { id: membership.id },
        });
        expect(prismaMock.group.update).not.toHaveBeenCalled();
        expect(prismaMock.group.findUnique).not.toHaveBeenCalled();
        expect(mockRevalidatePath).toHaveBeenCalledWith(`/dashboard/group/${testGroupId}`);
      });

      test("should remove member and add to blacklist", async () => {
        // Arrange
        const membership = groupMembershipFactory.build({
          id: "membership-1",
          userId: testUsers.target,
          isGroupOwner: false,
        });
        const group = groupFactory.build({
          id: testGroupId,
          isBlackList: { "other-user": true },
        });

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.owner);
        mockCheckIsPermission.mockResolvedValue({
          success: true,
          message: "Permission check successfully",
          data: true,
        });
        mockCheckGroupMembership.mockResolvedValue({
          success: true,
          message: "グループメンバーシップを取得しました",
          data: { id: membership.id, isGroupOwner: membership.isGroupOwner },
        });
        prismaMock.$transaction.mockImplementation(async (callback) => {
          return await callback(prismaMock);
        });
        prismaMock.groupMembership.delete.mockResolvedValue(membership);
        prismaMock.group.findUnique.mockResolvedValue(group);
        prismaMock.group.update.mockResolvedValue(group);

        // Act
        const result = await removeMember(testGroupId, testUsers.target, true);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          message: "メンバーを削除しました",
          data: null,
        });
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledWith();
        expect(mockCheckIsPermission).toHaveBeenCalledWith(testUsers.owner, testGroupId, undefined, false);
        expect(mockCheckGroupMembership).toHaveBeenCalledWith(testUsers.target, testGroupId);
        expect(prismaMock.group.findUnique).toHaveBeenCalledWith({
          where: { id: testGroupId },
          select: { isBlackList: true },
        });
        expect(prismaMock.group.update).toHaveBeenCalledWith({
          where: { id: testGroupId },
          data: {
            isBlackList: {
              "other-user": true,
              [testUsers.target]: true,
            },
          },
        });
      });

      test("should handle blacklist with null initial value", async () => {
        // Arrange
        const membership = groupMembershipFactory.build({
          userId: testUsers.target,
          isGroupOwner: false,
        });
        const group = groupFactory.build({
          id: testGroupId,
          isBlackList: null,
        });

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.owner);
        mockCheckIsPermission.mockResolvedValue({
          success: true,
          message: "Permission check successfully",
          data: true,
        });
        mockCheckGroupMembership.mockResolvedValue({
          success: true,
          message: "グループメンバーシップを取得しました",
          data: { id: membership.id, isGroupOwner: membership.isGroupOwner },
        });
        prismaMock.$transaction.mockImplementation(async (callback) => {
          return await callback(prismaMock);
        });
        prismaMock.groupMembership.delete.mockResolvedValue(membership);
        prismaMock.group.findUnique.mockResolvedValue(group);
        prismaMock.group.update.mockResolvedValue(group);

        // Act
        const result = await removeMember(testGroupId, testUsers.target, true);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          message: "メンバーを削除しました",
          data: null,
        });
        expect(prismaMock.group.update).toHaveBeenCalledWith({
          where: { id: testGroupId },
          data: {
            isBlackList: {
              [testUsers.target]: true,
            },
          },
        });
      });
    });

    describe("異常系", () => {
      test.each([
        { groupId: "", removeUserId: testUsers.target, addToBlackList: false },
        { groupId: testGroupId, removeUserId: "", addToBlackList: false },
        { groupId: testGroupId, removeUserId: testUsers.target, addToBlackList: undefined },
        { groupId: testGroupId, removeUserId: testUsers.target, addToBlackList: null },
      ])("should return error when groupId is not provided", async ({ groupId, removeUserId, addToBlackList }) => {
        // Act & Assert
        await expect(removeMember(groupId, removeUserId, addToBlackList!)).rejects.toThrow("invalid parameters");
      });

      test("should return error when user is not owner", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.owner);
        mockCheckIsPermission.mockResolvedValue({
          success: false,
          message: "グループメンバーを削除する権限がありません",
          data: false,
        });

        // Act
        const result = await removeMember(testGroupId, testUsers.target, false);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: "グループメンバーを削除する権限がありません",
          data: null,
        });
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledWith();
        expect(mockCheckIsPermission).toHaveBeenCalledWith(testUsers.owner, testGroupId, undefined, false);
        expect(mockCheckGroupMembership).not.toHaveBeenCalled();
        expect(prismaMock.groupMembership.delete).not.toHaveBeenCalled();
        expect(prismaMock.group.update).not.toHaveBeenCalled();
        expect(prismaMock.group.findUnique).not.toHaveBeenCalled();
        expect(mockRevalidatePath).not.toHaveBeenCalled();
      });

      test("should return error when target user is not member", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.owner);
        mockCheckIsPermission.mockResolvedValue({
          success: true,
          message: "Permission check successfully",
          data: true,
        });
        // checkGroupMembershipが false を返すようにモック（参加していない状態）
        mockCheckGroupMembership.mockResolvedValue({
          success: false,
          message: "グループメンバーシップが存在しません",
          data: null,
        });

        // Act
        const result = await removeMember(testGroupId, testUsers.target, false);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: "指定されたユーザーはグループに参加していません",
          data: null,
        });
        expect(prismaMock.groupMembership.delete).not.toHaveBeenCalled();
      });

      test("should return error when trying to remove self", async () => {
        // Arrange
        const membership = groupMembershipFactory.build({
          userId: testUsers.owner,
          isGroupOwner: false,
        });

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.owner);
        mockCheckIsPermission.mockResolvedValue({
          success: true,
          message: "Permission check successfully",
          data: true,
        });
        // checkGroupMembershipがメンバーシップを返すようにモック
        mockCheckGroupMembership.mockResolvedValue({
          success: true,
          message: "グループメンバーシップを取得しました",
          data: { id: membership.id, isGroupOwner: membership.isGroupOwner },
        });

        // Act
        const result = await removeMember(testGroupId, testUsers.owner, false);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: "自分自身を削除することはできません",
          data: null,
        });
        expect(prismaMock.groupMembership.delete).not.toHaveBeenCalled();
      });

      test("should return error when trying to remove group owner", async () => {
        // Arrange
        const ownerMembership = groupMembershipFactory.build({
          userId: testUsers.target,
          isGroupOwner: true,
        });

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.owner);
        mockCheckIsPermission.mockResolvedValue({
          success: true,
          message: "Permission check successfully",
          data: true,
        });
        // checkGroupMembershipがオーナーメンバーシップを返すようにモック
        mockCheckGroupMembership.mockResolvedValue({
          success: true,
          message: "グループメンバーシップを取得しました",
          data: { id: ownerMembership.id, isGroupOwner: ownerMembership.isGroupOwner },
        });

        // Act
        const result = await removeMember(testGroupId, testUsers.target, false);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: "グループオーナーを削除することはできません",
          data: null,
        });
        expect(prismaMock.groupMembership.delete).not.toHaveBeenCalled();
      });

      test("should handle authentication failure", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("Authentication failed"));

        // Act & Assert
        await expect(removeMember(testGroupId, testUsers.target, false)).rejects.toThrow("Authentication failed");
      });

      test("should handle database error during transaction", async () => {
        // Arrange
        const membership = groupMembershipFactory.build({
          userId: testUsers.target,
          isGroupOwner: false,
        });

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUsers.owner);
        mockCheckIsPermission.mockResolvedValue({
          success: true,
          message: "Permission check successfully",
          data: true,
        });
        mockCheckGroupMembership.mockResolvedValue({
          success: true,
          message: "グループメンバーシップを取得しました",
          data: { id: membership.id, isGroupOwner: membership.isGroupOwner },
        });
        prismaMock.$transaction.mockRejectedValue(new Error("Transaction failed"));

        // Act & Assert
        await expect(removeMember(testGroupId, testUsers.target, false)).rejects.toThrow("Transaction failed");
      });
    });
  });
});
