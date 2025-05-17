"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";

/**
 * Comboboxの選択肢の型定義
 */
type ComboboxOption = {
  value: string;
  label: string;
};

/**
 * UserComboboxコンポーネントのpropsの型定義
 */
type UserComboboxProps = {
  options: ComboboxOption[];
  value?: string; // 現在選択されている値 (ユーザーID)
  onValueChangeAction: (value: string) => void; // 値が変更されたときのコールバック (選択されたユーザーIDまたは空文字を渡す)
  placeholder?: string; // 値が選択されていないときのプレースホルダー
  searchPlaceholder?: string; // コマンド入力のプレースホルダー
  emptyMessage?: string; // 検索結果がない場合のメッセージ
  open: boolean; // Popoverの開閉状態
  setOpenAction: (open: boolean) => void; // Popoverの開閉状態を変更する関数
};

/**
 * ユーザー選択用のComboboxコンポーネント
 */
export function UserCombobox({
  options,
  value,
  onValueChangeAction,
  placeholder = "選択してください...",
  searchPlaceholder = "検索...",
  emptyMessage = "見つかりません。",
  open,
  setOpenAction,
}: UserComboboxProps): JSX.Element {
  return (
    <Popover open={open} onOpenChange={setOpenAction}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between" // 幅を親要素に合わせる
        >
          {value ? options.find((option) => option.value === value)?.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      {/* Popoverのコンテンツ幅をトリガーの幅に合わせる */}
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value} // ここでの value は検索用及び識別に使われる
                  onSelect={(currentValue) => {
                    // currentValue には CommandItem の value が渡される (この場合は option.value と同じ)
                    // 既に選択されている項目と同じ項目を選択した場合、選択を解除 (空文字を渡す)
                    // そうでない場合は新しい値を選択
                    onValueChangeAction(currentValue === value ? "" : currentValue);
                    setOpenAction(false); // 選択後、Popoverを閉じる
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4", // チェックアイコンとラベルの間にマージン
                      value === option.value ? "opacity-100" : "opacity-0", // 選択されている場合に表示
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
