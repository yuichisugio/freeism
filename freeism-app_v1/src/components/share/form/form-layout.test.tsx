import type { FieldValues } from "react-hook-form";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, test, vi } from "vitest";

import { FormLayout } from "./form-layout";

// UIコンポーネントのモック
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/ui/form", () => ({
  Form: ({ children }: { children: React.ReactNode }) => <div data-testid="form-provider">{children}</div>,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(" "),
}));

// テスト用のラッパーコンポーネント
function TestFormWrapper({
  onSubmit,
  submitLabel = "送信",
  submittingLabel,
  showCancelButton = false,
  onCancel,
  className,
}: {
  onSubmit?: (data: FieldValues) => void;
  submitLabel?: string;
  submittingLabel?: string;
  showCancelButton?: boolean;
  onCancel?: () => void;
  className?: string;
}) {
  const form = useForm<FieldValues>({
    defaultValues: {
      name: "",
      email: "",
    },
  });

  const handleSubmit = onSubmit ?? vi.fn();

  return (
    <FormLayout
      form={form}
      onSubmit={handleSubmit}
      submitLabel={submitLabel ?? "送信"}
      submittingLabel={submittingLabel}
      showCancelButton={showCancelButton}
      onCancel={onCancel}
      className={className}
    >
      <div data-testid="form-content">フォームコンテンツ</div>
    </FormLayout>
  );
}

