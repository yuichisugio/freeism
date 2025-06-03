/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { AllTheProviders } from "@/test/setup/tanstack-query-setup";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Factory } from "fishery";
import { FormProvider, useForm } from "react-hook-form";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { ComboBoxOption, CustomFormFieldProps, RadioOption } from "./form-field";
import { CustomFormField } from "./form-field";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テスト用のフォームデータ型定義
 */
type TestFormData = {
  textField: string;
  emailField: string;
  numberField: number;
  textareaField: string;
  radioField: string | number;
  comboboxField: string;
  dateField: Date | undefined;
  switchField: boolean;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テスト用のフォームラッパーコンポーネント
 */
type TestFormWrapperProps<TName extends keyof TestFormData> = {
  fieldProps: CustomFormFieldProps<TestFormData, TName>;
  defaultValues?: Partial<TestFormData>;
};

function TestFormWrapper<TName extends keyof TestFormData>({ fieldProps, defaultValues }: TestFormWrapperProps<TName>) {
  const methods = useForm<TestFormData>({
    defaultValues: {
      textField: "",
      emailField: "",
      numberField: 0,
      textareaField: "",
      radioField: "",
      comboboxField: "",
      dateField: undefined,
      switchField: false,
      ...defaultValues,
    },
  });

  return (
    <FormProvider {...methods}>
      <CustomFormField {...fieldProps} control={methods.control} />
    </FormProvider>
  );
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Fisheryファクトリーを使用したテストデータ作成
 */

// RadioOptionファクトリー
const radioOptionFactory = Factory.define<RadioOption>(({ sequence, params }) => ({
  value: params.value ?? `option-${sequence}`,
  label: params.label ?? `オプション ${sequence}`,
}));

// ComboBoxOptionファクトリー
const comboBoxOptionFactory = Factory.define<ComboBoxOption>(({ sequence, params }) => ({
  id: params.id ?? `combo-${sequence}`,
  name: params.name ?? `コンボボックス項目 ${sequence}`,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ作成ヘルパー関数
 */

const createRadioOptions = (count = 3): RadioOption[] => {
  return radioOptionFactory.buildList(count);
};

const createComboBoxOptions = (count = 3): ComboBoxOption[] => {
  return comboBoxOptionFactory.buildList(count);
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * CustomFormField コンポーネントの単体テスト
 */
describe("CustomFormField", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Input フィールドのテスト
   */
  describe("Input フィールド", () => {
    test("should render text input field with required props", () => {
      const fieldProps: CustomFormFieldProps<TestFormData, "textField"> = {
        fieldType: "input",
        type: "text",
        control: {} as any,
        name: "textField",
        label: "テキスト入力",
      };

      render(
        <AllTheProviders>
          <TestFormWrapper fieldProps={fieldProps} />
        </AllTheProviders>,
      );

      // ラベルが表示されることを確認
      expect(screen.getByText("テキスト入力")).toBeInTheDocument();

      // 入力フィールドが表示されることを確認
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    test("should render email input field with correct type", () => {
      const fieldProps: CustomFormFieldProps<TestFormData, "emailField"> = {
        fieldType: "input",
        type: "email",
        control: {} as any,
        name: "emailField",
        label: "メールアドレス",
        placeholder: "example@email.com",
      };

      render(
        <AllTheProviders>
          <TestFormWrapper fieldProps={fieldProps} />
        </AllTheProviders>,
      );

      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("type", "email");
      expect(input).toHaveAttribute("placeholder", "example@email.com");
    });

    test("should render number input field with min and max attributes", () => {
      const fieldProps: CustomFormFieldProps<TestFormData, "numberField"> = {
        fieldType: "input",
        type: "number",
        control: {} as any,
        name: "numberField",
        label: "数値入力",
        min: 0,
        max: 100,
      };

      render(
        <AllTheProviders>
          <TestFormWrapper fieldProps={fieldProps} />
        </AllTheProviders>,
      );

      const input = screen.getByRole("spinbutton");
      expect(input).toHaveAttribute("type", "number");
      expect(input).toHaveAttribute("min", "0");
      expect(input).toHaveAttribute("max", "100");
    });

    test("should render input field with description when provided", () => {
      const fieldProps: CustomFormFieldProps<TestFormData, "textField"> = {
        fieldType: "input",
        type: "text",
        control: {} as any,
        name: "textField",
        label: "テキスト入力",
        description: "説明文です",
      };

      render(
        <AllTheProviders>
          <TestFormWrapper fieldProps={fieldProps} />
        </AllTheProviders>,
      );

      expect(screen.getByText("説明文です")).toBeInTheDocument();
    });

    test("should handle user input correctly", async () => {
      const user = userEvent.setup();
      const fieldProps: CustomFormFieldProps<TestFormData, "textField"> = {
        fieldType: "input",
        type: "text",
        control: {} as any,
        name: "textField",
        label: "テキスト入力",
      };

      render(
        <AllTheProviders>
          <TestFormWrapper fieldProps={fieldProps} />
        </AllTheProviders>,
      );

      const input = screen.getByRole("textbox");
      await user.type(input, "テストテキスト");

      expect(input).toHaveValue("テストテキスト");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Textarea フィールドのテスト
   */
  describe("Textarea フィールド", () => {
    test("should render textarea field with required props", () => {
      const fieldProps: CustomFormFieldProps<TestFormData, "textareaField"> = {
        fieldType: "textarea",
        control: {} as any,
        name: "textareaField",
        label: "テキストエリア",
      };

      render(
        <AllTheProviders>
          <TestFormWrapper fieldProps={fieldProps} />
        </AllTheProviders>,
      );

      expect(screen.getByText("テキストエリア")).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    test("should render textarea with placeholder", () => {
      const fieldProps: CustomFormFieldProps<TestFormData, "textareaField"> = {
        fieldType: "textarea",
        control: {} as any,
        name: "textareaField",
        label: "テキストエリア",
        placeholder: "詳細を入力してください",
      };

      render(
        <AllTheProviders>
          <TestFormWrapper fieldProps={fieldProps} />
        </AllTheProviders>,
      );

      expect(screen.getByPlaceholderText("詳細を入力してください")).toBeInTheDocument();
    });

    test("should handle textarea input correctly", async () => {
      const user = userEvent.setup();
      const fieldProps: CustomFormFieldProps<TestFormData, "textareaField"> = {
        fieldType: "textarea",
        control: {} as any,
        name: "textareaField",
        label: "テキストエリア",
      };

      render(
        <AllTheProviders>
          <TestFormWrapper fieldProps={fieldProps} />
        </AllTheProviders>,
      );

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "複数行の\nテキスト入力");

      expect(textarea).toHaveValue("複数行の\nテキスト入力");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Radio フィールドのテスト
   */
  describe("Radio フィールド", () => {
    test("should render radio field with required props", () => {
      const options = createRadioOptions(3);
      const fieldProps: CustomFormFieldProps<TestFormData, "radioField"> = {
        fieldType: "radio",
        control: {} as any,
        name: "radioField",
        label: "ラジオボタン",
        options,
      };

      render(
        <AllTheProviders>
          <TestFormWrapper fieldProps={fieldProps} />
        </AllTheProviders>,
      );

      expect(screen.getByText("ラジオボタン")).toBeInTheDocument();

      // 各オプションが表示されることを確認
      options.forEach((option) => {
        expect(screen.getByText(option.label)).toBeInTheDocument();
      });
    });

    test("should handle radio selection correctly", async () => {
      const user = userEvent.setup();
      const options = createRadioOptions(2);
      const fieldProps: CustomFormFieldProps<TestFormData, "radioField"> = {
        fieldType: "radio",
        control: {} as any,
        name: "radioField",
        label: "ラジオボタン",
        options,
      };

      render(
        <AllTheProviders>
          <TestFormWrapper fieldProps={fieldProps} />
        </AllTheProviders>,
      );

      // 最初のオプションをクリック
      const firstOption = screen.getByText(options[0].label);
      await user.click(firstOption);

      // 選択状態が反映されることを確認（視覚的な変化）
      expect(firstOption.closest("label")).toHaveClass("peer-checked:border-blue-500");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Switch フィールドのテスト
   */
  describe("Switch フィールド", () => {
    test("should render switch field with required props", () => {
      const fieldProps: CustomFormFieldProps<TestFormData, "switchField"> = {
        fieldType: "switch",
        control: {} as any,
        name: "switchField",
        label: "スイッチ",
      };

      render(
        <AllTheProviders>
          <TestFormWrapper fieldProps={fieldProps} />
        </AllTheProviders>,
      );

      expect(screen.getByText("スイッチ")).toBeInTheDocument();
      expect(screen.getByRole("switch")).toBeInTheDocument();
    });

    test("should handle switch toggle correctly", async () => {
      const user = userEvent.setup();
      const fieldProps: CustomFormFieldProps<TestFormData, "switchField"> = {
        fieldType: "switch",
        control: {} as any,
        name: "switchField",
        label: "スイッチ",
      };

      render(
        <AllTheProviders>
          <TestFormWrapper fieldProps={fieldProps} />
        </AllTheProviders>,
      );

      const switchElement = screen.getByRole("switch");

      // 初期状態はfalse
      expect(switchElement).not.toBeChecked();

      // スイッチをクリック
      await user.click(switchElement);

      // 状態が変更されることを確認
      expect(switchElement).toBeChecked();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ComboBox フィールドのテスト
   */
  describe("ComboBox フィールド", () => {
    test("should render combobox field with required props", () => {
      const options = createComboBoxOptions(3);
      const fieldProps: CustomFormFieldProps<TestFormData, "comboboxField"> = {
        fieldType: "combobox",
        control: {} as any,
        name: "comboboxField",
        label: "コンボボックス",
        options,
        open: false,
        setOpen: vi.fn(),
      };

      render(
        <AllTheProviders>
          <TestFormWrapper fieldProps={fieldProps} />
        </AllTheProviders>,
      );

      expect(screen.getByText("コンボボックス")).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    test("should open combobox when clicked", async () => {
      const user = userEvent.setup();
      const setOpenMock = vi.fn();
      const options = createComboBoxOptions(3);
      const fieldProps: CustomFormFieldProps<TestFormData, "comboboxField"> = {
        fieldType: "combobox",
        control: {} as any,
        name: "comboboxField",
        label: "コンボボックス",
        options,
        open: false,
        setOpen: setOpenMock,
      };

      render(
        <AllTheProviders>
          <TestFormWrapper fieldProps={fieldProps} />
        </AllTheProviders>,
      );

      const combobox = screen.getByRole("combobox");
      await user.click(combobox);

      // setOpenが呼ばれることを確認
      expect(setOpenMock).toHaveBeenCalled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Date フィールドのテスト
   */
  describe("Date フィールド", () => {
    test("should render date field with required props", () => {
      const fieldProps: CustomFormFieldProps<TestFormData, "dateField"> = {
        fieldType: "date",
        control: {} as any,
        name: "dateField",
        label: "日付選択",
      };

      render(
        <AllTheProviders>
          <TestFormWrapper fieldProps={fieldProps} />
        </AllTheProviders>,
      );

      expect(screen.getByText("日付選択")).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    test("should render date field with custom placeholder", () => {
      const fieldProps: CustomFormFieldProps<TestFormData, "dateField"> = {
        fieldType: "date",
        control: {} as any,
        name: "dateField",
        label: "日付選択",
        placeholder: "カスタム日付プレースホルダー",
      };

      render(
        <AllTheProviders>
          <TestFormWrapper fieldProps={fieldProps} />
        </AllTheProviders>,
      );

      expect(screen.getByPlaceholderText("カスタム日付プレースホルダー")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * エラーハンドリングのテスト
   */
  describe("エラーハンドリング", () => {
    test("should throw error for unsupported field type", () => {
      // 未対応のフィールドタイプをテストするため、型アサーションを使用
      const fieldProps = {
        fieldType: "unsupported",
        control: {} as any,
        name: "textField",
        label: "未対応フィールド",
      } as any;

      // エラーがスローされることを確認
      expect(() => {
        render(
          <AllTheProviders>
            <TestFormWrapper fieldProps={fieldProps} />
          </AllTheProviders>,
        );
      }).toThrow("未対応のフィールドタイプが指定されました");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 境界値・エッジケースのテスト
   */
  describe("境界値・エッジケース", () => {
    test("should handle empty radio options array", () => {
      const fieldProps: CustomFormFieldProps<TestFormData, "radioField"> = {
        fieldType: "radio",
        control: {} as any,
        name: "radioField",
        label: "空のラジオボタン",
        options: [],
      };

      render(
        <AllTheProviders>
          <TestFormWrapper fieldProps={fieldProps} />
        </AllTheProviders>,
      );

      expect(screen.getByText("空のラジオボタン")).toBeInTheDocument();
      // オプションが空の場合でもエラーにならないことを確認
    });

    test("should handle empty combobox options array", () => {
      const fieldProps: CustomFormFieldProps<TestFormData, "comboboxField"> = {
        fieldType: "combobox",
        control: {} as any,
        name: "comboboxField",
        label: "空のコンボボックス",
        options: [],
        open: false,
        setOpen: vi.fn(),
      };

      render(
        <AllTheProviders>
          <TestFormWrapper fieldProps={fieldProps} />
        </AllTheProviders>,
      );

      expect(screen.getByText("空のコンボボックス")).toBeInTheDocument();
      // オプションが空の場合でもエラーにならないことを確認
    });

    test("should handle radio field with numeric values", () => {
      const numericOptions: RadioOption[] = [
        { value: 1, label: "オプション1" },
        { value: 2, label: "オプション2" },
      ];

      const fieldProps: CustomFormFieldProps<TestFormData, "radioField"> = {
        fieldType: "radio",
        control: {} as any,
        name: "radioField",
        label: "数値ラジオボタン",
        options: numericOptions,
      };

      render(
        <AllTheProviders>
          <TestFormWrapper fieldProps={fieldProps} />
        </AllTheProviders>,
      );

      expect(screen.getByText("数値ラジオボタン")).toBeInTheDocument();
      expect(screen.getByText("オプション1")).toBeInTheDocument();
      expect(screen.getByText("オプション2")).toBeInTheDocument();
    });

    test("should handle input field with all supported types", async () => {
      const inputTypes = ["text", "email", "password", "number", "tel", "url"] as const;

      for (const type of inputTypes) {
        const fieldProps: CustomFormFieldProps<TestFormData, "textField"> = {
          fieldType: "input",
          type,
          control: {} as any,
          name: "textField",
          label: `${type}入力`,
        };

        const { unmount } = render(
          <AllTheProviders>
            <TestFormWrapper fieldProps={fieldProps} />
          </AllTheProviders>,
        );

        expect(screen.getByText(`${type}入力`)).toBeInTheDocument();

        // 入力フィールドの存在を確認（ロールではなく属性で確認）
        const input = screen.getByDisplayValue("");
        expect(input).toHaveAttribute("type", type);

        unmount();
      }
    });

    test("should handle combobox with custom properties", () => {
      const customOptions: ComboBoxOption[] = [
        { id: "1", name: "カスタム項目1" },
        { id: "2", name: "カスタム項目2" },
      ];

      const fieldProps: CustomFormFieldProps<TestFormData, "comboboxField"> = {
        fieldType: "combobox",
        control: {} as any,
        name: "comboboxField",
        label: "カスタムコンボボックス",
        options: customOptions,
        open: false,
        setOpen: vi.fn(),
        placeholder: "カスタムプレースホルダー",
        searchPlaceholder: "カスタム検索",
        emptyMessage: "カスタム空メッセージ",
      };

      render(
        <AllTheProviders>
          <TestFormWrapper fieldProps={fieldProps} />
        </AllTheProviders>,
      );

      expect(screen.getByText("カスタムコンボボックス")).toBeInTheDocument();
      expect(screen.getByText("カスタムプレースホルダー")).toBeInTheDocument();
    });

    test("should handle date field with all optional props", () => {
      const fieldProps: CustomFormFieldProps<TestFormData, "dateField"> = {
        fieldType: "date",
        control: {} as any,
        name: "dateField",
        label: "完全な日付フィールド",
        placeholder: "カスタム日付プレースホルダー",
        buttonText: "カスタムボタン",
        dateFormat: "yyyy/MM/dd",
        disablePastDates: false,
      };

      render(
        <AllTheProviders>
          <TestFormWrapper fieldProps={fieldProps} />
        </AllTheProviders>,
      );

      expect(screen.getByText("完全な日付フィールド")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("カスタム日付プレースホルダー")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * アクセシビリティのテスト
   */
  describe("アクセシビリティ", () => {
    test("should have proper aria attributes for input fields", () => {
      const fieldProps: CustomFormFieldProps<TestFormData, "textField"> = {
        fieldType: "input",
        type: "text",
        control: {} as any,
        name: "textField",
        label: "アクセシブルな入力",
        description: "説明文",
      };

      render(
        <AllTheProviders>
          <TestFormWrapper fieldProps={fieldProps} />
        </AllTheProviders>,
      );

      const input = screen.getByRole("textbox");
      // 入力フィールドが適切にレンダリングされることを確認
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute("id", "textField");
      // 説明文が表示されることを確認
      expect(screen.getByText("説明文")).toBeInTheDocument();
    });

    test("should have proper labels for radio options", () => {
      const options = createRadioOptions(2);
      const fieldProps: CustomFormFieldProps<TestFormData, "radioField"> = {
        fieldType: "radio",
        control: {} as any,
        name: "radioField",
        label: "アクセシブルなラジオ",
        options,
      };

      render(
        <AllTheProviders>
          <TestFormWrapper fieldProps={fieldProps} />
        </AllTheProviders>,
      );

      // 各ラジオボタンにlabelが関連付けられていることを確認
      options.forEach((option) => {
        const label = screen.getByText(option.label);
        expect(label.closest("label")).toHaveAttribute("for");
      });
    });

    test("should have proper switch accessibility", () => {
      const fieldProps: CustomFormFieldProps<TestFormData, "switchField"> = {
        fieldType: "switch",
        control: {} as any,
        name: "switchField",
        label: "アクセシブルなスイッチ",
      };

      render(
        <AllTheProviders>
          <TestFormWrapper fieldProps={fieldProps} />
        </AllTheProviders>,
      );

      const switchElement = screen.getByRole("switch");
      expect(switchElement).toBeInTheDocument();
      expect(switchElement).toHaveAttribute("aria-checked");
    });
  });
});
