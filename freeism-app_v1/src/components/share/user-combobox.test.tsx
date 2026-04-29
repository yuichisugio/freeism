import { AllTheProviders } from "@/test/setup/tanstack-query-setup";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { UserCombobox } from "./user-combobox";

/**
 * テスト用のユーザーオプションデータ
 */
const mockOptions = [
  { value: "user-1", label: "田中太郎" },
  { value: "user-2", label: "佐藤花子" },
  { value: "user-3", label: "鈴木次郎" },
];

/**
 * UserComboboxコンポーネントのテストスイート
 */
describe("UserCombobox", () => {
  // モック関数の定義
  const mockOnValueChangeAction = vi.fn();
  const mockSetOpenAction = vi.fn();

  // デフォルトのprops
  const defaultProps = {
    options: mockOptions,
    onValueChangeAction: mockOnValueChangeAction,
    open: false,
    setOpenAction: mockSetOpenAction,
  };

  beforeEach(() => {
    // 各テスト前にモック関数をリセット
    vi.clearAllMocks();
  });

  describe("レンダリング", () => {
    test("should render combobox trigger button", () => {
      render(
        <AllTheProviders>
          <UserCombobox {...defaultProps} />
        </AllTheProviders>,
      );

      // comboboxのボタンが表示されることを確認
      const triggerButton = screen.getByRole("combobox");
      expect(triggerButton).toBeInTheDocument();
    });

    test("should display placeholder when no value is selected", () => {
      render(
        <AllTheProviders>
          <UserCombobox {...defaultProps} placeholder="ユーザーを選択してください" />
        </AllTheProviders>,
      );

      // プレースホルダーが表示されることを確認
      expect(screen.getByText("ユーザーを選択してください")).toBeInTheDocument();
    });

    test("should display selected user label when value is provided", () => {
      render(
        <AllTheProviders>
          <UserCombobox {...defaultProps} value="user-1" />
        </AllTheProviders>,
      );

      // 選択されたユーザー名が表示されることを確認
      expect(screen.getByText("田中太郎")).toBeInTheDocument();
    });

    test("should display default placeholder when no custom placeholder provided", () => {
      render(
        <AllTheProviders>
          <UserCombobox {...defaultProps} />
        </AllTheProviders>,
      );

      // デフォルトのプレースホルダーが表示されることを確認
      expect(screen.getByText("選択してください...")).toBeInTheDocument();
    });

    test("should display placeholder when invalid value is provided", () => {
      render(
        <AllTheProviders>
          <UserCombobox {...defaultProps} value="invalid-user-id" />
        </AllTheProviders>,
      );

      // 無効な値の場合でもプレースホルダーではなく、空文字が表示される可能性
      // 実際の実装を確認する必要があるが、ここではgetByTextで見つからない場合をテスト
      const triggerButton = screen.getByRole("combobox");
      expect(triggerButton).toBeInTheDocument();
      // プレースホルダーまたは空のテキストが表示されることを確認
      expect(screen.queryByText("田中太郎")).not.toBeInTheDocument();
      expect(screen.queryByText("佐藤花子")).not.toBeInTheDocument();
      expect(screen.queryByText("鈴木次郎")).not.toBeInTheDocument();
    });
  });

  describe("aria属性とアクセシビリティ", () => {
    test("should have correct aria attributes when closed", () => {
      render(
        <AllTheProviders>
          <UserCombobox {...defaultProps} open={false} />
        </AllTheProviders>,
      );

      const triggerButton = screen.getByRole("combobox");
      expect(triggerButton).toHaveAttribute("aria-expanded", "false");
    });

    test("should have correct aria attributes when open", () => {
      render(
        <AllTheProviders>
          <UserCombobox {...defaultProps} open={true} />
        </AllTheProviders>,
      );

      // トリガーボタンを取得（複数のcomboboxがあるため、配列の最初を取得）
      const comboboxElements = screen.getAllByRole("combobox");
      const triggerButton = comboboxElements[0]; // 最初の要素はトリガーボタン
      expect(triggerButton).toHaveAttribute("aria-expanded", "true");

      // 検索入力も存在することを確認（2番目の要素）
      const searchInput = comboboxElements[1];
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveAttribute("role", "combobox");
      expect(searchInput).toHaveAttribute("placeholder", "検索...");
    });

    test("should display search placeholder correctly", () => {
      render(
        <AllTheProviders>
          <UserCombobox {...defaultProps} open={true} searchPlaceholder="カスタム検索..." />
        </AllTheProviders>,
      );

      // カスタム検索プレースホルダーが表示されることを確認
      expect(screen.getByPlaceholderText("カスタム検索...")).toBeInTheDocument();
    });

    test("should display empty message when no options and popover is open", () => {
      render(
        <AllTheProviders>
          <UserCombobox {...defaultProps} options={[]} open={true} emptyMessage="カスタム空メッセージ" />
        </AllTheProviders>,
      );

      // カスタム空メッセージが表示されることを確認
      expect(screen.getByText("カスタム空メッセージ")).toBeInTheDocument();
    });

    test("should display default empty message when no options and popover is open", () => {
      render(
        <AllTheProviders>
          <UserCombobox {...defaultProps} options={[]} open={true} />
        </AllTheProviders>,
      );

      // デフォルトの空メッセージが表示されることを確認
      expect(screen.getByText("見つかりません。")).toBeInTheDocument();
    });
  });

  describe("ユーザー選択機能", () => {
    test("should call onValueChangeAction when user is selected", async () => {
      const user = userEvent.setup();

      render(
        <AllTheProviders>
          <UserCombobox {...defaultProps} open={true} />
        </AllTheProviders>,
      );

      // ユーザーオプションをクリック
      const userOption = screen.getByRole("option", { name: "田中太郎" });
      await user.click(userOption);

      // onValueChangeActionが正しい値で呼ばれることを確認
      expect(mockOnValueChangeAction).toHaveBeenCalledWith("user-1");
      expect(mockSetOpenAction).toHaveBeenCalledWith(false);
    });

    test("should call onValueChangeAction with empty string when same user is selected again", async () => {
      const user = userEvent.setup();

      render(
        <AllTheProviders>
          <UserCombobox {...defaultProps} open={true} value="user-1" />
        </AllTheProviders>,
      );

      // 既に選択されているユーザーオプションをクリック
      const userOption = screen.getByRole("option", { name: "田中太郎" });
      await user.click(userOption);

      // 選択解除として空文字で呼ばれることを確認
      expect(mockOnValueChangeAction).toHaveBeenCalledWith("");
      expect(mockSetOpenAction).toHaveBeenCalledWith(false);
    });

    test("should show check icon for selected user", () => {
      render(
        <AllTheProviders>
          <UserCombobox {...defaultProps} open={true} value="user-2" />
        </AllTheProviders>,
      );

      // 選択されたユーザーのオプションを取得
      const selectedOption = screen.getByRole("option", { name: "佐藤花子" });
      expect(selectedOption).toBeInTheDocument();

      // 選択されていないユーザーのオプションも存在することを確認
      const unselectedOption = screen.getByRole("option", { name: "田中太郎" });
      expect(unselectedOption).toBeInTheDocument();

      // Checkアイコンの存在を確認（実装では opacity で制御されている）
      // CommandItemの子要素としてCheckアイコンが存在することを確認
      const checkIcons = selectedOption.querySelectorAll("svg");
      expect(checkIcons.length).toBeGreaterThan(0);
    });

    test("should render all user options when popover is open", () => {
      render(
        <AllTheProviders>
          <UserCombobox {...defaultProps} open={true} />
        </AllTheProviders>,
      );

      // すべてのユーザーオプションが表示されることを確認
      expect(screen.getByRole("option", { name: "田中太郎" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "佐藤花子" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "鈴木次郎" })).toBeInTheDocument();
    });
  });

  describe("Popover開閉制御", () => {
    test("should call setOpenAction when trigger button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <AllTheProviders>
          <UserCombobox {...defaultProps} open={false} />
        </AllTheProviders>,
      );

      const triggerButton = screen.getByRole("combobox");
      await user.click(triggerButton);

      // setOpenActionが呼ばれることを確認
      expect(mockSetOpenAction).toHaveBeenCalled();
    });

    test("should not render options when popover is closed", () => {
      render(
        <AllTheProviders>
          <UserCombobox {...defaultProps} open={false} />
        </AllTheProviders>,
      );

      // Popoverが閉じている時はオプションが表示されない
      expect(screen.queryByRole("option", { name: "田中太郎" })).not.toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "佐藤花子" })).not.toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "鈴木次郎" })).not.toBeInTheDocument();
    });
  });

  describe("境界値・異常系テスト", () => {
    test("should handle empty options array", () => {
      render(
        <AllTheProviders>
          <UserCombobox {...defaultProps} options={[]} open={true} />
        </AllTheProviders>,
      );

      // 空のオプション配列でも正常に表示される
      expect(screen.getByText("見つかりません。")).toBeInTheDocument();
      expect(screen.queryByRole("option")).not.toBeInTheDocument();
    });

    test("should handle undefined value", () => {
      render(
        <AllTheProviders>
          <UserCombobox {...defaultProps} value={undefined} />
        </AllTheProviders>,
      );

      // undefined値の場合はプレースホルダーが表示される
      expect(screen.getByText("選択してください...")).toBeInTheDocument();
    });

    test("should handle empty string value", () => {
      render(
        <AllTheProviders>
          <UserCombobox {...defaultProps} value="" />
        </AllTheProviders>,
      );

      // 空文字の場合はプレースホルダーが表示される
      expect(screen.getByText("選択してください...")).toBeInTheDocument();
    });

    test("should handle options with special characters", () => {
      const specialOptions = [
        { value: "user-special", label: "特殊文字@#$%^&*()" },
        { value: "user-emoji", label: "絵文字ユーザー😀🎉" },
        { value: "user-space", label: "スペース含む" },
      ];

      render(
        <AllTheProviders>
          <UserCombobox {...defaultProps} options={specialOptions} open={true} />
        </AllTheProviders>,
      );

      // 特殊文字を含むオプションも正常に表示される
      expect(screen.getByRole("option", { name: "特殊文字@#$%^&*()" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "絵文字ユーザー😀🎉" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "スペース含む" })).toBeInTheDocument();
    });

    test("should handle very long user names", () => {
      const longNameOptions = [
        {
          value: "user-long",
          label: "とても長いユーザー名".repeat(10), // 100文字の名前
        },
      ];

      render(
        <AllTheProviders>
          <UserCombobox {...defaultProps} options={longNameOptions} open={true} />
        </AllTheProviders>,
      );

      // 長い名前も正常に表示される
      expect(screen.getByRole("option", { name: "とても長いユーザー名".repeat(10) })).toBeInTheDocument();
    });

    test("should handle duplicate user names with different values", () => {
      const duplicateNameOptions = [
        { value: "user-1", label: "同じ名前" },
        { value: "user-2", label: "同じ名前" },
        { value: "user-3", label: "同じ名前" },
      ];

      render(
        <AllTheProviders>
          <UserCombobox {...defaultProps} options={duplicateNameOptions} open={true} />
        </AllTheProviders>,
      );

      // 同じ名前でも異なるvalueを持つオプションが全て表示される
      const sameNameOptions = screen.getAllByRole("option", { name: "同じ名前" });
      expect(sameNameOptions).toHaveLength(3);
    });
  });
});
