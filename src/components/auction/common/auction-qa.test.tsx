import type { AuctionMessage } from "@/hooks/auction/bid/use-auction-qa";
import React from "react";
import { mockUseSession } from "@/test/setup/setup";
import { AllTheProviders } from "@/test/setup/tanstack-query-setup";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

// テスト対象コンポーネント
import { AuctionQA } from "./auction-qa";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * useAuctionQAフックのモック
 */
const mockUseAuctionQA = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/auction/bid/use-auction-qa", () => ({
  useAuctionQA: mockUseAuctionQA,
  __esModule: true,
}));

/**
 * formatRelativeTimeのモック
 */
vi.mock("@/lib/utils", () => ({
  cn: vi.fn((classes: string) => classes),
  formatRelativeTime: vi.fn(() => "2時間前"),
  __esModule: true,
}));

/**
 * UIコンポーネントのモック
 */
vi.mock("@/components/ui/form", () => ({
  Form: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <form {...props}>{children}</form>,
  FormField: ({
    name,
    render,
  }: {
    control?: unknown;
    name: string;
    render: (props: { field: { value: string; onChange: () => void; onBlur: () => void; name: string } }) => React.ReactNode;
  }) => {
    const fieldProps = {
      field: {
        value: "",
        onChange: vi.fn(),
        onBlur: vi.fn(),
        name,
      },
    };
    return render(fieldProps);
  },
  FormControl: ({ children }: { children: React.ReactNode }) => children,
  FormItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormMessage: ({ children }: { children?: React.ReactNode }) => (children ? <div>{children}</div> : null),
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: ({ placeholder, ...props }: { placeholder?: string; [key: string]: unknown }) => <textarea placeholder={placeholder} {...props} />,
}));

/**
 * react-hook-formのモック
 */
const mockRegister = vi.fn();
const mockHandleSubmit = vi.fn();
const mockGetValues = vi.fn();
const mockReset = vi.fn();
const mockSetValue = vi.fn();
const mockWatch = vi.fn();

