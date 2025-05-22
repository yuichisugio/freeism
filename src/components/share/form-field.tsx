"use client";

import type { Locale } from "date-fns/locale";
import type { ReactNode } from "react";
import { memo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { type Control, type ControllerRenderProps, type FieldValues, type Path } from "react-hook-form";

import { Button } from "../ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { FormControl, FormDescription, FormItem, FormLabel, FormMessage, FormField as RHFFormField } from "../ui/form";
import { Input } from "../ui/input";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/share-table-popover";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { DateField } from "./date-field";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Radioグループの型定義
 */
export type RadioOption = {
  value: string | number;
  label: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * コンボボックスの型定義
 */
export type ComboBoxOption = {
  id: string;
  name: string;
  // valuePropertyとlabelPropertyとして使用されるプロパティは必ずstring型であることを保証
  [key: string]: string | number | boolean | null | undefined;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * フィールドタイプに応じた詳細なプロパティ定義
 */
export type FormFieldBaseProps<TFieldValues extends FieldValues, TName extends Path<TFieldValues>> = {
  control: Control<TFieldValues>;
  name: TName;
  label: string;
  description?: string;
  children?: ReactNode;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入力フィールドのプロパティ
 */
export type InputFieldProps<TFieldValues extends FieldValues, TName extends Path<TFieldValues>> = FormFieldBaseProps<TFieldValues, TName> & {
  type: "text" | "email" | "password" | "number" | "tel" | "url" | "date" | "time" | "datetime-local";
  placeholder?: string;
  min?: number;
  max?: number;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テキストエリアのプロパティ
 */
export type TextareaFieldProps<TFieldValues extends FieldValues, TName extends Path<TFieldValues>> = FormFieldBaseProps<TFieldValues, TName> & {
  placeholder?: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ラジオグループのプロパティ
 */
export type RadioFieldProps<TFieldValues extends FieldValues, TName extends Path<TFieldValues>> = FormFieldBaseProps<TFieldValues, TName> & {
  options: RadioOption[];
  className?: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * コンボボックスのプロパティ
 */
export type ComboBoxFieldProps<TFieldValues extends FieldValues, TName extends Path<TFieldValues>> = FormFieldBaseProps<TFieldValues, TName> & {
  options: ComboBoxOption[];
  open: boolean;
  setOpen: (open: boolean) => void;
  container?: HTMLElement | null;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  valueProperty?: string;
  labelProperty?: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * カレンダーフィールドのプロパティ
 */
export type CalendarFieldProps<TFieldValues extends FieldValues, TName extends Path<TFieldValues>> = FormFieldBaseProps<TFieldValues, TName> & {
  placeholder?: string;
  buttonText?: string;
  locale?: Locale;
  dateFormat?: string;
  disablePastDates?: boolean;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Switchフィールドのプロパティ
 */
export type SwitchFieldProps<TFieldValues extends FieldValues, TName extends Path<TFieldValues>> = FormFieldBaseProps<TFieldValues, TName> & {
  // Switchフィールド特有のプロパティがあれば追加
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 判別共用体を使用した型定義
 */
export type CustomFormFieldProps<TFieldValues extends FieldValues, TName extends Path<TFieldValues>> =
  | ({ fieldType: "input" } & InputFieldProps<TFieldValues, TName>)
  | ({ fieldType: "textarea" } & TextareaFieldProps<TFieldValues, TName>)
  | ({ fieldType: "radio" } & RadioFieldProps<TFieldValues, TName>)
  | ({ fieldType: "combobox" } & ComboBoxFieldProps<TFieldValues, TName>)
  | ({ fieldType: "date" } & CalendarFieldProps<TFieldValues, TName>)
  | ({ fieldType: "switch" } & SwitchFieldProps<TFieldValues, TName>);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 共通のフィールドレイアウトコンポーネント
 */
const FieldLayout = memo(function FieldLayout({
  label,
  description,
  children,
  extraChildren,
}: {
  label: string;
  description?: string;
  error?: string;
  children: ReactNode;
  extraChildren?: ReactNode;
}) {
  return (
    <div className="mb-5 transition-all">
      <FormItem className="mb-4">
        <div className="flex flex-col gap-3">
          <FormLabel className="form-label-custom text-base font-medium text-gray-700">{label}</FormLabel>
          <FormControl>
            <div className="transition-all hover:opacity-95">{children}</div>
          </FormControl>
        </div>
        {description && <FormDescription className="form-description-custom mt-2 text-sm text-gray-500">{description}</FormDescription>}
        <div className="mt-2">
          <FormMessage className="form-message-custom text-sm" />
        </div>
        {extraChildren}
      </FormItem>
    </div>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 統合されたフォームフィールドコンポーネント
 */
export function CustomFormField<TFieldValues extends FieldValues, TName extends Path<TFieldValues>>(
  props: CustomFormFieldProps<TFieldValues, TName>,
): JSX.Element {
  // --------------------------------------------------

  // 型安全のために、カスタムフィールドをFieldValuesにキャストする関数を作成
  const handleField = useCallback(
    (field: ControllerRenderProps<TFieldValues, TName>, formProps: CustomFormFieldProps<TFieldValues, TName>) => {
      switch (formProps.fieldType) {
        case "input": {
          return (
            <FieldLayout label={formProps.label} description={formProps.description} extraChildren={formProps.children}>
              <Input
                id={field.name.toString()}
                type={formProps.type}
                placeholder={formProps.placeholder ?? ""}
                min={formProps.min}
                max={formProps.max}
                {...field}
                className="w-full rounded-md border-gray-300 shadow-sm transition-all duration-200 focus:ring-0 focus:outline-none"
              />
            </FieldLayout>
          );
        }
        case "textarea": {
          return (
            <FieldLayout label={formProps.label} description={formProps.description} extraChildren={formProps.children}>
              <Textarea
                id={field.name.toString()}
                placeholder={formProps.placeholder ?? ""}
                {...field}
                className="min-h-[120px] w-full rounded-md border-gray-300 shadow-sm transition-all duration-200 focus:border-blue-500 focus:ring-0 focus:ring-blue-500 focus:outline-none"
              />
            </FieldLayout>
          );
        }
        case "radio": {
          // オプションの数に基づいて適切なグリッドレイアウトを決定
          let gridClass = "grid-cols-1";
          if (formProps.options.length >= 3) {
            gridClass = "grid-cols-1 sm:grid-cols-2 md:grid-cols-3";
          } else if (formProps.options.length === 2) {
            gridClass = "grid-cols-1 sm:grid-cols-2";
          }

          return (
            <FieldLayout label={formProps.label} description={formProps.description} extraChildren={formProps.children}>
              <div className={`grid gap-3 ${formProps.className ?? gridClass}`}>
                <RadioGroup
                  onValueChange={(value) => {
                    // 数値の場合は数値型に変換して設定
                    const numValue = Number(value);
                    field.onChange(
                      !isNaN(numValue) && typeof formProps.options.find((opt: RadioOption) => String(opt.value) === String(value))?.value === "number"
                        ? numValue
                        : value,
                    );
                  }}
                  defaultValue={String(field.value)}
                  className="contents"
                >
                  {formProps.options.map((option: RadioOption) => (
                    <div key={option.value} className="relative">
                      <RadioGroupItem
                        value={String(option.value)}
                        className="peer absolute opacity-0"
                        id={`${field.name.toString()}-${option.value}`}
                      />
                      <label
                        htmlFor={`${field.name.toString()}-${option.value}`}
                        className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-sm transition-all peer-checked:border-blue-500 peer-checked:ring-1 peer-checked:ring-blue-500 hover:bg-blue-50"
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-gray-300 peer-checked:border-blue-500">
                            <div
                              className={`h-2.5 w-2.5 rounded-full bg-blue-500 ${String(field.value) === String(option.value) ? "opacity-100" : "opacity-0"} transition-opacity`}
                            ></div>
                          </div>
                          <span className={`font-medium ${String(field.value) === String(option.value) ? "text-blue-700" : "text-gray-600"}`}>
                            {option.label}
                          </span>
                        </div>
                        {String(field.value) === String(option.value) && (
                          <div className="text-blue-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                        )}
                      </label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </FieldLayout>
          );
        }
        case "combobox": {
          const valueProperty = formProps.valueProperty ?? "id";
          const labelProperty = formProps.labelProperty ?? "name";
          const placeholder = formProps.placeholder ?? "選択してください";
          const searchPlaceholder = formProps.searchPlaceholder ?? "検索...";
          const emptyMessage = formProps.emptyMessage ?? "項目が見つかりません";

          // Keyとして安全な値を取得するヘルパー関数
          const getKey = (item: ComboBoxOption, prop: string): string => {
            const value = item[prop];
            // 文字列または数値の場合は文字列に変換して返す
            return value != null ? String(value) : `item-${Math.random().toString(36).substring(2, 9)}`;
          };

          // 文字列として安全な値を取得するヘルパー関数
          const getStringValue = (item: ComboBoxOption, prop: string): string => {
            const value = item[prop];
            return value != null ? String(value) : "";
          };

          return (
            <FieldLayout label={formProps.label} description={formProps.description} extraChildren={formProps.children}>
              <Popover open={formProps.open} onOpenChange={formProps.setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={formProps.open}
                    className={cn(
                      "w-full justify-between border-gray-300 transition-all duration-200 hover:border-blue-400",
                      !field.value && "text-muted-foreground",
                    )}
                    type="button"
                  >
                    {field.value
                      ? (formProps.options.find((item: ComboBoxOption) => item[valueProperty] === field.value)?.[labelProperty] ?? placeholder)
                      : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start" container={formProps.container}>
                  <Command className="rounded-lg border shadow-md">
                    <CommandInput placeholder={searchPlaceholder} className="border-b-0" />
                    <CommandList>
                      <CommandEmpty>{emptyMessage}</CommandEmpty>
                      <CommandGroup>
                        {formProps.options.map((item: ComboBoxOption) => (
                          <div key={getKey(item, valueProperty)} className="transition-all">
                            <CommandItem
                              key={getKey(item, valueProperty)}
                              value={getStringValue(item, labelProperty)}
                              onSelect={() => {
                                field.onChange(item[valueProperty]);
                                formProps.setOpen(false);
                              }}
                              className="transition-colors duration-150 hover:bg-blue-50"
                            >
                              <div className={item[valueProperty] === field.value ? "opacity-100" : "opacity-0"}>
                                <Check className="mr-2 h-4 w-4 text-blue-500" />
                              </div>
                              {getStringValue(item, labelProperty)}
                            </CommandItem>
                          </div>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </FieldLayout>
          );
        }
        case "date": {
          return <DateField {...formProps} control={props.control} name={props.name} />;
        }
        case "switch": {
          return (
            <FieldLayout label={formProps.label} description={formProps.description} extraChildren={formProps.children}>
              <div className="flex items-center">
                <Switch id={field.name.toString()} checked={field.value} onCheckedChange={field.onChange} className="focus:ring-blue-500" />
              </div>
            </FieldLayout>
          );
        }
        default: {
          // 型チェックのエラーを回避するために単純なメッセージを返す
          throw new Error(`未対応のフィールドタイプが指定されました`);
        }
      }
    },
    [props.control, props.name],
  );

  return (
    <RHFFormField
      control={props.control}
      name={props.name}
      render={({ field }) => {
        // すべてのフィールドレンダリングロジックを一元化した関数を呼び出す
        return handleField(field, props);
      }}
    />
  );
}
