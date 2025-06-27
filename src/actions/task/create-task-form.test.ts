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
 * テストヘルパー関数
 */

// 基本タスクデータを作成するヘルパー関数
const createBaseTaskData = (overrides: Partial<CreateTaskParams> = {}): CreateTaskParams => ({
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

// グループ存在チェックのモックセットアップ
const setupGroupExistsCheck = (exists = true) => {
  const groupData = exists ? { id: testGroup.id } : null;
  prismaMock.group.findUnique.mockResolvedValue(
    groupData as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
  );
};

// タスク作成成功時の共通モックセットアップ
const setupSuccessfulTaskCreation = () => {
  const createdTask = taskFactory.build({
    id: "created-task-id",
    groupId: testGroup.id,
    creatorId: testUser.id,
  });

  setupGroupExistsCheck(true);
  prismaMock.task.create.mockResolvedValue(createdTask);

  return createdTask;
};

// オークション作成のモックセットアップ
const setupAuctionCreation = (taskId: string) => {
  const createdAuction = auctionFactory.build({
    taskId,
    groupId: testGroup.id,
  });
  prismaMock.auction.create.mockResolvedValue(createdAuction);
  return createdAuction;
};

// 成功結果の共通検証
const assertSuccessResult = (result: { success: boolean }) => {
  expect(result).toStrictEqual({ success: true });
  expect(mockRevalidatePath).toHaveBeenCalledWith(`/dashboard/group/${testGroup.id}`);
};

// エラー結果の共通検証（実装に合わせてthrowをテスト）
const assertTaskCreationError = async (taskData: CreateTaskParams) => {
  await expect(createTask(taskData)).rejects.toThrow("タスクの作成中にエラーが発生しました");
  expect(mockRevalidatePath).not.toHaveBeenCalled();
};

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
        const taskData = createBaseTaskData();
        setupSuccessfulTaskCreation();

        // Act
        const result = await createTask(taskData);

        // Assert
        assertSuccessResult(result);
        expect(prismaMock.group.findUnique).toHaveBeenCalledWith({
          where: { id: testGroup.id },
          select: { id: true },
        });
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
      });

      test("should create task with REWARD contribution type and auction", async () => {
        // Arrange
        const rewardTaskData = createBaseTaskData({
          contributionType: ContributionType.REWARD,
          auctionStartTime: new Date("2024-01-01T00:00:00Z"),
          auctionEndTime: new Date("2024-01-08T00:00:00Z"),
          isExtension: "true",
        });

        const createdTask = setupSuccessfulTaskCreation();
        setupAuctionCreation(createdTask.id);

        // Act
        const result = await createTask(rewardTaskData);

        // Assert
        assertSuccessResult(result);
        expect(prismaMock.auction.create).toHaveBeenCalledWith({
          data: {
            taskId: createdTask.id,
            startTime: rewardTaskData.auctionStartTime,
            endTime: rewardTaskData.auctionEndTime,
            currentHighestBid: 0,
            extensionTotalCount: 0,
            extensionLimitCount: 3,
            extensionTime: 10,
            remainingTimeForExtension: 10,
            groupId: testGroup.id,
            isExtension: true,
          },
        });
      });

      test("should create task with default participants when not provided or empty", async () => {
        // Arrange - undefinedとempty arrayの両方をテスト（共通の結果なので統合）
        const testCases = [
          { reporters: undefined, executors: undefined },
          { reporters: [], executors: [] },
        ];

        for (const participantOverrides of testCases) {
          vi.clearAllMocks();
          mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);

          const taskData = createBaseTaskData(participantOverrides);
          setupSuccessfulTaskCreation();

          // Act
          const result = await createTask(taskData);

          // Assert
          assertSuccessResult(result);
          expect(prismaMock.task.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
              reporters: { create: [{ userId: testUser.id }] },
              executors: { create: [{ userId: testUser.id }] },
            }) as unknown as Prisma.TaskCreateInput,
          });
        }
      });

      test("should handle isExtension value conversion (string to boolean)", async () => {
        // Arrange - 文字列と真偽値の両方をテスト
        const testCases = [
          { isExtension: "false", expectedValue: false },
          { isExtension: "true", expectedValue: true },
          { isExtension: false, expectedValue: false },
          { isExtension: true, expectedValue: true },
        ] as const;

        for (const { isExtension, expectedValue } of testCases) {
          vi.clearAllMocks();
          mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);

          const rewardTaskData = createBaseTaskData({
            contributionType: ContributionType.REWARD,
            isExtension: isExtension as string,
          });

          const createdTask = setupSuccessfulTaskCreation();
          setupAuctionCreation(createdTask.id);

          // Act
          const result = await createTask(rewardTaskData);

          // Assert
          assertSuccessResult(result);
          expect(prismaMock.auction.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
              isExtension: expectedValue,
            }) as unknown as Prisma.AuctionCreateInput,
          });
        }
      });

      test("should use default auction times when not provided", async () => {
        // Arrange
        const rewardTaskData = createBaseTaskData({
          contributionType: ContributionType.REWARD,
          auctionStartTime: undefined,
          auctionEndTime: undefined,
        });

        setupSuccessfulTaskCreation();
        const taskId = "created-task-id";
        setupAuctionCreation(taskId);

        // Act
        const result = await createTask(rewardTaskData);

        // Assert
        assertSuccessResult(result);
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
        const taskData = createBaseTaskData();
        setupGroupExistsCheck(false);

        // Act & Assert
        await expect(createTask(taskData)).rejects.toThrow("タスクの作成中にエラーが発生しました");
        expect(prismaMock.task.create).not.toHaveBeenCalled();
        expect(mockRevalidatePath).not.toHaveBeenCalled();
      });

      test("should throw error when getAuthenticatedSessionUserId fails", async () => {
        // Arrange
        const taskData = createBaseTaskData();
        setupGroupExistsCheck(true);
        mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("認証エラー"));

        // Act & Assert
        await assertTaskCreationError(taskData);
        expect(prismaMock.task.create).not.toHaveBeenCalled();
      });

      test("should throw error when task creation fails", async () => {
        // Arrange
        const taskData = createBaseTaskData();
        setupGroupExistsCheck(true);
        prismaMock.task.create.mockRejectedValue(new Error("データベースエラー"));

        // Act & Assert
        await assertTaskCreationError(taskData);
        expect(prismaMock.task.create).toHaveBeenCalled();
      });

      test("should throw error when auction creation fails", async () => {
        // Arrange
        const rewardTaskData = createBaseTaskData({
          contributionType: ContributionType.REWARD,
        });

        setupSuccessfulTaskCreation();
        prismaMock.auction.create.mockRejectedValue(new Error("オークション作成エラー"));

        // Act & Assert
        await assertTaskCreationError(rewardTaskData);
        expect(prismaMock.task.create).toHaveBeenCalled();
        expect(prismaMock.auction.create).toHaveBeenCalled();
      });
    });

    describe("境界値テスト", () => {
      test("should handle minimum required fields", async () => {
        // Arrange
        const minimalTaskData = createBaseTaskData({
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

        setupSuccessfulTaskCreation();

        // Act
        const result = await createTask(minimalTaskData);

        // Assert
        assertSuccessResult(result);
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
        const taskDataWithVariousValues = createBaseTaskData({
          detail: "",
          reference: undefined,
          info: undefined,
          imageUrl: "",
          category: undefined,
        });

        setupSuccessfulTaskCreation();

        // Act
        const result = await createTask(taskDataWithVariousValues);

        // Assert
        assertSuccessResult(result);
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