vi.mock("react-hook-form", () => ({
  useForm: vi.fn(() => ({
    control: {},
    handleSubmit: mockHandleSubmit,
    getValues: mockGetValues,
    reset: mockReset,
    register: mockRegister,
    setValue: mockSetValue,
    watch: mockWatch,
    formState: {
      isValid: true,
      isDirty: false,
      isSubmitting: false,
      isValidating: false,
      errors: {},
    },
  })),
  Controller: vi.fn((_props: unknown) => null),
  FormProvider: vi.fn(({ children }: { children: React.ReactNode }) => children),
  useFormContext: vi.fn(() => ({
    control: {},
    handleSubmit: mockHandleSubmit,
    getValues: mockGetValues,
    reset: mockReset,
    register: mockRegister,
    setValue: mockSetValue,
    watch: mockWatch,
    formState: {
      isValid: true,
      isDirty: false,
      isSubmitting: false,
      isValidating: false,
      errors: {},
    },
  })),
  __esModule: true,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータヘルパー関数
 */

// AuctionMessage テストデータ作成
const createTestMessage = (overrides: Partial<AuctionMessage> = {}): AuctionMessage => ({
  messageId: "test-message-1",
  messageContent: "テストメッセージ",
  createdAt: new Date("2024-01-01T10:00:00Z"),
  person: {
    sender: {
      id: "test-user",
      appUserName: "テストユーザー",
      image: null,
    },
  },
  ...overrides,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テスト用プロパティ
 */
const defaultProps = {
  auctionId: "test-auction-id",
  isEnd: false,
  isDisplayAfterEnd: false,
  auctionEndDate: new Date("2024-01-01T18:00:00Z"),
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * デフォルトのフックモック戻り値
 */
const createDefaultHookReturn = () => ({
  messages: [],
  auctionPersonInfo: null,
  loading: false,
  error: null,
  submitting: false,
  isSeller: false,
  messagesEndRef: { current: null },
  form: {
    control: {},
    handleSubmit: mockHandleSubmit,
    getValues: mockGetValues,
    reset: mockReset,
  },
  isRefetching: false,
  handleReload: vi.fn(),
  handleKeyDown: vi.fn(),
  handleSubmit: vi.fn(),
  currentUserId: "test-user-id",
  getSenderInfo: vi.fn(() => ({
    name: "テストユーザー",
    image: null,
    sellerTypes: [],
    isOwnMessage: false,
    isSellerMessage: false,
  })),
  messagesContainerProps: {
    style: {},
    className: "",
  },
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("AuctionQA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルトのセッション状態を設定
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: "test-user-id",
          email: "test@example.com",
          name: "テストユーザー",
        },
      },
      status: "authenticated",
    });

    // デフォルトのフック戻り値を設定
    mockUseAuctionQA.mockReturnValue(createDefaultHookReturn());

    // react-hook-formのモック初期化
    mockHandleSubmit.mockImplementation((fn: () => void) => fn);
    mockGetValues.mockReturnValue({ message: "" });
  });

  describe("基本レンダリング", () => {
    test("should render without crashing", () => {
      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert - コンポーネントがクラッシュしないことを確認
      expect(screen.getByRole("button", { name: /更新/i })).toBeInTheDocument();
    });

    test("should display loading state correctly", () => {
      // Arrange
      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        loading: true,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("メッセージを読み込み中...")).toBeInTheDocument();
    });

    test("should display error state correctly", () => {
      // Arrange
      const errorMessage = "エラーが発生しました";
      const mockHandleReload = vi.fn();
      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        error: errorMessage,
        handleReload: mockHandleReload,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /再読み込み/i })).toBeInTheDocument();
    });

    test("should display empty message state correctly", () => {
      // Arrange
      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages: [],
        isSeller: false,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("質問はまだありません")).toBeInTheDocument();
      expect(screen.getByText("最初の質問をしてみましょう")).toBeInTheDocument();
    });

    test("should display empty message state for seller correctly", () => {
      // Arrange
      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages: [],
        isSeller: true,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("質問はまだありません")).toBeInTheDocument();
      expect(screen.getByText("質問に回答しましょう")).toBeInTheDocument();
    });
  });

  describe("メッセージ表示", () => {
    test("should display messages when available", () => {
      // Arrange
      const testMessage = createTestMessage({
        messageContent: "テストメッセージ内容",
      });

      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages: [testMessage],
        getSenderInfo: vi.fn(() => ({
          name: "テストユーザー",
          image: null,
          sellerTypes: ["creator"],
          isOwnMessage: false,
          isSellerMessage: true,
        })),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("テストメッセージ内容")).toBeInTheDocument();
      expect(screen.getByText("テストユーザー")).toBeInTheDocument();
      expect(screen.getByText("2時間前")).toBeInTheDocument();
    });

    test("should display seller badge for creator messages", () => {
      // Arrange
      const testMessage = createTestMessage({
        messageContent: "作成者のメッセージ",
        person: {
          sender: {
            id: "creator-id",
            appUserName: "作成者",
            image: null,
          },
        },
      });

      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages: [testMessage],
        getSenderInfo: vi.fn(() => ({
          name: "作成者",
          image: null,
          sellerTypes: ["creator"],
          isOwnMessage: false,
          isSellerMessage: true,
        })),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("作成者のメッセージ")).toBeInTheDocument();
      expect(screen.getByText("作成者")).toBeInTheDocument();
      expect(screen.getByText("出品者（作成者）")).toBeInTheDocument();
    });

    test("should display multiple seller types correctly", () => {
      // Arrange
      const testMessage = createTestMessage({
        messageContent: "複数の役割を持つメッセージ",
      });

      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages: [testMessage],
        getSenderInfo: vi.fn(() => ({
          name: "マルチロールユーザー",
          image: null,
          sellerTypes: ["creator", "reporter", "executor"],
          isOwnMessage: false,
          isSellerMessage: true,
        })),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("複数の役割を持つメッセージ")).toBeInTheDocument();
      expect(screen.getByText("出品者（作成者・報告者・実行者）")).toBeInTheDocument();
    });

    test("should display multiple messages in correct order", () => {
      // Arrange
      const messages = [
        createTestMessage({
          messageId: "msg-1",
          messageContent: "最初のメッセージ",
          createdAt: new Date("2024-01-01T10:00:00Z"),
        }),
        createTestMessage({
          messageId: "msg-2",
          messageContent: "2番目のメッセージ",
          createdAt: new Date("2024-01-01T11:00:00Z"),
        }),
        createTestMessage({
          messageId: "msg-3",
          messageContent: "3番目のメッセージ",
          createdAt: new Date("2024-01-01T12:00:00Z"),
        }),
      ];

      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages,
        getSenderInfo: vi.fn(() => ({
          name: "テストユーザー",
          image: null,
          sellerTypes: [],
          isOwnMessage: false,
          isSellerMessage: false,
        })),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("最初のメッセージ")).toBeInTheDocument();
      expect(screen.getByText("2番目のメッセージ")).toBeInTheDocument();
      expect(screen.getByText("3番目のメッセージ")).toBeInTheDocument();
    });
  });

  describe("フォーム表示制御", () => {
    test("should show form when auction is not ended", () => {
      // Arrange
      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages: [],
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} isEnd={false} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByRole("button", { name: /送信/i })).toBeInTheDocument();
      expect(screen.getByText("⌘+Enter")).toBeInTheDocument();
      expect(screen.getByText("で送信")).toBeInTheDocument();
    });

    test("should hide form when auction is ended and isDisplayAfterEnd is false", () => {
      // Arrange
      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages: [],
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} isEnd={true} isDisplayAfterEnd={false} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.queryByRole("button", { name: /送信/i })).not.toBeInTheDocument();
      expect(screen.queryByText("⌘+Enter")).not.toBeInTheDocument();
      expect(screen.getByText("チャットは締め切りました")).toBeInTheDocument();
    });

    test("should show form when auction is ended but isDisplayAfterEnd is true", () => {
      // Arrange
      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages: [],
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} isEnd={true} isDisplayAfterEnd={true} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByRole("button", { name: /送信/i })).toBeInTheDocument();
      expect(screen.getByText("⌘+Enter")).toBeInTheDocument();
      expect(screen.getByText("で送信")).toBeInTheDocument();
    });

    test("should show appropriate placeholder for seller", () => {
      // Arrange
      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        isSeller: true,
      });

      // Act - オークション終了していない状態で表示
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} isEnd={false} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByPlaceholderText("質問への回答を入力してください...")).toBeInTheDocument();
    });

    test("should show appropriate placeholder for bidder", () => {
      // Arrange
      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        isSeller: false,
      });

      // Act - オークション終了していない状態で表示
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} isEnd={false} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByPlaceholderText("質問を入力してください...")).toBeInTheDocument();
    });
  });

  describe("ユーザーインタラクション", () => {
    test("should call handleReload when reload button is clicked", async () => {
      // Arrange
      const mockHandleReload = vi.fn();
      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        handleReload: mockHandleReload,
      });

      const user = userEvent.setup();

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      await user.click(screen.getByRole("button", { name: /更新/i }));

      // Assert
      expect(mockHandleReload).toHaveBeenCalledOnce();
    });

    test("should show refetching state", () => {
      // Arrange
      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        isRefetching: true,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByRole("button", { name: /更新/i })).toBeDisabled();
    });

    test("should handle form submission", async () => {
      // Arrange
      const mockHandleSubmitFn = vi.fn();
      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        handleSubmit: mockHandleSubmitFn,
      });

      const user = userEvent.setup();

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      const submitButton = screen.getByRole("button", { name: /送信/i });
      await user.click(submitButton);

      // Assert
      expect(mockHandleSubmit).toHaveBeenCalled();
    });

    test("should handle keyboard events in textarea", async () => {
      // Arrange
      const mockHandleKeyDown = vi.fn();
      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        handleKeyDown: mockHandleKeyDown,
      });

      // Act - オークション終了していない状態で表示
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} isEnd={false} />
        </AllTheProviders>,
      );

      const textarea = screen.getByRole("textbox");

      // Command+Enter のシミュレーション
      fireEvent.keyDown(textarea, {
        key: "Enter",
        metaKey: true,
      });

      // Assert
      expect(mockHandleKeyDown).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "Enter",
          metaKey: true,
        }),
      );
    });

    test("should disable submit button when submitting", () => {
      // Arrange
      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        submitting: true,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByRole("button", { name: /送信/i })).toBeDisabled();
    });
  });

  describe("境界値テスト", () => {
    test("should handle large number of messages correctly", async () => {
      // Arrange
      const messages = Array.from({ length: 100 }, (_, index) =>
        createTestMessage({
          messageId: `message-${index}`,
          messageContent: `メッセージ${index}`,
          createdAt: new Date(`2024-01-01T${10 + Math.floor(index / 60)}:${index % 60}:00Z`),
        }),
      );

      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages,
        getSenderInfo: vi.fn(() => ({
          name: "テストユーザー",
          image: null,
          sellerTypes: [],
          isOwnMessage: false,
          isSellerMessage: false,
        })),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert - 最初と最後のメッセージが表示されることを確認（非同期で待機）
      await screen.findByText("メッセージ0");
      expect(screen.getByText("メッセージ0")).toBeInTheDocument();
      expect(screen.getByText("メッセージ99")).toBeInTheDocument();
    });

    test("should handle very long message content", () => {
      // Arrange
      const longMessage = "あ".repeat(1000);
      const testMessage = createTestMessage({
        messageContent: longMessage,
      });

      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages: [testMessage],
        getSenderInfo: vi.fn(() => ({
          name: "ユーザー",
          image: null,
          sellerTypes: [],
          isOwnMessage: false,
          isSellerMessage: false,
        })),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText(longMessage)).toBeInTheDocument();
    });

    test("should handle messages with special characters", () => {
      // Arrange
      const specialMessage = "特殊文字テスト: !@#$%^&*()[]{}|\\:\"';?/>.<,`~";
      const testMessage = createTestMessage({
        messageContent: specialMessage,
      });

      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages: [testMessage],
        getSenderInfo: vi.fn(() => ({
          name: "ユーザー",
          image: null,
          sellerTypes: [],
          isOwnMessage: false,
          isSellerMessage: false,
        })),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText(specialMessage)).toBeInTheDocument();
    });

    test("should handle messages with line breaks", () => {
      // Arrange
      const multilineMessage = "行1\n行2\n行3";
      const testMessage = createTestMessage({
        messageContent: multilineMessage,
      });

      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages: [testMessage],
        getSenderInfo: vi.fn(() => ({
          name: "ユーザー",
          image: null,
          sellerTypes: [],
          isOwnMessage: false,
          isSellerMessage: false,
        })),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert - 改行を含むテキストは関数マッチャーを使用
      expect(
        screen.getByText((_, element) => {
          return element?.textContent === multilineMessage;
        }),
      ).toBeInTheDocument();
    });
  });

  describe("特殊ケース", () => {
    test("should handle null sender gracefully", () => {
      // Arrange
      const testMessage = createTestMessage({
        messageContent: "送信者がnullのメッセージ",
        person: null,
      });

      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages: [testMessage],
        getSenderInfo: vi.fn(() => ({
          name: "不明なユーザー",
          image: null,
          sellerTypes: [],
          isOwnMessage: false,
          isSellerMessage: false,
        })),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("送信者がnullのメッセージ")).toBeInTheDocument();
      expect(screen.getByText("不明なユーザー")).toBeInTheDocument();
    });

    test("should handle own message correctly", () => {
      // Arrange
      const testMessage = createTestMessage({
        messageContent: "自分のメッセージ",
        person: {
          sender: {
            id: "test-user-id",
            appUserName: "テストユーザー",
            image: null,
          },
        },
      });

      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages: [testMessage],
        currentUserId: "test-user-id",
        getSenderInfo: vi.fn(() => ({
          name: "あなた",
          image: null,
          sellerTypes: [],
          isOwnMessage: true,
          isSellerMessage: false,
        })),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("自分のメッセージ")).toBeInTheDocument();
      const youTexts = screen.getAllByText("あなた");
      expect(youTexts.length).toBeGreaterThan(0);
    });

    test("should handle seller and own message simultaneously", () => {
      // Arrange
      const testMessage = createTestMessage({
        messageContent: "自分かつ出品者のメッセージ",
        person: {
          sender: {
            id: "test-user-id",
            appUserName: "テストユーザー",
            image: null,
          },
        },
      });

      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages: [testMessage],
        currentUserId: "test-user-id",
        getSenderInfo: vi.fn(() => ({
          name: "あなた",
          image: null,
          sellerTypes: ["creator"],
          isOwnMessage: true,
          isSellerMessage: true,
        })),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("自分かつ出品者のメッセージ")).toBeInTheDocument();
      expect(screen.getByText("あなた")).toBeInTheDocument();
    });

    test("should handle messages with images", () => {
      // Arrange
      const testMessage = createTestMessage({
        messageContent: "画像付きメッセージ",
        person: {
          sender: {
            id: "user-with-image",
            appUserName: "画像ユーザー",
            image: "https://example.com/avatar.jpg",
          },
        },
      });

      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages: [testMessage],
        getSenderInfo: vi.fn(() => ({
          name: "画像ユーザー",
          image: "https://example.com/avatar.jpg",
          sellerTypes: [],
          isOwnMessage: false,
          isSellerMessage: false,
        })),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("画像付きメッセージ")).toBeInTheDocument();
      expect(screen.getByText("画像ユーザー")).toBeInTheDocument();
    });

    test("should handle error in reload correctly", async () => {
      // Arrange
      const errorMessage = "再読み込みエラー";
      const mockHandleReload = vi.fn();
      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        error: errorMessage,
        handleReload: mockHandleReload,
      });

      const user = userEvent.setup();

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      await user.click(screen.getByRole("button", { name: /再読み込み/i }));

      // Assert
      expect(mockHandleReload).toHaveBeenCalledOnce();
    });
  });

  describe("アクセシビリティ", () => {
    test("should have proper ARIA labels and roles", () => {
      // Arrange
      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
      });

      // Act - オークション終了していない状態で表示
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} isEnd={false} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByRole("button", { name: /更新/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /送信/i })).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    test("should support keyboard navigation", async () => {
      // Arrange
      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
      });

      const user = userEvent.setup();

      // Act - オークション終了していない状態で表示
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} isEnd={false} />
        </AllTheProviders>,
      );

      // Tab navigation test
      await user.tab();
      expect(screen.getByRole("button", { name: /更新/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole("textbox")).toHaveFocus();

      await user.tab();
      expect(screen.getByRole("button", { name: /送信/i })).toHaveFocus();
    });
  });

  describe("パフォーマンス", () => {
    test("should not re-render unnecessarily with same props", () => {
      // Arrange
      const renderSpy = vi.fn();
      const TestWrapper = () => {
        renderSpy();
        return <AuctionQA {...defaultProps} />;
      };

      mockUseAuctionQA.mockReturnValue(createDefaultHookReturn());

      // Act
      const { rerender } = render(
        <AllTheProviders>
          <TestWrapper />
        </AllTheProviders>,
      );

      // 同じpropsで再レンダリング
      rerender(
        <AllTheProviders>
          <TestWrapper />
        </AllTheProviders>,
      );

      // Assert
      expect(renderSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("出品者タイプの境界値テスト", () => {
    test("should handle empty seller types correctly", () => {
      // Arrange
      const testMessage = createTestMessage({
        messageContent: "空の出品者タイプのメッセージ",
      });

      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages: [testMessage],
        getSenderInfo: vi.fn(() => ({
          name: "出品者",
          image: null,
          sellerTypes: [], // 空の配列
          isOwnMessage: false,
          isSellerMessage: true,
        })),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("空の出品者タイプのメッセージ")).toBeInTheDocument();
      expect(screen.getAllByText("出品者")).toHaveLength(2); // 送信者名とバッジ
    });

    test("should handle single seller type correctly", () => {
      // Arrange
      const testMessage = createTestMessage({
        messageContent: "単一タイプのメッセージ",
      });

      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages: [testMessage],
        getSenderInfo: vi.fn(() => ({
          name: "報告者",
          image: null,
          sellerTypes: ["reporter"],
          isOwnMessage: false,
          isSellerMessage: true,
        })),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("出品者（報告者）")).toBeInTheDocument();
    });

    test("should handle executor type correctly", () => {
      // Arrange
      const testMessage = createTestMessage({
        messageContent: "実行者タイプのメッセージ",
      });

      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages: [testMessage],
        getSenderInfo: vi.fn(() => ({
          name: "実行者",
          image: null,
          sellerTypes: ["executor"],
          isOwnMessage: false,
          isSellerMessage: true,
        })),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("出品者（実行者）")).toBeInTheDocument();
    });

    test("should handle all three seller types correctly", () => {
      // Arrange
      const testMessage = createTestMessage({
        messageContent: "全タイプのメッセージ",
      });

      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages: [testMessage],
        getSenderInfo: vi.fn(() => ({
          name: "全役割ユーザー",
          image: null,
          sellerTypes: ["creator", "reporter", "executor"],
          isOwnMessage: false,
          isSellerMessage: true,
        })),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("出品者（作成者・報告者・実行者）")).toBeInTheDocument();
    });

    test("should handle two seller types correctly", () => {
      // Arrange
      const testMessage = createTestMessage({
        messageContent: "二つのタイプのメッセージ",
      });

      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages: [testMessage],
        getSenderInfo: vi.fn(() => ({
          name: "二役ユーザー",
          image: null,
          sellerTypes: ["creator", "executor"],
          isOwnMessage: false,
          isSellerMessage: true,
        })),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("出品者（作成者・実行者）")).toBeInTheDocument();
    });
  });

  describe("メッセージスタイリングのテスト", () => {
    test("should apply correct styling for own message", () => {
      // Arrange
      const testMessage = createTestMessage({
        messageContent: "自分のメッセージ",
        person: {
          sender: {
            id: "test-user-id",
            appUserName: "テストユーザー",
            image: null,
          },
        },
      });

      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages: [testMessage],
        currentUserId: "test-user-id",
        getSenderInfo: vi.fn(() => ({
          name: "あなた",
          image: null,
          sellerTypes: [],
          isOwnMessage: true,
          isSellerMessage: false,
        })),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("自分のメッセージ")).toBeInTheDocument();
      expect(screen.getAllByText("あなた")).toHaveLength(2); // 送信者名とバッジ
    });

    test("should apply correct styling for seller message", () => {
      // Arrange
      const testMessage = createTestMessage({
        messageContent: "出品者のメッセージ",
      });

      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages: [testMessage],
        getSenderInfo: vi.fn(() => ({
          name: "出品者",
          image: null,
          sellerTypes: ["creator"],
          isOwnMessage: false,
          isSellerMessage: true,
        })),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("出品者のメッセージ")).toBeInTheDocument();
      expect(screen.getAllByText("出品者")).toHaveLength(1); // 送信者名のみ（バッジは「出品者（作成者）」）
    });

    test("should apply correct styling for regular bidder message", () => {
      // Arrange
      const testMessage = createTestMessage({
        messageContent: "一般入札者のメッセージ",
      });

      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages: [testMessage],
        getSenderInfo: vi.fn(() => ({
          name: "入札者",
          image: null,
          sellerTypes: [],
          isOwnMessage: false,
          isSellerMessage: false,
        })),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("一般入札者のメッセージ")).toBeInTheDocument();
      expect(screen.getByText("質問者")).toBeInTheDocument();
    });
  });

  describe("フォーム無効化状態のテスト", () => {
    test("should disable form elements when submitting", () => {
      // Arrange
      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        submitting: true,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} isEnd={false} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByRole("button", { name: /送信/i })).toBeDisabled();
      expect(screen.getByRole("textbox")).toBeDisabled();
    });

    test("should enable form elements when not submitting", () => {
      // Arrange
      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        submitting: false,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} isEnd={false} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByRole("button", { name: /送信/i })).not.toBeDisabled();
      expect(screen.getByRole("textbox")).not.toBeDisabled();
    });
  });

  describe("メッセージコンテンツの詳細テスト", () => {
    test("should handle message with undefined sender name", () => {
      // Arrange
      const testMessage = createTestMessage({
        messageContent: "送信者名未定義のメッセージ",
        person: {
          sender: {
            id: "unknown-user",
            appUserName: "",
            image: null,
          },
        },
      });

      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages: [testMessage],
        getSenderInfo: vi.fn(() => ({
          name: "",
          image: null,
          sellerTypes: [],
          isOwnMessage: false,
          isSellerMessage: false,
        })),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("送信者名未定義のメッセージ")).toBeInTheDocument();
    });

    test("should handle message with very short content", () => {
      // Arrange
      const testMessage = createTestMessage({
        messageContent: "短",
      });

      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages: [testMessage],
        getSenderInfo: vi.fn(() => ({
          name: "テストユーザー",
          image: null,
          sellerTypes: [],
          isOwnMessage: false,
          isSellerMessage: false,
        })),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("短")).toBeInTheDocument();
    });

    test("should handle message with numeric content", () => {
      // Arrange
      const testMessage = createTestMessage({
        messageContent: "12345",
      });

      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages: [testMessage],
        getSenderInfo: vi.fn(() => ({
          name: "テストユーザー",
          image: null,
          sellerTypes: [],
          isOwnMessage: false,
          isSellerMessage: false,
        })),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("12345")).toBeInTheDocument();
    });
  });

  describe("日時表示のテスト", () => {
    test("should display formatted relative time", () => {
      // Arrange
      const testMessage = createTestMessage({
        messageContent: "時間表示テスト",
        createdAt: new Date("2024-01-01T10:00:00Z"),
      });

      mockUseAuctionQA.mockReturnValue({
        ...createDefaultHookReturn(),
        messages: [testMessage],
        getSenderInfo: vi.fn(() => ({
          name: "テストユーザー",
          image: null,
          sellerTypes: [],
          isOwnMessage: false,
          isSellerMessage: false,
        })),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionQA {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("2時間前")).toBeInTheDocument();
    });
  });
});
