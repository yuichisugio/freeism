import { AllTheProviders } from "@/test/setup/tanstack-query-setup";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Factory } from "fishery";
import { FormProvider, useForm } from "react-hook-form";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { DateField } from "./share-calendar";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テスト用のフォームラッパーコンポーネント
 */
type TestFormData = {
  date: Date | undefined;
};

type TestWrapperProps = {
  label: string;
  description?: string;
  placeholder?: string;
  dateFormat?: string;
  disablePastDates?: boolean;
  disabledDates?: (date: Date) => boolean;
  defaultValue?: Date;
};

function TestFormWrapper({ defaultValue, ...props }: TestWrapperProps) {
  const methods = useForm<TestFormData>({
    defaultValues: {
      date: defaultValue,
    },
  });

  return (
    <FormProvider {...methods}>
      <DateField {...props} control={methods.control} name="date" />
    </FormProvider>
  );
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Fisheryファクトリーを使用したテストデータ作成
 */

// DateFieldのpropsファクトリー
const dateFieldPropsFactory = Factory.define<TestWrapperProps>(({ params }) => ({
  label: params.label ?? "日付選択",
  description: params.description,
  placeholder: params.placeholder ?? "日付を選択",
  dateFormat: params.dateFormat ?? "yyyy年MM月dd日",
  disablePastDates: params.disablePastDates ?? true,
  disabledDates: params.disabledDates,
  defaultValue: params.defaultValue,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ作成ヘルパー関数
 */

const createTestProps = (overrides = {}) => {
  return dateFieldPropsFactory.build(overrides);
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * DateField コンポーネントの単体テスト
 */
describe("DateField", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 基本的なレンダリングのテスト
   */
  describe("基本的なレンダリング", () => {
    test("should render with required props", () => {
      const props = createTestProps({ label: "開始日" });

      render(
        <AllTheProviders>
          <TestFormWrapper {...props} />
        </AllTheProviders>,
      );

      // ラベルが表示されることを確認
      expect(screen.getByText("開始日")).toBeInTheDocument();

      // 入力フィールドが表示されることを確認
      expect(screen.getByPlaceholderText("日付を選択")).toBeInTheDocument();

      // カレンダーアイコンボタンが表示されることを確認
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    test("should render with description when provided", () => {
      const props = createTestProps({
        label: "開始日",
        description: "プロジェクトの開始日を選択してください",
      });

      render(
        <AllTheProviders>
          <TestFormWrapper {...props} />
        </AllTheProviders>,
      );

      expect(screen.getByText("プロジェクトの開始日を選択してください")).toBeInTheDocument();
    });

    test("should render with custom placeholder when provided", () => {
      const props = createTestProps({
        label: "終了日",
        placeholder: "カスタムプレースホルダー",
      });

      render(
        <AllTheProviders>
          <TestFormWrapper {...props} />
        </AllTheProviders>,
      );

      expect(screen.getByPlaceholderText("カスタムプレースホルダー")).toBeInTheDocument();
    });

    test("should render without description when not provided", () => {
      const props = createTestProps({ label: "開始日" });

      render(
        <AllTheProviders>
          <TestFormWrapper {...props} />
        </AllTheProviders>,
      );

      // descriptionが提供されていない場合は表示されないことを確認
      expect(screen.queryByText("プロジェクトの開始日を選択してください")).not.toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * デフォルト値のテスト
   */
  describe("デフォルト値", () => {
    test("should display formatted default value when provided", () => {
      const defaultDate = new Date(2024, 0, 15); // 2024年1月15日
      const props = createTestProps({
        label: "開始日",
        defaultValue: defaultDate,
      });

      render(
        <AllTheProviders>
          <TestFormWrapper {...props} />
        </AllTheProviders>,
      );

      const expectedFormat = format(defaultDate, "yyyy年MM月dd日", { locale: ja });
      expect(screen.getByDisplayValue(expectedFormat)).toBeInTheDocument();
    });

    test("should render empty input when no default value", () => {
      const props = createTestProps({ label: "開始日" });

      render(
        <AllTheProviders>
          <TestFormWrapper {...props} />
        </AllTheProviders>,
      );

      const input = screen.getByPlaceholderText("日付を選択");
      expect(input).toHaveValue("");
    });

    test("should display custom date format when provided", () => {
      const defaultDate = new Date(2024, 0, 15); // 2024年1月15日
      const customFormat = "yyyy/MM/dd";
      const props = createTestProps({
        label: "開始日",
        defaultValue: defaultDate,
        dateFormat: customFormat,
      });

      render(
        <AllTheProviders>
          <TestFormWrapper {...props} />
        </AllTheProviders>,
      );

      const expectedFormat = format(defaultDate, customFormat, { locale: ja });
      expect(screen.getByDisplayValue(expectedFormat)).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザー操作のテスト
   */
  describe("ユーザー操作", () => {
    test("should open calendar popover when calendar button is clicked", async () => {
      const user = userEvent.setup();
      const props = createTestProps({ label: "開始日" });

      render(
        <AllTheProviders>
          <TestFormWrapper {...props} />
        </AllTheProviders>,
      );

      const calendarButton = screen.getByRole("button");
      await user.click(calendarButton);

      // カレンダーが表示されることを確認
      await waitFor(() => {
        expect(screen.getByRole("grid")).toBeInTheDocument();
      });
    });

    test("should handle direct text input", async () => {
      const user = userEvent.setup();
      const props = createTestProps({ label: "開始日" });

      render(
        <AllTheProviders>
          <TestFormWrapper {...props} />
        </AllTheProviders>,
      );

      const input = screen.getByPlaceholderText("日付を選択");

      // 直接テキストを入力
      await user.type(input, "2024年01月15日");

      expect(input).toHaveValue("2024年01月15日");
    });

    test("should clear input when invalid text is entered and field loses focus", async () => {
      const user = userEvent.setup();
      const props = createTestProps({ label: "開始日" });

      render(
        <AllTheProviders>
          <TestFormWrapper {...props} />
        </AllTheProviders>,
      );

      const input = screen.getByPlaceholderText("日付を選択");

      // 無効なテキストを入力
      await user.type(input, "無効な日付");

      // フォーカスを外す
      await user.tab();

      // 無効な入力の場合は空になることを確認
      expect(input).toHaveValue("");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * カスタム設定のテスト
   */
  describe("カスタム設定", () => {
    test("should apply custom disabled dates function", async () => {
      const user = userEvent.setup();
      const disabledDates = vi.fn((date: Date) => {
        // 土曜日と日曜日を無効化
        const day = date.getDay();
        return day === 0 || day === 6;
      });

      const props = createTestProps({
        label: "開始日",
        disabledDates,
      });

      render(
        <AllTheProviders>
          <TestFormWrapper {...props} />
        </AllTheProviders>,
      );

      const calendarButton = screen.getByRole("button");
      await user.click(calendarButton);

      // カレンダーが表示されたらdisabledDates関数が呼ばれることを確認
      await waitFor(() => {
        expect(disabledDates).toHaveBeenCalled();
      });
    });

    test("should respect disablePastDates=false setting", () => {
      const props = createTestProps({
        label: "開始日",
        disablePastDates: false,
      });

      render(
        <AllTheProviders>
          <TestFormWrapper {...props} />
        </AllTheProviders>,
      );

      // コンポーネントが正常にレンダリングされることを確認
      expect(screen.getByText("開始日")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 境界値・エラーケースのテスト
   */
  describe("境界値・エラーケース", () => {
    test("should handle empty label", () => {
      const props = createTestProps({ label: "" });

      render(
        <AllTheProviders>
          <TestFormWrapper {...props} />
        </AllTheProviders>,
      );

      // 空のラベルでもエラーが発生しないことを確認
      expect(screen.getByPlaceholderText("日付を選択")).toBeInTheDocument();
    });

    test("should handle undefined placeholder", () => {
      const props = createTestProps({
        label: "開始日",
        placeholder: undefined,
      });

      render(
        <AllTheProviders>
          <TestFormWrapper {...props} />
        </AllTheProviders>,
      );

      // undefinedの場合はデフォルト値が使用されることを確認
      expect(screen.getByPlaceholderText("日付を選択")).toBeInTheDocument();
    });

    test("should handle undefined defaultValue", () => {
      const props = createTestProps({
        label: "開始日",
        defaultValue: undefined,
      });

      render(
        <AllTheProviders>
          <TestFormWrapper {...props} />
        </AllTheProviders>,
      );

      const input = screen.getByPlaceholderText("日付を選択");
      expect(input).toHaveValue("");
    });

    test("should handle null label gracefully", () => {
      const props = createTestProps({
        label: "",
      });

      render(
        <AllTheProviders>
          <TestFormWrapper {...props} />
        </AllTheProviders>,
      );

      // 空のラベルでも正常に動作することを確認
      expect(screen.getByPlaceholderText("日付を選択")).toBeInTheDocument();
    });

    test("should handle very long label text", () => {
      const longLabel = "これは非常に長いラベルテキストです。".repeat(5);
      const props = createTestProps({
        label: longLabel,
      });

      render(
        <AllTheProviders>
          <TestFormWrapper {...props} />
        </AllTheProviders>,
      );

      expect(screen.getByText(longLabel)).toBeInTheDocument();
    });

    test("should handle special characters in label", () => {
      const specialLabel = "日付選択 <>&'\"";
      const props = createTestProps({
        label: specialLabel,
      });

      render(
        <AllTheProviders>
          <TestFormWrapper {...props} />
        </AllTheProviders>,
      );

      expect(screen.getByText(specialLabel)).toBeInTheDocument();
    });
  });
});
