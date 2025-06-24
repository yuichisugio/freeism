import { revalidatePath } from "next/cache";
// モック関数のインポート
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { groupFactory, groupMembershipFactory, userFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { checkGroupMembership, checkOneGroupOwner, grantOwnerPermission } from "./permission";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モックを定義
 */
// テストファイル内でモックを上書きして実際の実装を使用
vi.mock("@/lib/actions/permission", async (importOriginal) => {
  const actual = await importOriginal();
  return actual;
});

// revalidatePathのモック
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// getAuthenticatedSessionUserIdのモック
vi.mock("@/lib/utils", () => ({
  getAuthenticatedSessionUserId: vi.fn(),
}));

const mockGetAuthenticatedSessionUserId = vi.mocked(getAuthenticatedSessionUserId);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数の型を定義
 */
const mockRevalidatePath = vi.mocked(revalidatePath);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 共通テストデータの準備
 */
const testUser = userFactory.build({ id: "test-user-1", isAppOwner: false });
const testGroup = groupFactory.build({ id: "test-group-1", createdBy: testUser.id });
const testGroupMembership = groupMembershipFactory.build({
  id: "test-membership-1",
  userId: testUser.id,
  groupId: testGroup.id,
  isGroupOwner: true,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 各テスト前にモックをリセット
 */
beforeEach(() => {
  // 各テスト前にモックをリセット
  vi.clearAllMocks();

  // デフォルトの認証されたユーザーIDを設定
  mockGetAuthenticatedSessionUserId.mockResolvedValue("authenticated-user-id");

  // revalidatePathのデフォルト実装をリセット
  mockRevalidatePath.mockImplementation(() => {
    // 何もしない
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テスト
 */
describe("permission.ts", () => {
  describe("grantOwnerPermission", () => {
    describe("正常系", () => {
      test("should grant owner permission successfully", async () => {
        // Arrange
        const operatorUser = userFactory.build({ id: "authenticated-user-id" });
        const targetUser = userFactory.build({ id: "target-user" });
        const operatorMembership = groupMembershipFactory.build({
          id: "operator-membership",
          userId: operatorUser.id,
          groupId: testGroup.id,
          isGroupOwner: true,
        });
        const targetMembership = groupMembershipFactory.build({
          id: "target-membership",
          userId: targetUser.id,
          groupId: testGroup.id,
          isGroupOwner: false,
        });

        // checkIsPermissionのモック（操作者がオーナー権限あり）
        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.groupMembership.findFirst
          .mockResolvedValueOnce(operatorMembership)
          .mockResolvedValueOnce(targetMembership);
        prismaMock.groupMembership.update.mockResolvedValue({
          ...targetMembership,
          isGroupOwner: true,
        });

        // Act
        const result = await grantOwnerPermission(testGroup.id, targetUser.id);

        // Assert
        expect(result).toStrictEqual({ success: true, message: "グループオーナー権限を付与しました" });
        expect(prismaMock.groupMembership.update).toHaveBeenCalledWith({
          where: { id: targetMembership.id },
          data: { isGroupOwner: true },
        });
        expect(mockRevalidatePath).toHaveBeenCalledWith(`/dashboard/group/${testGroup.id}`);
      });

      test("should grant permission when user is app owner", async () => {
        // Arrange
        const appOwner = userFactory.build({ id: "authenticated-user-id", isAppOwner: true });
        const targetUser = userFactory.build({ id: "target-user" });
        const targetMembership = groupMembershipFactory.build({
          id: "target-membership",
          userId: targetUser.id,
          groupId: testGroup.id,
          isGroupOwner: false,
        });

        // checkIsPermissionのモック（アプリオーナー）
        prismaMock.user.findUnique.mockResolvedValue(appOwner);
        prismaMock.groupMembership.findFirst.mockResolvedValueOnce(targetMembership);
        prismaMock.groupMembership.update.mockResolvedValue({
          ...targetMembership,
          isGroupOwner: true,
        });

        // Act
        const result = await grantOwnerPermission(testGroup.id, targetUser.id);

        // Assert
        expect(result).toStrictEqual({ success: true, message: "グループオーナー権限を付与しました" });
        expect(prismaMock.groupMembership.update).toHaveBeenCalledWith({
          where: { id: targetMembership.id },
          data: { isGroupOwner: true },
        });
        expect(mockRevalidatePath).toHaveBeenCalledWith(`/dashboard/group/${testGroup.id}`);
      });
    });

    describe("異常系", () => {
      describe("パラメータ検証エラー", () => {
        test.each([
          { groupId: "", userId: "valid-user-id", description: "groupId is empty string" },
          { groupId: "valid-group-id", userId: "", description: "userId is empty string" },
          { groupId: "", userId: "", description: "both parameters are empty strings" },
          { groupId: null as unknown as string, userId: "valid-user-id", description: "groupId is null" },
          { groupId: "valid-group-id", userId: null as unknown as string, description: "userId is null" },
          { groupId: undefined as unknown as string, userId: "valid-user-id", description: "groupId is undefined" },
          { groupId: "valid-group-id", userId: undefined as unknown as string, description: "userId is undefined" },
        ])("should return error when $description", async ({ groupId, userId }) => {
          // Act
          const result = await grantOwnerPermission(groupId, userId);

          // Assert
          expect(result).toStrictEqual({
            success: false,
            message: "グループオーナー権限の付与中にエラーが発生しました: 無効なパラメータが指定されました",
          });
        });
      });

      test("should return error when user has no owner permission", async () => {
        // Arrange
        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.groupMembership.findFirst.mockResolvedValue(null);

        // Act
        const result = await grantOwnerPermission(testGroup.id, testUser.id);

        // Assert
        expect(result).toStrictEqual({ success: false, message: "アプリオーナー or グループオーナー権限がありません" });
      });

      test("should return error when target user is not group member", async () => {
        // Arrange
        const targetUser = userFactory.build({ id: "target-user" });
        const operatorMembership = groupMembershipFactory.build({
          userId: "authenticated-user-id",
          groupId: testGroup.id,
          isGroupOwner: true,
        });

        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.groupMembership.findFirst.mockResolvedValueOnce(operatorMembership).mockResolvedValueOnce(null);

        // Act
        const result = await grantOwnerPermission(testGroup.id, targetUser.id);

        // Assert
        expect(result).toStrictEqual({ success: false, message: "指定されたユーザーはグループに参加していません" });
      });

      test("should return error when target user is already owner", async () => {
        // Arrange
        const targetUser = userFactory.build({ id: "target-user" });
        const operatorMembership = groupMembershipFactory.build({
          userId: "authenticated-user-id",
          groupId: testGroup.id,
          isGroupOwner: true,
        });
        const targetMembership = groupMembershipFactory.build({
          userId: targetUser.id,
          groupId: testGroup.id,
          isGroupOwner: true,
        });

        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.groupMembership.findFirst
          .mockResolvedValueOnce(operatorMembership)
          .mockResolvedValueOnce(targetMembership);

        // Act
        const result = await grantOwnerPermission(testGroup.id, targetUser.id);

        // Assert
        expect(result).toStrictEqual({ success: false, message: "指定されたユーザーは既にグループオーナーです" });
      });

      test("should handle database error gracefully", async () => {
        // Arrange
        const targetUser = userFactory.build({ id: "target-user" });
        const operatorMembership = groupMembershipFactory.build({
          userId: "authenticated-user-id",
          groupId: testGroup.id,
          isGroupOwner: true,
        });
        const targetMembership = groupMembershipFactory.build({
          userId: targetUser.id,
          groupId: testGroup.id,
          isGroupOwner: false,
        });

        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.groupMembership.findFirst
          .mockResolvedValueOnce(operatorMembership)
          .mockResolvedValueOnce(targetMembership);
        prismaMock.groupMembership.update.mockRejectedValue(new Error("Database error"));

        // Act
        const result = await grantOwnerPermission(testGroup.id, targetUser.id);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: "グループオーナー権限の付与中にエラーが発生しました: Database error",
        });
      });

      test("should handle unknown error gracefully", async () => {
        // Arrange
        const targetUser = userFactory.build({ id: "target-user" });
        const operatorMembership = groupMembershipFactory.build({
          userId: "authenticated-user-id",
          groupId: testGroup.id,
          isGroupOwner: true,
        });
        const targetMembership = groupMembershipFactory.build({
          userId: targetUser.id,
          groupId: testGroup.id,
          isGroupOwner: false,
        });

        // checkIsPermission内のprisma callは成功させる
        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.groupMembership.findFirst
          .mockResolvedValueOnce(operatorMembership) // 1回目: checkIsPermissionは成功
          .mockResolvedValueOnce(targetMembership); // 2回目: checkGroupMembershipも成功

        // prisma.groupMembership.updateで未知のエラーを発生させる
        prismaMock.groupMembership.update.mockRejectedValue("Unknown error");

        // Act
        const result = await grantOwnerPermission(testGroup.id, targetUser.id);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: "グループオーナー権限の付与中にエラーが発生しました: 不明なエラー",
        });
      });
    });

    describe("境界値テスト", () => {
      test("should handle when same user tries to grant permission to themselves", async () => {
        // Arrange
        const sameUser = userFactory.build({ id: "authenticated-user-id" });
        const operatorMembership = groupMembershipFactory.build({
          id: "operator-membership",
          userId: sameUser.id,
          groupId: testGroup.id,
          isGroupOwner: true,
        });
        const targetMembership = groupMembershipFactory.build({
          id: "target-membership",
          userId: sameUser.id,
          groupId: testGroup.id,
          isGroupOwner: true,
        });

        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.groupMembership.findFirst
          .mockResolvedValueOnce(operatorMembership)
          .mockResolvedValueOnce(targetMembership);

        // Act
        const result = await grantOwnerPermission(testGroup.id, sameUser.id);

        // Assert
        expect(result).toStrictEqual({ success: false, message: "指定されたユーザーは既にグループオーナーです" });
      });
    });
  });

  describe("checkGroupMembership", () => {
    describe("正常系", () => {
      test("should return membership when user is group member", async () => {
        // Arrange
        const expectedMembership = {
          id: testGroupMembership.id,
          isGroupOwner: testGroupMembership.isGroupOwner,
        };
        prismaMock.groupMembership.findFirst.mockResolvedValue(
          expectedMembership as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findFirst>>,
        );

        // Act
        const result = await checkGroupMembership(testUser.id, testGroup.id);

        // Assert
        expect(result).toStrictEqual(expectedMembership);
        expect(prismaMock.groupMembership.findFirst).toHaveBeenCalledWith({
          where: {
            userId: testUser.id,
            groupId: testGroup.id,
          },
          select: {
            id: true,
            isGroupOwner: true,
          },
        });
      });

      test("should return null when user is not group member", async () => {
        // Arrange
        prismaMock.groupMembership.findFirst.mockResolvedValue(null);

        // Act
        const result = await checkGroupMembership(testUser.id, testGroup.id);

        // Assert
        expect(result).toBeNull();
      });
    });

    describe("異常系", () => {
      test("should return null when database error occurs", async () => {
        // Arrange
        prismaMock.groupMembership.findFirst.mockRejectedValue(new Error("Database error"));

        // Act
        const result = await checkGroupMembership(testUser.id, testGroup.id);

        // Assert
        expect(result).toBeNull();
      });

      test.each([
        { userId: null as unknown as string, groupId: testGroup.id },
        { userId: testUser.id, groupId: null as unknown as string },
        { userId: "", groupId: "" },
      ])("should handle null parameters", async ({ userId, groupId }) => {
        // Arrange
        prismaMock.groupMembership.findFirst.mockResolvedValue(null);

        // Act & Assert
        expect(await checkGroupMembership(userId, groupId)).toBeNull();
      });
    });
  });

  describe("checkOneGroupOwner", () => {
    describe("正常系", () => {
      test("should return success true when user has at least one group owner permission", async () => {
        // Arrange
        const ownerMembership = groupMembershipFactory.build({
          userId: testUser.id,
          groupId: testGroup.id,
          isGroupOwner: true,
        });
        prismaMock.groupMembership.findFirst.mockResolvedValue(ownerMembership);

        // Act
        const result = await checkOneGroupOwner(testUser.id);

        // Assert
        expect(result).toStrictEqual({ success: true, message: "グループオーナー権限があります" });
        expect(prismaMock.groupMembership.findFirst).toHaveBeenCalledWith({
          where: {
            userId: testUser.id,
            isGroupOwner: true,
          },
          select: {
            groupId: true,
          },
        });
      });

      test("should return error when user has no group owner permissions", async () => {
        // Arrange
        prismaMock.groupMembership.findFirst.mockResolvedValue(null);

        // Act
        const result = await checkOneGroupOwner(testUser.id);

        // Assert
        expect(result).toStrictEqual({ success: false, message: "グループオーナー権限がありません" });
      });
    });

    describe("異常系", () => {
      test.each([{ userId: null }, { userId: undefined }, { userId: "" }])(
        "should throw error for %s",
        async ({ userId }) => {
          // Act & Assert
          await expect(checkOneGroupOwner(userId as unknown as string)).rejects.toThrow(
            "無効なパラメータが指定されました",
          );
        },
      );
    });
  });
});
