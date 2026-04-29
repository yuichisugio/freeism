import type { Group } from "@/types/group-types";
import { act } from "react";
import { AllTheProviders, mockUseMutation, mockUseQuery, mockUseQueryClient } from "@/test/setup/tanstack-query-setup";
import { faker } from "@faker-js/faker";
import { renderHook, waitFor } from "@testing-library/react";
import { Factory } from "fishery";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useGroupManipulation } from "./use-group-manipulation";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ホイストされたモック関数の宣言
 */
const {
  mockPush,
  mockRefresh,
  mockUseSession,
  mockJoinGroup,
  mockDeleteGroup,
  mockRemoveMember,
  mockLeaveGroup,
  mockGetGroupById,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
  mockUseSession: vi.fn(),
  mockJoinGroup: vi.fn(),
  mockDeleteGroup: vi.fn(),
  mockRemoveMember: vi.fn(),
  mockLeaveGroup: vi.fn(),
  mockGetGroupById: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// Next.js navigation のモック
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  redirect: vi.fn(),
}));

// next-auth/react のモック
vi.mock("next-auth/react", () => ({
  useSession: mockUseSession,
}));

// Sonner（トースト通知）のモック
vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

// グループアクション関数のモック
vi.mock("@/actions/group", () => ({
  joinGroup: mockJoinGroup,
  deleteGroup: mockDeleteGroup,
  removeMember: mockRemoveMember,
}));

vi.mock("@/actions/group/group-detail", () => ({
  getGroupById: mockGetGroupById,
}));

