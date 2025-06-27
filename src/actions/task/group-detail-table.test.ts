import { groupDetailTaskFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { ContributionType, TaskStatus } from "@prisma/client";
import { Factory } from "fishery";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { GetGroupTaskAndCountReturn, GetTasksByGroupIdProps } from "./cache-group-detail-table";
import { getCachedGroupTaskAndCount } from "./cache-group-detail-table";
import { getGroupTaskAndCount } from "./group-detail-table";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// getCachedGroupTaskAndCountのモック
vi.mock("./cache-group-detail-table", () => ({
  getCachedGroupTaskAndCount: vi.fn(),
}));
const mockGetCachedGroupTaskAndCount = vi.mocked(getCachedGroupTaskAndCount);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータファクトリー
 */

// GetTasksByGroupIdPropsのファクトリー
const getTasksByGroupIdPropsFactory = Factory.define<GetTasksByGroupIdProps>(({ sequence, params }) => ({
  groupId: params.groupId ?? `group-${sequence}`,
  page: params.page ?? 1,
  sortField: params.sortField ?? "createdAt",
  sortDirection: params.sortDirection ?? "desc",
  searchQuery: params.searchQuery ?? "",
  contributionTypeFilter: params.contributionTypeFilter ?? "ALL",
  statusFilter: params.statusFilter ?? "ALL",
  itemPerPage: params.itemPerPage ?? 10,
}));

// GetGroupTaskAndCountReturnのファクトリー
const getGroupTaskAndCountReturnFactory = Factory.define<GetGroupTaskAndCountReturn>(({ params }) => ({
  returnTasks: params.returnTasks ?? [],
  totalTaskCount: params.totalTaskCount ?? 0,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストヘルパー関数
 */

const createTestProps = (overrides: Partial<GetTasksByGroupIdProps> = {}): GetTasksByGroupIdProps => {
  return getTasksByGroupIdPropsFactory.build(overrides);
};

const createTestResponse = (overrides: Partial<GetGroupTaskAndCountReturn> = {}): GetGroupTaskAndCountReturn => {
  return getGroupTaskAndCountReturnFactory.build(overrides);
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("getGroupTaskAndCount", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系", () => {
    test("should call getCachedGroupTaskAndCount with correct parameters and return its result", async () => {
      // Arrange
      const testProps = createTestProps({
        groupId: "test-group-id",
        page: 1,
        sortField: "createdAt",
        sortDirection: "desc",
        searchQuery: "テスト",
        contributionTypeFilter: ContributionType.REWARD,
        statusFilter: TaskStatus.PENDING,
        itemPerPage: 20,
      });

      const testTasks = [
        groupDetailTaskFactory.build({ id: "task-1" }),
        groupDetailTaskFactory.build({ id: "task-2" }),
      ];
      const expectedResponse = createTestResponse({
        returnTasks: testTasks,
        totalTaskCount: 2,
      });

      mockGetCachedGroupTaskAndCount.mockResolvedValue(expectedResponse);

      // Act
      const result = await getGroupTaskAndCount(testProps);

      // Assert
      expect(mockGetCachedGroupTaskAndCount).toHaveBeenCalledTimes(1);
      expect(mockGetCachedGroupTaskAndCount).toHaveBeenCalledWith(testProps);
      expect(result).toStrictEqual(expectedResponse);
    });

    test("should handle default parameters correctly", async () => {
      // Arrange
      const testProps = createTestProps({
        groupId: "default-group-id",
        page: 1,
        sortField: "task",
        sortDirection: "asc",
        searchQuery: "",
        contributionTypeFilter: "ALL",
        statusFilter: "ALL",
        itemPerPage: 10,
      });

      const expectedResponse = createTestResponse({
        returnTasks: [],
        totalTaskCount: 0,
      });

      mockGetCachedGroupTaskAndCount.mockResolvedValue(expectedResponse);

      // Act
      const result = await getGroupTaskAndCount(testProps);

      // Assert
      expect(mockGetCachedGroupTaskAndCount).toHaveBeenCalledTimes(1);
      expect(mockGetCachedGroupTaskAndCount).toHaveBeenCalledWith(testProps);
      expect(result).toStrictEqual(expectedResponse);
    });

    test("should handle all contribution type filters", async () => {
      // Arrange - ALL filter
      const propsWithAll = createTestProps({
        contributionTypeFilter: "ALL",
      });
      const responseWithAll = createTestResponse();
      mockGetCachedGroupTaskAndCount.mockResolvedValue(responseWithAll);

      // Act & Assert - ALL filter
      await getGroupTaskAndCount(propsWithAll);
      expect(mockGetCachedGroupTaskAndCount).toHaveBeenCalledWith(propsWithAll);

      // Arrange - REWARD filter
      const propsWithReward = createTestProps({
        contributionTypeFilter: ContributionType.REWARD,
      });
      const responseWithReward = createTestResponse();
      mockGetCachedGroupTaskAndCount.mockResolvedValue(responseWithReward);

      // Act & Assert - REWARD filter
      await getGroupTaskAndCount(propsWithReward);
      expect(mockGetCachedGroupTaskAndCount).toHaveBeenCalledWith(propsWithReward);

      // Arrange - NON_REWARD filter
      const propsWithNonReward = createTestProps({
        contributionTypeFilter: ContributionType.NON_REWARD,
      });
      const responseWithNonReward = createTestResponse();
      mockGetCachedGroupTaskAndCount.mockResolvedValue(responseWithNonReward);

      // Act & Assert - NON_REWARD filter
      await getGroupTaskAndCount(propsWithNonReward);
      expect(mockGetCachedGroupTaskAndCount).toHaveBeenCalledWith(propsWithNonReward);
    });

    test("should handle all status filters", async () => {
      // Arrange - ALL status
      const propsWithAll = createTestProps({
        statusFilter: "ALL",
      });
      const responseWithAll = createTestResponse();
      mockGetCachedGroupTaskAndCount.mockResolvedValue(responseWithAll);

      // Act & Assert - ALL status
      await getGroupTaskAndCount(propsWithAll);
      expect(mockGetCachedGroupTaskAndCount).toHaveBeenCalledWith(propsWithAll);

      // Arrange - PENDING status
      const propsWithPending = createTestProps({
        statusFilter: TaskStatus.PENDING,
      });
      const responseWithPending = createTestResponse();
      mockGetCachedGroupTaskAndCount.mockResolvedValue(responseWithPending);

      // Act & Assert - PENDING status
      await getGroupTaskAndCount(propsWithPending);
      expect(mockGetCachedGroupTaskAndCount).toHaveBeenCalledWith(propsWithPending);

      // Arrange - TASK_COMPLETED status
      const propsWithCompleted = createTestProps({
        statusFilter: TaskStatus.TASK_COMPLETED,
      });
      const responseWithCompleted = createTestResponse();
      mockGetCachedGroupTaskAndCount.mockResolvedValue(responseWithCompleted);

      // Act & Assert - TASK_COMPLETED status
      await getGroupTaskAndCount(propsWithCompleted);
      expect(mockGetCachedGroupTaskAndCount).toHaveBeenCalledWith(propsWithCompleted);
    });

    test("should handle different sort fields and directions", async () => {
      // Arrange - createdAt desc
      const propsCreatedAtDesc = createTestProps({
        sortField: "createdAt",
        sortDirection: "desc",
      });
      const responseCreatedAtDesc = createTestResponse();
      mockGetCachedGroupTaskAndCount.mockResolvedValue(responseCreatedAtDesc);

      // Act & Assert - createdAt desc
      await getGroupTaskAndCount(propsCreatedAtDesc);
      expect(mockGetCachedGroupTaskAndCount).toHaveBeenCalledWith(propsCreatedAtDesc);

      // Arrange - task asc
      const propsTaskAsc = createTestProps({
        sortField: "task",
        sortDirection: "asc",
      });
      const responseTaskAsc = createTestResponse();
      mockGetCachedGroupTaskAndCount.mockResolvedValue(responseTaskAsc);

      // Act & Assert - task asc
      await getGroupTaskAndCount(propsTaskAsc);
      expect(mockGetCachedGroupTaskAndCount).toHaveBeenCalledWith(propsTaskAsc);

      // Arrange - taskFixedContributionPoint desc
      const propsPointDesc = createTestProps({
        sortField: "taskFixedContributionPoint",
        sortDirection: "desc",
      });
      const responsePointDesc = createTestResponse();
      mockGetCachedGroupTaskAndCount.mockResolvedValue(responsePointDesc);

      // Act & Assert - taskFixedContributionPoint desc
      await getGroupTaskAndCount(propsPointDesc);
      expect(mockGetCachedGroupTaskAndCount).toHaveBeenCalledWith(propsPointDesc);
    });

    test("should handle different page numbers and itemPerPage values", async () => {
      // Arrange - page 1, itemPerPage 10
      const propsPage1 = createTestProps({
        page: 1,
        itemPerPage: 10,
      });
      const responsePage1 = createTestResponse();
      mockGetCachedGroupTaskAndCount.mockResolvedValue(responsePage1);

      // Act & Assert - page 1
      await getGroupTaskAndCount(propsPage1);
      expect(mockGetCachedGroupTaskAndCount).toHaveBeenCalledWith(propsPage1);

      // Arrange - page 5, itemPerPage 50
      const propsPage5 = createTestProps({
        page: 5,
        itemPerPage: 50,
      });
      const responsePage5 = createTestResponse();
      mockGetCachedGroupTaskAndCount.mockResolvedValue(responsePage5);

      // Act & Assert - page 5
      await getGroupTaskAndCount(propsPage5);
      expect(mockGetCachedGroupTaskAndCount).toHaveBeenCalledWith(propsPage5);
    });

    test("should handle search query variations", async () => {
      // Arrange - empty search query
      const propsEmptySearch = createTestProps({
        searchQuery: "",
      });
      const responseEmptySearch = createTestResponse();
      mockGetCachedGroupTaskAndCount.mockResolvedValue(responseEmptySearch);

      // Act & Assert - empty search
      await getGroupTaskAndCount(propsEmptySearch);
      expect(mockGetCachedGroupTaskAndCount).toHaveBeenCalledWith(propsEmptySearch);

      // Arrange - Japanese search query
      const propsJapaneseSearch = createTestProps({
        searchQuery: "テストタスク",
      });
      const responseJapaneseSearch = createTestResponse();
      mockGetCachedGroupTaskAndCount.mockResolvedValue(responseJapaneseSearch);

      // Act & Assert - Japanese search
      await getGroupTaskAndCount(propsJapaneseSearch);
      expect(mockGetCachedGroupTaskAndCount).toHaveBeenCalledWith(propsJapaneseSearch);

      // Arrange - English search query
      const propsEnglishSearch = createTestProps({
        searchQuery: "test task",
      });
      const responseEnglishSearch = createTestResponse();
      mockGetCachedGroupTaskAndCount.mockResolvedValue(responseEnglishSearch);

      // Act & Assert - English search
      await getGroupTaskAndCount(propsEnglishSearch);
      expect(mockGetCachedGroupTaskAndCount).toHaveBeenCalledWith(propsEnglishSearch);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系", () => {
    test("should propagate error when getCachedGroupTaskAndCount throws an error", async () => {
      // Arrange
      const testProps = createTestProps();
      const testError = new Error("データベースエラー");
      mockGetCachedGroupTaskAndCount.mockRejectedValue(testError);

      // Act & Assert
      await expect(getGroupTaskAndCount(testProps)).rejects.toThrow("データベースエラー");
      expect(mockGetCachedGroupTaskAndCount).toHaveBeenCalledTimes(1);
      expect(mockGetCachedGroupTaskAndCount).toHaveBeenCalledWith(testProps);
    });

    test("should propagate error when getCachedGroupTaskAndCount throws a generic error", async () => {
      // Arrange
      const testProps = createTestProps();
      const testError = new Error("予期しないエラー");
      mockGetCachedGroupTaskAndCount.mockRejectedValue(testError);

      // Act & Assert
      await expect(getGroupTaskAndCount(testProps)).rejects.toThrow("予期しないエラー");
      expect(mockGetCachedGroupTaskAndCount).toHaveBeenCalledTimes(1);
      expect(mockGetCachedGroupTaskAndCount).toHaveBeenCalledWith(testProps);
    });

    test("should propagate error when getCachedGroupTaskAndCount throws a non-Error object", async () => {
      // Arrange
      const testProps = createTestProps();
      const testError = "文字列エラー";
      mockGetCachedGroupTaskAndCount.mockRejectedValue(testError);

      // Act & Assert
      await expect(getGroupTaskAndCount(testProps)).rejects.toBe("文字列エラー");
      expect(mockGetCachedGroupTaskAndCount).toHaveBeenCalledTimes(1);
      expect(mockGetCachedGroupTaskAndCount).toHaveBeenCalledWith(testProps);
    });
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
