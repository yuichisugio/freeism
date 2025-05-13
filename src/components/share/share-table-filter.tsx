"use client";

import type { ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/table-radio-group";
import { cn } from "@/lib/utils";
import { Maximize, Minimize } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テーブルのフィルター
 */
export type Filter = {
  filterType: "input" | "radio";
  filterText: string;
  onFilterChange: (value: string) => void;
  placeholder: string;
  radioOptions?: { value: string; label: string }[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テーブルのフィルターのprops
 */
export type ShareTableFilterProps = {
  filtersArray: Filter[] | null;
  fullScreenProps: {
    isFullScreen: boolean;
    toggleFullScreen: () => void;
  };
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テーブルのフィルターのコンポーネント
 */
export function ShareTableFilter({ filtersArray, fullScreenProps }: ShareTableFilterProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フルスクリーンモードのprops
   */
  const { isFullScreen, toggleFullScreen } = fullScreenProps;

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
          {filtersArray?.map((filter: Filter, index: number) => (
            <div key={index} className="mb-4 flex items-center">
              {filter.filterType === "input" ? (
                <Input
                  type="text"
                  value={filter.filterText ?? ""}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => filter.onFilterChange(e.target.value)}
                  placeholder={filter.placeholder ?? "キーワードで絞り込み..."}
                  className="w-full border-blue-200 bg-white/80 text-sm focus:border-blue-400 focus:ring-blue-400 md:w-[300px]"
                />
              ) : (
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
        <Button onClick={toggleFullScreen} variant="outline" size="sm" className="mr-3 mb-3 ml-auto items-center self-end">
          {isFullScreen ? <Minimize className="mr-2 h-4 w-4" /> : <Maximize className="mr-2 h-4 w-4" />}
          {isFullScreen ? "通常表示に戻す" : "フルスクリーン"}
        </Button>
      </div>
    </>
  );
}
