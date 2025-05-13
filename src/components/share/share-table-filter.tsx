"use client";

import type { ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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
  filtersArray: Filter[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テーブルのフィルターのコンポーネント
 */
export function ShareTableFilter({ filtersArray }: ShareTableFilterProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テーブルのフィルターのコンポーネント
   */
  return (
    <>
      {filtersArray.map((filter: Filter, index: number) => (
        <div key={index} className="mb-4 flex w-full items-center">
          {filter.filterType === "input" ? (
            <Input
              type="text"
              value={filter.filterText ?? ""}
              onChange={(e: ChangeEvent<HTMLInputElement>) => filter.onFilterChange(e.target.value)}
              placeholder={filter.placeholder ?? "キーワードで絞り込み..."}
              className="w-[50%] border-blue-200 bg-white/80 text-sm focus:border-blue-400 focus:ring-blue-400"
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
    </>
  );
}
