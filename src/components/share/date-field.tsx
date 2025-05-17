"use client";

import type { Locale } from "date-fns";
import type { Control, FieldValues, Path } from "react-hook-form";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { format, parseISO, startOfDay } from "date-fns";
import { ja } from "date-fns/locale";
import { useController } from "react-hook-form";

import { FormControl, FormDescription, FormItem, FormLabel, FormMessage } from "../ui/form";

export type DateFieldProps<TFieldValues extends FieldValues, TName extends Path<TFieldValues>> = {
  control: Control<TFieldValues>;
  name: TName;
  label: string;
  description?: string;
  placeholder?: string;
  buttonText?: string;
  locale?: Locale;
  dateFormat?: string;
  disablePastDates?: boolean;
};

export function DateField<TFieldValues extends FieldValues, TName extends Path<TFieldValues>>(props: DateFieldProps<TFieldValues, TName>) {
  const {
    control,
    name,
    label,
    description,
    placeholder = "日付を選択",
    buttonText = placeholder,
    locale = ja,
    dateFormat = "yyyy年MM月dd日",
    disablePastDates = true,
  } = props;

  const {
    field: { value, onChange },
  } = useController({ control, name });

  const [manualDate, setManualDate] = useState<string>(value ? format(new Date(value), "yyyy-MM-dd") : "");

  // 今日 (00:00:00)
  const today = startOfDay(new Date());

  return (
    <FormItem className="space-y-2">
      <FormLabel className="text-sm font-medium">{label}</FormLabel>
      {description && <FormDescription className="text-xs text-gray-500">{description}</FormDescription>}
      <FormControl>
        <div className="px-4 pt-1 pb-2">
          <input
            type="date"
            value={manualDate}
            min={disablePastDates ? format(today, "yyyy-MM-dd") : undefined}
            onChange={(e) => {
              setManualDate(e.target.value);
              const parsed = parseISO(e.target.value);
              if (!isNaN(parsed.getTime())) {
                onChange(parsed);
              }
            }}
            className={cn(
              "w-full justify-start border border-gray-200 bg-white px-4 py-2.5 text-left font-normal shadow-sm transition-all hover:bg-gray-50",
              "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none",
            )}
          />
        </div>
      </FormControl>
      <FormMessage className="mt-1 text-xs text-red-500" />
    </FormItem>
  );
}
