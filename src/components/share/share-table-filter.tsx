"use client";

import type { ChangeEvent } from "react";
import { Input } from "@/components/ui/input";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テーブルのフィルター
 */
export type Filter = {
  filterText: string;
  onFilterChange: (value: string) => void;
  placeholder: string;
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
        <div key={index} className="mb-4 flex w-full max-w-xs items-center">
          <Input
            type="text"
            value={filter.filterText}
            onChange={(e: ChangeEvent<HTMLInputElement>) => filter.onFilterChange(e.target.value)}
            placeholder={filter.placeholder ?? "キーワードで絞り込み..."}
            className="w-full border-blue-200 bg-white/80 text-sm focus:border-blue-400 focus:ring-blue-400"
          />
        </div>
      ))}
    </>
  );
}
