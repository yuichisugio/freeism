"use client";

import type { Group } from "@/types/group-types";
import { mockUseSession } from "@/test/setup/setup";
import { AllTheProviders } from "@/test/setup/tanstack-query-setup";
import { faker } from "@faker-js/faker";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Factory } from "fishery";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { GroupDetail } from "./group-detail";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// ホイストされたモック関数の宣言
const { mockUseGroupPermission, mockUseGroupDetailModal, mockUseGroupManipulation } = vi.hoisted(() => ({
  mockUseGroupPermission: vi.fn(),
  mockUseGroupDetailModal: vi.fn(),
  mockUseGroupManipulation: vi.fn(),
}));

// カスタムフックのモック
vi.mock("@/hooks/group/group-detail/use-group-permission", () => ({
  useGroupPermission: mockUseGroupPermission,
}));

vi.mock("@/hooks/group/group-detail/use-group-detail-modal", () => ({
  useGroupDetailModal: mockUseGroupDetailModal,
}));

vi.mock("@/hooks/group/group-detail/use-group-manipulation", () => ({
  useGroupManipulation: mockUseGroupManipulation,
}));

// 子コンポーネントのモック
vi.mock("@/components/form/edit-group-form", () => ({
  EditGroupForm: vi.fn(({ onCloseAction }: { onCloseAction: () => void }) => (
    <div data-testid="edit-group-form">
      <button onClick={() => onCloseAction()}>Close Edit Form</button>
    </div>
  )),
}));

vi.mock("@/components/group/group-detail-table", () => ({
  GroupDetailTable: vi.fn(({ groupId, isOwner }: { groupId: string; isOwner: boolean }) => (
    <div data-testid="group-detail-table">
      Group Detail Table - GroupId: {groupId}, IsOwner: {isOwner.toString()}
    </div>
  )),
}));

vi.mock("@/components/modal/csv-upload-modal", () => ({
  CsvUploadModal: vi.fn(
    ({
      isOpen,
      onCloseAction,
      groupId,
    }: {
      isOpen: boolean;
      onCloseAction: (open: boolean) => void;
      groupId: string;
    }) => (
      <div data-testid="csv-upload-modal" style={{ display: isOpen ? "block" : "none" }}>
        CSV Upload Modal - GroupId: {groupId}
        <button onClick={() => onCloseAction(false)}>Close CSV Modal</button>
      </div>
    ),
  ),
}));

