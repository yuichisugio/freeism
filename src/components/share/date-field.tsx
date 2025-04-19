/* ---------------------------------------------------------------------------
   DateField.tsx – redesigned calendar field component
   Changes requested 2025‑04‑19
   1. Disable‑past‑date cursor set to “not‑allowed” (+ visual dim)
   2. Keep nav‑arrow alignment by giving calendar table a fixed min‑height
   3. Add manual <input type="date"> under the calendar so the user can
      type / paste a date directly.
   The three changed blocks are wrapped with  // —— CHANGE #n 〈start|end〉 ——  
   so you can quickly diff against the previous file. Only nearby context is
   included outside those blocks.
--------------------------------------------------------------------------- */

"use client";

import type { Locale } from "date-fns";
import type { Control, FieldValues, Path } from "react-hook-form";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { addMonths, format, parseISO, startOfDay, subMonths } from "date-fns";
import { ja } from "date-fns/locale";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useController } from "react-hook-form";

import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import { FormControl, FormDescription, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

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

  // Popover 開閉状態
  const [open, setOpen] = useState(false);
  // 表示月の状態管理
  const [currentMonth, setCurrentMonth] = useState<Date>(value ? new Date(value) : new Date());

  // —— CHANGE #3 start – state for manual input field ——
  const [manualDate, setManualDate] = useState<string>(value ? format(new Date(value), "yyyy-MM-dd") : "");
  // —— CHANGE #3 end ——

  // 今日 (00:00:00)
  const today = startOfDay(new Date());

  const goToPreviousMonth = () => setCurrentMonth((m) => subMonths(m, 1));
  const goToNextMonth = () => setCurrentMonth((m) => addMonths(m, 1));

  return (
    <FormItem className="space-y-2">
      <FormLabel className="text-sm font-medium">{label}</FormLabel>
      {description && <FormDescription className="text-xs text-gray-500">{description}</FormDescription>}
      <FormControl>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              type="button"
              className={cn(
                "w-full justify-start border border-gray-200 bg-white px-4 py-2.5 text-left font-normal shadow-sm transition-all hover:bg-gray-50",
                !value && "text-gray-400",
                "focus:ring-opacity-40 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 text-blue-600" />
              {value ? format(new Date(value), dateFormat, { locale }) : buttonText}
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-auto rounded-lg border border-gray-200 p-0 shadow-xl" align="center">
            <div className="p-4 pb-2">
              <div className="mb-4 flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  onClick={goToPreviousMonth}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>

                <div className="text-base font-semibold text-gray-900">{format(currentMonth, "yyyy年MM月", { locale })}</div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  onClick={goToNextMonth}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>

              <Calendar
                mode="single"
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                selected={value ? new Date(value) : undefined}
                onSelect={(d) => {
                  if (!d) return;
                  d.setHours(0, 0, 0, 0);
                  onChange(d);
                  setManualDate(format(d, "yyyy-MM-dd"));
                  setOpen(false);
                }}
                locale={locale}
                disabled={(date) => (disablePastDates ? date < today : false)}
                initialFocus
                components={{ IconLeft: () => null, IconRight: () => null }}
                modifiersClassNames={{
                  selected: "bg-blue-600 text-white hover:bg-blue-700 cursor-pointer",
                  today: "bg-blue-50 font-bold text-blue-800",
                  // —— CHANGE #1 start – visual & cursor for disabled days ——
                  disabled: "text-gray-300 cursor-not-allowed opacity-50 hover:bg-transparent pointer-events-none line-through",
                  // —— CHANGE #1 end ——
                }}
                classNames={{
                  // —— CHANGE #1 (continued) – cursor‑pointer for active days ——
                  day: "h-10 w-10 p-0 text-center font-normal rounded-md transition-all hover:bg-gray-100 text-sm cursor-pointer",
                  // ——
                  day_selected: "bg-blue-600 text-white hover:bg-blue-700",
                  day_today: "bg-blue-50 text-blue-800 font-medium",
                  day_disabled: "text-gray-300 cursor-not-allowed opacity-50 hover:bg-transparent pointer-events-none line-through",
                  day_outside: "text-gray-300 opacity-50",
                  day_range_middle: "aria-selected:bg-blue-100",
                  day_hidden: "invisible",
                  caption: "hidden",
                  caption_label: "hidden",
                  nav: "hidden",
                  table:
                    // —— CHANGE #2 start – fix calendar height so arrows stay put ——
                    "border-collapse w-full min-h-[290px]",
                  // —— CHANGE #2 end ——
                  head_row: "flex mb-1 justify-between px-1",
                  head_cell: "text-gray-500 w-10 font-medium text-xs h-8",
                  row: "flex w-full my-1 justify-between px-1",
                  cell: "text-center text-sm p-0 relative",
                }}
              />
            </div>

            {/* —— CHANGE #3 start – manual input field under calendar —— */}
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
                    setCurrentMonth(parsed);
                  }
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            {/* —— CHANGE #3 end —— */}

            <div className="flex items-center justify-between rounded-b-lg border-t border-gray-100 bg-gray-50 p-3">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                className="rounded-md px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-800"
                onClick={() => {
                  onChange(today);
                  setManualDate(format(today, "yyyy-MM-dd"));
                  setOpen(false);
                }}
              >
                今日
              </Button>

              {value && (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-800"
                  onClick={() => {
                    onChange(undefined);
                    setManualDate("");
                    setOpen(false);
                  }}
                >
                  クリア
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </FormControl>
      <FormMessage className="mt-1 text-xs text-red-500" />
    </FormItem>
  );
}
