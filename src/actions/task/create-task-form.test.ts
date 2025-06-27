import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import {
  auctionFactory,
  groupFactory,
  taskFactory,
  userFactory,
  userSettingsFactory,
} from "@/test/test-utils/test-utils-prisma-orm";
import { ContributionType } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { CreateTaskParams } from "./create-task-form";
import { createTask, prepareCreateTaskForm } from "./create-task-form";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */
vi.mock("@/lib/utils", () => ({
  getAuthenticatedSessionUserId: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数の型定義
 */
const mockGetAuthenticatedSessionUserId = vi.mocked(getAuthenticatedSessionUserId);
const mockRevalidatePath = vi.mocked(revalidatePath);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータファクトリー
 */
const testUser = userFactory.build({ id: "test-user-id", name: "テストユーザー" });
const testUser2 = userFactory.build({ id: "test-user-2-id", name: "テストユーザー2" });
const testGroup = groupFactory.build({ id: "test-group-id", name: "テストグループ" });
const testGroup2 = groupFactory.build({ id: "test-group-2-id", name: "テストグループ2" });

const testUserSettings = userSettingsFactory.build({
  userId: testUser.id,
  username: testUser.name ?? undefined,
});
const testUserSettings2 = userSettingsFactory.build({
  userId: testUser2.id,
  username: testUser2.name ?? undefined,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク作成フォームのパラメータを作成するヘルパー関数
 * @param overrides 上書きするパラメータ
 * @returns タスク作成フォームのパラメータ
 */
const createTaskFuncParams = (overrides: Partial<CreateTaskParams> = {}): CreateTaskParams => ({
  task: "テストタスク",
  detail: "テストタスクの詳細",
  reference: "https://example.com",
  info: "追加情報",
  imageUrl: "https://example.com/image.jpg",
  contributionType: ContributionType.NON_REWARD,
  category: "テスト",
  groupId: testGroup.id,
  deliveryMethod: "オンライン",
  reporters: [{ userId: testUser.id, name: testUser.name ?? undefined }],
  executors: [{ userId: testUser2.id, name: testUser2.name ?? undefined }],
  ...overrides,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("create-task-form.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("prepareCreateTaskForm", () => {
    describe("正常系", () => {
      test("should return groups and users when user has group memberships", async () => {
        // Arrange
        const groupMemberships = [
          { group: { id: testGroup.id, name: testGroup.name } },
          { group: { id: testGroup2.id, name: testGroup2.name } },
        ];

        const userMemberships = [
          { user: { id: testUser.id, settings: testUserSettings } },
          { user: { id: testUser2.id, settings: testUserSettings2 } },
        ];

        prismaMock.groupMembership.findMany
          .mockResolvedValueOnce(
            groupMemberships as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
          )
          .mockResolvedValueOnce(
            userMemberships as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
          );

        // Act
        const result = await prepareCreateTaskForm();

        // Assert
        expect(result).toStrictEqual({
          groups: [
            { id: testGroup.id, name: testGroup.name },
            { id: testGroup2.id, name: testGroup2.name },
          ],
          users: [
            { id: testUser.id, name: testUser.name },
            { id: testUser2.id, name: testUser2.name },
          ],
        });
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
        expect(prismaMock.groupMembership.findMany).toHaveBeenCalledTimes(2);
      });

      test("should return empty arrays when user has no group memberships", async () => {
        // Arrange
        prismaMock.groupMembership.findMany.mockResolvedValue([]);

        // Act
        const result = await prepareCreateTaskForm();

        // Assert
        expect(result).toStrictEqual({
          groups: [],
          users: [],
        });
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
        expect(prismaMock.groupMembership.findMany).toHaveBeenCalledOnce();
      });

      test("should handle users with missing username settings", async () => {
        // Arrange
        const groupMemberships = [{ group: { id: testGroup.id, name: testGroup.name } }];
        const userMemberships = [{ user: { id: testUser.id, settings: null } }];

        prismaMock.groupMembership.findMany
          .mockResolvedValueOnce(
            groupMemberships as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
          )
          .mockResolvedValueOnce(
            userMemberships as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
          );

        // Act
        const result = await prepareCreateTaskForm();

        // Assert
        expect(result.users).toStrictEqual([{ id: testUser.id, name: `未設定_${testUser.id}` }]);
      });
    });

    describe("異常系", () => {
      test("should throw error when getAuthenticatedSessionUserId fails", async () => {
        // Arrange
        const errorMessage = "認証エラー";
        mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error(errorMessage));

        // Act & Assert
        await expect(prepareCreateTaskForm()).rejects.toThrow(errorMessage);
      });

      test("should throw error when database query fails", async () => {
        // Arrange
        const errorMessage = "データベースエラー";
        prismaMock.groupMembership.findMany.mockRejectedValue(new Error(errorMessage));

        // Act & Assert
        await expect(prepareCreateTaskForm()).rejects.toThrow(errorMessage);
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("createTask", () => {
    describe("正常系", () => {
      test("should create task successfully with NON_REWARD contribution type", async () => {
        // Arrange
        const taskData = createTaskFuncParams();
        const createdTask = taskFactory.build({
          id: "created-task-id",
          groupId: testGroup.id,
          creatorId: testUser.id,
        });

        prismaMock.group.findUnique.mockResolvedValue({ id: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.group.findUnique>
        >);
        prismaMock.task.create.mockResolvedValue(createdTask);

        // Act
        const result = await createTask(taskData);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(prismaMock.group.findUnique).toHaveBeenCalledWith({
          where: { id: testGroup.id },
          select: { id: true },
        });
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
        expect(prismaMock.task.create).toHaveBeenCalledWith({
          data: {
            task: taskData.task,
            detail: taskData.detail,
            reference: taskData.reference,
            info: taskData.info,
            imageUrl: taskData.imageUrl,
            contributionType: taskData.contributionType,
            category: taskData.category,
            creatorId: testUser.id,
            groupId: testGroup.id,
            deliveryMethod: taskData.deliveryMethod,
            reporters: {
              create: [{ name: testUser.name, userId: testUser.id }],
            },
            executors: {
              create: [{ name: testUser2.name, userId: testUser2.id }],
            },
          },
        });
        expect(mockRevalidatePath).toHaveBeenCalledWith(`/dashboard/group/${testGroup.id}`);
      });

      test("should create task with REWARD contribution type and auction", async () => {
        // Arrange
        const rewardTaskData = createTaskFuncParams({
          contributionType: ContributionType.REWARD,
          auctionStartTime: new Date("2024-01-01T00:00:00Z"),
          auctionEndTime: new Date("2024-01-08T00:00:00Z"),
          isExtension: "true",
        });

        const createdTask = taskFactory.build({
          id: "created-task-id",
          groupId: testGroup.id,
          creatorId: testUser.id,
        });
        prismaMock.group.findUnique.mockResolvedValue({ id: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.group.findUnique>
        >);
        prismaMock.task.create.mockResolvedValue(createdTask);
        const createdAuction = auctionFactory.build({
          taskId: createdTask.id,
          groupId: testGroup.id,
        });
        prismaMock.auction.create.mockResolvedValue(createdAuction);

        // Act
        const result = await createTask(rewardTaskData);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(prismaMock.auction.create).toHaveBeenCalledWith({
          data: {
            taskId: createdTask.id,
            startTime: new Date("2024-01-01T00:00:00Z"),
            endTime: new Date("2024-01-08T00:00:00Z"),
            groupId: testGroup.id,
            isExtension: true,
          },
        });
        expect(mockRevalidatePath).toHaveBeenCalledWith(`/dashboard/group/${testGroup.id}`);
      });

      test.each([
        { reporters: undefined, executors: undefined },
        { reporters: [], executors: undefined },
        { reporters: undefined, executors: [] },
        { reporters: [], executors: [] },
      ])(
        "should create task with default participants when not provided or empty",
        async ({ reporters, executors }) => {
          // Arrange
          const taskData = createTaskFuncParams({ reporters, executors });
          const createdTask = taskFactory.build({
            id: "created-task-id",
            groupId: testGroup.id,
            creatorId: testUser.id,
          });
          prismaMock.group.findUnique.mockResolvedValue({ id: testGroup.id } as unknown as Awaited<
            ReturnType<typeof prismaMock.group.findUnique>
          >);
          prismaMock.task.create.mockResolvedValue(createdTask);

          // Act
          const result = await createTask(taskData);

          // Assert
          expect(result).toStrictEqual({ success: true });
          expect(mockRevalidatePath).toHaveBeenCalledWith(`/dashboard/group/${testGroup.id}`);
          expect(prismaMock.task.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
              reporters: { create: [{ userId: testUser.id }] },
              executors: { create: [{ userId: testUser.id }] },
            }) as unknown as Prisma.TaskCreateInput,
          });
        },
      );

      test.each([
        { isExtension: "false", expectedValue: false },
        { isExtension: "true", expectedValue: true },
        { isExtension: false, expectedValue: false },
        { isExtension: true, expectedValue: true },
      ] as const)(
        "should handle isExtension value conversion (string to boolean)",
        async ({ isExtension, expectedValue }) => {
          // Arrange
          const rewardTaskData = createTaskFuncParams({
            contributionType: ContributionType.REWARD,
            isExtension: isExtension as string,
          });

          const createdTask = taskFactory.build({
            id: "created-task-id",
            groupId: testGroup.id,
            creatorId: testUser.id,
          });
          prismaMock.group.findUnique.mockResolvedValue({ id: testGroup.id } as unknown as Awaited<
            ReturnType<typeof prismaMock.group.findUnique>
          >);
          prismaMock.task.create.mockResolvedValue(createdTask);
          const createdAuction = auctionFactory.build({
            taskId: createdTask.id,
            groupId: testGroup.id,
          });
          prismaMock.auction.create.mockResolvedValue(createdAuction);

          // Act
          const result = await createTask(rewardTaskData);

          // Assert
          expect(result).toStrictEqual({ success: true });
          expect(mockRevalidatePath).toHaveBeenCalledWith(`/dashboard/group/${testGroup.id}`);
          expect(prismaMock.auction.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
              isExtension: expectedValue,
            }) as unknown as Prisma.AuctionCreateInput,
          });
        },
      );

      test("should use default auction times when not provided", async () => {
        // Arrange
        const rewardTaskData = createTaskFuncParams({
          contributionType: ContributionType.REWARD,
          auctionStartTime: undefined,
          auctionEndTime: undefined,
        });

        const createdTask = taskFactory.build({
          id: "created-task-id",
          groupId: testGroup.id,
          creatorId: testUser.id,
        });
        prismaMock.group.findUnique.mockResolvedValue({ id: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.group.findUnique>
        >);
        prismaMock.task.create.mockResolvedValue(createdTask);
        const createdAuction = auctionFactory.build({
          taskId: "created-task-id",
          groupId: testGroup.id,
        });
        prismaMock.auction.create.mockResolvedValue(createdAuction);

        // Act
        const result = await createTask(rewardTaskData);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(mockRevalidatePath).toHaveBeenCalledWith(`/dashboard/group/${testGroup.id}`);
        expect(prismaMock.auction.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            startTime: expect.any(Date) as unknown as Date,
            endTime: expect.any(Date) as unknown as Date,
          }) as unknown as Prisma.AuctionCreateInput,
        });
      });
    });

    describe("異常系", () => {
      test("should throw error when group not found", async () => {
        // Arrange
        const taskData = createTaskFuncParams();
        prismaMock.group.findUnique.mockResolvedValue(
          null as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
        );

        // Act & Assert
        await expect(createTask(taskData)).rejects.toThrow(
          "タスクの作成中にエラーが発生しました: グループが見つかりません",
        );
        expect(prismaMock.task.create).not.toHaveBeenCalled();
        expect(mockRevalidatePath).not.toHaveBeenCalled();
      });

      test("should throw error when getAuthenticatedSessionUserId fails", async () => {
        // Arrange
        const taskData = createTaskFuncParams();
        prismaMock.group.findUnique.mockResolvedValue({ id: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.group.findUnique>
        >);
        mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("認証エラー"));

        // Act & Assert
        await expect(createTask(taskData)).rejects.toThrow("タスクの作成中にエラーが発生しました: 認証エラー");
        expect(prismaMock.task.create).not.toHaveBeenCalled();
        expect(mockRevalidatePath).not.toHaveBeenCalled();
        expect(prismaMock.task.create).not.toHaveBeenCalled();
        expect(mockRevalidatePath).not.toHaveBeenCalled();
      });

      test("should throw error when task creation fails", async () => {
        // Arrange
        const taskData = createTaskFuncParams();
        prismaMock.group.findUnique.mockResolvedValue({ id: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.group.findUnique>
        >);
        prismaMock.task.create.mockRejectedValue(new Error("データベースエラー"));

        // Act & Assert
        await expect(createTask(taskData)).rejects.toThrow("タスクの作成中にエラーが発生しました: データベースエラー");
        expect(mockRevalidatePath).not.toHaveBeenCalled();
      });

      test("should throw error when auction creation fails", async () => {
        // Arrange
        const rewardTaskData = createTaskFuncParams({
          contributionType: ContributionType.REWARD,
        });

        const createdTask = taskFactory.build({
          id: "created-task-id",
          groupId: testGroup.id,
          creatorId: testUser.id,
        });
        prismaMock.group.findUnique.mockResolvedValue({ id: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.group.findUnique>
        >);
        prismaMock.task.create.mockResolvedValue(createdTask);
        prismaMock.auction.create.mockRejectedValue(new Error("オークション作成エラー"));

        // Act & Assert
        await expect(createTask(rewardTaskData)).rejects.toThrow(
          "タスクの作成中にエラーが発生しました: オークション作成エラー",
        );
        expect(mockRevalidatePath).not.toHaveBeenCalled();
        expect(prismaMock.auction.create).toHaveBeenCalled();
      });
    });

    describe("境界値テスト", () => {
      test("should handle minimum required fields", async () => {
        // Arrange
        const minimalTaskData = createTaskFuncParams({
          task: "最小タスク",
          detail: undefined,
          reference: undefined,
          info: undefined,
          imageUrl: undefined,
          category: undefined,
          deliveryMethod: undefined,
          reporters: undefined,
          executors: undefined,
        });

        const createdTask = taskFactory.build({
          id: "created-task-id",
          groupId: testGroup.id,
          creatorId: testUser.id,
        });
        prismaMock.group.findUnique.mockResolvedValue({ id: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.group.findUnique>
        >);
        prismaMock.task.create.mockResolvedValue(createdTask);

        // Act
        const result = await createTask(minimalTaskData);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(mockRevalidatePath).toHaveBeenCalledWith(`/dashboard/group/${testGroup.id}`);
        expect(prismaMock.task.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            task: "最小タスク",
            groupId: testGroup.id,
            contributionType: ContributionType.NON_REWARD,
            creatorId: testUser.id,
          }) as unknown as Prisma.TaskCreateInput,
        });
      });

      test("should handle various null and empty values", async () => {
        // Arrange - null、undefined、空文字の境界値を統合テスト
        const taskDataWithVariousValues = createTaskFuncParams({
          detail: "",
          reference: undefined,
          info: undefined,
          imageUrl: "",
          category: undefined,
        });

        const createdTask = taskFactory.build({
          id: "created-task-id",
          groupId: testGroup.id,
          creatorId: testUser.id,
        });
        prismaMock.group.findUnique.mockResolvedValue({ id: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.group.findUnique>
        >);
        prismaMock.task.create.mockResolvedValue(createdTask);

        // Act
        const result = await createTask(taskDataWithVariousValues);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(mockRevalidatePath).toHaveBeenCalledWith(`/dashboard/group/${testGroup.id}`);
        expect(prismaMock.task.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            detail: "",
            reference: undefined,
            info: undefined,
            imageUrl: "",
            category: undefined,
          }) as Prisma.TaskCreateInput,
        });
      });
    });
  });
});