vi.mock("@/components/modal/export-data-modal", () => ({
  ExportDataModal: vi.fn(
    ({
      isOpen,
      onCloseAction,
      groupId,
      groupName,
    }: {
      isOpen: boolean;
      onCloseAction: () => void;
      groupId: string;
      groupName: string;
    }) => (
      <div data-testid="export-data-modal" style={{ display: isOpen ? "block" : "none" }}>
        Export Data Modal - GroupId: {groupId}, GroupName: {groupName}
        <button onClick={() => onCloseAction()}>Close Export Modal</button>
      </div>
    ),
  ),
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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ作成ヘルパー関数
 */

const createTestGroup = (overrides: Partial<Group> = {}): Group => {
  return groupFactory.build(overrides);
};

const createTestSession = (overrides: Partial<{ user: { id: string; email: string; name: string } }> = {}) => {
  return sessionFactory.build(overrides);
};

// デフォルトのフック戻り値を作成
const createDefaultUseGroupPermissionReturn = (overrides = {}) => ({
  isOwner: false,
  groupMembers: [],
  showPermissionDialog: false,
  selectedUserId: null,
  selectedUserName: null,
  isComboboxOpen: false,
  setShowPermissionDialog: vi.fn(),
  setSelectedUserId: vi.fn(),
  setSelectedUserName: vi.fn(),
  setIsComboboxOpen: vi.fn(),
  handleOpenPermissionDialog: vi.fn(),
  handleGrantPermission: vi.fn(),
  ...overrides,
});

const createDefaultUseGroupDetailModalReturn = (overrides = {}) => ({
  isUploadModalOpen: false,
  isExportModalOpen: false,
  setIsUploadModalOpen: vi.fn(),
  setIsExportModalOpen: vi.fn(),
  ...overrides,
});

const createDefaultUseGroupManipulationReturn = (overrides = {}) => ({
  group: null,
  isMember: false,
  deleteDialogOpen: false,
  leaveDialogOpen: false,
  editDialogOpen: false,
  removeMemberDialogOpen: false,
  selectedMemberForRemoval: null,
  selectedMemberNameForRemoval: null,
  isRemovalComboboxOpen: false,
  addToBlackList: false,
  isLoadingGroup: false,
  isJoiningGroup: false,
  isLeavingGroup: false,
  isDeletingGroup: false,
  isRemovingMember: false,
  setDeleteDialogOpen: vi.fn(),
  setLeaveDialogOpen: vi.fn(),
  setEditDialogOpen: vi.fn(),
  setRemoveMemberDialogOpen: vi.fn(),
  setSelectedMemberForRemoval: vi.fn(),
  setSelectedMemberNameForRemoval: vi.fn(),
  setIsRemovalComboboxOpen: vi.fn(),
  setAddToBlackList: vi.fn(),
  handleJoinGroup: vi.fn(),
  handleLeave: vi.fn(),
  executeLeaveGroup: vi.fn(),
  handleOpenEditDialog: vi.fn(),
  handleOpenDeleteDialog: vi.fn(),
  handleDeleteGroup: vi.fn(),
  handleOpenRemoveMemberDialog: vi.fn(),
  handleRemoveMember: vi.fn(),
  ...overrides,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストセットアップ
 */

const testGroupId = "test-group-id";
const testUserId = "test-user-id";

describe("GroupDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルトのセッション設定
    mockUseSession.mockReturnValue({
      data: createTestSession({ user: { id: testUserId, email: "test@example.com", name: "Test User" } }),
      status: "authenticated",
    });

    // デフォルトのフック戻り値設定
    mockUseGroupPermission.mockReturnValue(createDefaultUseGroupPermissionReturn());
    mockUseGroupDetailModal.mockReturnValue(createDefaultUseGroupDetailModalReturn());
    mockUseGroupManipulation.mockReturnValue(createDefaultUseGroupManipulationReturn());
  });

  describe("初期化とレンダリング", () => {
    test("should render loading state when group is loading", () => {
      // Arrange
      mockUseGroupManipulation.mockReturnValue(
        createDefaultUseGroupManipulationReturn({
          isLoadingGroup: true,
          group: null,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetail groupId={testGroupId} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("グループ情報を読み込んでいます...")).toBeInTheDocument();
    });

    test("should render group not found message when group is null", async () => {
      // Arrange
      mockUseGroupManipulation.mockReturnValue(
        createDefaultUseGroupManipulationReturn({
          isLoadingGroup: false,
          group: null,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetail groupId={testGroupId} />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText("グループが見つかりません")).toBeInTheDocument();
      });
    });

    test("should render group information when group is loaded", async () => {
      // Arrange
      const testGroup = createTestGroup({
        id: testGroupId,
        name: "テストグループ",
        goal: "テスト目標",
        evaluationMethod: "自動評価",
        joinMemberCount: 5,
        maxParticipants: 10,
      });

      mockUseGroupManipulation.mockReturnValue(
        createDefaultUseGroupManipulationReturn({
          isLoadingGroup: false,
          group: testGroup,
          isMember: true,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetail groupId={testGroupId} />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText("テストグループ")).toBeInTheDocument();
        expect(screen.getByText("テスト目標")).toBeInTheDocument();
        expect(screen.getByText("参加人数: 5 / 10")).toBeInTheDocument();
        expect(screen.getByText("評価方法: 自動評価")).toBeInTheDocument();
      });
    });
  });

  describe("権限に基づく表示制御", () => {
    test("should show join button for non-members", async () => {
      // Arrange
      const testGroup = createTestGroup({ id: testGroupId });
      mockUseGroupManipulation.mockReturnValue(
        createDefaultUseGroupManipulationReturn({
          group: testGroup,
          isMember: false,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetail groupId={testGroupId} />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText("グループに参加する")).toBeInTheDocument();
      });
    });

    test("should show member actions for members", async () => {
      // Arrange
      const testGroup = createTestGroup({ id: testGroupId });
      mockUseGroupManipulation.mockReturnValue(
        createDefaultUseGroupManipulationReturn({
          group: testGroup,
          isMember: true,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetail groupId={testGroupId} />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText("エクスポート")).toBeInTheDocument();
      });
    });

    test("should show owner actions for group owners", async () => {
      // Arrange
      const testGroup = createTestGroup({ id: testGroupId });
      mockUseGroupPermission.mockReturnValue(
        createDefaultUseGroupPermissionReturn({
          isOwner: true,
        }),
      );
      mockUseGroupManipulation.mockReturnValue(
        createDefaultUseGroupManipulationReturn({
          group: testGroup,
          isMember: true,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetail groupId={testGroupId} />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText("グループを編集")).toBeInTheDocument();
        expect(screen.getByText("CSVアップロード")).toBeInTheDocument();
        expect(screen.getByText("権限を付与")).toBeInTheDocument();
        expect(screen.getByText("メンバーを除名")).toBeInTheDocument();
        expect(screen.getByText("グループを削除")).toBeInTheDocument();
      });
    });

    test("should show leave button for non-owner members", async () => {
      // Arrange
      const testGroup = createTestGroup({ id: testGroupId });
      mockUseGroupPermission.mockReturnValue(
        createDefaultUseGroupPermissionReturn({
          isOwner: false,
        }),
      );
      mockUseGroupManipulation.mockReturnValue(
        createDefaultUseGroupManipulationReturn({
          group: testGroup,
          isMember: true,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetail groupId={testGroupId} />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText("グループを脱退")).toBeInTheDocument();
      });
    });
  });

  describe("ユーザーアクション", () => {
    test("should call handleJoinGroup when join button is clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      const testGroup = createTestGroup({ id: testGroupId });
      const mockHandleJoinGroup = vi.fn();

      mockUseGroupManipulation.mockReturnValue(
        createDefaultUseGroupManipulationReturn({
          group: testGroup,
          isMember: false,
          handleJoinGroup: mockHandleJoinGroup,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetail groupId={testGroupId} />
        </AllTheProviders>,
      );

      const joinButton = await screen.findByText("グループに参加する");
      await user.click(joinButton);

      // Assert
      expect(mockHandleJoinGroup).toHaveBeenCalledWith(testGroupId);
    });

    test("should call handleLeave when leave button is clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      const testGroup = createTestGroup({ id: testGroupId });
      const mockHandleLeave = vi.fn();

      mockUseGroupPermission.mockReturnValue(
        createDefaultUseGroupPermissionReturn({
          isOwner: false,
        }),
      );
      mockUseGroupManipulation.mockReturnValue(
        createDefaultUseGroupManipulationReturn({
          group: testGroup,
          isMember: true,
          handleLeave: mockHandleLeave,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetail groupId={testGroupId} />
        </AllTheProviders>,
      );

      const leaveButton = await screen.findByText("グループを脱退");
      await user.click(leaveButton);

      // Assert
      expect(mockHandleLeave).toHaveBeenCalled();
    });

    test("should call handleOpenEditDialog when edit button is clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      const testGroup = createTestGroup({ id: testGroupId });
      const mockHandleOpenEditDialog = vi.fn();

      mockUseGroupPermission.mockReturnValue(
        createDefaultUseGroupPermissionReturn({
          isOwner: true,
        }),
      );
      mockUseGroupManipulation.mockReturnValue(
        createDefaultUseGroupManipulationReturn({
          group: testGroup,
          isMember: true,
          handleOpenEditDialog: mockHandleOpenEditDialog,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetail groupId={testGroupId} />
        </AllTheProviders>,
      );

      const editButton = await screen.findByText("グループを編集");
      await user.click(editButton);

      // Assert
      expect(mockHandleOpenEditDialog).toHaveBeenCalled();
    });

    test("should call setIsUploadModalOpen when CSV upload button is clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      const testGroup = createTestGroup({ id: testGroupId });
      const mockSetIsUploadModalOpen = vi.fn();

      mockUseGroupPermission.mockReturnValue(
        createDefaultUseGroupPermissionReturn({
          isOwner: true,
        }),
      );
      mockUseGroupManipulation.mockReturnValue(
        createDefaultUseGroupManipulationReturn({
          group: testGroup,
          isMember: true,
        }),
      );
      mockUseGroupDetailModal.mockReturnValue(
        createDefaultUseGroupDetailModalReturn({
          setIsUploadModalOpen: mockSetIsUploadModalOpen,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetail groupId={testGroupId} />
        </AllTheProviders>,
      );

      const uploadButton = await screen.findByText("CSVアップロード");
      await user.click(uploadButton);

      // Assert
      expect(mockSetIsUploadModalOpen).toHaveBeenCalledWith(true);
    });

    test("should call setIsExportModalOpen when export button is clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      const testGroup = createTestGroup({ id: testGroupId });
      const mockSetIsExportModalOpen = vi.fn();

      mockUseGroupManipulation.mockReturnValue(
        createDefaultUseGroupManipulationReturn({
          group: testGroup,
          isMember: true,
        }),
      );
      mockUseGroupDetailModal.mockReturnValue(
        createDefaultUseGroupDetailModalReturn({
          setIsExportModalOpen: mockSetIsExportModalOpen,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetail groupId={testGroupId} />
        </AllTheProviders>,
      );

      const exportButton = await screen.findByText("エクスポート");
      await user.click(exportButton);

      // Assert
      expect(mockSetIsExportModalOpen).toHaveBeenCalledWith(true);
    });
  });

  describe("モーダル・ダイアログの表示制御", () => {
    test("should show edit dialog when editDialogOpen is true", async () => {
      // Arrange
      const testGroup = createTestGroup({ id: testGroupId });

      mockUseGroupManipulation.mockReturnValue(
        createDefaultUseGroupManipulationReturn({
          group: testGroup,
          editDialogOpen: true,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetail groupId={testGroupId} />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId("edit-group-form")).toBeInTheDocument();
      });
    });

    test("should show CSV upload modal when isUploadModalOpen is true", async () => {
      // Arrange
      const testGroup = createTestGroup({ id: testGroupId });

      mockUseGroupManipulation.mockReturnValue(
        createDefaultUseGroupManipulationReturn({
          group: testGroup,
        }),
      );
      mockUseGroupDetailModal.mockReturnValue(
        createDefaultUseGroupDetailModalReturn({
          isUploadModalOpen: true,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetail groupId={testGroupId} />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId("csv-upload-modal")).toBeVisible();
      });
    });

    test("should show export modal when isExportModalOpen is true", async () => {
      // Arrange
      const testGroup = createTestGroup({ id: testGroupId });

      mockUseGroupManipulation.mockReturnValue(
        createDefaultUseGroupManipulationReturn({
          group: testGroup,
        }),
      );
      mockUseGroupDetailModal.mockReturnValue(
        createDefaultUseGroupDetailModalReturn({
          isExportModalOpen: true,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetail groupId={testGroupId} />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId("export-data-modal")).toBeVisible();
      });
    });
  });

  describe("ローディング状態", () => {
    test("should show loading spinner when joining group", async () => {
      // Arrange
      const testGroup = createTestGroup({ id: testGroupId });

      mockUseGroupManipulation.mockReturnValue(
        createDefaultUseGroupManipulationReturn({
          group: testGroup,
          isMember: false,
          isJoiningGroup: true,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetail groupId={testGroupId} />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        const joinButton = screen.getByRole("button", { name: /グループに参加する/ });
        expect(joinButton).toBeDisabled();
      });
    });

    test("should show loading spinner when leaving group", async () => {
      // Arrange
      const testGroup = createTestGroup({ id: testGroupId });

      mockUseGroupPermission.mockReturnValue(
        createDefaultUseGroupPermissionReturn({
          isOwner: false,
        }),
      );
      mockUseGroupManipulation.mockReturnValue(
        createDefaultUseGroupManipulationReturn({
          group: testGroup,
          isMember: true,
          isLeavingGroup: true,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetail groupId={testGroupId} />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        const leaveButton = screen.getByRole("button", { name: /グループを脱退/ });
        expect(leaveButton).toBeDisabled();
      });
    });

    test("should show loading spinner when deleting group", async () => {
      // Arrange
      const testGroup = createTestGroup({ id: testGroupId });

      mockUseGroupPermission.mockReturnValue(
        createDefaultUseGroupPermissionReturn({
          isOwner: true,
        }),
      );
      mockUseGroupManipulation.mockReturnValue(
        createDefaultUseGroupManipulationReturn({
          group: testGroup,
          isMember: true,
          isDeletingGroup: true,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetail groupId={testGroupId} />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        const deleteButton = screen.getByRole("button", { name: /グループを削除/ });
        expect(deleteButton).toBeDisabled();
      });
    });

    test("should show loading spinner when removing member", async () => {
      // Arrange
      const testGroup = createTestGroup({ id: testGroupId });

      mockUseGroupPermission.mockReturnValue(
        createDefaultUseGroupPermissionReturn({
          isOwner: true,
        }),
      );
      mockUseGroupManipulation.mockReturnValue(
        createDefaultUseGroupManipulationReturn({
          group: testGroup,
          isMember: true,
          isRemovingMember: true,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetail groupId={testGroupId} />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        const removeMemberButton = screen.getByRole("button", { name: /メンバーを除名/ });
        expect(removeMemberButton).toBeDisabled();
      });
    });
  });

  describe("境界値テスト", () => {
    test("should handle group with zero members", async () => {
      // Arrange
      const testGroup = createTestGroup({
        id: testGroupId,
        joinMemberCount: 0,
        maxParticipants: 10,
      });

      mockUseGroupManipulation.mockReturnValue(
        createDefaultUseGroupManipulationReturn({
          group: testGroup,
          isMember: false,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetail groupId={testGroupId} />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText("参加人数: 0 / 10")).toBeInTheDocument();
      });
    });

    test("should handle group with maximum members", async () => {
      // Arrange
      const testGroup = createTestGroup({
        id: testGroupId,
        joinMemberCount: 50,
        maxParticipants: 50,
      });

      mockUseGroupManipulation.mockReturnValue(
        createDefaultUseGroupManipulationReturn({
          group: testGroup,
          isMember: true,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetail groupId={testGroupId} />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText("参加人数: 50 / 50")).toBeInTheDocument();
      });
    });

    test("should handle very long group name", async () => {
      // Arrange
      const longGroupName = "a".repeat(100);
      const testGroup = createTestGroup({
        id: testGroupId,
        name: longGroupName,
      });

      mockUseGroupManipulation.mockReturnValue(
        createDefaultUseGroupManipulationReturn({
          group: testGroup,
          isMember: true,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetail groupId={testGroupId} />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(longGroupName)).toBeInTheDocument();
      });
    });

    test("should handle very long group goal", async () => {
      // Arrange
      const longGoal = "b".repeat(500);
      const testGroup = createTestGroup({
        id: testGroupId,
        goal: longGoal,
      });

      mockUseGroupManipulation.mockReturnValue(
        createDefaultUseGroupManipulationReturn({
          group: testGroup,
          isMember: true,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetail groupId={testGroupId} />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(longGoal)).toBeInTheDocument();
      });
    });
  });

  describe("異常系テスト", () => {
    test("should handle undefined group properties gracefully", async () => {
      // Arrange
      const testGroup = createTestGroup({
        id: testGroupId,
        name: "",
        goal: "",
        evaluationMethod: "",
        joinMemberCount: 0,
        maxParticipants: 0,
      });

      mockUseGroupManipulation.mockReturnValue(
        createDefaultUseGroupManipulationReturn({
          group: testGroup,
          isMember: true,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetail groupId={testGroupId} />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText("参加人数: 0 / 0")).toBeInTheDocument();
        expect(screen.getByText("評価方法:")).toBeInTheDocument();
      });
    });

    test("should handle session without user", () => {
      // Arrange
      mockUseSession.mockReturnValue({
        data: null,
        status: "unauthenticated",
      });

      const testGroup = createTestGroup({ id: testGroupId });
      mockUseGroupManipulation.mockReturnValue(
        createDefaultUseGroupManipulationReturn({
          group: testGroup,
        }),
      );

      // Act & Assert - コンポーネントがクラッシュしないことを確認
      expect(() => {
        render(
          <AllTheProviders>
            <GroupDetail groupId={testGroupId} />
          </AllTheProviders>,
        );
      }).not.toThrow();
    });
  });

  describe("子コンポーネントとの連携", () => {
    test("should render GroupDetailTable with correct props", async () => {
      // Arrange
      const testGroup = createTestGroup({ id: testGroupId });

      mockUseGroupPermission.mockReturnValue(
        createDefaultUseGroupPermissionReturn({
          isOwner: true,
        }),
      );
      mockUseGroupManipulation.mockReturnValue(
        createDefaultUseGroupManipulationReturn({
          group: testGroup,
          isMember: true,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetail groupId={testGroupId} />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId("group-detail-table")).toBeInTheDocument();
        expect(screen.getByText(`Group Detail Table - GroupId: ${testGroupId}, IsOwner: true`)).toBeInTheDocument();
      });
    });

    test("should render modals with correct props", async () => {
      // Arrange
      const testGroup = createTestGroup({
        id: testGroupId,
        name: "Test Group Name",
      });

      mockUseGroupManipulation.mockReturnValue(
        createDefaultUseGroupManipulationReturn({
          group: testGroup,
        }),
      );
      mockUseGroupDetailModal.mockReturnValue(
        createDefaultUseGroupDetailModalReturn({
          isUploadModalOpen: true,
          isExportModalOpen: true,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetail groupId={testGroupId} />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(`CSV Upload Modal - GroupId: ${testGroupId}`)).toBeInTheDocument();
        expect(
          screen.getByText(`Export Data Modal - GroupId: ${testGroupId}, GroupName: Test Group Name`),
        ).toBeInTheDocument();
      });
    });
  });
});
