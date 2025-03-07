import type { Locale } from "date-fns/locale";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
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

// アニメーション定義
const fieldVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.2 },
  },
};

const formMessageVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: {
    opacity: 1,
    height: "auto",
    transition: { duration: 0.2 },
  },
};

// 共通のフィールドレイアウトコンポーネント
// すべてのフィールドタイプで共通のUIパターンを抽出
function FieldLayout({ label, description, children, extraChildren }: { label: string; description?: string; error?: string; children: ReactNode; extraChildren?: ReactNode }) {
  return (
    <motion.div variants={fieldVariants} initial="hidden" animate="visible" exit="exit">
      <FormItem className="mb-4">
        <div className="flex flex-col gap-3">
          <FormLabel className="form-label-custom text-base font-medium text-gray-700">{label}</FormLabel>
          <FormControl>
            <motion.div whileHover={{ scale: 1.01 }} transition={{ duration: 0.2 }}>
              {children}
            </motion.div>
          </FormControl>
        </div>
        {description && <FormDescription className="form-description-custom mt-2 text-sm text-gray-500">{description}</FormDescription>}
        <AnimatePresence>
          <motion.div variants={formMessageVariants} initial="hidden" animate="visible">
            <FormMessage className="form-message-custom mt-2 text-sm" />
          </motion.div>
        </AnimatePresence>
        {extraChildren}
      </FormItem>
    </motion.div>
  );
}

// 各フィールドタイプのレンダラー関数
function renderInputField<T extends FieldValues>(props: InputFieldProps<T>, field: ControllerRenderProps<T, Path<T>>) {
  return (
    <FieldLayout label={props.label} description={props.description} extraChildren={props.children}>
      <Input
        id={props.name}
        type={props.type}
        placeholder={props.placeholder || ""}
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
        placeholder={props.placeholder || ""}
        {...field}
        className="min-h-[120px] w-full rounded-md border-gray-300 shadow-sm transition-all duration-200 focus:border-blue-500 focus:ring-blue-500"
      />
    </FieldLayout>
  );
}

function renderRadioField<T extends FieldValues>(props: RadioFieldProps<T>, field: ControllerRenderProps<T, Path<T>>) {
  return (
    <FieldLayout label={props.label} description={props.description} extraChildren={props.children}>
      <div className="border-input bg-background flex flex-col space-y-1 rounded-md border border-blue-200 px-3 py-2 shadow-sm transition-all duration-200 hover:border-blue-300">
        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className={props.className || "flex flex-col space-y-2"}>
          {props.options.map((option) => (
            <motion.div key={option.value} whileHover={{ x: 3 }} transition={{ duration: 0.2 }}>
              <FormItem key={option.value} className="flex items-center space-y-0 space-x-3">
                <FormControl>
                  <RadioGroupItem value={option.value} className="border-blue-300 text-blue-600 focus:ring-blue-500" />
                </FormControl>
                <FormLabel className="relative flex w-full cursor-pointer items-center font-normal before:absolute before:top-0 before:left-0 before:z-10 before:h-full before:w-full before:content-[''] hover:bg-blue-50">
                  {option.label}
                </FormLabel>
              </FormItem>
            </motion.div>
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
          <motion.div whileTap={{ scale: 0.98 }} transition={{ duration: 0.2 }}>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={props.open}
              className={cn("w-full justify-between border-gray-300 transition-all duration-200 hover:border-blue-400", !field.value && "text-muted-foreground")}
              type="button"
            >
              {field.value ? props.options.find((item) => item[valueProperty] === field.value)?.[labelProperty] || placeholder : placeholder}
              <motion.div animate={{ rotate: props.open ? 180 : 0 }} transition={{ duration: 0.3 }}>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </motion.div>
            </Button>
          </motion.div>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command className="rounded-lg border shadow-md">
            <CommandInput placeholder={searchPlaceholder} className="border-b-0" />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                <AnimatePresence>
                  {props.options.map((item) => (
                    <motion.div key={item[valueProperty]} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                      <CommandItem
                        key={item[valueProperty]}
                        value={item[labelProperty]}
                        onSelect={() => {
                          field.onChange(item[valueProperty]);
                          props.setOpen(false);
                        }}
                        className="transition-colors duration-150 hover:bg-blue-50"
                      >
                        <motion.div
                          animate={{
                            scale: item[valueProperty] === field.value ? 1 : 0.8,
                            opacity: item[valueProperty] === field.value ? 1 : 0,
                          }}
                          transition={{ duration: 0.2 }}
                        >
                          <Check className="mr-2 h-4 w-4 text-blue-500" />
                        </motion.div>
                        {item[labelProperty]}
                      </CommandItem>
                    </motion.div>
                  ))}
                </AnimatePresence>
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
          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.2 }}>
            <Button variant="outline" className="w-full justify-start border-gray-300 text-left font-normal transition-all duration-200 hover:border-blue-400" type="button">
              <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
              {field.value ? (
                <motion.span initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                  {format(new Date(field.value), dateFormat, { locale })}
                </motion.span>
              ) : (
                buttonText
              )}
            </Button>
          </motion.div>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
            <Calendar
              mode="single"
              selected={field.value ? new Date(field.value) : undefined}
              onSelect={(date: Date | undefined) => field.onChange(date || null)}
              initialFocus
              locale={locale}
              className="rounded-md border shadow-lg"
            />
          </motion.div>
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