describe("FormLayout", () => {
  test("should render form with basic elements", () => {
    render(<TestFormWrapper />);

    // フォームプロバイダーが存在することを確認
    expect(screen.getByTestId("form-provider")).toBeInTheDocument();

    // フォーム要素が存在することを確認（HTMLのform要素を直接検索）
    const formElement = document.querySelector("form");
    expect(formElement).toBeInTheDocument();

    // 子要素が表示されることを確認
    expect(screen.getByTestId("form-content")).toBeInTheDocument();

    // 送信ボタンが表示されることを確認
    expect(screen.getByRole("button", { name: "送信" })).toBeInTheDocument();
  });

  test("should render with custom submit label", () => {
    render(<TestFormWrapper submitLabel="保存" />);

    expect(screen.getByRole("button", { name: "保存" })).toBeInTheDocument();
  });

  test("should render with custom submitting label", () => {
    render(<TestFormWrapper submittingLabel="処理中..." />);

    // カスタムsubmittingLabelが設定されていることを確認（通常時は表示されない）
    expect(screen.getByRole("button", { name: "送信" })).toBeInTheDocument();
  });

  test("should show cancel button when showCancelButton is true", () => {
    const mockOnCancel = vi.fn();
    render(<TestFormWrapper showCancelButton={true} onCancel={mockOnCancel} />);

    expect(screen.getByRole("button", { name: "送信" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "キャンセル" })).toBeInTheDocument();
  });

  test("should not show cancel button when showCancelButton is false", () => {
    render(<TestFormWrapper showCancelButton={false} />);

    expect(screen.getByRole("button", { name: "送信" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "キャンセル" })).not.toBeInTheDocument();
  });

  test("should apply custom className", () => {
    render(<TestFormWrapper className="custom-form-class" />);

    const formElement = document.querySelector("form");
    expect(formElement).toHaveClass("custom-form-class");
  });

  test("should apply default className when no className provided", () => {
    render(<TestFormWrapper />);

    const formElement = document.querySelector("form");
    expect(formElement).toHaveClass("space-y-6");
  });

  test("should render children content", () => {
    render(<TestFormWrapper />);

    expect(screen.getByTestId("form-content")).toBeInTheDocument();
    expect(screen.getByText("フォームコンテンツ")).toBeInTheDocument();
  });

  test("should call onSubmit when form is submitted", async () => {
    const mockOnSubmit = vi.fn();
    const user = userEvent.setup();

    render(<TestFormWrapper onSubmit={mockOnSubmit} />);

    const submitButton = screen.getByRole("button", { name: "送信" });
    await user.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalled();
  });

  test("should call onCancel when cancel button is clicked", async () => {
    const mockOnCancel = vi.fn();
    const user = userEvent.setup();

    render(<TestFormWrapper showCancelButton={true} onCancel={mockOnCancel} />);

    const cancelButton = screen.getByRole("button", { name: "キャンセル" });
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  test("should display root error when form has root error", () => {
    function ErrorTestWrapper() {
      const form = useForm<FieldValues>();

      // rootエラーを設定
      React.useEffect(() => {
        form.setError("root", { message: "フォームエラーが発生しました" });
      }, [form]);

      return (
        <FormLayout form={form} onSubmit={vi.fn()} submitLabel="送信">
          <div>テストコンテンツ</div>
        </FormLayout>
      );
    }

    render(<ErrorTestWrapper />);

    expect(screen.getByText("フォームエラーが発生しました")).toBeInTheDocument();
  });

  test("should not display error when form has no root error", () => {
    render(<TestFormWrapper />);

    // エラーメッセージが表示されていないことを確認
    const errorElement = document.querySelector(".text-red-500");
    expect(errorElement).not.toBeInTheDocument();
  });

  describe("境界値テスト", () => {
    test("should handle empty submitLabel", () => {
      render(<TestFormWrapper submitLabel="" />);

      expect(screen.getByRole("button", { name: "" })).toBeInTheDocument();
    });

    test("should handle very long submitLabel", () => {
      const longLabel = "非常に長い送信ボタンのラベルテキストです".repeat(10);
      render(<TestFormWrapper submitLabel={longLabel} />);

      expect(screen.getByRole("button", { name: longLabel })).toBeInTheDocument();
    });

    test("should handle undefined onCancel with showCancelButton true", () => {
      render(<TestFormWrapper showCancelButton={true} onCancel={undefined} />);

      // onCancelがundefinedの場合、キャンセルボタンは表示されない
      expect(screen.queryByRole("button", { name: "キャンセル" })).not.toBeInTheDocument();
    });
  });

  describe("異常系テスト", () => {
    test("should handle null children", () => {
      function NullChildrenWrapper() {
        const form = useForm<FieldValues>();
        return (
          <FormLayout form={form} onSubmit={vi.fn()} submitLabel="送信">
            {null}
          </FormLayout>
        );
      }

      render(<NullChildrenWrapper />);

      expect(screen.getByRole("button", { name: "送信" })).toBeInTheDocument();
    });

    test("should handle multiple children", () => {
      function MultipleChildrenWrapper() {
        const form = useForm<FieldValues>();
        return (
          <FormLayout form={form} onSubmit={vi.fn()} submitLabel="送信">
            <div data-testid="child-1">子要素1</div>
            <div data-testid="child-2">子要素2</div>
            <div data-testid="child-3">子要素3</div>
          </FormLayout>
        );
      }

      render(<MultipleChildrenWrapper />);

      expect(screen.getByTestId("child-1")).toBeInTheDocument();
      expect(screen.getByTestId("child-2")).toBeInTheDocument();
      expect(screen.getByTestId("child-3")).toBeInTheDocument();
    });
  });

  describe("cn関数統合テスト", () => {
    test("should properly merge default and custom classes using cn", () => {
      render(<TestFormWrapper className="custom-class border-2" />);

      const formElement = document.querySelector("form");

      // カスタムクラスが追加されることを確認
      expect(formElement).toHaveClass("custom-class", "border-2");

      // デフォルトクラスの一部が保持されることを確認
      expect(formElement).toHaveClass("opacity-100", "transition-opacity", "duration-300");
    });

    test("should handle conflicting classes through cn function", () => {
      render(<TestFormWrapper className="opacity-50 duration-500" />);

      const formElement = document.querySelector("form");

      // cn関数により最後に指定されたクラスが優先されることを確認
      expect(formElement).toHaveClass("opacity-50", "duration-500");
    });
  });
});
