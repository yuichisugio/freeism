"use client";

import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/table-radio-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useShortcut } from "@/hooks/utils/use-shortcut";
import { cn } from "@/lib/utils";
import { HelpCircle, Maximize, Minimize } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テーブルのフィルター
 */
export type Filter = {
  filterType: "input" | "radio";
  filterText: string;
  onFilterChange: (value: string) => void;
  placeholder: string;
  radioOptions: { value: string; label: string }[] | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テーブルのフィルターのprops
 */
export type ShareTableFilterProps = {
  filter: {
    filterContents: Filter[];
    onResetFilters: () => void;
    onResetSort: () => void;
  };
  fullScreenProps: {
    isFullScreen: boolean;
    toggleFullScreen: () => void;
  };
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テーブルのフィルターのコンポーネント
 */
export function ShareTableFilter({ filter, fullScreenProps }: ShareTableFilterProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フルスクリーンモードのprops
   */
  const { isFullScreen, toggleFullScreen } = fullScreenProps;

  /**
   * フィルターのprops
   */
  const { filterContents, onResetFilters, onResetSort } = filter;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ショートカットキーの設定
   * n+alt+ctrlで通知モーダーを開く
   */
  useShortcut([
    {
      code: "KeyF",
      alt: true,
      callback: () => toggleFullScreen(),
      preventDefault: true,
    },
  ]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * inputタイプフィルターの値を一時的に保持するstate
   */
  // inputタイプフィルターの値を一時的に保持するstate
  const [inputFilterValues, setInputFilterValues] = useState<Record<number, string>>({});

  // filtersArrayが変更された場合、または初回レンダリング時にinputFilterValuesを初期化
  useEffect(() => {
    if (filterContents) {
      const initialInputValues: Record<number, string> = {};
      filterContents.forEach((filter, index) => {
        if (filter.filterType === "input") {
          initialInputValues[index] = filter.filterText ?? "";
        }
      });
      setInputFilterValues(initialInputValues);
    }
  }, [filterContents]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * inputタイプフィルターの値を変更する
   */
  const handleInputChange = (index: number, value: string) => {
    setInputFilterValues((prev) => ({ ...prev, [index]: value }));
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * inputタイプフィルターの値を適応する
   */
  const handleApplyFilter = (index: number, onFilterChangeCallback: (value: string) => void) => {
    if (inputFilterValues[index] !== undefined) {
      onFilterChangeCallback(inputFilterValues[index]);
    }
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テーブルのフィルターのコンポーネント
   */
  return (
    <>
      {/* フィルターとフルスクリーンボタンを横並びにするためのコンテナ */}
      <div className={cn("flex items-start justify-between", !isFullScreen && "mb-2", isFullScreen && "mt-3 ml-3")}>
        {/* フィルター群 */}
        <div className="flex flex-col">
          {filterContents?.map((filter: Filter, index: number) => (
            <div key={index} className="mb-4 flex items-start">
              {/* inputタイプフィルター */}
              {filter.filterType === "input" ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={inputFilterValues[index] ?? ""}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange(index, e.target.value)}
                    placeholder={filter.placeholder ?? "キーワードで絞り込み..."}
                    className="focus:none w-full border-blue-200 bg-white/80 text-sm md:w-[300px]"
                  />
                  <Button
                    onClick={() => handleApplyFilter(index, filter.onFilterChange)}
                    size="sm"
                    className="w-15 bg-blue-500 text-white hover:bg-blue-600"
                  >
                    適応
                  </Button>
                </div>
              ) : (
                // radioタイプフィルター
                filter.filterType === "radio" &&
                filter.radioOptions && (
                  <RadioGroup
                    defaultValue={filter.filterText}
                    onValueChange={(value: string) => filter.onFilterChange(value)}
                    className="flex items-center space-x-4"
                  >
                    {filter.radioOptions.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={option.value} id={`${filter.placeholder}-${option.value}-${index}`} />
                        <Label htmlFor={`${filter.placeholder}-${option.value}-${index}`}>{option.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                )
              )}
            </div>
          ))}
        </div>

        {/* フルスクリーンボタン */}
        <div className="mb-3 flex items-center gap-2 self-end">
          {onResetFilters && (
            <Button onClick={onResetFilters} variant="outline" size="sm" className={cn(isFullScreen && "mr-1")}>
              フィルターリセット
            </Button>
          )}
          {onResetSort && (
            <Button onClick={onResetSort} variant="outline" size="sm" className={cn(isFullScreen && "mr-1")}>
              ソートリセット
            </Button>
          )}
          <Button onClick={toggleFullScreen} variant="outline" size="sm" className={cn("ml-auto", isFullScreen && "mr-3")}>
            {isFullScreen ? <Minimize className="mr-2 h-4 w-4" /> : <Maximize className="mr-2 h-4 w-4" />}
            {isFullScreen ? "通常表示に戻す" : "フルスクリーン"}
          </Button>
          {/* フルスクリーンモードではツールチップが表示できないので表示しない */}
          {!isFullScreen && <TableToolTips />}
        </div>
      </div>
    </>
  );
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テーブルのフィルターのツールチップ
 * fullScreen時にToolTipが表示されないのは、FullScreen APIの仕様。回避できるが一旦は行わない
 */
export function TableToolTips() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50"
          aria-label="通知コマンドのヘルプ"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-left text-xs">
          <p className="mb-1 font-semibold">キーボードショートカット</p>
          <ul className="list-inside list-disc">
            <li>
              <kbd className="rounded border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-xs text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                Option
              </kbd>{" "}
              +{" "}
              <kbd className="rounded border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-xs text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                F
              </kbd>{" "}
              : フルスクリーンモードにする
            </li>
          </ul>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
