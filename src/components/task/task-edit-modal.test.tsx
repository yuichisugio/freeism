import type { TaskFormValues } from "@/hooks/modal/use-task-edit-modal";
import type { TaskParticipant } from "@/types/group-types";
import { AllTheProviders } from "@/test/setup/tanstack-query-setup";
import { faker } from "@faker-js/faker";
import { contributionType } from "@prisma/client";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Factory } from "fishery";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { TaskEditModal } from "./task-edit-modal";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ホイストされたモック関数の宣言
 */
const { mockUseTaskEditModal } = vi.hoisted(() => ({
  mockUseTaskEditModal: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// useTaskEditModalフックのモック
vi.mock("@/hooks/modal/use-task-edit-modal", () => ({
  useTaskEditModal: mockUseTaskEditModal,
}));

// CustomFormFieldコンポーネントのモック
vi.mock("@/components/share/form/form-field", () => ({
  CustomFormField: ({ label, name }: { label: string; name: string }) => (
    <div data-testid={`form-field-${name}`}>
      <label>{label}</label>
      <input name={name} />
    </div>
  ),
}));

// ImageUploadAreaコンポーネントのモック
vi.mock("@/components/share/image-upload-area", () => ({
  ImageUploadArea: ({ onImageUploaded, onImageRemoved }: { onImageUploaded?: (url: string) => void; onImageRemoved?: () => void }) => (
    <div data-testid="image-upload-area">
      <button onClick={() => onImageUploaded?.("test-image-url")}>Upload Image</button>
      <button onClick={() => onImageRemoved?.()}>Remove Image</button>
    </div>
  ),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Fisheryファクトリーを使用したテストデータ作成
 */

// TaskParticipantファクトリー
const taskParticipantFactory = Factory.define<TaskParticipant>(({ sequence, params }) => ({
  appUserId: params.appUserId ?? `user-${sequence}`,
  appUserName: params.appUserName ?? faker.person.fullName(),
}));

// TaskFormValuesファクトリー
const taskFormValuesFactory = Factory.define<TaskFormValues>(({ params }) => ({
  task: params.task ?? faker.lorem.sentence(),
  detail: params.detail ?? faker.lorem.paragraph(),
  reference: params.reference ?? faker.lorem.paragraph(),
  info: params.info ?? faker.lorem.paragraph(),
  contributionType: params.contributionType ?? contributionType.REWARD,
  category: params.category ?? "その他",
  executors: params.executors ?? [],
  reporters: params.reporters ?? [],
  imageUrl: params.imageUrl ?? "",
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ作成ヘルパー関数
 */

const createTestTaskParticipants = (count = 3): TaskParticipant[] => {
  return taskParticipantFactory.buildList(count);
};

const createMockForm = (values: Partial<TaskFormValues> = {}) => {
  const formValues = taskFormValuesFactory.build(values);
  return {
    control: {} as unknown,
    getValues: vi.fn().mockReturnValue(formValues),
    setValue: vi.fn(),
    watch: vi.fn().mockReturnValue(formValues.contributionType),
    reset: vi.fn(),
  };
};

const createDefaultMockReturn = (overrides: Record<string, unknown> = {}) => ({
  // state
  form: createMockForm(),
  isSubmitting: false,
  isRewardType: true,
  categoryOpen: false,
  executors: [],
  nonRegisteredExecutor: "",
  reporters: [],
  nonRegisteredReporter: "",
  users: [],
  isLoading: false,

  // function
  setCategoryOpen: vi.fn(),
  setNonRegisteredExecutor: vi.fn(),
  setNonRegisteredReporter: vi.fn(),
  handleOpenChange: vi.fn(),
  addExecutor: vi.fn(),
  removeExecutor: vi.fn(),
  addReporter: vi.fn(),
  removeReporter: vi.fn(),
  handleImageUploaded: vi.fn(),
  handleImageRemoved: vi.fn(),
  handleUpdate: vi.fn(),
  ...overrides,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストセットアップ
 */

describe("TaskEditModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルトのモック戻り値を設定
    mockUseTaskEditModal.mockReturnValue(createDefaultMockReturn());
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系", () => {
    test("should render modal with basic elements when open", () => {
      // Arrange
      const props = {
        taskId: "test-task-id",
        open: true,
        onOpenChangeAction: vi.fn(),
      };

      // Act
      render(
        <AllTheProviders>
          <TaskEditModal {...props} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("タスクを編集")).toBeInTheDocument();
      expect(screen.getByText("貢献の種類")).toBeInTheDocument();
      expect(screen.getByText("タスクのタイトル")).toBeInTheDocument();
      expect(screen.getByText("カテゴリ")).toBeInTheDocument();
      expect(screen.getByText("タスクの詳細")).toBeInTheDocument();
      expect(screen.getByText("参考にした内容")).toBeInTheDocument();
      expect(screen.getByText("証拠・結果・補足情報")).toBeInTheDocument();
      expect(screen.getByText("タスク実行者")).toBeInTheDocument();
      expect(screen.getByText("タスク報告者")).toBeInTheDocument();
      expect(screen.getByText("キャンセル")).toBeInTheDocument();
      expect(screen.getByText("更新")).toBeInTheDocument();
    });

    test("should not render modal when closed", () => {
      // Arrange
      const props = {
        taskId: "test-task-id",
        open: false,
        onOpenChangeAction: vi.fn(),
      };

      // Act
      render(
        <AllTheProviders>
          <TaskEditModal {...props} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.queryByText("タスクを編集")).not.toBeInTheDocument();
    });

    test("should render image upload area when contribution type is REWARD", () => {
      // Arrange
      mockUseTaskEditModal.mockReturnValue(
        createDefaultMockReturn({
          isRewardType: true,
        }),
      );

      const props = {
        taskId: "test-task-id",
        open: true,
        onOpenChangeAction: vi.fn(),
      };

      // Act
      render(
        <AllTheProviders>
          <TaskEditModal {...props} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("報酬画像")).toBeInTheDocument();
      expect(screen.getByTestId("image-upload-area")).toBeInTheDocument();
    });

    test("should not render image upload area when contribution type is NON_REWARD", () => {
      // Arrange
      mockUseTaskEditModal.mockReturnValue(
        createDefaultMockReturn({
          isRewardType: false,
        }),
      );

      const props = {
        taskId: "test-task-id",
        open: true,
        onOpenChangeAction: vi.fn(),
      };

      // Act
      render(
        <AllTheProviders>
          <TaskEditModal {...props} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.queryByText("報酬画像")).not.toBeInTheDocument();
      expect(screen.queryByTestId("image-upload-area")).not.toBeInTheDocument();
    });

    test("should render with onTaskUpdated callback", () => {
      // Arrange
      const onTaskUpdated = vi.fn();
      const props = {
        taskId: "test-task-id",
        open: true,
        onOpenChangeAction: vi.fn(),
        onTaskUpdated,
      };

      // Act
      render(
        <AllTheProviders>
          <TaskEditModal {...props} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("タスクを編集")).toBeInTheDocument();
    });

    test("should render with container prop", () => {
      // Arrange
      const container = document.createElement("div");
      const props = {
        taskId: "test-task-id",
        open: true,
        onOpenChangeAction: vi.fn(),
        container,
      };

      // Act
      render(
        <AllTheProviders>
          <TaskEditModal {...props} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("タスクを編集")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ローディング状態", () => {
    test("should render loading state when isLoading is true", () => {
      // Arrange
      mockUseTaskEditModal.mockReturnValue(
        createDefaultMockReturn({
          isLoading: true,
        }),
      );

      const props = {
        taskId: "test-task-id",
        open: true,
        onOpenChangeAction: vi.fn(),
      };

      // Act
      render(
        <AllTheProviders>
          <TaskEditModal {...props} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("読み込み中...")).toBeInTheDocument();
      expect(screen.queryByText("タスクを編集")).not.toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ユーザーインタラクション", () => {
    test("should call onOpenChangeAction when cancel button is clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      const onOpenChangeAction = vi.fn();
      const props = {
        taskId: "test-task-id",
        open: true,
        onOpenChangeAction,
      };

      // Act
      render(
        <AllTheProviders>
          <TaskEditModal {...props} />
        </AllTheProviders>,
      );

      const cancelButton = screen.getByText("キャンセル");
      await user.click(cancelButton);

      // Assert
      expect(onOpenChangeAction).toHaveBeenCalledWith(false);
    });

    test("should call handleUpdate when update button is clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      const handleUpdate = vi.fn();
      mockUseTaskEditModal.mockReturnValue(
        createDefaultMockReturn({
          handleUpdate,
        }),
      );

      const props = {
        taskId: "test-task-id",
        open: true,
        onOpenChangeAction: vi.fn(),
      };

      // Act
      render(
        <AllTheProviders>
          <TaskEditModal {...props} />
        </AllTheProviders>,
      );

      const updateButton = screen.getByText("更新");
      await user.click(updateButton);

      // Assert
      expect(handleUpdate).toHaveBeenCalled();
    });

    test("should disable buttons when isSubmitting is true", () => {
      // Arrange
      mockUseTaskEditModal.mockReturnValue(
        createDefaultMockReturn({
          isSubmitting: true,
        }),
      );

      const props = {
        taskId: "test-task-id",
        open: true,
        onOpenChangeAction: vi.fn(),
      };

      // Act
      render(
        <AllTheProviders>
          <TaskEditModal {...props} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("キャンセル")).toBeDisabled();
      expect(screen.getByText("更新中...")).toBeDisabled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("実行者・報告者管理", () => {
    test("should render executors list when executors exist", () => {
      // Arrange
      const testExecutors = createTestTaskParticipants(2);
      mockUseTaskEditModal.mockReturnValue(
        createDefaultMockReturn({
          executors: testExecutors,
        }),
      );

      const props = {
        taskId: "test-task-id",
        open: true,
        onOpenChangeAction: vi.fn(),
      };

      // Act
      render(
        <AllTheProviders>
          <TaskEditModal {...props} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("選択された実行者:")).toBeInTheDocument();
      expect(screen.getAllByText("削除")).toHaveLength(4); // 実行者2つ + 報告者2つ（デフォルトで空配列なので実際は2つ）
    });

    test("should render reporters list when reporters exist", () => {
      // Arrange
      const testReporters = createTestTaskParticipants(2);
      mockUseTaskEditModal.mockReturnValue(
        createDefaultMockReturn({
          reporters: testReporters,
        }),
      );

      const props = {
        taskId: "test-task-id",
        open: true,
        onOpenChangeAction: vi.fn(),
      };

      // Act
      render(
        <AllTheProviders>
          <TaskEditModal {...props} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("選択された報告者:")).toBeInTheDocument();
    });

    test("should render users dropdown when users exist", () => {
      // Arrange
      const testUsers = createTestTaskParticipants(3);
      mockUseTaskEditModal.mockReturnValue(
        createDefaultMockReturn({
          users: testUsers,
        }),
      );

      const props = {
        taskId: "test-task-id",
        open: true,
        onOpenChangeAction: vi.fn(),
      };

      // Act
      render(
        <AllTheProviders>
          <TaskEditModal {...props} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("登録済みユーザーから選択...")).toBeInTheDocument();
    });

    test("should render no users message when users array is empty", () => {
      // Arrange
      mockUseTaskEditModal.mockReturnValue(
        createDefaultMockReturn({
          users: [],
        }),
      );

      const props = {
        taskId: "test-task-id",
        open: true,
        onOpenChangeAction: vi.fn(),
      };

      // Act
      render(
        <AllTheProviders>
          <TaskEditModal {...props} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getAllByText("登録済みのユーザーがいません。")).toHaveLength(2); // 実行者と報告者セクション
    });

    test("should call addExecutor when add executor button is clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      const addExecutor = vi.fn();
      mockUseTaskEditModal.mockReturnValue(
        createDefaultMockReturn({
          addExecutor,
          nonRegisteredExecutor: "Test User",
        }),
      );

      const props = {
        taskId: "test-task-id",
        open: true,
        onOpenChangeAction: vi.fn(),
      };

      // Act
      render(
        <AllTheProviders>
          <TaskEditModal {...props} />
        </AllTheProviders>,
      );

      const addButtons = screen.getAllByText("追加");
      await user.click(addButtons[0]); // 最初の追加ボタン（実行者用）

      // Assert
      expect(addExecutor).toHaveBeenCalled();
    });

    test("should call addReporter when add reporter button is clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      const addReporter = vi.fn();
      mockUseTaskEditModal.mockReturnValue(
        createDefaultMockReturn({
          addReporter,
          nonRegisteredReporter: "Test Reporter",
        }),
      );

      const props = {
        taskId: "test-task-id",
        open: true,
        onOpenChangeAction: vi.fn(),
      };

      // Act
      render(
        <AllTheProviders>
          <TaskEditModal {...props} />
        </AllTheProviders>,
      );

      const addButtons = screen.getAllByText("追加");
      await user.click(addButtons[1]); // 2番目の追加ボタン（報告者用）

      // Assert
      expect(addReporter).toHaveBeenCalled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("画像アップロード機能", () => {
    test("should call handleImageUploaded when image is uploaded", async () => {
      // Arrange
      const user = userEvent.setup();
      const handleImageUploaded = vi.fn();
      mockUseTaskEditModal.mockReturnValue(
        createDefaultMockReturn({
          handleImageUploaded,
          isRewardType: true,
        }),
      );

      const props = {
        taskId: "test-task-id",
        open: true,
        onOpenChangeAction: vi.fn(),
      };

      // Act
      render(
        <AllTheProviders>
          <TaskEditModal {...props} />
        </AllTheProviders>,
      );

      const uploadButton = screen.getByText("Upload Image");
      await user.click(uploadButton);

      // Assert
      expect(handleImageUploaded).toHaveBeenCalledWith("test-image-url");
    });

    test("should call handleImageRemoved when image is removed", async () => {
      // Arrange
      const user = userEvent.setup();
      const handleImageRemoved = vi.fn();
      mockUseTaskEditModal.mockReturnValue(
        createDefaultMockReturn({
          handleImageRemoved,
          isRewardType: true,
        }),
      );

      const props = {
        taskId: "test-task-id",
        open: true,
        onOpenChangeAction: vi.fn(),
      };

      // Act
      render(
        <AllTheProviders>
          <TaskEditModal {...props} />
        </AllTheProviders>,
      );

      const removeButton = screen.getByText("Remove Image");
      await user.click(removeButton);

      // Assert
      expect(handleImageRemoved).toHaveBeenCalled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系", () => {
    test("should handle undefined taskId", () => {
      // Arrange
      const props = {
        taskId: undefined as unknown as string,
        open: true,
        onOpenChangeAction: vi.fn(),
      };

      // Act & Assert
      expect(() =>
        render(
          <AllTheProviders>
            <TaskEditModal {...props} />
          </AllTheProviders>,
        ),
      ).not.toThrow();
    });

    test("should handle null onOpenChangeAction", () => {
      // Arrange
      const props = {
        taskId: "test-task-id",
        open: true,
        onOpenChangeAction: null as unknown as (open: boolean) => void,
      };

      // Act & Assert
      expect(() =>
        render(
          <AllTheProviders>
            <TaskEditModal {...props} />
          </AllTheProviders>,
        ),
      ).not.toThrow();
    });

    test("should handle empty string taskId", () => {
      // Arrange
      const props = {
        taskId: "",
        open: true,
        onOpenChangeAction: vi.fn(),
      };

      // Act
      render(
        <AllTheProviders>
          <TaskEditModal {...props} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("タスクを編集")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle very long taskId", () => {
      // Arrange
      const longTaskId = "a".repeat(1000);
      const props = {
        taskId: longTaskId,
        open: true,
        onOpenChangeAction: vi.fn(),
      };

      // Act
      render(
        <AllTheProviders>
          <TaskEditModal {...props} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("タスクを編集")).toBeInTheDocument();
    });

    test("should handle maximum number of executors", () => {
      // Arrange
      const maxExecutors = createTestTaskParticipants(100);
      mockUseTaskEditModal.mockReturnValue(
        createDefaultMockReturn({
          executors: maxExecutors,
        }),
      );

      const props = {
        taskId: "test-task-id",
        open: true,
        onOpenChangeAction: vi.fn(),
      };

      // Act
      render(
        <AllTheProviders>
          <TaskEditModal {...props} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("選択された実行者:")).toBeInTheDocument();
    });

    test("should handle maximum number of reporters", () => {
      // Arrange
      const maxReporters = createTestTaskParticipants(100);
      mockUseTaskEditModal.mockReturnValue(
        createDefaultMockReturn({
          reporters: maxReporters,
        }),
      );

      const props = {
        taskId: "test-task-id",
        open: true,
        onOpenChangeAction: vi.fn(),
      };

      // Act
      render(
        <AllTheProviders>
          <TaskEditModal {...props} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("選択された報告者:")).toBeInTheDocument();
    });

    test("should handle participants with null names", () => {
      // Arrange
      const participantsWithNullNames = [
        { appUserId: "user-1", appUserName: null },
        { appUserId: null, appUserName: "User 2" },
      ];
      mockUseTaskEditModal.mockReturnValue(
        createDefaultMockReturn({
          executors: participantsWithNullNames,
        }),
      );

      const props = {
        taskId: "test-task-id",
        open: true,
        onOpenChangeAction: vi.fn(),
      };

      // Act
      render(
        <AllTheProviders>
          <TaskEditModal {...props} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("選択された実行者:")).toBeInTheDocument();
      expect(screen.getByText("名前なし (登録済み)")).toBeInTheDocument();
      expect(screen.getByText("User 2 (未登録)")).toBeInTheDocument();
    });
  });
});
