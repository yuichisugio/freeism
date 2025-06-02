import { AllTheProviders } from "@/test/setup/tanstack-query-setup";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { CreateTaskForm } from "./create-task-form";

// ホイストされたモック関数の宣言
const { mockUseTaskInputForm } = vi.hoisted(() => ({
  mockUseTaskInputForm: vi.fn(),
}));

// useTaskInputFormフックのモック
vi.mock("@/hooks/form/use-create-task-form", () => ({
  useTaskInputForm: mockUseTaskInputForm,
}));

// 子コンポーネントのモック
vi.mock("@/components/share/form/form-field", () => ({
  CustomFormField: ({ label }: { label: string }) => <div data-testid={`form-field-${label}`}>{label}</div>,
}));

vi.mock("@/components/share/form/form-layout", () => ({
  FormLayout: ({ children, submitLabel }: { children: React.ReactNode; submitLabel: string }) => (
    <form data-testid="form-layout">
      {children}
      <button type="submit">{submitLabel}</button>
    </form>
  ),
}));

vi.mock("@/components/share/image-upload-area", () => ({
  ImageUploadArea: () => <div data-testid="image-upload-area">画像アップロード</div>,
}));

vi.mock("@/components/share/user-combobox", () => ({
  UserCombobox: ({ placeholder }: { placeholder: string }) => <div data-testid="user-combobox">{placeholder}</div>,
}));

vi.mock("@/components/share/share-loading", () => ({
  Loading: () => <div data-testid="loading">読み込み中...</div>,
}));

// AUCTION_CONSTANTSのモック
vi.mock("@/lib/constants", () => ({
  AUCTION_CONSTANTS: {
    AUCTION_CATEGORIES: ["すべて", "食品", "コード", "本", "デザイン", "開発", "マーケティング", "ライティング", "事務作業", "その他"],
  },
}));

