"use client";

import type { Locale } from "date-fns";
import type { Control, FieldValues, Path } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { FormControl, FormDescription, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, startOfDay } from "date-fns";
import { ja } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useController } from "react-hook-form";

export type DateFieldProps<TFieldValues extends FieldValues, TName extends Path<TFieldValues>> = {
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

export function DateField<TFieldValues extends FieldValues, TName extends Path<TFieldValues>>(props: DateFieldProps<TFieldValues, TName>) {
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

  return (
    <FormItem className="space-y-2">
      <FormLabel className="text-sm font-medium">{label}</FormLabel>
      {description && <FormDescription className="text-xs text-gray-500">{description}</FormDescription>}
      <Popover>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start pl-3 text-left font-normal shadow-sm transition-all hover:bg-gray-50",
                !value && "text-muted-foreground",
              )}
              ref={ref} // Pass ref to the button
            >
              {value ? format(new Date(value), dateFormat, { locale }) : <span>{placeholder}</span>}
              <CalendarIcon className="ml-auto size-4 opacity-50" />
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value ? new Date(value) : undefined}
            onSelect={(selectedDate) => {
              if (selectedDate) {
                onChange(selectedDate);
              }
            }}
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
