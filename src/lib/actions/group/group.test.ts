import { type CreateGroupFormData } from "@/components/form/create-group-form";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { createInvalidGroupData, groupFactory, groupMembershipFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { type GroupMembership } from "@prisma/client";
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

/**
 * モック設定
 */
vi.mock("@/lib/utils", () => ({
  getAuthenticatedSessionUserId: vi.fn(),
}));

vi.mock("@/lib/actions/permission", () => ({
  checkGroupMembership: vi.fn(),
  checkIsOwner: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

/**
 * モック関数のインポート
 */
const mockGetAuthenticatedSessionUserId = vi.mocked(await import("@/lib/utils")).getAuthenticatedSessionUserId;
const mockCheckGroupMembership = vi.mocked(await import("@/lib/actions/permission")).checkGroupMembership;
const mockCheckIsOwner = vi.mocked(await import("@/lib/actions/permission")).checkIsPermission;
const mockRevalidatePath = vi.mocked(await import("next/cache")).revalidatePath;

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

/**
 * 共通のセットアップ関数
 */
function setupCommonMocks() {
  vi.clearAllMocks();
}

function setupAuthenticationSuccess(userId: string = testUsers.user1) {
  mockGetAuthenticatedSessionUserId.mockResolvedValue(userId);
}

function setupAuthenticationFailure() {
  mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("Authentication failed"));
}

function setupOwnerPermission(hasPermission: boolean) {
  mockCheckIsOwner.mockResolvedValue({ success: hasPermission, message: "Permission check successfully" });
}

function setupGroupMembership(membership: GroupMembership | null = null) {
  mockCheckGroupMembership.mockResolvedValue(membership);
}

describe("createGroup", () => {
  beforeEach(setupCommonMocks);

  test("should create group successfully with valid data", async () => {
    // Arrange
    const expectedGroup = groupFactory.build(validGroupData);
    setupAuthenticationSuccess();
    prismaMock.group.create.mockResolvedValue(expectedGroup);

    // Act
    const result = await createGroup(validGroupData);

    // Assert
    expect(result).toStrictEqual({ success: true });
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

  test("should return error when authentication fails", async () => {
    // Arrange
    setupAuthenticationFailure();

    // Act
    const result = await createGroup(validGroupData);

    // Assert
    expect(result).toStrictEqual({ error: "エラーが発生しました" });
    expect(prismaMock.group.create).not.toHaveBeenCalled();
  });

  test("should return validation error for invalid data", async () => {
    // Arrange
    const invalidData = { name: "", goal: "", evaluationMethod: "" };
    setupAuthenticationSuccess();

    // Act
    const result = await createGroup(invalidData as unknown as CreateGroupFormData);

    // Assert
    expect(result).toStrictEqual({ error: "入力内容に誤りがあります" });
    expect(prismaMock.group.create).not.toHaveBeenCalled();
  });

  test("should handle database error during group creation", async () => {
    // Arrange
    setupAuthenticationSuccess();
    prismaMock.group.create.mockRejectedValue(new Error("Database error"));

    // Act
    const result = await createGroup(validGroupData);

    // Assert
    expect(result).toStrictEqual({ error: "エラーが発生しました" });
  });

  test("should handle missing required fields", async () => {
    // Arrange
    const invalidData = createInvalidGroupData();
    setupAuthenticationSuccess();

    // Act
    const result = await createGroup(invalidData as unknown as CreateGroupFormData);

    // Assert
    expect(result).toStrictEqual({ error: "入力内容に誤りがあります" });
  });

  test("should handle boundary values for maxParticipants", async () => {
    // Arrange
    const boundaryData = { ...validGroupData, maxParticipants: 1 };
    const expectedGroup = groupFactory.build(boundaryData);
    setupAuthenticationSuccess();
    prismaMock.group.create.mockResolvedValue(expectedGroup);

    // Act
    const result = await createGroup(boundaryData);

    // Assert
    expect(result).toStrictEqual({ success: true });
  });
});

describe("joinGroup", () => {
  beforeEach(setupCommonMocks);

  test("should join group successfully", async () => {
    // Arrange
    const group = groupFactory.build({ id: testGroupId, maxParticipants: 10 });
    const membership = groupMembershipFactory.build();

    setupAuthenticationSuccess();
    prismaMock.group.findUnique.mockResolvedValue(group);
    setupGroupMembership(null);
    prismaMock.groupMembership.count.mockResolvedValue(5);
    prismaMock.groupMembership.create.mockResolvedValue(membership);

    // Act
    const result = await joinGroup(testGroupId);

    // Assert
    expect(result).toStrictEqual({ success: true });
    expect(prismaMock.groupMembership.create).toHaveBeenCalledWith({
      data: {
        userId: testUsers.user1,
        groupId: testGroupId,
      },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/group-list");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/my-groups");
  });

  test("should return error when group not found", async () => {
    // Arrange
    setupAuthenticationSuccess();
    prismaMock.group.findUnique.mockResolvedValue(null);

    // Act
    const result = await joinGroup(testGroupId);

    // Assert
    expect(result).toStrictEqual({ error: "グループが見つかりません" });
    expect(prismaMock.groupMembership.create).not.toHaveBeenCalled();
  });

  test("should return error when user already joined", async () => {
    // Arrange
    const group = groupFactory.build({ id: testGroupId });
    const existingMembership = groupMembershipFactory.build();

    setupAuthenticationSuccess();
    prismaMock.group.findUnique.mockResolvedValue(group);
    setupGroupMembership(existingMembership);

    // Act
    const result = await joinGroup(testGroupId);

    // Assert
    expect(result).toStrictEqual({ error: "既に参加済みです" });
    expect(prismaMock.groupMembership.create).not.toHaveBeenCalled();
  });

  test("should return error when group is full", async () => {
    // Arrange
    const group = groupFactory.build({ id: testGroupId, maxParticipants: 5 });

    setupAuthenticationSuccess();
    prismaMock.group.findUnique.mockResolvedValue(group);
    setupGroupMembership(null);
    prismaMock.groupMembership.count.mockResolvedValue(5);

    // Act
    const result = await joinGroup(testGroupId);

    // Assert
    expect(result).toStrictEqual({ error: "参加人数が上限に達しています" });
    expect(prismaMock.groupMembership.create).not.toHaveBeenCalled();
  });

  test("should handle authentication failure", async () => {
    // Arrange
    setupAuthenticationFailure();

    // Act
    const result = await joinGroup(testGroupId);

    // Assert
    expect(result).toStrictEqual({ error: "エラーが発生しました" });
  });

  test("should handle database error during join", async () => {
    // Arrange
    const group = groupFactory.build({ id: testGroupId, maxParticipants: 10 });

    setupAuthenticationSuccess();
    prismaMock.group.findUnique.mockResolvedValue(group);
    setupGroupMembership(null);
    prismaMock.groupMembership.count.mockResolvedValue(5);
    prismaMock.groupMembership.create.mockRejectedValue(new Error("Database error"));

    // Act
    const result = await joinGroup(testGroupId);

    // Assert
    expect(result).toStrictEqual({ error: "エラーが発生しました" });
  });

  test("should handle boundary case when group is exactly at capacity", async () => {
    // Arrange
    const group = groupFactory.build({ id: testGroupId, maxParticipants: 1 });

    setupAuthenticationSuccess();
    prismaMock.group.findUnique.mockResolvedValue(group);
    setupGroupMembership(null);
    prismaMock.groupMembership.count.mockResolvedValue(1);

    // Act
    const result = await joinGroup(testGroupId);

    // Assert
    expect(result).toStrictEqual({ error: "参加人数が上限に達しています" });
  });
});

describe("deleteGroup", () => {
  beforeEach(setupCommonMocks);

  test("should delete group successfully", async () => {
    // Arrange
    const group = groupFactory.build({ id: testGroupId, createdBy: testUsers.user1 });

    setupAuthenticationSuccess();
    prismaMock.group.findUnique.mockResolvedValue(group);
    prismaMock.group.delete.mockResolvedValue(group);

    // Act
    const result = await deleteGroup(testGroupId);

    // Assert
    expect(result).toStrictEqual({ success: true });
    expect(prismaMock.group.delete).toHaveBeenCalledWith({
      where: { id: testGroupId },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/group-list");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/my-groups");
  });

  test("should return error when group not found", async () => {
    // Arrange
    setupAuthenticationSuccess();
    prismaMock.group.findUnique.mockResolvedValue(null);

    // Act
    const result = await deleteGroup(testGroupId);

    // Assert
    expect(result).toStrictEqual({ error: "グループが見つかりません" });
    expect(prismaMock.group.delete).not.toHaveBeenCalled();
  });

  test("should return error when user is not group creator", async () => {
    // Arrange
    const group = groupFactory.build({ id: testGroupId, createdBy: "other-user" });

    setupAuthenticationSuccess();
    prismaMock.group.findUnique.mockResolvedValue(group);

    // Act
    const result = await deleteGroup(testGroupId);

    // Assert
    expect(result).toStrictEqual({ error: "グループの削除権限がありません" });
    expect(prismaMock.group.delete).not.toHaveBeenCalled();
  });

  test("should handle authentication failure", async () => {
    // Arrange
    setupAuthenticationFailure();

    // Act
    const result = await deleteGroup(testGroupId);

    // Assert
    expect(result).toStrictEqual({
      error: "グループの削除中にエラーが発生しました",
    });
  });

  test("should handle database error during deletion", async () => {
    // Arrange
    const group = groupFactory.build({ id: testGroupId, createdBy: testUsers.user1 });

    setupAuthenticationSuccess();
    prismaMock.group.findUnique.mockResolvedValue(group);
    prismaMock.group.delete.mockRejectedValue(new Error("Database error"));

    // Act
    const result = await deleteGroup(testGroupId);

    // Assert
    expect(result).toStrictEqual({
      error: "グループの削除中にエラーが発生しました",
    });
  });
});

describe("checkGroupExistByName", () => {
  beforeEach(setupCommonMocks);

  test("should return true when group exists", async () => {
    // Arrange
    const groupName = "既存グループ";
    const existingGroup = groupFactory.build({ name: groupName });
    prismaMock.group.findFirst.mockResolvedValue(existingGroup);

    // Act
    const result = await checkGroupExistByName(groupName);

    // Assert
    expect(result).toBe(true);
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
    expect(result).toBe(false);
    expect(prismaMock.group.findFirst).toHaveBeenCalledWith({
      where: { name: groupName },
    });
  });

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
    prismaMock.group.findFirst.mockResolvedValue(null);

    // Act
    const result = await checkGroupExistByName(groupName);

    // Assert
    expect(result).toBe(false);
  });

  test("should handle special characters in name", async () => {
    // Arrange
    const groupName = "テスト@#$%グループ";
    prismaMock.group.findFirst.mockResolvedValue(null);

    // Act
    const result = await checkGroupExistByName(groupName);

    // Assert
    expect(result).toBe(false);
    expect(prismaMock.group.findFirst).toHaveBeenCalledWith({
      where: { name: groupName },
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

  beforeEach(setupCommonMocks);

  test("should update group successfully", async () => {
    // Arrange
    const existingGroup = groupFactory.build({
      id: testGroupId,
      createdBy: testUsers.user1,
      name: "元のグループ名",
    });
    const updatedGroup = groupFactory.build({ ...validUpdateData, id: testGroupId });

    setupAuthenticationSuccess();
    prismaMock.group.findUnique.mockResolvedValue(existingGroup);
    prismaMock.group.findFirst.mockResolvedValue(null);
    prismaMock.group.update.mockResolvedValue(updatedGroup);

    // Act
    const result = await updateGroup(testGroupId, validUpdateData);

    // Assert
    expect(result).toStrictEqual({ success: true });
    expect(prismaMock.group.update).toHaveBeenCalledWith({
      where: { id: testGroupId },
      data: validUpdateData,
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/group-list");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/my-groups");
  });

  test("should return error when group not found", async () => {
    // Arrange
    setupAuthenticationSuccess();
    prismaMock.group.findUnique.mockResolvedValue(null);

    // Act
    const result = await updateGroup(testGroupId, validUpdateData);

    // Assert
    expect(result).toStrictEqual({ error: "グループが見つかりません" });
    expect(prismaMock.group.update).not.toHaveBeenCalled();
  });

  test("should return error when user is not group creator", async () => {
    // Arrange
    const existingGroup = groupFactory.build({
      id: testGroupId,
      createdBy: "other-user",
    });

    setupAuthenticationSuccess();
    prismaMock.group.findUnique.mockResolvedValue(existingGroup);

    // Act
    const result = await updateGroup(testGroupId, validUpdateData);

    // Assert
    expect(result).toStrictEqual({ error: "グループの編集権限がありません" });
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

    setupAuthenticationSuccess();
    prismaMock.group.findUnique.mockResolvedValue(existingGroup);
    prismaMock.group.findFirst.mockResolvedValue(duplicateGroup);

    // Act
    const result = await updateGroup(testGroupId, validUpdateData);

    // Assert
    expect(result).toStrictEqual({
      error: "このグループ名は既に使用されています",
    });
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

    setupAuthenticationSuccess();
    prismaMock.group.findUnique.mockResolvedValue(existingGroup);
    prismaMock.group.update.mockResolvedValue(existingGroup);

    // Act
    const result = await updateGroup(testGroupId, updateDataWithSameName);

    // Assert
    expect(result).toStrictEqual({ success: true });
    expect(prismaMock.group.findFirst).not.toHaveBeenCalled();
  });

  test("should return validation error for invalid data", async () => {
    // Arrange
    const existingGroup = groupFactory.build({
      id: testGroupId,
      createdBy: testUsers.user1,
    });
    const invalidData = { name: "", goal: "", evaluationMethod: "" };

    setupAuthenticationSuccess();
    prismaMock.group.findUnique.mockResolvedValue(existingGroup);

    // Act
    const result = await updateGroup(testGroupId, invalidData as unknown as CreateGroupFormData);

    // Assert
    expect(result).toStrictEqual({ error: "入力内容に誤りがあります" });
    expect(prismaMock.group.update).not.toHaveBeenCalled();
  });

  test("should handle database error during update", async () => {
    // Arrange
    const existingGroup = groupFactory.build({
      id: testGroupId,
      createdBy: testUsers.user1,
      name: "元のグループ名",
    });

    setupAuthenticationSuccess();
    prismaMock.group.findUnique.mockResolvedValue(existingGroup);
    prismaMock.group.findFirst.mockResolvedValue(null);
    prismaMock.group.update.mockRejectedValue(new Error("Database error"));

    // Act
    const result = await updateGroup(testGroupId, validUpdateData);

    // Assert
    expect(result).toStrictEqual({
      error: "グループの更新中にエラーが発生しました",
    });
  });
});

describe("getGroupMembers", () => {
  beforeEach(setupCommonMocks);

  test("should return group members successfully", async () => {
    // Arrange
    const mockMembers = [
      {
        isGroupOwner: true,
        user: { id: "user-1", name: "オーナーユーザー" },
      },
      {
        isGroupOwner: false,
        user: { id: "user-2", name: "一般ユーザー" },
      },
      {
        isGroupOwner: false,
        user: { id: "user-3", name: null },
      },
    ];

    prismaMock.groupMembership.findMany.mockResolvedValue(
      mockMembers as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
    );

    // Act
    const result = await getGroupMembers(testGroupId);

    // Assert
    expect(result).toStrictEqual([
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
        appUserName: "未設定",
      },
    ]);

    expect(prismaMock.groupMembership.findMany).toHaveBeenCalledWith({
      where: { groupId: testGroupId },
      select: {
        isGroupOwner: true,
        user: {
          select: {
            id: true,
            name: true,
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
    expect(result).toStrictEqual([]);
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
        user: { id: "user-1", name: null },
      },
    ];

    prismaMock.groupMembership.findMany.mockResolvedValue(
      mockMembers as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
    );

    // Act
    const result = await getGroupMembers(testGroupId);

    // Assert
    expect(result).toStrictEqual([
      {
        isGroupOwner: false,
        userId: "user-1",
        appUserName: "未設定",
      },
    ]);
  });
});

describe("removeMember", () => {
  beforeEach(setupCommonMocks);

  test("should remove member successfully without blacklist", async () => {
    // Arrange
    const membership = groupMembershipFactory.build({
      id: "membership-1",
      userId: testUsers.target,
      isGroupOwner: false,
    });

    setupAuthenticationSuccess(testUsers.owner);
    setupOwnerPermission(true);
    setupGroupMembership(membership);
    prismaMock.$transaction.mockImplementation(async (callback) => {
      return await callback(prismaMock);
    });
    prismaMock.groupMembership.delete.mockResolvedValue(membership);

    // Act
    const result = await removeMember(testGroupId, testUsers.target, false);

    // Assert
    expect(result).toStrictEqual({ success: true });
    expect(prismaMock.groupMembership.delete).toHaveBeenCalledWith({
      where: { id: membership.id },
    });
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

    setupAuthenticationSuccess(testUsers.owner);
    setupOwnerPermission(true);
    setupGroupMembership(membership);
    prismaMock.$transaction.mockImplementation(async (callback) => {
      return await callback(prismaMock);
    });
    prismaMock.groupMembership.delete.mockResolvedValue(membership);
    prismaMock.group.findUnique.mockResolvedValue(group);
    prismaMock.group.update.mockResolvedValue(group);

    // Act
    const result = await removeMember(testGroupId, testUsers.target, true);

    // Assert
    expect(result).toStrictEqual({ success: true });
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

  test("should return error when user is not owner", async () => {
    // Arrange
    setupAuthenticationSuccess(testUsers.owner);
    setupOwnerPermission(false);

    // Act
    const result = await removeMember(testGroupId, testUsers.target, false);

    // Assert
    expect(result).toStrictEqual({
      error: "グループメンバーを削除する権限がありません",
    });
    expect(prismaMock.groupMembership.delete).not.toHaveBeenCalled();
  });

  test("should return error when target user is not member", async () => {
    // Arrange
    setupAuthenticationSuccess(testUsers.owner);
    setupOwnerPermission(true);
    setupGroupMembership(null);

    // Act
    const result = await removeMember(testGroupId, testUsers.target, false);

    // Assert
    expect(result).toStrictEqual({
      error: "指定されたユーザーはグループに参加していません",
    });
    expect(prismaMock.groupMembership.delete).not.toHaveBeenCalled();
  });

  test("should return error when trying to remove self", async () => {
    // Arrange
    const membership = groupMembershipFactory.build({
      userId: testUsers.owner,
      isGroupOwner: false,
    });

    setupAuthenticationSuccess(testUsers.owner);
    setupOwnerPermission(true);
    setupGroupMembership(membership);

    // Act
    const result = await removeMember(testGroupId, testUsers.owner, false);

    // Assert
    expect(result).toStrictEqual({
      error: "自分自身を削除することはできません",
    });
    expect(prismaMock.groupMembership.delete).not.toHaveBeenCalled();
  });

  test("should return error when trying to remove group owner", async () => {
    // Arrange
    const ownerMembership = groupMembershipFactory.build({
      userId: testUsers.target,
      isGroupOwner: true,
    });

    setupAuthenticationSuccess(testUsers.owner);
    setupOwnerPermission(true);
    setupGroupMembership(ownerMembership);

    // Act
    const result = await removeMember(testGroupId, testUsers.target, false);

    // Assert
    expect(result).toStrictEqual({
      error: "グループオーナーを削除することはできません",
    });
    expect(prismaMock.groupMembership.delete).not.toHaveBeenCalled();
  });

  test("should handle authentication failure", async () => {
    // Arrange
    setupAuthenticationFailure();

    // Act
    const result = await removeMember(testGroupId, testUsers.target, false);

    // Assert
    expect(result).toStrictEqual({
      error: "メンバー削除中にエラーが発生しました",
    });
  });

  test("should handle database error during transaction", async () => {
    // Arrange
    const membership = groupMembershipFactory.build({
      userId: testUsers.target,
      isGroupOwner: false,
    });

    setupAuthenticationSuccess(testUsers.owner);
    setupOwnerPermission(true);
    setupGroupMembership(membership);
    prismaMock.$transaction.mockRejectedValue(new Error("Transaction failed"));

    // Act
    const result = await removeMember(testGroupId, testUsers.target, false);

    // Assert
    expect(result).toStrictEqual({
      error: "メンバー削除中にエラーが発生しました",
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

    setupAuthenticationSuccess(testUsers.owner);
    setupOwnerPermission(true);
    setupGroupMembership(membership);
    prismaMock.$transaction.mockImplementation(async (callback) => {
      return await callback(prismaMock);
    });
    prismaMock.groupMembership.delete.mockResolvedValue(membership);
    prismaMock.group.findUnique.mockResolvedValue(group);
    prismaMock.group.update.mockResolvedValue(group);

    // Act
    const result = await removeMember(testGroupId, testUsers.target, true);

    // Assert
    expect(result).toStrictEqual({ success: true });
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
