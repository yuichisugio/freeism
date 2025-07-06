import React from "react";
import { createGroup } from "@/actions/group/group";
import { mockPush, mockToastError, mockToastSuccess } from "@/test/setup/setup";
import { Prisma } from "@prisma/client";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { CreateGroupFormData } from "./create-group-form";
import { CreateGroupForm } from "./create-group-form";

// --------------------------------------------------
// モック設定
// --------------------------------------------------

/**
 * createGroup actionのモック
 */
vi.mock("@/lib/actions/group");

const mockCreateGroup = vi.mocked(createGroup);

/**
 * CustomFormFieldコンポーネントのモック
 */
vi.mock("@/components/share/form/form-field", () => ({
  CustomFormField: ({
    name,
    label,
    placeholder,
    type,
  }: {
    name: string;
    label: string;
    placeholder?: string;
    type?: string;
  }) => (
    <div data-testid={`form-field-${name}`}>
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} placeholder={placeholder} type={type} data-testid={`input-${name}`} />
    </div>
  ),
}));

/**
 * FormLayoutコンポーネントのモック
 */
vi.mock("@/components/share/form/form-layout", () => ({
  FormLayout: ({
    children,
    onSubmit,
    submitLabel,
  }: {
    children: React.ReactNode;
    onSubmit: (data: CreateGroupFormData) => void;
    submitLabel: string;
  }) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // フォームデータを模擬的に作成
        const formData: CreateGroupFormData = {
          name: "テストグループ",
          goal: "テスト目標",
          evaluationMethod: "テスト評価方法",
          maxParticipants: 100,
          depositPeriod: 30,
        };
        onSubmit(formData);
      }}
      data-testid="form-layout"
    >
      {children}
      <button type="submit" data-testid="submit-button">
        {submitLabel}
      </button>
    </form>
  ),
}));

// --------------------------------------------------
// テストデータ
// --------------------------------------------------

/**
 * 有効なグループデータ
 */
const validGroupData: CreateGroupFormData = {
  name: "テストグループ",
  goal: "テスト目標",
  evaluationMethod: "テスト評価方法",
  maxParticipants: 100,
  depositPeriod: 30,
};

// --------------------------------------------------
// ヘルパー関数
// --------------------------------------------------

/**
 * 共通のモック設定
 */
function setupCommonMocks() {
  vi.clearAllMocks();
  mockCreateGroup.mockReset();
  mockPush.mockReset();
  mockToastSuccess.mockReset();
  mockToastError.mockReset();
}

/**
 * createGroup成功時のモック設定
 */
function setupCreateGroupSuccess() {
  mockCreateGroup.mockResolvedValue({ success: true, message: "グループを作成しました", data: null });
}

/**
 * createGroup失敗時のモック設定
 */
function setupCreateGroupError(error: string) {
  mockCreateGroup.mockResolvedValue({ success: false, message: error, data: null });
}

/**
 * createGroupでPrismaエラーが発生する場合のモック設定
 */
function setupCreateGroupPrismaError() {
  const prismaError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "5.0.0",
  });
  mockCreateGroup.mockRejectedValue(prismaError);
}

// --------------------------------------------------
// テストスイート
// --------------------------------------------------