describe("CreateTaskForm", () => {
  // デフォルトのモック戻り値
  const defaultMockReturn = {
    // state
    groups: [
      { id: "group-1", name: "テストグループ1" },
      { id: "group-2", name: "テストグループ2" },
    ],
    users: [
      { id: "user-1", name: "テストユーザー1" },
      { id: "user-2", name: "テストユーザー2" },
    ],
    form: {
      control: {},
      getValues: vi.fn().mockReturnValue(""),
      handleSubmit: vi.fn(),
      formState: { isSubmitting: false },
    },
    open: false,
    categoryOpen: false,
    executors: [],
    nonRegisteredExecutor: "",
    reporters: [],
    nonRegisteredReporter: "",
    isRewardType: false,
    isLoading: false,
    reporterComboboxOpen: false,
    selectedReporterId: undefined,
    executorsComboboxOpen: false,
    selectedExecutorId: undefined,

    // function
    setCategoryOpen: vi.fn(),
    setNonRegisteredExecutor: vi.fn(),
    setOpen: vi.fn(),
    setNonRegisteredReporter: vi.fn(),
    addExecutor: vi.fn(),
    removeExecutor: vi.fn(),
    addReporter: vi.fn(),
    removeReporter: vi.fn(),
    handleImageUploaded: vi.fn(),
    handleImageRemoved: vi.fn(),
    onSubmit: vi.fn(),
    setReporterComboboxOpen: vi.fn(),
    handleReporterSelect: vi.fn(),
    setExecutorsComboboxOpen: vi.fn(),
    handleExecutorSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTaskInputForm.mockReturnValue(defaultMockReturn);
  });

  describe("基本的なレンダリング", () => {
    test("should render form layout with submit button", () => {
      render(
        <AllTheProviders>
          <CreateTaskForm />
        </AllTheProviders>,
      );

      expect(screen.getByTestId("form-layout")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "保存" })).toBeInTheDocument();
    });

    test("should render all required form fields", () => {
      render(
        <AllTheProviders>
          <CreateTaskForm />
        </AllTheProviders>,
      );

      // 必須フィールドの確認
      expect(screen.getByTestId("form-field-グループ選択")).toBeInTheDocument();
      expect(screen.getByTestId("form-field-貢献の種類")).toBeInTheDocument();
      expect(screen.getByTestId("form-field-タスクのタイトル")).toBeInTheDocument();
      expect(screen.getByTestId("form-field-カテゴリ")).toBeInTheDocument();
      expect(screen.getByTestId("form-field-タスクの詳細")).toBeInTheDocument();
      expect(screen.getByTestId("form-field-参考にした内容")).toBeInTheDocument();
      expect(screen.getByTestId("form-field-証拠・結果・補足情報")).toBeInTheDocument();
    });

    test("should render executor and reporter sections", () => {
      render(
        <AllTheProviders>
          <CreateTaskForm />
        </AllTheProviders>,
      );

      expect(screen.getByText("タスク実行者")).toBeInTheDocument();
      expect(screen.getByText("タスク報告者")).toBeInTheDocument();
    });
  });

  describe("ローディング状態", () => {
    test("should show loading component when isLoading is true", () => {
      mockUseTaskInputForm.mockReturnValue({
        ...defaultMockReturn,
        isLoading: true,
      });

      render(
        <AllTheProviders>
          <CreateTaskForm />
        </AllTheProviders>,
      );

      expect(screen.getByTestId("loading")).toBeInTheDocument();
      expect(screen.getByText("読み込み中...")).toBeInTheDocument();
    });

    test("should not show form when isLoading is true", () => {
      mockUseTaskInputForm.mockReturnValue({
        ...defaultMockReturn,
        isLoading: true,
      });

      render(
        <AllTheProviders>
          <CreateTaskForm />
        </AllTheProviders>,
      );

      expect(screen.queryByTestId("form-layout")).not.toBeInTheDocument();
    });
  });

  describe("条件付き表示 - 報酬タイプ", () => {
    test("should not show image upload and auction settings when isRewardType is false", () => {
      mockUseTaskInputForm.mockReturnValue({
        ...defaultMockReturn,
        isRewardType: false,
      });

      render(
        <AllTheProviders>
          <CreateTaskForm />
        </AllTheProviders>,
      );

      expect(screen.queryByTestId("image-upload-area")).not.toBeInTheDocument();
      expect(screen.queryByText("オークション設定")).not.toBeInTheDocument();
    });

    test("should show image upload and auction settings when isRewardType is true", () => {
      mockUseTaskInputForm.mockReturnValue({
        ...defaultMockReturn,
        isRewardType: true,
      });

      render(
        <AllTheProviders>
          <CreateTaskForm />
        </AllTheProviders>,
      );

      expect(screen.getByTestId("image-upload-area")).toBeInTheDocument();
      expect(screen.getByText("オークション設定")).toBeInTheDocument();
      expect(screen.getByTestId("form-field-オークション開始日時")).toBeInTheDocument();
      expect(screen.getByTestId("form-field-オークション終了日時")).toBeInTheDocument();
      expect(screen.getByTestId("form-field-スナイピング対策のオークション延長")).toBeInTheDocument();
      expect(screen.getByTestId("form-field-提供方法")).toBeInTheDocument();
    });

    test("should show reward image section when isRewardType is true", () => {
      mockUseTaskInputForm.mockReturnValue({
        ...defaultMockReturn,
        isRewardType: true,
      });

      render(
        <AllTheProviders>
          <CreateTaskForm />
        </AllTheProviders>,
      );

      expect(screen.getByText("報酬画像")).toBeInTheDocument();
      expect(screen.getByText("報酬として提供する商品・サービスの画像をアップロードしてください")).toBeInTheDocument();
    });
  });

  describe("実行者管理", () => {
    test("should display executors when they exist", () => {
      const executors = [{ userId: "user-1", name: "登録済みユーザー" }, { name: "未登録ユーザー" }];

      mockUseTaskInputForm.mockReturnValue({
        ...defaultMockReturn,
        executors,
      });

      render(
        <AllTheProviders>
          <CreateTaskForm />
        </AllTheProviders>,
      );

      expect(screen.getByText("選択された実行者:")).toBeInTheDocument();
      expect(screen.getByText("登録済みユーザー (登録済み)")).toBeInTheDocument();
      expect(screen.getByText("未登録ユーザー (未登録)")).toBeInTheDocument();
    });

    test("should handle executor removal", () => {
      const mockRemoveExecutor = vi.fn();
      const executors = [{ userId: "user-1", name: "テストユーザー" }];

      mockUseTaskInputForm.mockReturnValue({
        ...defaultMockReturn,
        executors,
        removeExecutor: mockRemoveExecutor,
      });

      render(
        <AllTheProviders>
          <CreateTaskForm />
        </AllTheProviders>,
      );

      const removeButton = screen.getByRole("button", { name: "削除" });
      fireEvent.click(removeButton);

      expect(mockRemoveExecutor).toHaveBeenCalledWith(0);
    });

    test("should handle non-registered executor addition", () => {
      const mockAddExecutor = vi.fn();
      const mockSetNonRegisteredExecutor = vi.fn();

      mockUseTaskInputForm.mockReturnValue({
        ...defaultMockReturn,
        nonRegisteredExecutor: "新しいユーザー",
        addExecutor: mockAddExecutor,
        setNonRegisteredExecutor: mockSetNonRegisteredExecutor,
      });

      render(
        <AllTheProviders>
          <CreateTaskForm />
        </AllTheProviders>,
      );

      const addButton = screen.getAllByRole("button", { name: "追加" })[0];
      fireEvent.click(addButton);

      expect(mockAddExecutor).toHaveBeenCalledWith(undefined, "新しいユーザー");
    });

    test("should handle non-registered executor input change", () => {
      const mockSetNonRegisteredExecutor = vi.fn();

      mockUseTaskInputForm.mockReturnValue({
        ...defaultMockReturn,
        setNonRegisteredExecutor: mockSetNonRegisteredExecutor,
      });

      render(
        <AllTheProviders>
          <CreateTaskForm />
        </AllTheProviders>,
      );

      // 実行者セクション内の入力フィールドを取得
      const executorSection = screen.getByText("タスク実行者").closest("div");
      const input = executorSection?.querySelector('input[placeholder="未登録ユーザー名を入力..."]');

      expect(input).toBeInTheDocument();
      expect(input).not.toBeNull();
      fireEvent.change(input!, { target: { value: "新しいユーザー" } });

      expect(mockSetNonRegisteredExecutor).toHaveBeenCalledWith("新しいユーザー");
    });

    test("should not display executor list when no executors exist", () => {
      mockUseTaskInputForm.mockReturnValue({
        ...defaultMockReturn,
        executors: [],
      });

      render(
        <AllTheProviders>
          <CreateTaskForm />
        </AllTheProviders>,
      );

      expect(screen.queryByText("選択された実行者:")).not.toBeInTheDocument();
    });
  });

  describe("報告者管理", () => {
    test("should display reporters when they exist", () => {
      const reporters = [{ userId: "user-1", name: "登録済み報告者" }, { name: "未登録報告者" }];

      mockUseTaskInputForm.mockReturnValue({
        ...defaultMockReturn,
        reporters,
      });

      render(
        <AllTheProviders>
          <CreateTaskForm />
        </AllTheProviders>,
      );

      expect(screen.getByText("選択された報告者:")).toBeInTheDocument();
      expect(screen.getByText("登録済み報告者 (登録済み)")).toBeInTheDocument();
      expect(screen.getByText("未登録報告者 (未登録)")).toBeInTheDocument();
    });

    test("should handle reporter removal", () => {
      const mockRemoveReporter = vi.fn();
      const reporters = [{ userId: "user-1", name: "テスト報告者" }];

      mockUseTaskInputForm.mockReturnValue({
        ...defaultMockReturn,
        reporters,
        removeReporter: mockRemoveReporter,
      });

      render(
        <AllTheProviders>
          <CreateTaskForm />
        </AllTheProviders>,
      );

      const removeButtons = screen.getAllByRole("button", { name: "削除" });
      const reporterRemoveButton = removeButtons[removeButtons.length - 1]; // 最後の削除ボタンが報告者用
      fireEvent.click(reporterRemoveButton);

      expect(mockRemoveReporter).toHaveBeenCalledWith(0);
    });

    test("should handle non-registered reporter addition", () => {
      const mockAddReporter = vi.fn();

      mockUseTaskInputForm.mockReturnValue({
        ...defaultMockReturn,
        nonRegisteredReporter: "新しい報告者",
        addReporter: mockAddReporter,
      });

      render(
        <AllTheProviders>
          <CreateTaskForm />
        </AllTheProviders>,
      );

      const addButtons = screen.getAllByRole("button", { name: "追加" });
      const reporterAddButton = addButtons[addButtons.length - 1]; // 最後の追加ボタンが報告者用
      fireEvent.click(reporterAddButton);

      expect(mockAddReporter).toHaveBeenCalledWith(undefined, "新しい報告者");
    });

    test("should disable reporter add button when input is empty", () => {
      mockUseTaskInputForm.mockReturnValue({
        ...defaultMockReturn,
        nonRegisteredReporter: "",
      });

      render(
        <AllTheProviders>
          <CreateTaskForm />
        </AllTheProviders>,
      );

      const addButtons = screen.getAllByRole("button", { name: "追加" });
      const reporterAddButton = addButtons[addButtons.length - 1];

      expect(reporterAddButton).toBeDisabled();
    });

    test("should not display reporter list when no reporters exist", () => {
      mockUseTaskInputForm.mockReturnValue({
        ...defaultMockReturn,
        reporters: [],
      });

      render(
        <AllTheProviders>
          <CreateTaskForm />
        </AllTheProviders>,
      );

      expect(screen.queryByText("選択された報告者:")).not.toBeInTheDocument();
    });

    test("should handle non-registered reporter input change", () => {
      const mockSetNonRegisteredReporter = vi.fn();

      mockUseTaskInputForm.mockReturnValue({
        ...defaultMockReturn,
        setNonRegisteredReporter: mockSetNonRegisteredReporter,
      });

      render(
        <AllTheProviders>
          <CreateTaskForm />
        </AllTheProviders>,
      );

      // 報告者セクション内の入力フィールドを取得
      const reporterSection = screen.getByText("タスク報告者").closest("div");
      const input = reporterSection?.querySelector('input[placeholder="未登録ユーザー名を入力..."]');

      expect(input).toBeInTheDocument();
      expect(input).not.toBeNull();
      fireEvent.change(input!, { target: { value: "新しい報告者" } });

      expect(mockSetNonRegisteredReporter).toHaveBeenCalledWith("新しい報告者");
    });
  });

  describe("境界値テスト", () => {
    test("should handle empty groups array", () => {
      mockUseTaskInputForm.mockReturnValue({
        ...defaultMockReturn,
        groups: [],
      });

      render(
        <AllTheProviders>
          <CreateTaskForm />
        </AllTheProviders>,
      );

      expect(screen.getByTestId("form-field-グループ選択")).toBeInTheDocument();
    });

    test("should handle empty users array", () => {
      mockUseTaskInputForm.mockReturnValue({
        ...defaultMockReturn,
        users: [],
      });

      render(
        <AllTheProviders>
          <CreateTaskForm />
        </AllTheProviders>,
      );

      expect(screen.queryByTestId("user-combobox")).not.toBeInTheDocument();
    });

    test("should handle null/undefined values in executors", () => {
      const executors = [
        { userId: "user-1", name: null },
        { userId: undefined, name: "未登録ユーザー" },
      ];

      mockUseTaskInputForm.mockReturnValue({
        ...defaultMockReturn,
        executors,
      });

      render(
        <AllTheProviders>
          <CreateTaskForm />
        </AllTheProviders>,
      );

      expect(screen.getByText("名前なし (登録済み)")).toBeInTheDocument();
      expect(screen.getByText("未登録ユーザー (未登録)")).toBeInTheDocument();
    });

    test("should handle null/undefined values in reporters", () => {
      const reporters = [
        { userId: "user-1", name: null },
        { userId: undefined, name: "未登録報告者" },
      ];

      mockUseTaskInputForm.mockReturnValue({
        ...defaultMockReturn,
        reporters,
      });

      render(
        <AllTheProviders>
          <CreateTaskForm />
        </AllTheProviders>,
      );

      expect(screen.getByText("名前なし (登録済み)")).toBeInTheDocument();
      expect(screen.getByText("未登録報告者 (未登録)")).toBeInTheDocument();
    });
  });

  describe("エラーケース", () => {
    test("should handle missing form control", () => {
      mockUseTaskInputForm.mockReturnValue({
        ...defaultMockReturn,
        form: {
          ...defaultMockReturn.form,
          control: undefined,
        },
      });

      expect(() => {
        render(
          <AllTheProviders>
            <CreateTaskForm />
          </AllTheProviders>,
        );
      }).not.toThrow();
    });

    test("should handle missing getValues function", () => {
      mockUseTaskInputForm.mockReturnValue({
        ...defaultMockReturn,
        form: {
          ...defaultMockReturn.form,
          getValues: undefined,
        },
      });

      expect(() => {
        render(
          <AllTheProviders>
            <CreateTaskForm />
          </AllTheProviders>,
        );
      }).not.toThrow();
    });
  });

  describe("アクセシビリティ", () => {
    test("should have proper aria-label for reward image section", () => {
      mockUseTaskInputForm.mockReturnValue({
        ...defaultMockReturn,
        isRewardType: true,
      });

      render(
        <AllTheProviders>
          <CreateTaskForm />
        </AllTheProviders>,
      );

      const rewardImageSection = screen.getByRole("group", { name: "報酬画像" });
      expect(rewardImageSection).toBeInTheDocument();
    });

    test("should have proper form structure", () => {
      render(
        <AllTheProviders>
          <CreateTaskForm />
        </AllTheProviders>,
      );

      const form = screen.getByTestId("form-layout");
      expect(form).toBeInTheDocument();
      expect(form.tagName).toBe("FORM");
    });
  });
});
