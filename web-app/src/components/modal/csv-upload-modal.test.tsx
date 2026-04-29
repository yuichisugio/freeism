import type { CsvUploadHookReturn } from "@/hooks/modal/use-csv-upload";
import type { DropzoneInputProps, DropzoneRootProps } from "react-dropzone";
import { render, screen } from "@/test/utils";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { CsvUploadModal } from "./csv-upload-modal";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// useCsvUploadフックのモック
vi.mock("@/hooks/modal/use-csv-upload", () => ({
  useCsvUpload: vi.fn(),
  UPLOAD_TYPE_INFO: {
    TASK_REPORT: {
      title: "タスク報告",
      description: "タスクの内容やタイプを一括で登録します。",
      requiredFields: "task（タスク内容）, contributionType（貢献タイプ）",
      example: "Webサイトのデザイン改修,REWARD",
    },
    CONTRIBUTION_EVALUATION: {
      title: "貢献評価",
      description: "タスクに対する貢献ポイントや評価ロジックを一括で登録します。",
      requiredFields: "taskId（タスクID）, contributionPoint（貢献ポイント）, evaluationLogic（評価ロジック）",
      example: "clrqz3kp20000n4og9xq9d6mt,80,プロジェクトに大きく貢献した",
    },
    FIXED_CONTRIBUTION: {
      title: "FIXした分析結果",
      description: "分析結果を一括で登録します。",
      requiredFields:
        "id（タスクID）, fixedContributionPoint（ポイント）, fixedEvaluatorId（評価者ID）, fixedEvaluationLogic（評価ロジック）",
      example: "clrqz3kp20000n4og9xq9d6mt,100,clrq0001,ロジックの説明",
    },
    TASK_STATUS: {
      title: "タスクステータス",
      description: "タスクのステータスを一括で更新します。",
      requiredFields: "taskId（タスクID）, status（ステータス）",
      example: "clrqz3kp20000n4og9xq9d6mt,TASK_COMPLETED",
    },
  },
  globalDropOverlay: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, transition: { duration: 0.2 } },
  },
}));

// Framer Motionのモック
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ
 */

// デフォルトのprops
const defaultProps = {
  isOpen: true,
  onCloseAction: vi.fn(),
  groupId: "test-group-id",
};

