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
import { Textarea } from "../ui/textarea";

// 基本型定義
export type RadioOption = {
  value: string;
  label: string;
};

export type ComboBoxOption = {
  id: string;
  name: string;
  [key: string]: any;
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

// 判別共用体を使用した型定義
export type CustomFormFieldProps<T extends FieldValues> =
  | ({ fieldType: "input" } & InputFieldProps<T>)
  | ({ fieldType: "textarea" } & TextareaFieldProps<T>)
  | ({ fieldType: "radio" } & RadioFieldProps<T>)
  | ({ fieldType: "combobox" } & ComboBoxFieldProps<T>)
  | ({ fieldType: "date" } & CalendarFieldProps<T>);

// 共通のフィールドレイアウトコンポーネント
// すべてのフィールドタイプで共通のUIパターンを抽出
function FieldLayout({
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
    <FormItem>
      <div className="flex flex-col gap-3">
        <FormLabel className="form-label-custom">{label}</FormLabel>
        <FormControl>{children}</FormControl>
      </div>
      {description && <FormDescription className="form-description-custom">{description}</FormDescription>}
      <FormMessage className="form-message-custom" />
      {extraChildren}
    </FormItem>
  );
}

// 各フィールドタイプのレンダラー関数
function renderInputField<T extends FieldValues>(props: InputFieldProps<T>, field: ControllerRenderProps<T, Path<T>>) {
  return (
    <FieldLayout label={props.label} description={props.description} extraChildren={props.children}>
      <Input id={props.name} type={props.type} placeholder={props.placeholder || ""} {...field} />
    </FieldLayout>
  );
}

function renderTextareaField<T extends FieldValues>(props: TextareaFieldProps<T>, field: ControllerRenderProps<T, Path<T>>) {
  return (
    <FieldLayout label={props.label} description={props.description} extraChildren={props.children}>
      <Textarea id={props.name} placeholder={props.placeholder || ""} {...field} />
    </FieldLayout>
  );
}

function renderRadioField<T extends FieldValues>(props: RadioFieldProps<T>, field: ControllerRenderProps<T, Path<T>>) {
  return (
    <FieldLayout label={props.label} description={props.description} extraChildren={props.children}>
      <div className="border-input bg-background flex flex-col space-y-1 rounded-md border border-blue-200 px-3 py-2">
        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className={props.className || "flex flex-col space-y-1"}>
          {props.options.map((option) => (
            <FormItem key={option.value} className="flex items-center space-y-0 space-x-3">
              <FormControl>
                <RadioGroupItem value={option.value} className="border-blue-200" />
              </FormControl>
              <FormLabel className="font-normal">{option.label}</FormLabel>
            </FormItem>
          ))}
        </RadioGroup>
      </div>
    </FieldLayout>
  );
}

function renderComboBoxField<T extends FieldValues>(props: ComboBoxFieldProps<T>, field: ControllerRenderProps<T, Path<T>>) {
  const valueProperty = props.valueProperty || "id";
  const labelProperty = props.labelProperty || "name";
  const placeholder = props.placeholder || "選択してください";
  const searchPlaceholder = props.searchPlaceholder || "検索...";
  const emptyMessage = props.emptyMessage || "項目が見つかりません";

  return (
    <FieldLayout label={props.label} description={props.description} extraChildren={props.children}>
      <Popover open={props.open} onOpenChange={props.setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={props.open}
            className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
            type="button"
          >
            {field.value ? props.options.find((item) => item[valueProperty] === field.value)?.[labelProperty] || placeholder : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {props.options.map((item) => (
                  <CommandItem
                    key={item[valueProperty]}
                    value={item[labelProperty]}
                    onSelect={() => {
                      field.onChange(item[valueProperty]);
                      props.setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", item[valueProperty] === field.value ? "opacity-100" : "opacity-0")} />
                    {item[labelProperty]}
                  </CommandItem>
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
  const placeholder = props.placeholder || "日付を選択";
  const buttonText = props.buttonText || placeholder;
  const dateFormat = props.dateFormat || "yyyy年MM月dd日";
  const locale = props.locale || ja;

  return (
    <FieldLayout label={props.label} description={props.description} extraChildren={props.children}>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start text-left font-normal" type="button">
            <CalendarIcon className="mr-2 h-4 w-4" />
            {field.value ? format(new Date(field.value), dateFormat, { locale }) : buttonText}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={field.value ? new Date(field.value) : undefined}
            onSelect={(date: Date | undefined) => field.onChange(date || null)}
            initialFocus
            locale={locale}
          />
        </PopoverContent>
      </Popover>
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
          default:
            // この行は型チェックを通すためのもので、正しい型定義であれば実行されません
            const exhaustiveCheck: never = props;
            throw new Error(`未対応のフィールドタイプ: ${exhaustiveCheck}`);
        }
      }}
    />
  );
}

// 便宜上、別名も用意して移行をスムーズにする
export const FormField = CustomFormField;
