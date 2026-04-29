"use client";

import type { Locale } from "date-fns";
import type { Control, FieldValues, Path } from "react-hook-form";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { FormControl, FormDescription, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, isValid, parse, startOfDay } from "date-fns";
import { ja } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useController } from "react-hook-form";

type DateFieldProps<TFieldValues extends FieldValues, TName extends Path<TFieldValues>> = {
  control: Control<TFieldValues>;
  name: TName;
  label: string;
  description?: string;
  placeholder?: string;
  locale?: Locale;
  dateFormat?: string;
  disablePastDates?: boolean;
  disabledDates?: (date: Date) => boolean; // Specific disabled dates function
  showTimeInput?: boolean; // Option to show time input
};

export function DateField<TFieldValues extends FieldValues, TName extends Path<TFieldValues>>(
  props: DateFieldProps<TFieldValues, TName>,
) {
  const {
    control,
    name,
    label,
    description,
    placeholder = "日付を選択",
    locale = ja,
    dateFormat = "yyyy年MM月dd日",
    disablePastDates = true,
    disabledDates,
  } = props;

  const {
    field: { value, onChange, ref },
  } = useController({ control, name });

  // Popoverの開閉状態を管理
  const [open, setOpen] = useState(false);
  // 入力フィールドの値を管理（直接入力用）
  const [inputValue, setInputValue] = useState(() => {
    return value ? format(new Date(value), dateFormat, { locale }) : "";
  });

  // 今日 (00:00:00)
  const today = startOfDay(new Date());

  const defaultDisabledMatcher = (date: Date) => {
    if (disablePastDates && date < today) {
      return true;
    }
    return false;
  };

  const combinedDisabledMatcher = (date: Date) => {
    return defaultDisabledMatcher(date) || (disabledDates ? disabledDates(date) : false);
  };

  // 入力値を解析して日付に変換する関数
  const parseInputValue = (inputString: string): Date | null => {
    if (!inputString.trim()) return null;

    // 複数の日付フォーマットを試行
    const formats = ["yyyy年MM月dd日", "yyyy/MM/dd", "yyyy-MM-dd", "MM/dd/yyyy", "dd/MM/yyyy"];

    for (const formatString of formats) {
      try {
        const parsedDate = parse(inputString, formatString, new Date(), { locale });
        if (isValid(parsedDate)) {
          return parsedDate;
        }
      } catch {
        // 次のフォーマットを試行
        continue;
      }
    }
    return null;
  };

  // 入力フィールドの変更ハンドラー
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputString = e.target.value;
    setInputValue(inputString);

    // 入力値を解析して有効な日付の場合はフォームに反映
    const parsedDate = parseInputValue(inputString);
    if (parsedDate && isValid(parsedDate)) {
      onChange(parsedDate);
    }
  };

  // 入力フィールドのBlurハンドラー
  const handleInputBlur = () => {
    const parsedDate = parseInputValue(inputValue);
    if (parsedDate && isValid(parsedDate)) {
      // 有効な日付の場合、フォーマットして表示
      const formattedDate = format(parsedDate, dateFormat, { locale });
      setInputValue(formattedDate);
      onChange(parsedDate);
    } else if (value) {
      // 無効な入力の場合、元の値に戻す
      setInputValue(format(new Date(value), dateFormat, { locale }));
    } else {
      // 値がない場合は空にする
      setInputValue("");
    }
  };

  // カレンダーで日付が選択されたときのハンドラー
  const handleCalendarSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      onChange(selectedDate);
      setInputValue(format(selectedDate, dateFormat, { locale }));
      setOpen(false);
    }
  };

  return (
    <FormItem className="space-y-2">
      <FormLabel className="text-sm font-medium">{label}</FormLabel>
      {description && <FormDescription className="text-xs text-gray-500">{description}</FormDescription>}
      <Popover open={open} onOpenChange={setOpen}>
        <div className="relative flex">
          <FormControl>
            <Input
              ref={ref}
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              placeholder={placeholder}
              className={cn(
                "w-full rounded-md border-gray-300 pr-10 shadow-sm transition-all hover:bg-gray-50",
                !value && "text-muted-foreground",
              )}
            />
          </FormControl>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-0 right-0 h-full px-3 hover:bg-transparent"
              onClick={() => setOpen(!open)}
            >
              <CalendarIcon className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
        </div>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value ? new Date(value) : undefined}
            onSelect={handleCalendarSelect}
            disabled={combinedDisabledMatcher}
            initialFocus
            locale={locale}
          />
        </PopoverContent>
      </Popover>
      <FormMessage className="mt-1 text-xs text-red-500" />
    </FormItem>
  );
}
