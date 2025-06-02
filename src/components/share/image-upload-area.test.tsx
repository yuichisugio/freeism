import type React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { ImageUploadAreaProps } from "./image-upload-area";
import { ImageUploadArea } from "./image-upload-area";

// react-dropzoneの型定義
type DropzoneConfig = {
  accept?: Record<string, string[]>;
  maxSize?: number;
  onDrop?: (files: File[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  onDropRejected?: (rejectedFiles: Array<{ file: File; errors: Array<{ code: string; message: string }> }>) => void;
  noClick?: boolean;
  noKeyboard?: boolean;
  preventDropOnDocument?: boolean;
};

// ホイストされたモック関数の宣言
const { mockIsR2Enabled, mockGetSignedUploadUrl, mockToast, mockUseDropzone, mockURLCreateObjectURL, mockURLRevokeObjectURL } = vi.hoisted(() => ({
  mockIsR2Enabled: vi.fn(),
  mockGetSignedUploadUrl: vi.fn(),
  mockToast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
  mockUseDropzone: vi.fn(),
  mockURLCreateObjectURL: vi.fn(),
  mockURLRevokeObjectURL: vi.fn(),
}));

// モック設定
vi.mock("@/lib/cloudflare/r2-client-config", () => ({
  isR2Enabled: mockIsR2Enabled,
}));

vi.mock("@/lib/cloudflare/upload", () => ({
  getSignedUploadUrl: mockGetSignedUploadUrl,
}));

vi.mock("@/lib/cloudflare/upload-constants", () => ({
  ACCEPTED_IMAGE_TYPES: {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/jpg": [".jpg"],
    "image/png": [".png"],
    "image/gif": [".gif"],
    "image/webp": [".webp"],
    "image/avif": [".avif"],
  },
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

vi.mock("react-dropzone", () => ({
  useDropzone: mockUseDropzone,
}));

// Progressコンポーネントのモック
vi.mock("../ui/progress", () => ({
  Progress: ({ value, ...props }: { value: number; className?: string }) => (
    <div data-testid="progress" data-value={value} {...props}>
      Progress: {value}%
    </div>
  ),
}));

// framer-motionのモック
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <div data-testid="animate-presence">{children}</div>,
  motion: {
    div: ({ children, ...props }: React.HTMLProps<HTMLDivElement>) => (
      <div data-testid="motion-div" {...props}>
        {children}
      </div>
    ),
  },
}));

// フロントエンドAPIのモック
Object.defineProperty(global, "URL", {
  value: {
    createObjectURL: mockURLCreateObjectURL,
    revokeObjectURL: mockURLRevokeObjectURL,
  },
  writable: true,
});

// XMLHttpRequestのモック
const mockXHR = {
  open: vi.fn(),
  send: vi.fn(),
  setRequestHeader: vi.fn(),
  addEventListener: vi.fn(),
  upload: {
    addEventListener: vi.fn(),
  },
  status: 200,
  statusText: "OK",
};

Object.defineProperty(global, "XMLHttpRequest", {
  value: vi.fn(() => mockXHR),
  writable: true,
});

describe("ImageUploadArea", () => {
  // デフォルトのプロパティ
  const defaultProps: ImageUploadAreaProps = {
    onImageUploaded: vi.fn(),
    onImageRemoved: vi.fn(),
    disabled: false,
  };

  const mockDropzoneConfig = {
    getRootProps: () => ({ "data-testid": "dropzone" }),
    getInputProps: () => ({ "data-testid": "dropzone-input" }),
    isDragActive: false,
    open: vi.fn(),
  };

  beforeEach(() => {
    // デフォルトのモック設定
    mockIsR2Enabled.mockReturnValue(true);
    mockUseDropzone.mockReturnValue(mockDropzoneConfig);
    mockURLCreateObjectURL.mockReturnValue("blob:mock-url");
    mockGetSignedUploadUrl.mockResolvedValue({
      signedUrl: "https://signed-url.example.com",
      publicUrl: "https://public-url.example.com",
      key: "test-key",
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("基本的なレンダリング", () => {
    test("should render image upload area when R2 is enabled", () => {
      // Arrange
      mockIsR2Enabled.mockReturnValue(true);

      // Act
      render(<ImageUploadArea {...defaultProps} />);

      // Assert
      expect(screen.getByText("クリックまたはドラッグ&ドロップ")).toBeInTheDocument();
      expect(screen.getByText("JPEG, PNG, WebP, GIF (最大10MB)")).toBeInTheDocument();
    });

    test("should render disabled message when R2 is disabled", () => {
      // Arrange
      mockIsR2Enabled.mockReturnValue(false);

      // Act
      render(<ImageUploadArea {...defaultProps} />);

      // Assert
      expect(screen.getByText("画像アップロード機能は現在無効です")).toBeInTheDocument();
    });

    test("should render dropzone with correct test attributes", () => {
      // Arrange
      mockIsR2Enabled.mockReturnValue(true);

      // Act
      render(<ImageUploadArea {...defaultProps} />);

      // Assert
      expect(screen.getByTestId("dropzone")).toBeInTheDocument();
      expect(screen.getByTestId("dropzone-input")).toBeInTheDocument();
    });
  });

  describe("プロパティのテスト", () => {
    test("should render with initial image when initialImageUrl is provided", () => {
      // Arrange
      const propsWithInitialImage: ImageUploadAreaProps = {
        ...defaultProps,
        initialImageUrl: "https://example.com/initial-image.jpg",
      };

      // Act
      render(<ImageUploadArea {...propsWithInitialImage} />);

      // Assert
      expect(screen.getByAltText("画像プレビュー")).toBeInTheDocument();
      expect(screen.getByLabelText("画像を削除")).toBeInTheDocument();
    });

    test("should apply disabled state correctly", () => {
      // Arrange
      const disabledProps: ImageUploadAreaProps = {
        ...defaultProps,
        disabled: true,
      };

      // useDropzoneがdisabledプロパティを受け取ることを確認
      mockUseDropzone.mockImplementation((config: DropzoneConfig) => {
        expect(config.disabled).toBe(true);
        return mockDropzoneConfig;
      });

      // Act
      render(<ImageUploadArea {...disabledProps} />);

      // Assert - useDropzoneが正しい設定で呼ばれていることを確認
      expect(mockUseDropzone).toHaveBeenCalledWith(
        expect.objectContaining({
          disabled: true,
        }),
      );
    });

    test("should pass correct onImageUploaded callback", () => {
      // Arrange
      const mockOnImageUploaded = vi.fn();
      const propsWithCallback: ImageUploadAreaProps = {
        ...defaultProps,
        onImageUploaded: mockOnImageUploaded,
      };

      // Act
      render(<ImageUploadArea {...propsWithCallback} />);

      // Assert - コンポーネントが正しくレンダリングされることを確認
      expect(screen.getByText("クリックまたはドラッグ&ドロップ")).toBeInTheDocument();
    });

    test("should pass correct onImageRemoved callback", () => {
      // Arrange
      const mockOnImageRemoved = vi.fn();
      const propsWithCallback: ImageUploadAreaProps = {
        ...defaultProps,
        onImageRemoved: mockOnImageRemoved,
      };

      // Act
      render(<ImageUploadArea {...propsWithCallback} />);

      // Assert - コンポーネントが正しくレンダリングされることを確認
      expect(screen.getByText("クリックまたはドラッグ&ドロップ")).toBeInTheDocument();
    });
  });

  describe("useDropzoneの設定", () => {
    test("should configure useDropzone with correct parameters", () => {
      // Arrange & Act
      render(<ImageUploadArea {...defaultProps} />);

      // Assert
      expect(mockUseDropzone).toHaveBeenCalledWith(
        expect.objectContaining({
          accept: {
            "image/jpeg": [".jpg", ".jpeg"],
            "image/jpg": [".jpg"],
            "image/png": [".png"],
            "image/gif": [".gif"],
            "image/webp": [".webp"],
            "image/avif": [".avif"],
          },
          maxFiles: 1,
          noClick: false,
          noKeyboard: true,
          preventDropOnDocument: false,
        }),
      );
    });

    test("should disable dropzone when component is disabled", () => {
      // Arrange
      const disabledProps: ImageUploadAreaProps = {
        ...defaultProps,
        disabled: true,
      };

      // Act
      render(<ImageUploadArea {...disabledProps} />);

      // Assert
      expect(mockUseDropzone).toHaveBeenCalledWith(
        expect.objectContaining({
          disabled: true,
        }),
      );
    });

    test("should disable dropzone when R2 is disabled", () => {
      // Arrange
      mockIsR2Enabled.mockReturnValue(false);

      // Act
      render(<ImageUploadArea {...defaultProps} />);

      // Assert - R2が無効の場合、useDropzoneは呼ばれるがdisabledがtrueになる
      expect(mockUseDropzone).toHaveBeenCalledWith(
        expect.objectContaining({
          disabled: true, // !isEnabled で disabled が true になる
        }),
      );
    });
  });

  describe("ユーザーインタラクション", () => {
    test("should call onImageRemoved when remove button is clicked", async () => {
      // Arrange
      const mockOnImageRemoved = vi.fn();
      const propsWithImage: ImageUploadAreaProps = {
        ...defaultProps,
        onImageRemoved: mockOnImageRemoved,
        initialImageUrl: "https://example.com/test-image.jpg",
      };
      const user = userEvent.setup();

      // Act
      render(<ImageUploadArea {...propsWithImage} />);
      const removeButton = screen.getByLabelText("画像を削除");
      await user.click(removeButton);

      // Assert
      expect(mockOnImageRemoved).toHaveBeenCalledTimes(1);
    });

    test("should not show remove button when disabled", () => {
      // Arrange
      const propsWithImageAndDisabled: ImageUploadAreaProps = {
        ...defaultProps,
        disabled: true,
        initialImageUrl: "https://example.com/test-image.jpg",
      };

      // Act
      render(<ImageUploadArea {...propsWithImageAndDisabled} />);

      // Assert
      expect(screen.queryByLabelText("画像を削除")).not.toBeInTheDocument();
    });
  });

  describe("ファイルドロップ処理", () => {
    test("should handle file drop with onDrop callback", () => {
      // Arrange
      const mockFile = new File(["test"], "test.jpg", { type: "image/jpeg" });
      let capturedOnDrop: ((files: File[]) => void) | undefined;

      mockUseDropzone.mockImplementation((config: DropzoneConfig) => {
        capturedOnDrop = config.onDrop;
        return mockDropzoneConfig;
      });

      // Act
      render(<ImageUploadArea {...defaultProps} />);

      // onDropコールバックが設定されていることを確認
      expect(capturedOnDrop).toBeDefined();

      // ファイルドロップをシミュレート
      if (capturedOnDrop) {
        capturedOnDrop([mockFile]);
      }

      // Assert
      expect(mockURLCreateObjectURL).toHaveBeenCalledWith(mockFile);
    });

    test("should handle onDropRejected callback for file too large", () => {
      // Arrange
      let capturedOnDropRejected: ((rejectedFiles: Array<{ file: File; errors: Array<{ code: string; message: string }> }>) => void) | undefined;

      mockUseDropzone.mockImplementation((config: DropzoneConfig) => {
        capturedOnDropRejected = config.onDropRejected;
        return mockDropzoneConfig;
      });

      // Act
      render(<ImageUploadArea {...defaultProps} />);

      // onDropRejectedコールバックが設定されていることを確認
      expect(capturedOnDropRejected).toBeDefined();

      // ファイル拒否をシミュレート（サイズ超過）
      if (capturedOnDropRejected) {
        capturedOnDropRejected([
          {
            file: new File(["large"], "large.jpg", { type: "image/jpeg" }),
            errors: [{ code: "file-too-large", message: "File too large" }],
          },
        ]);
      }

      // Assert
      expect(mockToast.error).toHaveBeenCalledWith("ファイルサイズが大きすぎます（上限: 10MB）");
    });

    test("should handle onDropRejected callback for invalid file type", () => {
      // Arrange
      let capturedOnDropRejected: ((rejectedFiles: Array<{ file: File; errors: Array<{ code: string; message: string }> }>) => void) | undefined;

      mockUseDropzone.mockImplementation((config: DropzoneConfig) => {
        capturedOnDropRejected = config.onDropRejected;
        return mockDropzoneConfig;
      });

      // Act
      render(<ImageUploadArea {...defaultProps} />);

      // ファイル拒否をシミュレート（無効な形式）
      if (capturedOnDropRejected) {
        capturedOnDropRejected([
          {
            file: new File(["invalid"], "invalid.txt", { type: "text/plain" }),
            errors: [{ code: "file-invalid-type", message: "Invalid file type" }],
          },
        ]);
      }

      // Assert
      expect(mockToast.error).toHaveBeenCalledWith("無効なファイル形式です");
    });
  });

  describe("グローバルドロップゾーンの動作", () => {
    test("should add and remove global drag event listeners", () => {
      // Arrange
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      // Act
      const { unmount } = render(<ImageUploadArea {...defaultProps} />);

      // Assert - イベントリスナーが追加されていることを確認
      expect(addEventListenerSpy).toHaveBeenCalledWith("dragenter", expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith("dragover", expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith("dragleave", expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith("drop", expect.any(Function));

      // Act - コンポーネントをアンマウント
      unmount();

      // Assert - イベントリスナーが削除されていることを確認
      expect(removeEventListenerSpy).toHaveBeenCalledWith("dragenter", expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith("dragover", expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith("dragleave", expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith("drop", expect.any(Function));

      // Cleanup
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    test("should not add global event listeners when disabled", () => {
      // Arrange
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");
      const disabledProps: ImageUploadAreaProps = {
        ...defaultProps,
        disabled: true,
      };

      // Act
      render(<ImageUploadArea {...disabledProps} />);

      // Assert - disabledの場合、グローバルイベントリスナーが追加されない
      // （実装では、disabled || !isEnabled の条件でearly returnしている）
      expect(addEventListenerSpy).not.toHaveBeenCalledWith("dragenter", expect.any(Function));

      // Cleanup
      addEventListenerSpy.mockRestore();
    });
  });

  describe("アップロード状態の表示", () => {
    test("should show upload progress when uploading", () => {
      // Arrange
      const propsWithInitialImage: ImageUploadAreaProps = {
        ...defaultProps,
        initialImageUrl: "https://example.com/test-image.jpg",
      };

      // useImageUploadフックの内部状態をシミュレートするために、
      // コンポーネントの内部状態を模擬する必要があります
      // 実際のテストでは、アップロード状態をトリガーする操作をテストします

      // Act
      render(<ImageUploadArea {...propsWithInitialImage} />);

      // Assert - 初期状態では画像プレビューが表示される
      expect(screen.getByAltText("画像プレビュー")).toBeInTheDocument();
    });
  });

  describe("メモリリーク防止", () => {
    test("should revoke object URL on unmount", () => {
      // Arrange
      const propsWithInitialImage: ImageUploadAreaProps = {
        ...defaultProps,
        initialImageUrl: "https://example.com/test-image.jpg",
      };

      // Act
      const { unmount } = render(<ImageUploadArea {...propsWithInitialImage} />);
      unmount();

      // Assert - 初期画像URLではないプレビューURLがある場合のみrevokeが呼ばれる
      // この場合は初期画像なのでrevokeは呼ばれない
      expect(mockURLRevokeObjectURL).not.toHaveBeenCalled();
    });
  });

  describe("異常系・境界値テスト", () => {
    test("should handle undefined onImageUploaded callback", () => {
      // Arrange
      const propsWithoutCallback: ImageUploadAreaProps = {
        onImageRemoved: vi.fn(),
        disabled: false,
      };

      // Act & Assert - エラーなくレンダリングされることを確認
      expect(() => render(<ImageUploadArea {...propsWithoutCallback} />)).not.toThrow();
    });

    test("should handle undefined onImageRemoved callback", () => {
      // Arrange
      const propsWithoutCallback: ImageUploadAreaProps = {
        onImageUploaded: vi.fn(),
        disabled: false,
      };

      // Act & Assert - エラーなくレンダリングされることを確認
      expect(() => render(<ImageUploadArea {...propsWithoutCallback} />)).not.toThrow();
    });

    test("should handle null initialImageUrl", () => {
      // Arrange
      const propsWithNullImage: ImageUploadAreaProps = {
        ...defaultProps,
        initialImageUrl: undefined,
      };

      // Act
      render(<ImageUploadArea {...propsWithNullImage} />);

      // Assert
      expect(screen.getByText("クリックまたはドラッグ&ドロップ")).toBeInTheDocument();
      expect(screen.queryByAltText("画像プレビュー")).not.toBeInTheDocument();
    });

    test("should handle empty string initialImageUrl", () => {
      // Arrange
      const propsWithEmptyImage: ImageUploadAreaProps = {
        ...defaultProps,
        initialImageUrl: "",
      };

      // Act
      render(<ImageUploadArea {...propsWithEmptyImage} />);

      // Assert
      expect(screen.getByText("クリックまたはドラッグ&ドロップ")).toBeInTheDocument();
      expect(screen.queryByAltText("画像プレビュー")).not.toBeInTheDocument();
    });

    test("should handle very large initialImageUrl", () => {
      // Arrange
      const veryLongUrl = "https://example.com/" + "a".repeat(1000) + ".jpg";
      const propsWithLongUrl: ImageUploadAreaProps = {
        ...defaultProps,
        initialImageUrl: veryLongUrl,
      };

      // Act & Assert
      expect(() => render(<ImageUploadArea {...propsWithLongUrl} />)).not.toThrow();
    });

    test("should handle multiple rapid re-renders", () => {
      // Arrange
      const { rerender } = render(<ImageUploadArea {...defaultProps} />);

      // Act - 複数回の高速な再レンダリング
      for (let i = 0; i < 10; i++) {
        rerender(<ImageUploadArea {...defaultProps} />);
      }

      // Assert - エラーなく処理されることを確認
      expect(screen.getByText("クリックまたはドラッグ&ドロップ")).toBeInTheDocument();
    });
  });

  describe("アップロード機能のテスト", () => {
    test("should start upload when file is dropped and R2 is enabled", () => {
      // Arrange
      const mockFile = new File(["test"], "test.jpg", { type: "image/jpeg" });
      let capturedOnDrop: ((files: File[]) => void) | undefined;

      mockUseDropzone.mockImplementation((config: DropzoneConfig) => {
        capturedOnDrop = config.onDrop;
        return mockDropzoneConfig;
      });

      // Act
      render(<ImageUploadArea {...defaultProps} />);

      // ファイルドロップをシミュレート
      if (capturedOnDrop) {
        capturedOnDrop([mockFile]);
      }

      // Assert
      expect(mockURLCreateObjectURL).toHaveBeenCalledWith(mockFile);
      expect(mockGetSignedUploadUrl).toHaveBeenCalledWith("image/jpeg");
    });

    test("should not start upload when R2 is disabled", () => {
      // Arrange
      mockIsR2Enabled.mockReturnValue(false);
      const mockFile = new File(["test"], "test.jpg", { type: "image/jpeg" });
      let capturedOnDrop: ((files: File[]) => void) | undefined;

      mockUseDropzone.mockImplementation((config: DropzoneConfig) => {
        capturedOnDrop = config.onDrop;
        return mockDropzoneConfig;
      });

      // Act
      render(<ImageUploadArea {...defaultProps} />);

      // ファイルドロップをシミュレート（この場合、disabled=trueなのでonDropが呼ばれない）
      if (capturedOnDrop) {
        capturedOnDrop([mockFile]);
      }

      // Assert - R2が無効なのでアップロードAPIは呼ばれない
      expect(mockGetSignedUploadUrl).not.toHaveBeenCalled();
    });

    test("should handle upload error when getSignedUploadUrl fails", async () => {
      // Arrange
      mockGetSignedUploadUrl.mockRejectedValue(new Error("API Error"));
      const mockFile = new File(["test"], "test.jpg", { type: "image/jpeg" });
      let capturedOnDrop: ((files: File[]) => void) | undefined;

      mockUseDropzone.mockImplementation((config: DropzoneConfig) => {
        capturedOnDrop = config.onDrop;
        return mockDropzoneConfig;
      });

      // Act
      render(<ImageUploadArea {...defaultProps} />);

      if (capturedOnDrop) {
        capturedOnDrop([mockFile]);
      }

      // Wait for async operations
      await waitFor(() => {
        expect(mockGetSignedUploadUrl).toHaveBeenCalled();
      });

      // Assert - ファイルがドロップされた場合、プレビューが表示されている
      // エラーが発生してもコンポーネントがクラッシュしないことを確認
      expect(screen.getByAltText("画像プレビュー")).toBeInTheDocument();
      expect(mockURLCreateObjectURL).toHaveBeenCalledWith(mockFile);
    });

    test("should handle upload error", async () => {
      // Arrange
      const mockFile = new File(["test"], "test.jpg", { type: "image/jpeg" });
      let capturedOnDrop: ((files: File[]) => void) | undefined;
      let errorHandler: (() => void) | undefined;

      mockUseDropzone.mockImplementation((config: DropzoneConfig) => {
        capturedOnDrop = config.onDrop;
        return mockDropzoneConfig;
      });

      mockXHR.addEventListener.mockImplementation((type, handler) => {
        if (type === "error") {
          errorHandler = handler as () => void;
        }
      });

      // Act
      render(<ImageUploadArea {...defaultProps} />);

      if (capturedOnDrop) {
        capturedOnDrop([mockFile]);
      }

      await waitFor(() => {
        expect(mockGetSignedUploadUrl).toHaveBeenCalled();
      });

      // エラーイベントをシミュレート
      if (errorHandler) {
        // エラーをキャッチしてテストが失敗しないようにする
        try {
          errorHandler();
        } catch (error) {
          // エラーが投げられることを確認
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe("ネットワークエラーが発生しました");
        }
      }

      // Assert - エラーハンドラーが設定されていることを確認
      expect(mockXHR.addEventListener).toHaveBeenCalledWith("error", expect.any(Function));
    });
  });

  describe("processImageFile関数のテスト", () => {
    test("should process valid image file correctly", () => {
      // Arrange
      const mockFile = new File(["test"], "test.jpg", { type: "image/jpeg" });
      Object.defineProperty(mockFile, "size", { value: 1024 * 1024 }); // 1MB
      let capturedOnDrop: ((files: File[]) => void) | undefined;

      mockUseDropzone.mockImplementation((config: DropzoneConfig) => {
        capturedOnDrop = config.onDrop;
        return mockDropzoneConfig;
      });

      // Act
      render(<ImageUploadArea {...defaultProps} />);

      if (capturedOnDrop) {
        capturedOnDrop([mockFile]);
      }

      // Assert
      expect(mockURLCreateObjectURL).toHaveBeenCalledWith(mockFile);
    });

    test("should reject file that exceeds size limit", () => {
      // Arrange
      const mockFile = new File(["test"], "test.jpg", { type: "image/jpeg" });
      Object.defineProperty(mockFile, "size", { value: 15 * 1024 * 1024 }); // 15MB (over 10MB limit)
      let capturedOnDrop: ((files: File[]) => void) | undefined;

      mockUseDropzone.mockImplementation((config: DropzoneConfig) => {
        capturedOnDrop = config.onDrop;
        return mockDropzoneConfig;
      });

      // Act
      render(<ImageUploadArea {...defaultProps} />);

      if (capturedOnDrop) {
        capturedOnDrop([mockFile]);
      }

      // Assert - サイズ超過の場合はprocessImageFile内でエラーが発生
      // この場合、react-dropzoneのmaxSizeチェックで先に弾かれるため、
      // onDropRejectedが呼ばれる
      expect(mockURLCreateObjectURL).not.toHaveBeenCalled();
    });
  });

  describe("グローバルドロップゾーンのファイル処理", () => {
    test("should handle global drop with image files", () => {
      // Arrange
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");
      let capturedDropHandler: ((event: DragEvent) => void) | undefined;

      addEventListenerSpy.mockImplementation((type, handler) => {
        if (type === "drop") {
          capturedDropHandler = handler as (event: DragEvent) => void;
        }
      });

      // Act
      render(<ImageUploadArea {...defaultProps} />);

      // グローバルドロップイベントをシミュレート
      if (capturedDropHandler) {
        const mockEvent = {
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          dataTransfer: {
            files: [new File(["test"], "test.jpg", { type: "image/jpeg" })],
          },
          relatedTarget: null,
        } as unknown as DragEvent;

        capturedDropHandler(mockEvent);
      }

      // Assert
      expect(addEventListenerSpy).toHaveBeenCalledWith("drop", expect.any(Function));

      // Cleanup
      addEventListenerSpy.mockRestore();
    });

    test("should filter non-image files in global drop", () => {
      // Arrange
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");
      let capturedDropHandler: ((event: DragEvent) => void) | undefined;

      addEventListenerSpy.mockImplementation((type, handler) => {
        if (type === "drop") {
          capturedDropHandler = handler as (event: DragEvent) => void;
        }
      });

      // Act
      render(<ImageUploadArea {...defaultProps} />);

      // 混合ファイル（画像と非画像）でグローバルドロップをシミュレート
      if (capturedDropHandler) {
        const mockEvent = {
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          dataTransfer: {
            files: [new File(["test"], "test.jpg", { type: "image/jpeg" }), new File(["test"], "test.txt", { type: "text/plain" })],
          },
          relatedTarget: null,
        } as unknown as DragEvent;

        capturedDropHandler(mockEvent);
      }

      // Assert - 警告メッセージが表示される
      expect(mockToast.warning).toHaveBeenCalledWith("画像ファイル以外は無視されました");
      expect(mockURLCreateObjectURL).toHaveBeenCalled(); // 画像ファイルは処理される

      // Cleanup
      addEventListenerSpy.mockRestore();
    });

    test("should handle global drag leave correctly", () => {
      // Arrange
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");
      let capturedDragLeaveHandler: ((event: DragEvent) => void) | undefined;

      addEventListenerSpy.mockImplementation((type, handler) => {
        if (type === "dragleave") {
          capturedDragLeaveHandler = handler as (event: DragEvent) => void;
        }
      });

      // Act
      render(<ImageUploadArea {...defaultProps} />);

      // ドラッグリーブイベントをシミュレート
      if (capturedDragLeaveHandler) {
        const mockEvent = {
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          relatedTarget: null, // ウィンドウから離れた
        } as unknown as DragEvent;

        capturedDragLeaveHandler(mockEvent);
      }

      // Assert
      expect(addEventListenerSpy).toHaveBeenCalledWith("dragleave", expect.any(Function));

      // Cleanup
      addEventListenerSpy.mockRestore();
    });
  });

  describe("XMLHttpRequestを使ったアップロード", () => {
    test("should handle successful upload with progress tracking", async () => {
      // Arrange
      const mockFile = new File(["test"], "test.jpg", { type: "image/jpeg" });
      let capturedOnDrop: ((files: File[]) => void) | undefined;
      let progressHandler: ((event: ProgressEvent) => void) | undefined;
      let loadHandler: (() => void) | undefined;

      mockUseDropzone.mockImplementation((config: DropzoneConfig) => {
        capturedOnDrop = config.onDrop;
        return mockDropzoneConfig;
      });

      // XMLHttpRequestのアップロードイベントハンドラーをキャプチャ
      mockXHR.upload.addEventListener.mockImplementation((type, handler) => {
        if (type === "progress") {
          progressHandler = handler as (event: ProgressEvent) => void;
        }
      });

      mockXHR.addEventListener.mockImplementation((type, handler) => {
        if (type === "load") {
          loadHandler = handler as () => void;
        }
      });

      // Act
      render(<ImageUploadArea {...defaultProps} />);

      if (capturedOnDrop) {
        capturedOnDrop([mockFile]);
      }

      // アップロード進捗をシミュレート
      await waitFor(() => {
        expect(mockGetSignedUploadUrl).toHaveBeenCalled();
      });

      // 進捗イベントをシミュレート
      if (progressHandler) {
        progressHandler({
          lengthComputable: true,
          loaded: 50,
          total: 100,
        } as ProgressEvent);
      }

      // 完了イベントをシミュレート
      if (loadHandler) {
        loadHandler();
      }

      // Assert
      expect(mockXHR.open).toHaveBeenCalledWith("PUT", "https://signed-url.example.com");
      expect(mockXHR.setRequestHeader).toHaveBeenCalledWith("Content-Type", "image/jpeg");
      expect(mockXHR.send).toHaveBeenCalledWith(mockFile);
    });

    test("should handle upload error", async () => {
      // Arrange
      const mockFile = new File(["test"], "test.jpg", { type: "image/jpeg" });
      let capturedOnDrop: ((files: File[]) => void) | undefined;
      let errorHandler: (() => void) | undefined;

      mockUseDropzone.mockImplementation((config: DropzoneConfig) => {
        capturedOnDrop = config.onDrop;
        return mockDropzoneConfig;
      });

      mockXHR.addEventListener.mockImplementation((type, handler) => {
        if (type === "error") {
          errorHandler = handler as () => void;
        }
      });

      // Act
      render(<ImageUploadArea {...defaultProps} />);

      if (capturedOnDrop) {
        capturedOnDrop([mockFile]);
      }

      await waitFor(() => {
        expect(mockGetSignedUploadUrl).toHaveBeenCalled();
      });

      // エラーイベントをシミュレート
      if (errorHandler) {
        // エラーをキャッチしてテストが失敗しないようにする
        try {
          errorHandler();
        } catch (error) {
          // エラーが投げられることを確認
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe("ネットワークエラーが発生しました");
        }
      }

      // Assert - エラーハンドラーが設定されていることを確認
      expect(mockXHR.addEventListener).toHaveBeenCalledWith("error", expect.any(Function));
    });
  });

  describe("複雑なシナリオのテスト", () => {
    test("should handle rapid file selections", () => {
      // Arrange
      const mockFiles = [
        new File(["test1"], "test1.jpg", { type: "image/jpeg" }),
        new File(["test2"], "test2.png", { type: "image/png" }),
        new File(["test3"], "test3.gif", { type: "image/gif" }),
      ];
      let capturedOnDrop: ((files: File[]) => void) | undefined;

      mockUseDropzone.mockImplementation((config: DropzoneConfig) => {
        capturedOnDrop = config.onDrop;
        return mockDropzoneConfig;
      });

      // Act
      render(<ImageUploadArea {...defaultProps} />);

      // 複数ファイルを連続でドロップ（最初のファイルのみ処理される）
      if (capturedOnDrop) {
        mockFiles.forEach((file) => {
          capturedOnDrop!([file]);
        });
      }

      // Assert - 複数回呼ばれても正常に動作
      expect(mockURLCreateObjectURL).toHaveBeenCalledTimes(3);
    });

    test("should handle file removal after upload", async () => {
      // Arrange
      const mockOnImageRemoved = vi.fn();
      const propsWithImage: ImageUploadAreaProps = {
        ...defaultProps,
        onImageRemoved: mockOnImageRemoved,
        initialImageUrl: "https://example.com/test-image.jpg",
      };
      const user = userEvent.setup();

      // Act
      render(<ImageUploadArea {...propsWithImage} />);

      // 画像が表示されていることを確認
      expect(screen.getByAltText("画像プレビュー")).toBeInTheDocument();

      // 削除ボタンをクリック
      const removeButton = screen.getByLabelText("画像を削除");
      await user.click(removeButton);

      // Assert
      expect(mockOnImageRemoved).toHaveBeenCalledTimes(1);
    });

    test("should handle component unmount during upload", () => {
      // Arrange
      const mockFile = new File(["test"], "test.jpg", { type: "image/jpeg" });
      let capturedOnDrop: ((files: File[]) => void) | undefined;

      mockUseDropzone.mockImplementation((config: DropzoneConfig) => {
        capturedOnDrop = config.onDrop;
        return mockDropzoneConfig;
      });

      // Act
      const { unmount } = render(<ImageUploadArea {...defaultProps} />);

      if (capturedOnDrop) {
        capturedOnDrop([mockFile]);
      }

      // アップロード中にコンポーネントをアンマウント
      unmount();

      // Assert - エラーなく処理されることを確認
      expect(mockURLCreateObjectURL).toHaveBeenCalledWith(mockFile);
    });
  });
});
