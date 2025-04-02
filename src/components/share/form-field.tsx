import type { Locale } from "date-fns/locale";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { CalendarIcon, Check, ChevronsUpDown } from "lucide-react";
import { type Control, type ControllerRenderProps, type FieldValues, type Path } from "react-hook-form";

import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { FormControl, FormDescription, FormItem, FormLabel, FormMessage, FormField as RHFFormField } from "../ui/form";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";

// 基本型定義
export type RadioOption = {
  value: string | number;
  label: string;
};

export type ComboBoxOption = {
  id: string;
  name: string;
  // valuePropertyとlabelPropertyとして使用されるプロパティは必ずstring型であることを保証
  [key: string]: string | number | boolean | null | undefined;
};

// フィールドタイプに応じた詳細なプロパティ定義
export type FormFieldBaseProps<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  label: string;
  description?: string;
  children?: ReactNode;
};

// 入力フィールドのプロパティ
export type InputFieldProps<T extends FieldValues> = FormFieldBaseProps<T> & {
  type: "text" | "email" | "password" | "number" | "tel" | "url" | "date" | "time" | "datetime-local";
  placeholder?: string;
  min?: number;
  max?: number;
};

// テキストエリアのプロパティ
export type TextareaFieldProps<T extends FieldValues> = FormFieldBaseProps<T> & {
  placeholder?: string;
};

// ラジオグループのプロパティ
export type RadioFieldProps<T extends FieldValues> = FormFieldBaseProps<T> & {
  options: RadioOption[];
  className?: string;
};

// コンボボックスのプロパティ
export type ComboBoxFieldProps<T extends FieldValues> = FormFieldBaseProps<T> & {
  options: ComboBoxOption[];
  open: boolean;
  setOpen: (open: boolean) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  valueProperty?: string;
  labelProperty?: string;
};

// カレンダーフィールドのプロパティ
export type CalendarFieldProps<T extends FieldValues> = FormFieldBaseProps<T> & {
  placeholder?: string;
  buttonText?: string;
  locale?: Locale;
  dateFormat?: string;
};

// Switchフィールドのプロパティ
export type SwitchFieldProps<T extends FieldValues> = FormFieldBaseProps<T> & {
  // Switchフィールド特有のプロパティがあれば追加
};

// 判別共用体を使用した型定義
export type CustomFormFieldProps<T extends FieldValues> =
  | ({ fieldType: "input" } & InputFieldProps<T>)
  | ({ fieldType: "textarea" } & TextareaFieldProps<T>)
  | ({ fieldType: "radio" } & RadioFieldProps<T>)
  | ({ fieldType: "combobox" } & ComboBoxFieldProps<T>)
  | ({ fieldType: "date" } & CalendarFieldProps<T>)
  | ({ fieldType: "switch" } & SwitchFieldProps<T>);

// 共通のフィールドレイアウトコンポーネント
// すべてのフィールドタイプで共通のUIパターンを抽出
function FieldLayout({ label, description, children, extraChildren }: { label: string; description?: string; error?: string; children: ReactNode; extraChildren?: ReactNode }) {
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
}

// 各フィールドタイプのレンダラー関数
function renderInputField<T extends FieldValues>(props: InputFieldProps<T>, field: ControllerRenderProps<T, Path<T>>) {
  return (
    <FieldLayout label={props.label} description={props.description} extraChildren={props.children}>
      <Input
        id={props.name}
        type={props.type}
        placeholder={props.placeholder ?? ""}
        min={props.min}
        max={props.max}
        {...field}
        className="w-full rounded-md border-gray-300 shadow-sm transition-all duration-200 focus:border-blue-500 focus:ring-blue-500"
      />
    </FieldLayout>
  );
}

function renderTextareaField<T extends FieldValues>(props: TextareaFieldProps<T>, field: ControllerRenderProps<T, Path<T>>) {
  return (
    <FieldLayout label={props.label} description={props.description} extraChildren={props.children}>
      <Textarea
        id={props.name}
        placeholder={props.placeholder ?? ""}
        {...field}
        className="min-h-[120px] w-full rounded-md border-gray-300 shadow-sm transition-all duration-200 focus:border-blue-500 focus:ring-blue-500"
      />
    </FieldLayout>
  );
}

