"use client";

import type { ChangeEvent } from "react";
import { Input } from "@/components/ui/input";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テーブルのフィルターのprops
 */
export type ShareTableFilterProps = {
  filterText: string;
  onFilterChange: (value: string) => void;
  placeholder?: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テーブルのフィルターのコンポーネント
 */
export function ShareTableFilter({ filter }: { filter: ShareTableFilterProps }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルターのprops
   */
  const { filterText, onFilterChange, placeholder = "キーワードで絞り込み..." } = filter;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルターの値が変更されたときの処理
   */
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    onFilterChange(e.target.value);
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テーブルのフィルターのコンポーネント
   */
  return (
    <div className="mb-4 flex w-full max-w-xs items-center">
      <Input
        type="text"
        value={filterText}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full border-blue-200 bg-white/80 text-sm focus:border-blue-400 focus:ring-blue-400"
      />
    </div>
  );
}
