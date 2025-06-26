"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { auctionFactory, groupFactory, taskFactory, userFactory } from "@/test/test-utils/test-utils-prisma-orm";
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
 * テストデータ
 */
const testUser = userFactory.build({ id: "test-user-id", name: "テストユーザー" });
const testGroup = groupFactory.build({ id: "test-group-id", name: "テストグループ" });
const testGroup2 = groupFactory.build({ id: "test-group-2-id", name: "テストグループ2" });
const testUser2 = userFactory.build({ id: "test-user-2-id", name: "テストユーザー2" });

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
        prismaMock.groupMembership.findMany
          .mockResolvedValueOnce([
            {
              group: { id: testGroup.id, name: testGroup.name },
            },
            {
              group: { id: testGroup2.id, name: testGroup2.name },
            },
          ] as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>)
          .mockResolvedValueOnce([
            {
              user: { id: testUser.id, name: testUser.name },
            },
            {
              user: { id: testUser2.id, name: testUser2.name },
            },
          ] as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>);

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

      test("should handle null user names correctly", async () => {
        // Arrange
        prismaMock.groupMembership.findMany
          .mockResolvedValueOnce([
            {
              group: { id: testGroup.id, name: testGroup.name },
            },
          ] as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>)
          .mockResolvedValueOnce([
            {
              user: { id: testUser.id, name: null },
            },
          ] as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>);

        // Act
        const result = await prepareCreateTaskForm();

        // Assert
        expect(result).toStrictEqual({
          groups: [{ id: testGroup.id, name: testGroup.name }],
          users: [{ id: testUser.id, name: "不明なユーザー" }],
        });
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
    const baseTaskData = {
      task: "テストタスク",
      detail: "テストタスクの詳細",
      reference: "https://example.com",
      info: "追加情報",
      imageUrl: "https://example.com/image.jpg",
      contributionType: ContributionType.NON_REWARD,
      category: "テスト",
      groupId: testGroup.id,
      deliveryMethod: "オンライン",
      reporters: [{ userId: testUser.id, name: testUser.name }],
      executors: [{ userId: testUser2.id, name: testUser2.name }],
    };

    describe("正常系", () => {
      test("should create task successfully with NON_REWARD contribution type", async () => {
        // Arrange
        const createdTask = taskFactory.build({
          id: "created-task-id",
          task: baseTaskData.task,
          groupId: testGroup.id,
          creatorId: testUser.id,
        });

        prismaMock.group.findUnique.mockResolvedValue({ id: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.group.findUnique>
        >);
        prismaMock.task.create.mockResolvedValue(createdTask);

        // Act
        const result = await createTask(baseTaskData as unknown as CreateTaskParams);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(prismaMock.group.findUnique).toHaveBeenCalledWith({
          where: { id: testGroup.id },
          select: { id: true },
        });
        expect(prismaMock.task.create).toHaveBeenCalledWith({
          data: {
            task: baseTaskData.task,
            detail: baseTaskData.detail,
            reference: baseTaskData.reference,
            info: baseTaskData.info,
            imageUrl: baseTaskData.imageUrl,
            contributionType: baseTaskData.contributionType,
            category: baseTaskData.category,
            creatorId: testUser.id,
            groupId: testGroup.id,
            deliveryMethod: baseTaskData.deliveryMethod,
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
        const rewardTaskData = {
          ...baseTaskData,
          contributionType: ContributionType.REWARD,
          auctionStartTime: new Date("2024-01-01T00:00:00Z"),
          auctionEndTime: new Date("2024-01-08T00:00:00Z"),
          isExtension: true,
        };

        const createdTask = taskFactory.build({
          id: "created-task-id",
          contributionType: ContributionType.REWARD,
        });

        const createdAuction = auctionFactory.build({
          taskId: createdTask.id,
          groupId: testGroup.id,
        });

        prismaMock.group.findUnique.mockResolvedValue({ id: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.group.findUnique>
        >);
        prismaMock.task.create.mockResolvedValue(createdTask);
        prismaMock.auction.create.mockResolvedValue(createdAuction);

        // Act
        const result = await createTask(rewardTaskData as unknown as CreateTaskParams);

        // Assert
        expect(result).toStrictEqual({ success: true });
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

      test("should create task with default reporters and executors when not provided", async () => {
        // Arrange
        const taskDataWithoutParticipants = {
          ...baseTaskData,
          reporters: undefined,
          executors: undefined,
        };

        const createdTask = taskFactory.build();
        prismaMock.group.findUnique.mockResolvedValue({ id: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.group.findUnique>
        >);
        prismaMock.task.create.mockResolvedValue(createdTask);

        // Act
        const result = await createTask(taskDataWithoutParticipants as unknown as CreateTaskParams);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(
          prismaMock.task.create as unknown as Awaited<ReturnType<typeof prismaMock.task.create>>,
        ).toHaveBeenCalledWith({
          data: expect.objectContaining({
            reporters: {
              create: [{ userId: testUser.id }],
            },
            executors: {
              create: [{ userId: testUser.id }],
            },
          }) as unknown as Prisma.TaskCreateInput,
        });
      });

      test("should create task with empty reporters and executors arrays", async () => {
        // Arrange
        const taskDataWithEmptyArrays = {
          ...baseTaskData,
          reporters: [],
          executors: [],
        };

        const createdTask = taskFactory.build();
        prismaMock.group.findUnique.mockResolvedValue({ id: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.group.findUnique>
        >);
        prismaMock.task.create.mockResolvedValue(createdTask);

        // Act
        const result = await createTask(taskDataWithEmptyArrays as unknown as CreateTaskParams);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(
          prismaMock.task.create as unknown as Awaited<ReturnType<typeof prismaMock.task.create>>,
        ).toHaveBeenCalledWith({
          data: expect.objectContaining({
            reporters: {
              create: [{ userId: testUser.id }],
            },
            executors: {
              create: [{ userId: testUser.id }],
            },
          }) as unknown as Prisma.TaskCreateInput,
        });
      });

      test("should handle string isExtension value correctly", async () => {
        // Arrange
        const rewardTaskData = {
          ...baseTaskData,
          contributionType: ContributionType.REWARD,
          isExtension: "false",
        };

        const createdTask = taskFactory.build({
          contributionType: ContributionType.REWARD,
        });

        prismaMock.group.findUnique.mockResolvedValue({ id: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.group.findUnique>
        >);
        prismaMock.task.create.mockResolvedValue(createdTask);
        prismaMock.auction.create.mockResolvedValue(auctionFactory.build());

        // Act
        const result = await createTask(rewardTaskData as unknown as CreateTaskParams);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(
          prismaMock.auction.create as unknown as Awaited<ReturnType<typeof prismaMock.auction.create>>,
        ).toHaveBeenCalledWith({
          data: expect.objectContaining({
            isExtension: false,
          }) as unknown as Prisma.AuctionCreateInput,
        });
      });

      test("should use default auction times when not provided", async () => {
        // Arrange
        const rewardTaskData = {
          ...baseTaskData,
          contributionType: ContributionType.REWARD,
          auctionStartTime: undefined,
          auctionEndTime: undefined,
        };

        const createdTask = taskFactory.build({
          contributionType: ContributionType.REWARD,
        });

        prismaMock.group.findUnique.mockResolvedValue({ id: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.group.findUnique>
        >);
        prismaMock.task.create.mockResolvedValue(createdTask);
        prismaMock.auction.create.mockResolvedValue(auctionFactory.build());

        // Act
        const result = await createTask(rewardTaskData as unknown as CreateTaskParams);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(
          prismaMock.auction.create as unknown as Awaited<ReturnType<typeof prismaMock.auction.create>>,
        ).toHaveBeenCalledWith({
          data: expect.objectContaining({
            startTime: expect.any(Date) as unknown as Date,
            endTime: expect.any(Date) as unknown as Date,
          }) as unknown as Prisma.AuctionCreateInput,
        });
      });
    });

    describe("異常系", () => {
      test("should return error when group not found", async () => {
        // Arrange
        prismaMock.group.findUnique.mockResolvedValue(null);

        // Act
        const result = await createTask(baseTaskData as unknown as CreateTaskParams);

        // Assert
        expect(result).toStrictEqual({
          error: "指定されたグループが見つかりません",
        });
        expect(prismaMock.task.create).not.toHaveBeenCalled();
        expect(mockRevalidatePath).not.toHaveBeenCalled();
      });

      test("should return error when getAuthenticatedSessionUserId fails", async () => {
        // Arrange
        prismaMock.group.findUnique.mockResolvedValue({ id: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.group.findUnique>
        >);
        mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("認証エラー"));

        // Act
        const result = await createTask(baseTaskData as unknown as CreateTaskParams);

        // Assert
        expect(result).toStrictEqual({
          error: "タスクの作成中にエラーが発生しました",
        });
      });

      test("should return error when task creation fails", async () => {
        // Arrange
        prismaMock.group.findUnique.mockResolvedValue({ id: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.group.findUnique>
        >);
        prismaMock.task.create.mockRejectedValue(new Error("データベースエラー"));

        // Act
        const result = await createTask(baseTaskData as unknown as CreateTaskParams);

        // Assert
        expect(result).toStrictEqual({
          error: "タスクの作成中にエラーが発生しました",
        });
        expect(mockRevalidatePath).not.toHaveBeenCalled();
      });

      test("should return error when auction creation fails", async () => {
        // Arrange
        const rewardTaskData = {
          ...baseTaskData,
          contributionType: ContributionType.REWARD,
        };

        const createdTask = taskFactory.build({
          contributionType: ContributionType.REWARD,
        });

        prismaMock.group.findUnique.mockResolvedValue({ id: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.group.findUnique>
        >);
        prismaMock.task.create.mockResolvedValue(createdTask);
        prismaMock.auction.create.mockRejectedValue(new Error("オークション作成エラー"));

        // Act
        const result = await createTask(rewardTaskData as unknown as CreateTaskParams);

        // Assert
        expect(result).toStrictEqual({
          error: "タスクの作成中にエラーが発生しました",
        });
        expect(mockRevalidatePath).not.toHaveBeenCalled();
      });
    });

    describe("境界値テスト", () => {
      test("should handle minimum required fields", async () => {
        // Arrange
        const minimalTaskData = {
          task: "最小タスク",
          groupId: testGroup.id,
          contributionType: ContributionType.NON_REWARD,
        };

        const createdTask = taskFactory.build();
        prismaMock.group.findUnique.mockResolvedValue({ id: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.group.findUnique>
        >);
        prismaMock.task.create.mockResolvedValue(createdTask);

        // Act
        const result = await createTask(minimalTaskData as unknown as CreateTaskParams);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(
          prismaMock.task.create as unknown as Awaited<ReturnType<typeof prismaMock.task.create>>,
        ).toHaveBeenCalledWith({
          data: expect.objectContaining({
            task: minimalTaskData.task,
            groupId: minimalTaskData.groupId,
            contributionType: minimalTaskData.contributionType,
            creatorId: testUser.id,
          }) as unknown as Prisma.TaskCreateInput,
        });
      });

      test("should handle empty string values", async () => {
        // Arrange
        const taskDataWithEmptyStrings = {
          ...baseTaskData,
          detail: "",
          reference: "",
          info: "",
          imageUrl: "",
          category: "",
        };

        const createdTask = taskFactory.build();
        prismaMock.group.findUnique.mockResolvedValue({ id: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.group.findUnique>
        >);
        prismaMock.task.create.mockResolvedValue(createdTask);

        // Act
        const result = await createTask(taskDataWithEmptyStrings as unknown as CreateTaskParams);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(
          prismaMock.task.create as unknown as Awaited<ReturnType<typeof prismaMock.task.create>>,
        ).toHaveBeenCalledWith({
          data: expect.objectContaining({
            detail: "",
            reference: "",
            info: "",
            imageUrl: "",
            category: "",
          }) as unknown as Prisma.TaskCreateInput,
        });
      });

      test("should handle null and undefined values", async () => {
        // Arrange
        const taskDataWithNullValues = {
          ...baseTaskData,
          detail: undefined,
          reference: null,
          info: undefined,
          imageUrl: null,
          category: undefined,
        };

        const createdTask = taskFactory.build();
        prismaMock.group.findUnique.mockResolvedValue({ id: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.group.findUnique>
        >);
        prismaMock.task.create.mockResolvedValue(createdTask);

        // Act
        const result = await createTask(taskDataWithNullValues as unknown as CreateTaskParams);

        // Assert
        expect(result).toStrictEqual({ success: true });
      });
    });
  });
});