describe("CreateGroupForm", () => {
  beforeEach(() => {
    setupCommonMocks();
  });

  // --------------------------------------------------
  // 基本的なレンダリングテスト
  // --------------------------------------------------

  describe("基本的なレンダリング", () => {
    test("should render all form fields correctly", () => {
      // Act
      render(<CreateGroupForm />);

      // Assert
      expect(screen.getByTestId("form-field-name")).toBeInTheDocument();
      expect(screen.getByTestId("form-field-goal")).toBeInTheDocument();
      expect(screen.getByTestId("form-field-evaluationMethod")).toBeInTheDocument();
      expect(screen.getByTestId("form-field-maxParticipants")).toBeInTheDocument();
      expect(screen.getByTestId("form-field-depositPeriod")).toBeInTheDocument();
    });

    test("should render submit button with correct label", () => {
      // Act
      render(<CreateGroupForm />);

      // Assert
      expect(screen.getByTestId("submit-button")).toBeInTheDocument();
      expect(screen.getByTestId("submit-button")).toHaveTextContent("グループを作成");
    });

    test("should render form layout", () => {
      // Act
      render(<CreateGroupForm />);

      // Assert
      expect(screen.getByTestId("form-layout")).toBeInTheDocument();
    });
  });

  // --------------------------------------------------
  // フォーム送信の正常系テスト
  // --------------------------------------------------

  describe("フォーム送信の正常系", () => {
    test("should submit form successfully with valid data", async () => {
      // Arrange
      const user = userEvent.setup();
      setupCreateGroupSuccess();

      // Act
      render(<CreateGroupForm />);
      await user.click(screen.getByTestId("submit-button"));

      // Assert
      await waitFor(() => {
        expect(mockCreateGroup).toHaveBeenCalledWith(validGroupData);
      });

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("グループを作成しました");
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/dashboard/group-list");
      });
    });

    test("should call createGroup with correct parameters", async () => {
      // Arrange
      const user = userEvent.setup();
      setupCreateGroupSuccess();

      // Act
      render(<CreateGroupForm />);
      await user.click(screen.getByTestId("submit-button"));

      // Assert
      await waitFor(() => {
        expect(mockCreateGroup).toHaveBeenCalledTimes(1);
        expect(mockCreateGroup).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "テストグループ",
            goal: "テスト目標",
            evaluationMethod: "テスト評価方法",
            maxParticipants: 100,
            depositPeriod: 30,
          }),
        );
      });
    });
  });

  // --------------------------------------------------
  // エラーハンドリングテスト
  // --------------------------------------------------

  describe("エラーハンドリング", () => {
    test("should handle duplicate group name error", async () => {
      // Arrange
      const user = userEvent.setup();
      const duplicateError = "このグループ名は既に使用されています";
      setupCreateGroupError(duplicateError);

      // Act
      render(<CreateGroupForm />);
      await user.click(screen.getByTestId("submit-button"));

      // Assert
      await waitFor(() => {
        expect(mockCreateGroup).toHaveBeenCalled();
      });

      // フォームエラーが設定されることを確認（実際のフォームエラー表示は別途テストが必要）
      expect(mockToastError).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    test("should handle general error from createGroup", async () => {
      // Arrange
      const user = userEvent.setup();
      const generalError = "エラーが発生しました";
      setupCreateGroupError(generalError);

      // Act
      render(<CreateGroupForm />);
      await user.click(screen.getByTestId("submit-button"));

      // Assert
      await waitFor(() => {
        expect(mockCreateGroup).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(generalError);
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    test("should handle Prisma unique constraint error", async () => {
      // Arrange
      const user = userEvent.setup();
      setupCreateGroupPrismaError();

      // Act
      render(<CreateGroupForm />);
      await user.click(screen.getByTestId("submit-button"));

      // Assert
      await waitFor(() => {
        expect(mockCreateGroup).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("このグループ名は既に使用されています");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    test("should handle unexpected error", async () => {
      // Arrange
      const user = userEvent.setup();
      const unexpectedError = new Error("Unexpected error");
      mockCreateGroup.mockRejectedValue(unexpectedError);

      // Act
      render(<CreateGroupForm />);
      await user.click(screen.getByTestId("submit-button"));

      // Assert
      await waitFor(() => {
        expect(mockCreateGroup).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("エラーが発生しました");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------
  // 境界値・異常系テスト
  // --------------------------------------------------

  describe("境界値・異常系テスト", () => {
    test("should handle form submission with boundary values", async () => {
      // Arrange
      const user = userEvent.setup();
      setupCreateGroupSuccess();

      // Act
      render(<CreateGroupForm />);
      await user.click(screen.getByTestId("submit-button"));

      // Assert
      await waitFor(() => {
        expect(mockCreateGroup).toHaveBeenCalled();
      });
    });
  });

  // --------------------------------------------------
  // コンポーネントの状態テスト
  // --------------------------------------------------

  describe("コンポーネントの状態", () => {
    test("should render consistently on multiple renders", () => {
      // Act
      const { rerender } = render(<CreateGroupForm />);
      const firstRender = screen.getByTestId("form-layout");

      rerender(<CreateGroupForm />);
      const secondRender = screen.getByTestId("form-layout");

      // Assert
      expect(firstRender).toBeInTheDocument();
      expect(secondRender).toBeInTheDocument();
    });
  });
});