function renderRadioField<T extends FieldValues>(props: RadioFieldProps<T>, field: ControllerRenderProps<T, Path<T>>) {
  // オプションの数に基づいて適切なグリッドレイアウトを決定
  let gridClass = "grid-cols-1";
  if (props.options.length >= 3) {
    gridClass = "grid-cols-1 sm:grid-cols-2 md:grid-cols-3";
  } else if (props.options.length === 2) {
    gridClass = "grid-cols-1 sm:grid-cols-2";
  }

  return (
    <FieldLayout label={props.label} description={props.description} extraChildren={props.children}>
      <div className={`grid gap-3 ${props.className ?? gridClass}`}>
        <RadioGroup
          onValueChange={(value) => {
            // 数値の場合は数値型に変換して設定
            const numValue = Number(value);
            field.onChange(!isNaN(numValue) && typeof props.options.find((opt) => String(opt.value) === String(value))?.value === "number" ? numValue : value);
          }}
          defaultValue={String(field.value)}
          className="contents"
        >
          {props.options.map((option) => (
            <div key={option.value} className="relative">
              <RadioGroupItem value={String(option.value)} className="peer absolute opacity-0" id={`${props.name}-${option.value}`} />
              <label
                htmlFor={`${props.name}-${option.value}`}
                className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-sm transition-all peer-checked:border-blue-500 peer-checked:ring-1 peer-checked:ring-blue-500 hover:bg-blue-50"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-gray-300 peer-checked:border-blue-500">
                    <div className={`h-2.5 w-2.5 rounded-full bg-blue-500 ${String(field.value) === String(option.value) ? "opacity-100" : "opacity-0"} transition-opacity`}></div>
                  </div>
                  <span className={`font-medium ${String(field.value) === String(option.value) ? "text-blue-700" : "text-gray-600"}`}>{option.label}</span>
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

function renderComboBoxField<T extends FieldValues>(props: ComboBoxFieldProps<T>, field: ControllerRenderProps<T, Path<T>>) {
  const valueProperty = props.valueProperty ?? "id";
  const labelProperty = props.labelProperty ?? "name";
  const placeholder = props.placeholder ?? "選択してください";
  const searchPlaceholder = props.searchPlaceholder ?? "検索...";
  const emptyMessage = props.emptyMessage ?? "項目が見つかりません";

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
    <FieldLayout label={props.label} description={props.description} extraChildren={props.children}>
      <Popover open={props.open} onOpenChange={props.setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={props.open}
            className={cn("w-full justify-between border-gray-300 transition-all duration-200 hover:border-blue-400", !field.value && "text-muted-foreground")}
            type="button"
          >
            {field.value ? (props.options.find((item) => item[valueProperty] === field.value)?.[labelProperty] ?? placeholder) : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command className="rounded-lg border shadow-md">
            <CommandInput placeholder={searchPlaceholder} className="border-b-0" />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {props.options.map((item) => (
                  <div key={getKey(item, valueProperty)} className="transition-all">
                    <CommandItem
                      key={getKey(item, valueProperty)}
                      value={getStringValue(item, labelProperty)}
                      onSelect={() => {
                        field.onChange(item[valueProperty]);
                        props.setOpen(false);
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

function renderCalendarField<T extends FieldValues>(props: CalendarFieldProps<T>, field: ControllerRenderProps<T, Path<T>>) {
  const placeholder = props.placeholder ?? "日付を選択";
  const buttonText = props.buttonText ?? placeholder;
  const dateFormat = props.dateFormat ?? "yyyy年MM月dd日";
  const locale = props.locale ?? ja;
  const includeTime = dateFormat.includes("HH") || dateFormat.includes("mm") || dateFormat.includes("ss");

  return (
    <FieldLayout label={props.label} description={props.description} extraChildren={props.children}>
      <Popover>
        <PopoverTrigger asChild>
          <div className="transition-all hover:opacity-90">
            <Button variant="outline" className="w-full justify-start border-gray-300 text-left font-normal transition-all duration-200 hover:border-blue-400" type="button">
              <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
              {field.value ? <span className="transition-all">{format(new Date(field.value), dateFormat, { locale })}</span> : buttonText}
            </Button>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="transition-all">
            <Calendar
              mode="single"
              selected={field.value ? new Date(field.value) : undefined}
              onSelect={(date: Date | undefined) => {
                if (date) {
                  // 日付が選択された場合、現在の時間情報を保持
                  const currentValue = field.value ? new Date(field.value) : new Date();
                  date.setHours(currentValue.getHours());
                  date.setMinutes(currentValue.getMinutes());
                  date.setSeconds(currentValue.getSeconds());
                }
                field.onChange(date ?? null);
              }}
              initialFocus
              locale={locale}
              className="rounded-md border shadow-lg"
            />
            {includeTime && (
              <div className="border-t p-3">
                <div className="flex items-center justify-between">
                  <input
                    type="number"
                    min="0"
                    max="23"
                    className="w-16 rounded-md border p-2"
                    placeholder="時"
                    value={field.value ? new Date(field.value).getHours() : 0}
                    onChange={(e) => {
                      const date = new Date(field.value ?? new Date());
                      date.setHours(parseInt(e.target.value) ?? 0);
                      field.onChange(date);
                    }}
                  />
                  <span className="self-center">:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    className="w-16 rounded-md border p-2"
                    placeholder="分"
                    value={field.value ? new Date(field.value).getMinutes() : 0}
                    onChange={(e) => {
                      const date = new Date(field.value ?? new Date());
                      date.setMinutes(parseInt(e.target.value) ?? 0);
                      field.onChange(date);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </FieldLayout>
  );
}

// Switchフィールドレンダリング関数
function renderSwitchField<T extends FieldValues>(props: SwitchFieldProps<T>, field: ControllerRenderProps<T, Path<T>>) {
  return (
    <FieldLayout label={props.label} description={props.description} extraChildren={props.children}>
      <div className="flex items-center">
        <Switch id={props.name} checked={field.value} onCheckedChange={field.onChange} className="focus:ring-blue-500" />
      </div>
    </FieldLayout>
  );
}

// 統合されたフォームフィールドコンポーネント - 名前を変更して衝突を避ける
export function CustomFormField<T extends FieldValues>(props: CustomFormFieldProps<T>) {
  return (
    <RHFFormField
      control={props.control}
      name={props.name}
      render={({ field }) => {
        switch (props.fieldType) {
          case "input":
            return renderInputField<T>(props, field);
          case "textarea":
            return renderTextareaField<T>(props, field);
          case "radio":
            return renderRadioField<T>(props, field);
          case "combobox":
            return renderComboBoxField<T>(props, field);
          case "date":
            return renderCalendarField<T>(props, field);
          case "switch":
            return renderSwitchField<T>(props, field);
          default:
            // この行は型チェックを通すためのもので、正しい型定義であれば実行されません
            const exhaustiveCheck: never = props;
            throw new Error(`未対応のフィールドタイプ: ${String(exhaustiveCheck)}`);
        }
      }}
    />
  );
}

// 便宜上、別名も用意して移行をスムーズにする
export const FormField = CustomFormField;