// デフォルトのuseCsvUploadの戻り値
const defaultCsvUploadHookReturn: CsvUploadHookReturn = {
  uploadType: "TASK_REPORT",
  isUploading: false,
  uploadProgress: 0,
  currentFiles: [],
  isFileOver: false,
  isAuthorized: true,
  dropzoneProps: {
    getRootProps: vi.fn(<T extends DropzoneRootProps>(props?: T) => (props ?? {}) as T),
    getInputProps: vi.fn(<T extends DropzoneInputProps>(props?: T) => (props ?? {}) as T),
    isDragActive: false,
    open: vi.fn(),
  },
  setUploadType: vi.fn(),
  handleRemoveFile: vi.fn(),
  handleRemoveAll: vi.fn(),
  handleUpload: vi.fn(),
  onCancel: vi.fn(),
  fileCards: [],
  renderFileFormatInfo: vi.fn(() => <div>ファイルフォーマット情報</div>),
  hasPermissionForUploadType: vi.fn(() => true),
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストセットアップ
 */

beforeEach(async () => {
  vi.clearAllMocks();
  const { useCsvUpload } = vi.mocked(await import("@/hooks/modal/use-csv-upload"));
  useCsvUpload.mockReturnValue(defaultCsvUploadHookReturn);
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストスイート
 */

describe("CsvUploadModal", () => {
  /**
   * 基本的なレンダリングテスト
   */
  describe("基本的なレンダリング", () => {
    test("should render modal when isOpen is true", async () => {
      render(<CsvUploadModal {...defaultProps} />);

      // モーダルタイトルが表示されることを確認
      await screen.findByText("CSVファイルのアップロード");
      expect(screen.getByText("CSVファイルのアップロード")).toBeInTheDocument();
      expect(screen.getByText("CSVファイルをアップロードして一括でデータを登録します")).toBeInTheDocument();
    });

    test("should not render modal when isOpen is false", () => {
      render(<CsvUploadModal {...defaultProps} isOpen={false} />);

      // モーダルタイトルが表示されないことを確認
      expect(screen.queryByText("CSVファイルのアップロード")).not.toBeInTheDocument();
    });

    test("should render upload type selection", () => {
      render(<CsvUploadModal {...defaultProps} />);

      // アップロードタイプ選択セクションが表示されることを確認
      expect(screen.getByText("アップロードの種類")).toBeInTheDocument();
      expect(screen.getByText("タスク報告")).toBeInTheDocument();
      expect(screen.getByText("貢献評価")).toBeInTheDocument();
      expect(screen.getByText("FIXした分析結果")).toBeInTheDocument();
      expect(screen.getByText("タスクステータス")).toBeInTheDocument();
    });

    test("should render file upload area", () => {
      render(<CsvUploadModal {...defaultProps} />);

      // ファイルアップロードエリアが表示されることを確認
      expect(screen.getByText("CSVファイルをアップロード")).toBeInTheDocument();
      expect(screen.getByText("CSVファイルのフォーマット")).toBeInTheDocument();
      expect(screen.getByText("クリックまたはドラッグ&ドロップでアップロード")).toBeInTheDocument();
    });

    test("should render action buttons", () => {
      render(<CsvUploadModal {...defaultProps} />);

      // アクションボタンが表示されることを確認
      expect(screen.getByRole("button", { name: "キャンセル" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "アップロード" })).toBeInTheDocument();
    });
  });

  /**
   * useCsvUploadフックの呼び出しテスト
   */
  describe("useCsvUploadフックの呼び出し", () => {
    test("should call useCsvUpload with correct parameters", async () => {
      const { useCsvUpload } = vi.mocked(await import("@/hooks/modal/use-csv-upload"));

      render(<CsvUploadModal {...defaultProps} />);

      // useCsvUploadが正しいパラメータで呼び出されることを確認
      expect(useCsvUpload).toHaveBeenCalledWith({
        groupId: "test-group-id",
        isOpen: true,
        onCloseAction: defaultProps.onCloseAction,
      });
    });
  });

  /**
   * 閉じるボタンのテスト
   */
  describe("閉じるボタン", () => {
    test("should call onCloseAction when close button is clicked", async () => {
      const user = userEvent.setup();
      const mockOnCloseAction = vi.fn();

      const { useCsvUpload } = vi.mocked(await import("@/hooks/modal/use-csv-upload"));
      useCsvUpload.mockReturnValue({
        ...defaultCsvUploadHookReturn,
      });

      render(<CsvUploadModal {...defaultProps} onCloseAction={mockOnCloseAction} />);

      // 閉じるボタンをクリック
      const closeButton = screen.getByLabelText("閉じる");
      await user.click(closeButton);

      // onCloseActionが呼び出されることを確認
      expect(mockOnCloseAction).toHaveBeenCalledWith(false);
    });

    test("should not call onCloseAction when uploading", async () => {
      const user = userEvent.setup();
      const mockOnCloseAction = vi.fn();

      const { useCsvUpload } = vi.mocked(await import("@/hooks/modal/use-csv-upload"));
      useCsvUpload.mockReturnValue({
        ...defaultCsvUploadHookReturn,
        isUploading: true,
      });

      render(<CsvUploadModal {...defaultProps} onCloseAction={mockOnCloseAction} />);

      // 閉じるボタンをクリック
      const closeButton = screen.getByLabelText("閉じる");
      await user.click(closeButton);

      // アップロード中は閉じるボタンが無効化されているため、onCloseActionが呼び出されないことを確認
      expect(mockOnCloseAction).not.toHaveBeenCalled();
    });
  });

  /**
   * アクションボタンのテスト
   */
  describe("アクションボタン", () => {
    test("should call onCancel when cancel button is clicked", async () => {
      const user = userEvent.setup();
      const mockOnCancel = vi.fn();

      const { useCsvUpload } = vi.mocked(await import("@/hooks/modal/use-csv-upload"));
      useCsvUpload.mockReturnValue({
        ...defaultCsvUploadHookReturn,
        onCancel: mockOnCancel,
      });

      render(<CsvUploadModal {...defaultProps} />);

      // キャンセルボタンをクリック
      const cancelButton = screen.getByRole("button", { name: "キャンセル" });
      await user.click(cancelButton);

      // onCancelが呼び出されることを確認
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    test("should call handleUpload when upload button is clicked", async () => {
      const user = userEvent.setup();
      const mockHandleUpload = vi.fn();

      const { useCsvUpload } = vi.mocked(await import("@/hooks/modal/use-csv-upload"));
      useCsvUpload.mockReturnValue({
        ...defaultCsvUploadHookReturn,
        currentFiles: [new File(["test"], "test.csv", { type: "text/csv" })],
        handleUpload: mockHandleUpload,
      });

      render(<CsvUploadModal {...defaultProps} />);

      // アップロードボタンをクリック
      const uploadButton = screen.getByRole("button", { name: "アップロード" });
      await user.click(uploadButton);

      // handleUploadが呼び出されることを確認
      expect(mockHandleUpload).toHaveBeenCalledTimes(1);
    });

    test("should disable upload button when no files selected", async () => {
      const { useCsvUpload } = vi.mocked(await import("@/hooks/modal/use-csv-upload"));
      useCsvUpload.mockReturnValue({
        ...defaultCsvUploadHookReturn,
        currentFiles: [],
      });

      render(<CsvUploadModal {...defaultProps} />);

      // ファイルが選択されていない場合、アップロードボタンが無効化されることを確認
      const uploadButton = screen.getByRole("button", { name: "アップロード" });
      expect(uploadButton).toBeDisabled();
    });

    test("should disable upload button when uploading", async () => {
      const { useCsvUpload } = vi.mocked(await import("@/hooks/modal/use-csv-upload"));
      useCsvUpload.mockReturnValue({
        ...defaultCsvUploadHookReturn,
        isUploading: true,
        currentFiles: [new File(["test"], "test.csv", { type: "text/csv" })],
      });

      render(<CsvUploadModal {...defaultProps} />);

      // アップロード中はアップロードボタンが無効化されることを確認
      const uploadButton = screen.getByRole("button", { name: "アップロード中..." });
      expect(uploadButton).toBeDisabled();
    });

    test("should disable cancel button when uploading", async () => {
      const { useCsvUpload } = vi.mocked(await import("@/hooks/modal/use-csv-upload"));
      useCsvUpload.mockReturnValue({
        ...defaultCsvUploadHookReturn,
        isUploading: true,
      });

      render(<CsvUploadModal {...defaultProps} />);

      // アップロード中はキャンセルボタンが無効化されることを確認
      const cancelButton = screen.getByRole("button", { name: "キャンセル" });
      expect(cancelButton).toBeDisabled();
    });
  });
});