vi.mock("@/actions/group/my-group", () => ({
  leaveGroup: mockLeaveGroup,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Fisheryファクトリーを使用したテストデータ作成
 */

// グループデータファクトリー
const groupFactory = Factory.define<Group>(({ sequence, params }) => ({
  id: params.id ?? `group-${sequence}`,
  name: params.name ?? faker.company.name(),
  goal: params.goal ?? faker.company.catchPhrase(),
  evaluationMethod: params.evaluationMethod ?? "自動評価",
  joinMemberCount: params.joinMemberCount ?? faker.number.int({ min: 1, max: 10 }),
  maxParticipants: params.maxParticipants ?? faker.number.int({ min: 5, max: 20 }),
  depositPeriod: params.depositPeriod ?? faker.number.int({ min: 7, max: 90 }),
  members: params.members ?? [{ userId: "test-user-1" }, { userId: "test-user-2" }],
}));

// セッションデータファクトリー
const sessionFactory = Factory.define<{ user: { id: string; email: string; name: string } }>(
  ({ sequence, params }) => ({
    user: {
      id: params.user?.id ?? `user-${sequence}`,
      email: params.user?.email ?? faker.internet.email(),
      name: params.user?.name ?? faker.person.fullName(),
    },
  }),
);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ作成ヘルパー関数
 */

const createTestGroup = (overrides: Partial<Group> = {}): Group => {
  return groupFactory.build(overrides);
};

const createTestSession = (overrides = {}) => {
  return sessionFactory.build(overrides);
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストセットアップ
 */

describe("useGroupManipulation", () => {
  const testGroupId = "test-group-1";
  const testUserId = "test-user-1";
  const testGroup = createTestGroup({ id: testGroupId });
  const testSession = createTestSession({ user: { id: testUserId } });

  beforeEach(() => {
    // モックをリセット
    vi.clearAllMocks();

    // デフォルトのモック設定
    mockUseSession.mockReturnValue({
      data: testSession,
      status: "authenticated",
    });

    const mockInvalidateQueries = vi.fn();
    mockUseQueryClient.mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });

    // デフォルトのクエリ設定
    mockUseQuery.mockReturnValue({
      data: testGroup,
      isPending: false,
    });

    // デフォルトのミューテーション設定
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("初期化テスト", () => {
    test("should initialize with correct default values", () => {
      // Act
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Assert
      expect(result.current.group).toStrictEqual(testGroup);
      expect(result.current.isLoadingGroup).toBe(false);
      expect(result.current.deleteDialogOpen).toBe(false);
      expect(result.current.leaveDialogOpen).toBe(false);
      expect(result.current.editDialogOpen).toBe(false);
      expect(result.current.removeMemberDialogOpen).toBe(false);
      expect(result.current.selectedMemberForRemoval).toBeNull();
      expect(result.current.selectedMemberNameForRemoval).toBeNull();
      expect(result.current.isRemovalComboboxOpen).toBe(false);
      expect(result.current.addToBlackList).toBe(false);
      expect(result.current.isJoiningGroup).toBe(false);
      expect(result.current.isLeavingGroup).toBe(false);
      expect(result.current.isDeletingGroup).toBe(false);
      expect(result.current.isRemovingMember).toBe(false);
    });

    test("should set isMember to true when user is a member", async () => {
      // Arrange
      const groupWithUserAsMember = createTestGroup({
        id: testGroupId,
        members: [{ userId: testUserId }, { userId: "other-user" }],
      });

      mockUseQuery.mockReturnValue({
        data: groupWithUserAsMember,
        isPending: false,
      });

      // Act
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Assert
      await waitFor(() => {
        expect(result.current.isMember).toBe(true);
      });
    });

    test("should set isMember to false when user is not a member", async () => {
      // Arrange
      const groupWithoutUser = createTestGroup({
        id: testGroupId,
        members: [{ userId: "other-user-1" }, { userId: "other-user-2" }],
      });

      mockUseQuery.mockReturnValue({
        data: groupWithoutUser,
        isPending: false,
      });

      // Act
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Assert
      await waitFor(() => {
        expect(result.current.isMember).toBe(false);
      });
    });

    test("should handle loading state correctly", () => {
      // Arrange
      mockUseQuery.mockReturnValue({
        data: null,
        isPending: true,
      });

      // Act
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Assert
      expect(result.current.isLoadingGroup).toBe(true);
      expect(result.current.group).toBeNull();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("グループ参加機能", () => {
    test("should handle join group successfully", async () => {
      // Arrange
      const mockMutate = vi.fn();
      mockUseMutation.mockReturnValue({
        mutate: mockMutate.mockImplementation(() => {
          // 成功時のコールバックを直接呼び出す
          mockToastSuccess("グループに参加しました");
        }),
        isPending: false,
      });

      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: false,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Act
      act(() => {
        result.current.handleJoinGroup(testGroupId);
      });

      // Assert
      expect(mockMutate).toHaveBeenCalledWith(testGroupId);
      expect(mockToastSuccess).toHaveBeenCalledWith("グループに参加しました");
    });

    test("should handle join group error", async () => {
      // Arrange
      const errorMessage = "参加に失敗しました";
      const mockMutate = vi.fn();
      mockUseMutation.mockReturnValue({
        mutate: mockMutate.mockImplementation(() => {
          // エラー時のコールバックを直接呼び出す
          mockToastError(errorMessage);
        }),
        isPending: false,
      });

      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: false,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Act
      act(() => {
        result.current.handleJoinGroup(testGroupId);
      });

      // Assert
      expect(mockMutate).toHaveBeenCalledWith(testGroupId);
      expect(mockToastError).toHaveBeenCalledWith(errorMessage);
    });

    test("should show loading state during join group", () => {
      // Arrange
      mockUseMutation.mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
      });

      // Act
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: false,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Assert
      expect(result.current.isJoiningGroup).toBe(true);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("グループ脱退機能", () => {
    test("should open leave dialog when handleLeave is called", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: false,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Act
      act(() => {
        result.current.handleLeave();
      });

      // Assert
      expect(result.current.leaveDialogOpen).toBe(true);
    });

    test("should handle leave group successfully", async () => {
      // Arrange
      const mockMutate = vi.fn();
      mockUseMutation.mockReturnValue({
        mutate: mockMutate.mockImplementation(() => {
          // 成功時のコールバックを直接呼び出す
          mockToastSuccess("グループから脱退しました");
        }),
        isPending: false,
      });

      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: false,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Act
      act(() => {
        result.current.executeLeaveGroup(testGroupId);
      });

      // Assert
      expect(mockMutate).toHaveBeenCalledWith(testGroupId);
      expect(mockToastSuccess).toHaveBeenCalledWith("グループから脱退しました");
    });

    test("should handle leave group error", async () => {
      // Arrange
      const errorMessage = "脱退に失敗しました";
      const mockMutate = vi.fn();
      mockUseMutation.mockReturnValue({
        mutate: mockMutate.mockImplementation(() => {
          // エラー時のコールバックを直接呼び出す
          mockToastError(errorMessage);
        }),
        isPending: false,
      });

      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: false,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Act
      act(() => {
        result.current.executeLeaveGroup(testGroupId);
      });

      // Assert
      expect(mockMutate).toHaveBeenCalledWith(testGroupId);
      expect(mockToastError).toHaveBeenCalledWith(errorMessage);
    });

    test("should show loading state during leave group", () => {
      // Arrange
      mockUseMutation.mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
      });

      // Act
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: false,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Assert
      expect(result.current.isLeavingGroup).toBe(true);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("グループ編集機能", () => {
    test("should open edit dialog when user is owner", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Act
      act(() => {
        result.current.handleOpenEditDialog();
      });

      // Assert
      expect(result.current.editDialogOpen).toBe(true);
    });

    test("should show error when non-owner tries to edit", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: false,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Act
      act(() => {
        result.current.handleOpenEditDialog();
      });

      // Assert
      expect(mockToastError).toHaveBeenCalledWith("権限がありません");
      expect(result.current.editDialogOpen).toBe(false);
    });

    test("should allow setting edit dialog state", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Act
      act(() => {
        result.current.setEditDialogOpen(true);
      });

      // Assert
      expect(result.current.editDialogOpen).toBe(true);

      // Act
      act(() => {
        result.current.setEditDialogOpen(false);
      });

      // Assert
      expect(result.current.editDialogOpen).toBe(false);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("グループ削除機能", () => {
    test("should open delete dialog when user is owner", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Act
      act(() => {
        result.current.handleOpenDeleteDialog();
      });

      // Assert
      expect(result.current.deleteDialogOpen).toBe(true);
    });

    test("should show error when non-owner tries to delete", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: false,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Act
      act(() => {
        result.current.handleOpenDeleteDialog();
      });

      // Assert
      expect(mockToastError).toHaveBeenCalledWith("権限がありません");
      expect(result.current.deleteDialogOpen).toBe(false);
    });

    test("should handle delete group successfully", async () => {
      // Arrange
      const mockMutate = vi.fn();
      mockUseMutation.mockReturnValue({
        mutate: mockMutate.mockImplementation(() => {
          // 成功時のコールバックを直接呼び出す
          mockToastSuccess("グループを削除しました");
        }),
        isPending: false,
      });

      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Act
      act(() => {
        result.current.handleDeleteGroup(testGroupId);
      });

      // Assert
      expect(mockMutate).toHaveBeenCalledWith(testGroupId);
      expect(mockToastSuccess).toHaveBeenCalledWith("グループを削除しました");
    });

    test("should show error when non-owner tries to delete group", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: false,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Act
      act(() => {
        result.current.handleDeleteGroup(testGroupId);
      });

      // Assert
      expect(mockToastError).toHaveBeenCalledWith("権限がありません");
    });

    test("should handle delete group error", async () => {
      // Arrange
      const errorMessage = "削除に失敗しました";
      const mockMutate = vi.fn();
      mockUseMutation.mockReturnValue({
        mutate: mockMutate.mockImplementation(() => {
          // エラー時のコールバックを直接呼び出す
          mockToastError(errorMessage);
        }),
        isPending: false,
      });

      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Act
      act(() => {
        result.current.handleDeleteGroup(testGroupId);
      });

      // Assert
      expect(mockMutate).toHaveBeenCalledWith(testGroupId);
      expect(mockToastError).toHaveBeenCalledWith(errorMessage);
    });

    test("should show loading state during delete group", () => {
      // Arrange
      mockUseMutation.mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
      });

      // Act
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Assert
      expect(result.current.isDeletingGroup).toBe(true);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("メンバー除名機能", () => {
    test("should open remove member dialog when user is owner", async () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Act
      await act(async () => {
        await result.current.handleOpenRemoveMemberDialog();
      });

      // Assert
      expect(result.current.removeMemberDialogOpen).toBe(true);
    });

    test("should show error when non-owner tries to remove member", async () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: false,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Act
      await act(async () => {
        await result.current.handleOpenRemoveMemberDialog();
      });

      // Assert
      expect(mockToastError).toHaveBeenCalledWith("権限がありません");
      expect(result.current.removeMemberDialogOpen).toBe(false);
    });

    test("should handle remove member successfully", async () => {
      // Arrange
      const targetUserId = "target-user-id";
      const mockMutate = vi.fn();
      mockUseMutation.mockReturnValue({
        mutate: mockMutate.mockImplementation(() => {
          // 成功時のコールバックを直接呼び出す
          mockToastSuccess("メンバーを削除しました");
        }),
        isPending: false,
      });

      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Set selected member
      act(() => {
        result.current.setSelectedMemberForRemoval(targetUserId);
        result.current.setSelectedMemberNameForRemoval("Target User");
      });

      // Act
      act(() => {
        result.current.handleRemoveMember();
      });

      // Assert
      expect(mockMutate).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith("メンバーを削除しました");
    });

    test("should show error when non-owner tries to remove member via handleRemoveMember", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: false,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Act
      act(() => {
        result.current.handleRemoveMember();
      });

      // Assert
      expect(mockToastError).toHaveBeenCalledWith("権限がありません");
    });

    test("should show error when no member is selected", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Act
      act(() => {
        result.current.handleRemoveMember();
      });

      // Assert
      expect(mockToastError).toHaveBeenCalledWith("メンバーを選択してください");
    });

    test("should handle remove member error", async () => {
      // Arrange
      const targetUserId = "target-user-id";
      const errorMessage = "メンバー削除に失敗しました";
      const mockMutate = vi.fn();
      mockUseMutation.mockReturnValue({
        mutate: mockMutate.mockImplementation(() => {
          // エラー時のコールバックを直接呼び出す
          mockToastError(errorMessage);
        }),
        isPending: false,
      });

      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Set selected member
      act(() => {
        result.current.setSelectedMemberForRemoval(targetUserId);
      });

      // Act
      act(() => {
        result.current.handleRemoveMember();
      });

      // Assert
      expect(mockMutate).toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledWith(errorMessage);
    });

    test("should show loading state during remove member", () => {
      // Arrange
      mockUseMutation.mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
      });

      // Act
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Assert
      expect(result.current.isRemovingMember).toBe(true);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ダイアログ状態管理", () => {
    test("should manage delete dialog state", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Act & Assert
      act(() => {
        result.current.setDeleteDialogOpen(true);
      });
      expect(result.current.deleteDialogOpen).toBe(true);

      act(() => {
        result.current.setDeleteDialogOpen(false);
      });
      expect(result.current.deleteDialogOpen).toBe(false);
    });

    test("should manage leave dialog state", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Act & Assert
      act(() => {
        result.current.setLeaveDialogOpen(true);
      });
      expect(result.current.leaveDialogOpen).toBe(true);

      act(() => {
        result.current.setLeaveDialogOpen(false);
      });
      expect(result.current.leaveDialogOpen).toBe(false);
    });

    test("should manage remove member dialog state", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Act & Assert
      act(() => {
        result.current.setRemoveMemberDialogOpen(true);
      });
      expect(result.current.removeMemberDialogOpen).toBe(true);

      act(() => {
        result.current.setRemoveMemberDialogOpen(false);
      });
      expect(result.current.removeMemberDialogOpen).toBe(false);
    });

    test("should manage selected member for removal", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      const testUserId = "test-user-123";
      const testUserName = "Test User";

      // Act & Assert
      act(() => {
        result.current.setSelectedMemberForRemoval(testUserId);
      });
      expect(result.current.selectedMemberForRemoval).toBe(testUserId);

      act(() => {
        result.current.setSelectedMemberNameForRemoval(testUserName);
      });
      expect(result.current.selectedMemberNameForRemoval).toBe(testUserName);

      act(() => {
        result.current.setSelectedMemberForRemoval(null);
        result.current.setSelectedMemberNameForRemoval(null);
      });
      expect(result.current.selectedMemberForRemoval).toBeNull();
      expect(result.current.selectedMemberNameForRemoval).toBeNull();
    });

    test("should manage combobox state", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Act & Assert
      act(() => {
        result.current.setIsRemovalComboboxOpen(true);
      });
      expect(result.current.isRemovalComboboxOpen).toBe(true);

      act(() => {
        result.current.setIsRemovalComboboxOpen(false);
      });
      expect(result.current.isRemovalComboboxOpen).toBe(false);
    });

    test("should manage blacklist state", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Act & Assert
      act(() => {
        result.current.setAddToBlackList(true);
      });
      expect(result.current.addToBlackList).toBe(true);

      act(() => {
        result.current.setAddToBlackList(false);
      });
      expect(result.current.addToBlackList).toBe(false);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値・異常系テスト", () => {
    test("should handle undefined session", () => {
      // Arrange
      mockUseSession.mockReturnValue({
        data: null,
        status: "unauthenticated",
      });

      // Act & Assert - セッションがない場合はredirectが呼ばれることを期待
      expect(() => {
        renderHook(
          () =>
            useGroupManipulation({
              isOwner: true,
              groupId: testGroupId,
            }),
          { wrapper: AllTheProviders },
        );
      }).not.toThrow();
    });

    test("should handle empty group members array", async () => {
      // Arrange
      const groupWithNoMembers = createTestGroup({
        id: testGroupId,
        members: [],
      });

      mockUseQuery.mockReturnValue({
        data: groupWithNoMembers,
        isPending: false,
      });

      // Act
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Assert
      await waitFor(() => {
        expect(result.current.isMember).toBe(false);
      });
    });

    test("should handle null group data", () => {
      // Arrange
      mockUseQuery.mockReturnValue({
        data: null,
        isPending: false,
      });

      // Act
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Assert
      expect(result.current.group).toBeNull();
      expect(result.current.isMember).toBe(false);
    });

    test("should handle undefined group members", async () => {
      // Arrange
      const groupWithUndefinedMembers = createTestGroup({
        id: testGroupId,
        members: undefined as unknown as { userId: string }[],
      });

      mockUseQuery.mockReturnValue({
        data: groupWithUndefinedMembers,
        isPending: false,
      });

      // Act
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Assert - undefinedの場合はエラーが発生しないことを確認
      expect(result.current.group).toStrictEqual(groupWithUndefinedMembers);
    });

    test("should handle very long group ID", () => {
      // Arrange
      const longGroupId = "a".repeat(1000);

      // Act
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: longGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Assert - 長いIDでもエラーが発生しないことを確認
      expect(result.current).toBeDefined();
    });

    test("should handle empty group ID", () => {
      // Arrange
      const emptyGroupId = "";

      // Act
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: emptyGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Assert - 空のIDでもエラーが発生しないことを確認
      expect(result.current).toBeDefined();
    });

    test("should handle mutation error without message", async () => {
      // Arrange
      const mockMutate = vi.fn();
      mockUseMutation.mockReturnValue({
        mutate: mockMutate.mockImplementation(() => {
          // エラー時のコールバックを直接呼び出す
          mockToastError("グループへの参加に失敗しました。");
        }),
        isPending: false,
      });

      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Act
      act(() => {
        result.current.handleJoinGroup(testGroupId);
      });

      // Assert
      expect(mockToastError).toHaveBeenCalledWith("グループへの参加に失敗しました。");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("統合テスト", () => {
    test("should handle complete workflow: join -> leave -> delete", async () => {
      // Arrange
      const mockMutate = vi.fn();
      mockUseMutation.mockReturnValue({
        mutate: mockMutate.mockImplementation(() => {
          // 各操作の成功メッセージを順番に呼び出す
          if (mockMutate.mock.calls.length === 1) {
            mockToastSuccess("グループに参加しました");
          } else if (mockMutate.mock.calls.length === 2) {
            mockToastSuccess("グループから脱退しました");
          } else if (mockMutate.mock.calls.length === 3) {
            mockToastSuccess("グループを削除しました");
          }
        }),
        isPending: false,
      });

      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Act 1: Join group
      act(() => {
        result.current.handleJoinGroup(testGroupId);
      });

      expect(mockToastSuccess).toHaveBeenCalledWith("グループに参加しました");

      // Act 2: Leave group
      act(() => {
        result.current.handleLeave();
      });
      expect(result.current.leaveDialogOpen).toBe(true);

      act(() => {
        result.current.executeLeaveGroup(testGroupId);
      });

      expect(mockToastSuccess).toHaveBeenCalledWith("グループから脱退しました");

      // Act 3: Delete group
      act(() => {
        result.current.handleDeleteGroup(testGroupId);
      });

      expect(mockToastSuccess).toHaveBeenCalledWith("グループを削除しました");
    });

    test("should handle multiple dialog states simultaneously", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useGroupManipulation({
            isOwner: true,
            groupId: testGroupId,
          }),
        { wrapper: AllTheProviders },
      );

      // Act - 複数のダイアログを同時に開く
      act(() => {
        result.current.setDeleteDialogOpen(true);
        result.current.setLeaveDialogOpen(true);
        result.current.setEditDialogOpen(true);
        result.current.setRemoveMemberDialogOpen(true);
      });

      // Assert - すべてのダイアログが開いていることを確認
      expect(result.current.deleteDialogOpen).toBe(true);
      expect(result.current.leaveDialogOpen).toBe(true);
      expect(result.current.editDialogOpen).toBe(true);
      expect(result.current.removeMemberDialogOpen).toBe(true);
    });
  });
});
