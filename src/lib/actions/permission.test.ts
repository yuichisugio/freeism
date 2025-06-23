import { revalidatePath } from "next/cache";
// モック関数のインポート
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import {
  groupFactory,
  groupMembershipFactory,
  taskFactory,
  userFactory,
} from "@/test/test-utils/test-utils-prisma-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  checkGroupMembership,
  checkIsAppOwner,
  checkIsOwner,
  checkOneGroupOwner,
  grantOwnerPermission,
} from "./permission";

// テストファイル内でモックを上書きして実際の実装を使用
vi.mock("@/lib/actions/permission", async (importOriginal) => {
  const actual = await importOriginal();
  return actual;
});

// getAuthenticatedSessionUserIdのモック
vi.mock("@/lib/utils", () => ({
  getAuthenticatedSessionUserId: vi.fn(),
}));

// revalidatePathのモック
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockGetAuthenticatedSessionUserId = vi.mocked(getAuthenticatedSessionUserId);
const mockRevalidatePath = vi.mocked(revalidatePath);

describe("permission.ts", () => {
  // 共通テストデータの準備
  const testUser = userFactory.build({ id: "test-user-1", isAppOwner: false });
  const testAppOwner = userFactory.build({ id: "test-app-owner", isAppOwner: true });
  const testGroup = groupFactory.build({ id: "test-group-1", createdBy: testUser.id });
  const testTask = taskFactory.build({ id: "test-task-1", groupId: testGroup.id, creatorId: testUser.id });
  const testGroupMembership = groupMembershipFactory.build({
    id: "test-membership-1",
    userId: testUser.id,
    groupId: testGroup.id,
    isGroupOwner: true,
  });

  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  // 共通テストヘルパー関数
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("checkIsOwner", () => {
    describe("正常系", () => {
      test("should return success true when user is app owner", async () => {
        // Arrange
        prismaMock.user.findFirst.mockResolvedValue(testAppOwner);

        // Act
        const result = await checkIsOwner(testAppOwner.id, testGroup.id);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
          where: {
            id: testAppOwner.id,
            isAppOwner: true,
          },
        });
      });

      test("should return success true when user is group owner", async () => {
        // Arrange
        prismaMock.user.findFirst.mockResolvedValue(null); // アプリオーナーではない
        prismaMock.groupMembership.findFirst.mockResolvedValue(testGroupMembership);

        // Act
        const result = await checkIsOwner(testUser.id, testGroup.id);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(prismaMock.groupMembership.findFirst).toHaveBeenCalledWith({
          where: {
            userId: testUser.id,
            groupId: testGroup.id,
            isGroupOwner: true,
          },
        });
      });

      test("should return success false when user has no owner permissions", async () => {
        // Arrange
        prismaMock.user.findFirst.mockResolvedValue(null);
        prismaMock.groupMembership.findFirst.mockResolvedValue(null);

        // Act
        const result = await checkIsOwner(testUser.id, testGroup.id);

        // Assert
        expect(result).toStrictEqual({ success: false });
      });

      test("should get userId from session when not provided", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.user.findFirst.mockResolvedValue(null);
        prismaMock.groupMembership.findFirst.mockResolvedValue(testGroupMembership);

        // Act
        const result = await checkIsOwner(undefined, testGroup.id);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalled();
      });

      test("should get groupId from taskId when groupId not provided", async () => {
        // Arrange
        prismaMock.task.findUnique.mockResolvedValue(testTask);
        prismaMock.user.findFirst.mockResolvedValue(null);
        prismaMock.groupMembership.findFirst.mockResolvedValue(testGroupMembership);

        // Act
        const result = await checkIsOwner(testUser.id, undefined, testTask.id);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(prismaMock.task.findUnique).toHaveBeenCalledWith({
          where: { id: testTask.id },
          select: { groupId: true },
        });
      });

      describe("isRoleCheck scenarios", () => {
        test("should return success true when user is task creator", async () => {
          // Arrange
          const taskWithCreator = {
            creator: { id: testUser.id },
            reporters: [],
            executors: [],
          };
          prismaMock.task.findUnique.mockResolvedValue(taskWithCreator as unknown as typeof testTask);

          // Act
          const result = await checkIsOwner(testUser.id, undefined, testTask.id, true);

          // Assert
          expect(result).toStrictEqual({ success: true });
          expect(prismaMock.task.findUnique).toHaveBeenCalledWith({
            where: { id: testTask.id },
            select: {
              creator: { select: { id: true } },
              reporters: {
                where: { userId: testUser.id, taskId: testTask.id },
                select: { id: true },
              },
              executors: {
                where: { userId: testUser.id, taskId: testTask.id },
                select: { id: true },
              },
            },
          });
        });

        test("should return success true when user is task reporter", async () => {
          // Arrange
          const taskWithReporter = {
            creator: { id: "other-user" },
            reporters: [{ id: "reporter-1" }],
            executors: [],
          };
          prismaMock.task.findUnique.mockResolvedValue(taskWithReporter as unknown as typeof testTask);

          // Act
          const result = await checkIsOwner(testUser.id, undefined, testTask.id, true);

          // Assert
          expect(result).toStrictEqual({ success: true });
        });

        test("should return success true when user is task executor", async () => {
          // Arrange
          const taskWithExecutor = {
            creator: { id: "other-user" },
            reporters: [],
            executors: [{ id: "executor-1" }],
          };
          prismaMock.task.findUnique.mockResolvedValue(taskWithExecutor as unknown as typeof testTask);

          // Act
          const result = await checkIsOwner(testUser.id, undefined, testTask.id, true);

          // Assert
          expect(result).toStrictEqual({ success: true });
        });
      });
    });

    describe("異常系", () => {
      test("should return error when taskId not provided for role check", async () => {
        // Act
        const result = await checkIsOwner(testUser.id, testGroup.id, undefined, true);

        // Assert
        expect(result).toStrictEqual({ success: false, error: "タスクIDが指定されていません" });
      });

      test("should return error when task not found", async () => {
        // Arrange
        prismaMock.task.findUnique.mockResolvedValue(null);

        // Act
        const result = await checkIsOwner(testUser.id, undefined, testTask.id, true);

        // Assert
        expect(result).toStrictEqual({ success: false, error: "タスクが見つかりません" });
      });

      test("should return error when task not found for groupId extraction", async () => {
        // Arrange
        prismaMock.task.findUnique.mockResolvedValue(null);

        // Act
        const result = await checkIsOwner(testUser.id, undefined, testTask.id);

        // Assert
        expect(result).toStrictEqual({ success: false, error: "タスクが見つかりません" });
      });

      test("should handle database error gracefully", async () => {
        // Arrange
        prismaMock.user.findFirst.mockRejectedValue(new Error("Database error"));

        // Act
        const result = await checkIsOwner(testUser.id, testGroup.id);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          error: "グループオーナー権限のチェック中にエラーが発生しました",
        });
      });
    });

    describe("境界値テスト", () => {
      test("should handle null parameter", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue("session-user-id");
        prismaMock.user.findFirst.mockResolvedValue(null);
        prismaMock.groupMembership.findFirst.mockResolvedValue(null);

        // Act
        const result = await checkIsOwner(null as unknown as string, testGroup.id);

        // Assert
        expect(result.success).toBe(false);
      });

      test("should handle undefined parameter", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue("session-user-id");
        prismaMock.user.findFirst.mockResolvedValue(null);
        prismaMock.groupMembership.findFirst.mockResolvedValue(null);

        // Act
        const result = await checkIsOwner(undefined as unknown as string, testGroup.id);

        // Assert
        expect(result.success).toBe(false);
      });

      test("should handle empty string parameter", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue("session-user-id");
        prismaMock.user.findFirst.mockResolvedValue(null);
        prismaMock.groupMembership.findFirst.mockResolvedValue(null);

        // Act
        const result = await checkIsOwner("", testGroup.id);

        // Assert
        expect(result.success).toBe(false);
      });

      test("should handle undefined groupId and taskId", async () => {
        // Arrange
        prismaMock.user.findFirst.mockResolvedValue(null);
        prismaMock.groupMembership.findFirst.mockResolvedValue(null);

        // Act
        const result = await checkIsOwner(testUser.id, undefined, undefined);

        // Assert
        expect(result).toStrictEqual({ success: false });
      });
    });
  });

  describe("grantOwnerPermission", () => {
    describe("正常系", () => {
      test("should grant owner permission successfully", async () => {
        // Arrange
        const operatorUser = userFactory.build({ id: "operator-user" });
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

        // checkIsOwnerのモック（操作者がオーナー権限あり）
        prismaMock.user.findFirst.mockResolvedValue(null);
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
        expect(result).toStrictEqual({ success: true });
        expect(prismaMock.groupMembership.update).toHaveBeenCalledWith({
          where: { id: targetMembership.id },
          data: { isGroupOwner: true },
        });
        expect(mockRevalidatePath).toHaveBeenCalledWith(`/dashboard/group/${testGroup.id}`);
      });
    });

    describe("異常系", () => {
      test("should return error when user has no owner permission", async () => {
        // Arrange
        prismaMock.user.findFirst.mockResolvedValue(null);
        prismaMock.groupMembership.findFirst.mockResolvedValue(null);

        // Act
        const result = await grantOwnerPermission(testGroup.id, testUser.id);

        // Assert
        expect(result).toStrictEqual({ success: false, error: "グループオーナー権限がありません" });
      });

      test("should return error when target user is not group member", async () => {
        // Arrange
        const targetUser = userFactory.build({ id: "target-user" });
        const operatorMembership = groupMembershipFactory.build({
          userId: testUser.id,
          groupId: testGroup.id,
          isGroupOwner: true,
        });

        prismaMock.user.findFirst.mockResolvedValue(null);
        prismaMock.groupMembership.findFirst.mockResolvedValueOnce(operatorMembership).mockResolvedValueOnce(null);

        // Act
        const result = await grantOwnerPermission(testGroup.id, targetUser.id);

        // Assert
        expect(result).toStrictEqual({ success: false, error: "指定されたユーザーはグループに参加していません" });
      });

      test("should return error when target user is already owner", async () => {
        // Arrange
        const targetUser = userFactory.build({ id: "target-user" });
        const operatorMembership = groupMembershipFactory.build({
          userId: testUser.id,
          groupId: testGroup.id,
          isGroupOwner: true,
        });
        const targetMembership = groupMembershipFactory.build({
          userId: targetUser.id,
          groupId: testGroup.id,
          isGroupOwner: true,
        });

        prismaMock.user.findFirst.mockResolvedValue(null);
        prismaMock.groupMembership.findFirst
          .mockResolvedValueOnce(operatorMembership)
          .mockResolvedValueOnce(targetMembership);

        // Act
        const result = await grantOwnerPermission(testGroup.id, targetUser.id);

        // Assert
        expect(result).toStrictEqual({ success: false, error: "指定されたユーザーは既にグループオーナーです" });
      });

      test("should handle database error gracefully", async () => {
        // Arrange
        const operatorMembership = groupMembershipFactory.build({
          userId: testUser.id,
          groupId: testGroup.id,
          isGroupOwner: true,
        });
        const targetMembership = groupMembershipFactory.build({
          userId: testUser.id,
          groupId: testGroup.id,
          isGroupOwner: false,
        });

        prismaMock.user.findFirst.mockResolvedValue(null);
        prismaMock.groupMembership.findFirst
          .mockResolvedValueOnce(operatorMembership)
          .mockResolvedValueOnce(targetMembership);
        prismaMock.groupMembership.update.mockRejectedValue(new Error("Database error"));

        // Act
        const result = await grantOwnerPermission(testGroup.id, testUser.id);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          error: "グループオーナー権限の付与中にエラーが発生しました",
        });
      });
    });
  });

  describe("checkIsAppOwner", () => {
    describe("正常系", () => {
      test("should return success true when user is app owner", async () => {
        // Arrange
        prismaMock.user.findUnique.mockResolvedValue(testAppOwner);

        // Act
        const result = await checkIsAppOwner(testAppOwner.id);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
          where: { id: testAppOwner.id },
          select: { isAppOwner: true },
        });
      });

      test("should return success false when user is not app owner", async () => {
        // Arrange
        prismaMock.user.findUnique.mockResolvedValue(testUser);

        // Act
        const result = await checkIsAppOwner(testUser.id);

        // Assert
        expect(result).toStrictEqual({ success: false });
      });
    });

    describe("異常系", () => {
      test("should return error when user not found", async () => {
        // Arrange
        prismaMock.user.findUnique.mockResolvedValue(null);

        // Act
        const result = await checkIsAppOwner("non-existent-user");

        // Assert
        expect(result).toStrictEqual({ success: false, error: "ユーザーが見つかりません" });
      });

      test("should handle database error gracefully", async () => {
        // Arrange
        prismaMock.user.findUnique.mockRejectedValue(new Error("Database error"));

        // Act
        const result = await checkIsAppOwner(testUser.id);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          error: "アプリオーナー権限のチェック中にエラーが発生しました",
        });
      });
    });

    describe("境界値テスト", () => {
      test("should handle null parameter", async () => {
        // Arrange
        prismaMock.user.findUnique.mockResolvedValue(null);

        // Act
        const result = await checkIsAppOwner(null as unknown as string);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          error: "アプリオーナー権限のチェック中にエラーが発生しました",
        });
      });

      test("should handle undefined parameter", async () => {
        // Arrange
        prismaMock.user.findUnique.mockResolvedValue(null);

        // Act
        const result = await checkIsAppOwner(undefined as unknown as string);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          error: "アプリオーナー権限のチェック中にエラーが発生しました",
        });
      });

      test("should handle empty string parameter", async () => {
        // Arrange
        prismaMock.user.findUnique.mockResolvedValue(null);

        // Act
        const result = await checkIsAppOwner("");

        // Assert
        expect(result).toStrictEqual({
          success: false,
          error: "アプリオーナー権限のチェック中にエラーが発生しました",
        });
      });
    });
  });

  describe("checkGroupMembership", () => {
    describe("正常系", () => {
      test("should return membership when user is group member", async () => {
        // Arrange
        prismaMock.groupMembership.findFirst.mockResolvedValue(testGroupMembership);

        // Act
        const result = await checkGroupMembership(testUser.id, testGroup.id);

        // Assert
        expect(result).toStrictEqual(testGroupMembership);
        expect(prismaMock.groupMembership.findFirst).toHaveBeenCalledWith({
          where: {
            userId: testUser.id,
            groupId: testGroup.id,
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
    });

    describe("境界値テスト", () => {
      test("should handle null parameters", async () => {
        // Arrange
        prismaMock.groupMembership.findFirst.mockResolvedValue(null);

        // Act & Assert
        expect(await checkGroupMembership(null as unknown as string, testGroup.id)).toBeNull();
        expect(await checkGroupMembership(testUser.id, null as unknown as string)).toBeNull();
        expect(await checkGroupMembership("", "")).toBeNull();
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
        expect(result).toStrictEqual({ success: true });
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
        expect(result).toStrictEqual({ success: false, error: "グループオーナー権限がありません" });
      });
    });

    describe("境界値テスト", () => {
      test("should throw error for null userId", async () => {
        // Act & Assert
        await expect(checkOneGroupOwner(null as unknown as string)).rejects.toThrow("無効なパラメータが指定されました");
      });

      test("should throw error for undefined userId", async () => {
        // Act & Assert
        await expect(checkOneGroupOwner(undefined as unknown as string)).rejects.toThrow(
          "無効なパラメータが指定されました",
        );
      });

      test("should throw error for empty string userId", async () => {
        // Act & Assert
        await expect(checkOneGroupOwner("")).rejects.toThrow("無効なパラメータが指定されました");
      });
    });
  });
});
