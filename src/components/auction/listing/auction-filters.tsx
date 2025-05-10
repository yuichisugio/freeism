"use client";

import type { AuctionSortField } from "@/types/auction-types";
import type { ReactNode } from "react";
import { memo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { useAuctionFilters } from "@/hooks/auction/listing/use-auction-filters";
import { cn } from "@/lib/utils";
import { type AuctionFiltersProps, type AuctionFilterTypes } from "@/types/auction-types";
import {
  ArrowDown,
  ArrowDownCircle,
  ArrowUp,
  BarChart4,
  Calendar,
  Check,
  ChevronsUpDown,
  Clock,
  EyeIcon,
  Filter,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TimerIcon,
  X,
} from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ソートオプション設定
 */
const sortOptions = [
  { value: "relevance", label: "関連度順", icon: <Sparkles className="h-4 w-4" /> },
  { value: "newest", label: "新着順", icon: <Sparkles className="h-4 w-4" /> },
  { value: "time_remaining", label: "終了時間順", icon: <Clock className="h-4 w-4" /> },
  { value: "price", label: "入札額", icon: <ArrowDownCircle className="h-4 w-4" /> },
  { value: "bids", label: "入札数順", icon: <BarChart4 className="h-4 w-4" /> },
];

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ステータスオプション設定
 */
const statusOptions = [
  { value: "all", label: "すべて", icon: <EyeIcon className="h-4 w-4" /> },
  { value: "watchlist", label: "ウォッチリスト", icon: <ShieldCheck className="h-4 w-4" /> },
  { value: "not_bidded", label: "未入札", icon: <ShieldAlert className="h-4 w-4" /> },
  { value: "bidded", label: "入札済み", icon: <Check className="h-4 w-4" /> },
  { value: "not_ended", label: "終了済み以外", icon: <TimerIcon className="h-4 w-4" /> },
  { value: "ended", label: "終了済み", icon: <Calendar className="h-4 w-4" /> },
  { value: "not_started", label: "未開始", icon: <Clock className="h-4 w-4" /> },
  { value: "started", label: "開始済み", icon: <Clock className="h-4 w-4" /> },
];

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 残り時間のプリセット
 */
const timePresets = [
  { label: "1時間以内", start: 0, end: 1 },
  { label: "24時間以内", start: 0, end: 24 },
  { label: "3日以内", start: 0, end: 72 },
  { label: "1週間以内", start: 0, end: 168 },
  { label: "2週間以内", start: 0, end: 336 },
  { label: "1ヶ月以内", start: 0, end: 720 },
  { label: "3ヶ月以内", start: 0, end: 2160 },
  { label: "すべて", start: 0, end: 100000 },
];

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 価格のプリセット
 */
const pricePresets = [
  { label: "500P以下", start: 0, end: 500 },
  { label: "1000P以下", start: 0, end: 1000 },
  { label: "5000P以下", start: 0, end: 5000 },
  { label: "10000P以下", start: 0, end: 10000 },
  { label: "50000P以下", start: 0, end: 50000 },
  { label: "100000P以下", start: 0, end: 100000 },
  { label: "すべて", start: 0, end: 100000000 },
];

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 共通フィルターセクションコンポーネント
 */
type FilterSectionProps = {
  title: string;
  bgColor: string;
  textColor: string;
  children: ReactNode;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * フィルターセクションコンポーネント
 */
function FilterSection({ title, bgColor, textColor, children }: FilterSectionProps): JSX.Element {
  return (
    <Card className="overflow-hidden border shadow-sm">
      <CardHeader className={`${bgColor} p-3`}>
        <CardTitle className={`text-sm font-medium ${textColor}`}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-3">{children}</CardContent>
    </Card>
  );
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * プリセットボタングリッドコンポーネント
 */
type PresetButtonsProps = {
  presets: Array<{ label: string; start: number; end: number }>;
  onSelectPreset: (min: number, max: number) => void;
  cols: number;
  hoverColors: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * プリセットボタングリッドコンポーネント
 */
const PresetButtons = memo(function PresetButtons({ presets, onSelectPreset, cols, hoverColors }: PresetButtonsProps): JSX.Element {
  return (
    <div className={`grid grid-cols-${cols} gap-2`}>
      {presets.map((preset) => (
        <Button
          key={preset.label}
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onSelectPreset(preset.start, preset.end)}
          className={`text-xs ${hoverColors}`}
        >
          {preset.label}
        </Button>
      ))}
    </div>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 数値範囲入力フィールドコンポーネント
 */
type RangeInputFieldsProps = {
  minValue: number | null;
  maxValue: number | null;
  defaultMaxValue: number;
  onRangeChange: (range: [number, number]) => void;
  minLabel: string;
  maxLabel: string;
  step: number;
  focusColors: string;
  isPrice?: boolean;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 数値範囲入力フィールドコンポーネント
 */
const RangeInputFields = memo(function RangeInputFields({
  minValue,
  maxValue,
  defaultMaxValue,
  onRangeChange,
  minLabel,
  maxLabel,
  step,
  focusColors,
  isPrice = false,
}: RangeInputFieldsProps): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label htmlFor={`min-${isPrice ? "price" : "time"}`} className="mb-1 block text-xs text-gray-500">
          {minLabel}
        </label>
        {isPrice ? (
          <input
            id="min-price"
            type="number"
            min={0}
            max={(maxValue ?? defaultMaxValue) - step}
            value={minValue ?? 0}
            onChange={(e) => {
              const value = Math.max(0, Math.min((maxValue ?? defaultMaxValue) - step, parseInt(e.target.value) || 0));
              onRangeChange([value, maxValue ?? defaultMaxValue]);
            }}
            className={`border-input bg-background h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus:${focusColors} focus:outline-none`}
          />
        ) : (
          <select
            id="min-time"
            value={minValue ?? 0}
            onChange={(e) => {
              const value = Math.min(parseInt(e.target.value), (maxValue ?? defaultMaxValue) - 1);
              onRangeChange([value, maxValue ?? defaultMaxValue]);
            }}
            className={`border-input bg-background w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors focus:${focusColors} focus:outline-none`}
          >
            {timePresets.map((preset) => (
              <option key={preset.label} value={preset.start}>
                {preset.label}
              </option>
            ))}
          </select>
        )}
      </div>
      <div>
        <label htmlFor={`max-${isPrice ? "price" : "time"}`} className="mb-1 block text-xs text-gray-500">
          {maxLabel}
        </label>
        {isPrice ? (
          <input
            id="max-price"
            type="number"
            min={(minValue ?? 0) + step}
            max={10000}
            value={maxValue ?? defaultMaxValue}
            onChange={(e) => {
              const value = Math.max((minValue ?? 0) + step, Math.min(10000, parseInt(e.target.value) || 0));
              onRangeChange([minValue ?? 0, value]);
            }}
            className={`border-input bg-background h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus:${focusColors} focus:outline-none`}
          />
        ) : (
          <select
            id="max-time"
            value={maxValue ?? defaultMaxValue}
            onChange={(e) => {
              const value = Math.max((minValue ?? 0) + 1, parseInt(e.target.value));
              onRangeChange([minValue ?? 0, value]);
            }}
            className={`border-input bg-background w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors focus:${focusColors} focus:outline-none`}
          >
            {timePresets.map((preset) => (
              <option key={preset.label} value={preset.start}>
                {preset.label}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションフィルターコンポーネント
 * @param listingsConditions フィルター
 * @param setListingsConditions フィルター変更アクション
 */
export const AuctionFilters = memo(function AuctionFilters({ listingsConditions, setListingsConditionsAction }: AuctionFiltersProps): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * カスタムフックからロジックを取得
   */
  const {
    // state
    showFilters,
    activeFilterCount,
    openGroupCombobox,
    changingSearchQuery,
    draftConditions,
    categoriesList,
    areAllGroupsSelected,
    joinTypeinedGroupList,

    // action
    setChangingSearchQuery,
    setOpenGroupCombobox,
    handleCategorySelect,
    handleStatusSelect,
    handleStatusJoinTypeChange,
    handleGroupSelect,
    handlePriceRangeChange,
    handlePriceRangeApply,
    handleTimeRangeChange,
    handleTimeRangeApply,
    toggleFilterDisplay,
    setPricePreset,
    setTimePreset,
    handleSortChange,
    handleSortDirectionToggle,
    handleResetAllFilters,
    handleSearchQueryEnter,
    applyAllFilters,

    // サジェスト
    suggestions,
    highlightedIndex,
    selectSuggestion,
    handleKeyDown,
    closeSuggestions,

    // utilities
    formatTimeDisplay,
    isCategorySelected,
    isStatusSelected,
    isGroupSelected,
    getSortField,
    getSortDirection,
  } = useAuctionFilters({
    listingsConditions,
    setListingsConditionsAction,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Ref の定義
   */
  // 検索バーとサジェスト全体を囲むコンテナ用
  const searchContainerRef = useRef<HTMLDivElement>(null);
  // サジェストリスト(ul)用
  const suggestionListRef = useRef<HTMLUListElement>(null);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * サジェスト外クリックで閉じる処理
   */
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // searchContainerRef が存在し、クリックされた要素が searchContainer の外側にある場合
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        closeSuggestions(); // サジェストを閉じる
      }
    }
    // イベントリスナーを登録
    document.addEventListener("mousedown", handleClickOutside);
    // クリーンアップ関数
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [closeSuggestions]); // closeSuggestions が変更された場合のみ再登録

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 矢印キーでのスクロール処理
   */
  useEffect(() => {
    // highlightedIndex が有効な値で、サジェストリストの ref が存在する場合
    if (highlightedIndex >= 0 && suggestionListRef.current) {
      // ハイライトされている li 要素を取得
      const highlightedItem = suggestionListRef.current.querySelector(`#suggestion-item-${highlightedIndex}`);
      // 要素が存在すれば、その要素が表示されるようにスクロール
      if (highlightedItem) {
        highlightedItem.scrollIntoView({
          block: "nearest", // 要素全体が画面内に入るように、または最も近い境界にスクロール
          inline: "nearest",
        });
      }
    }
  }, [highlightedIndex]); // highlightedIndex が変更された時に実行

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="mb-4 w-full">
      {/* 検索バーとサジェスト */}
      <div className="relative mb-4 w-full" ref={searchContainerRef}>
        {/* 検索欄 */}
        <form
          className="focus-within:ring-opacity-50 flex w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-200 dark:border-gray-700 dark:bg-gray-800"
          onSubmit={(e) => {
            e.preventDefault();
            if (highlightedIndex === -1) {
              handleSearchQueryEnter(changingSearchQuery ?? "");
            } else if (suggestions[highlightedIndex]) {
              // Enterキーでハイライトされたサジェストを選択する処理は handleKeyDown で行うため、ここでは何もしないか、必要であれば handleKeyDown と重複しないように調整
              selectSuggestion(suggestions[highlightedIndex].text);
            } else {
              handleSearchQueryEnter(changingSearchQuery ?? "");
            }
          }}
        >
          <input
            type="search"
            placeholder="商品名や説明文で検索..."
            value={changingSearchQuery ?? ""}
            onChange={(e) => setChangingSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 rounded-l-lg border-0 bg-transparent px-4 py-2.5 text-gray-900 placeholder-gray-500 focus:ring-0 focus:outline-none dark:text-gray-100 dark:placeholder-gray-400"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={suggestions.length > 0}
            aria-controls="suggestions-list"
            aria-activedescendant={highlightedIndex >= 0 ? `suggestion-item-${highlightedIndex}` : undefined}
          />
          <Button
            type="submit"
            variant="ghost"
            className="focus:ring-opacity-50 h-auto rounded-l-none rounded-r-lg border-0 bg-blue-500 px-5 text-white hover:bg-blue-600 focus:ring-2 focus:ring-blue-300 focus:outline-none"
          >
            検索
          </Button>
        </form>

        {/* サジェストリスト */}
        {changingSearchQuery && changingSearchQuery.trim() !== "" && suggestions && suggestions.length > 0 && (
          <ul
            id="suggestions-list" // アクセシビリティ向上のため追加推奨
            className="ring-opacity-5 absolute z-50 mt-1.5 max-h-72 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 text-base shadow-lg ring-1 ring-black focus:outline-none sm:text-sm dark:border-gray-600 dark:bg-gray-800"
            role="listbox" // アクセシビリティ向上のため追加推奨
            ref={suggestionListRef}
          >
            {suggestions.map(
              (
                suggestion,
                index, // index を受け取る
              ) => (
                <li
                  key={suggestion.id}
                  id={`suggestion-item-${index}`} // アクセシビリティ向上のため追加推奨
                  role="option" // アクセシビリティ向上のため追加推奨
                  aria-selected={index === highlightedIndex} // アクセシビリティ向上のため追加推奨
                  className={cn(
                    "relative cursor-pointer px-4 py-2 text-gray-900 transition-colors duration-100 ease-in-out select-none dark:text-gray-100",
                    index === highlightedIndex
                      ? "bg-blue-100 dark:bg-blue-900" // ハイライト時のスタイル
                      : "hover:bg-gray-100 dark:hover:bg-gray-700", // ホバー時のスタイル
                  )}
                  // マウス操作でも選択できるように onClick を維持
                  onClick={() => selectSuggestion(suggestion.text)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault(); // デフォルトの動作（スペースでのスクロールなど）を防止
                      selectSuggestion(suggestion.text);
                    }
                  }}
                >
                  {/* button要素は不要になったため削除し、li要素に直接スタイルとイベントを適用 */}
                  <span dangerouslySetInnerHTML={{ __html: suggestion.highlighted }} />
                </li>
              ),
            )}
          </ul>
        )}
      </div>

      {/* カテゴリタブ */}
      <ScrollArea className="relative w-full pb-3 whitespace-nowrap">
        <div className="mx-2 mb-4 flex space-x-1 sm:mx-0 sm:space-x-2">
          {categoriesList && categoriesList.length > 0 ? (
            categoriesList.map((category: string) => (
              <button
                key={category}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors duration-150 sm:px-4 sm:py-2",
                  isCategorySelected(category)
                    ? "bg-blue-500 text-white shadow-sm"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600",
                )}
                onClick={() => handleCategorySelect(category)}
              >
                {category}
              </button>
            ))
          ) : (
            <div className="text-red-500">カテゴリが読み込まれていません</div>
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <div className="mb-4 flex items-center justify-between gap-2">
        {/* フィルターボタン */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFilterDisplay}
            className={cn(
              "flex items-center gap-2 rounded-md border",
              showFilters ? "border-blue-300 bg-blue-50 text-blue-600" : "hover:border-gray-300 hover:bg-gray-50",
            )}
          >
            <Filter className="h-4 w-4" />
            <span>並び替え・フィルター</span>
            {activeFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600">
                {activeFilterCount}
              </span>
            )}
          </Button>

          {/* フィルターリセットボタン */}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                handleResetAllFilters();
              }}
              className="rounded-md text-red-500 hover:bg-red-50 hover:text-red-600"
            >
              <X className="mr-1 h-4 w-4" />
              リセット
            </Button>
          )}
        </div>

        {/* フィルター適用ボタン */}
        <Button variant="default" size="sm" onClick={applyAllFilters} className="rounded-md bg-blue-600 text-white hover:bg-blue-700">
          フィルターを適用
        </Button>
      </div>

      {/* フィルターパネル */}
      {showFilters && (
        <Card className="mt-2 border bg-white shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-lg font-medium">フィルター設定</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ScrollArea className="h-[80vh] pr-4">
              <div className="space-y-6">
                {/* ソートセクション */}
                <FilterSection title="並び替え" bgColor="bg-blue-50" textColor="text-blue-800">
                  <div className="mb-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium">並び順</span>
                    </div>
                    <div className="flex w-full rounded-md border border-blue-200 p-1">
                      <button
                        type="button"
                        onClick={() => handleSortDirectionToggle()}
                        className={`flex flex-1 items-center justify-center gap-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-all ${
                          getSortDirection() === "asc" ? "bg-blue-100 text-gray-900 shadow-sm" : "bg-transparent text-gray-900 hover:bg-blue-50"
                        }`}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                        <span>昇順</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSortDirectionToggle()}
                        className={`flex flex-1 items-center justify-center gap-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-all ${
                          getSortDirection() === "desc" ? "bg-blue-100 text-gray-900 shadow-sm" : "bg-transparent text-gray-900 hover:bg-blue-50"
                        }`}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                        <span>降順</span>
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      {getSortDirection() === "asc" ? "価格や終了時間などを小さい順に表示" : "価格や終了時間などを大きい順に表示"}
                    </p>
                  </div>
                  <Separator className="mb-3" />
                  <div className="grid gap-2">
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={cn(
                          "hover:border-opacity-80 flex w-full cursor-pointer items-center rounded-md border p-3 text-left transition-all focus:outline-none",
                          getSortField() === option.value ? "border-blue-500 bg-blue-50 shadow-sm" : "border-gray-200",
                        )}
                        onClick={() =>
                          handleSortChange({
                            field: option.value as AuctionSortField,
                            direction: getSortDirection() ?? "asc",
                          })
                        }
                        aria-pressed={getSortField() === option.value}
                      >
                        <div className="flex w-full items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-full",
                                getSortField() === option.value ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500",
                              )}
                            >
                              {option.icon}
                            </div>
                            <span className="text-sm font-medium">{option.label}</span>
                          </div>
                          {getSortField() === option.value && <Check className={`h-4 w-4 text-blue-500`} />}
                        </div>
                      </button>
                    ))}
                  </div>
                </FilterSection>

                {/* ステータスセクション */}
                <FilterSection title="ステータス" bgColor="bg-green-50" textColor="text-green-800">
                  {/* ステータス条件の結合方法（OR/AND） */}
                  <div className="mb-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium">条件の結合方法</span>
                    </div>
                    <div className="flex w-full rounded-md border border-green-200 p-1">
                      <button
                        type="button"
                        onClick={() => handleStatusJoinTypeChange("OR")}
                        className={`flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-all ${
                          (draftConditions.statusConditionJoinType ?? "OR") === "OR"
                            ? "bg-green-100 text-gray-900 shadow-sm"
                            : "bg-transparent text-gray-900 hover:bg-green-50"
                        }`}
                      >
                        OR条件
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusJoinTypeChange("AND")}
                        className={`flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-all ${
                          draftConditions.statusConditionJoinType === "AND"
                            ? "bg-green-100 text-gray-900 shadow-sm"
                            : "bg-transparent text-gray-900 hover:bg-green-50"
                        }`}
                      >
                        AND条件
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      {(draftConditions.statusConditionJoinType ?? "OR") === "OR"
                        ? "いずれかの条件に一致するアイテムを表示"
                        : "すべての条件に一致するアイテムを表示"}
                    </p>
                  </div>
                  <Separator className="mb-3" />

                  <div className="grid gap-2">
                    {statusOptions.map((option) => (
                      <button
                        key={option.value}
                        className={cn(
                          "hover:border-opacity-80 mb-2 flex w-full cursor-pointer items-center rounded-md border p-3 text-left transition-all",
                          isStatusSelected(option.value) ? "border-green-500 bg-green-50 shadow-sm" : "border-gray-200",
                        )}
                        onClick={() => handleStatusSelect(option.value as AuctionFilterTypes)}
                        aria-pressed={isStatusSelected(option.value)}
                        type="button"
                      >
                        <div className="flex w-full items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-full",
                                isStatusSelected(option.value) ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500",
                              )}
                            >
                              {option.icon}
                            </div>
                            <span className="text-sm font-medium">{option.label}</span>
                          </div>
                          {isStatusSelected(option.value) && <Check className={`h-4 w-4 text-green-500`} />}
                        </div>
                      </button>
                    ))}
                  </div>
                </FilterSection>

                {/* グループセクション */}
                <FilterSection title="グループ" bgColor="bg-purple-50" textColor="text-purple-800">
                  <Popover open={openGroupCombobox} onOpenChange={setOpenGroupCombobox}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openGroupCombobox}
                        className="w-full justify-between border-gray-200 bg-white py-6 hover:border-purple-200"
                      >
                        {areAllGroupsSelected
                          ? "すべてのグループ"
                          : (joinTypeinedGroupList.find((group) => group.id && draftConditions.groupIds?.includes(group.id))?.name ??
                            "グループを選択")}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="グループを検索..." />
                        <CommandList>
                          <CommandEmpty>グループが見つかりません</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="all-groups"
                              onSelect={() => {
                                handleGroupSelect(null);
                                setOpenGroupCombobox(false);
                              }}
                              className={cn("transition-colors duration-150 hover:bg-purple-50", isGroupSelected(null) && "bg-purple-50")}
                            >
                              <Check className={cn("mr-2 h-4 w-4", isGroupSelected(null) ? "opacity-100" : "opacity-0")} />
                              すべてのグループ
                            </CommandItem>
                            {/* グループIDでユニークにフィルタリング */}
                            {joinTypeinedGroupList.map((group) => (
                              <CommandItem
                                key={group.id}
                                value={group.name}
                                onSelect={() => {
                                  handleGroupSelect(group.id);
                                  setOpenGroupCombobox(false);
                                }}
                                className={cn("transition-colors duration-150 hover:bg-purple-50", isGroupSelected(group.id) && "bg-purple-50")}
                              >
                                <Check className={cn("mr-2 h-4 w-4", isGroupSelected(group.id) ? "opacity-100" : "opacity-0")} />
                                {group.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </FilterSection>

                {/* 残り時間セクション */}
                <FilterSection title="残り時間" bgColor="bg-amber-50" textColor="text-amber-800">
                  <div className="space-y-5">
                    <Slider
                      defaultValue={[draftConditions.minRemainingTime ?? 0, draftConditions.maxRemainingTime ?? 720]}
                      min={0}
                      max={2160}
                      step={1}
                      value={[draftConditions.minRemainingTime ?? 0, draftConditions.maxRemainingTime ?? 720]}
                      onValueChange={handleTimeRangeChange}
                      className="mt-6"
                    />

                    <div className="flex justify-between text-sm">
                      <span>{formatTimeDisplay(draftConditions.minRemainingTime ?? 0)}</span>
                      <span>{formatTimeDisplay(draftConditions.maxRemainingTime ?? 720)}</span>
                    </div>

                    <RangeInputFields
                      minValue={draftConditions.minRemainingTime}
                      maxValue={draftConditions.maxRemainingTime}
                      defaultMaxValue={720}
                      onRangeChange={handleTimeRangeChange}
                      minLabel="最小時間"
                      maxLabel="最大時間"
                      step={1}
                      focusColors="border-amber-300 focus:ring-2 focus:ring-amber-100"
                    />

                    <PresetButtons
                      presets={timePresets}
                      onSelectPreset={setTimePreset}
                      cols={4}
                      hoverColors="hover:border-amber-200 hover:bg-amber-50"
                    />

                    <Button type="button" size="sm" onClick={handleTimeRangeApply} className="w-full bg-amber-500 text-white hover:bg-amber-600">
                      残り時間を適用
                    </Button>
                  </div>
                </FilterSection>

                {/* 価格帯セクション */}
                <FilterSection title="価格帯" bgColor="bg-red-50" textColor="text-red-800">
                  <div className="space-y-5">
                    <Slider
                      defaultValue={[draftConditions.minBid ?? 0, draftConditions.maxBid ?? 100000]}
                      min={0}
                      max={100000}
                      step={100}
                      value={[draftConditions.minBid ?? 0, draftConditions.maxBid ?? 100000]}
                      onValueChange={handlePriceRangeChange}
                      className="mt-6"
                    />

                    <div className="flex justify-between text-sm">
                      <span>{draftConditions.minBid?.toLocaleString()} ポイント</span>
                      <span>{draftConditions.maxBid?.toLocaleString()} ポイント</span>
                    </div>

                    <RangeInputFields
                      minValue={draftConditions.minBid}
                      maxValue={draftConditions.maxBid}
                      defaultMaxValue={100000}
                      onRangeChange={handlePriceRangeChange}
                      minLabel="最小価格"
                      maxLabel="最大価格"
                      step={100}
                      focusColors="border-red-300 focus:ring-2 focus:ring-red-100"
                      isPrice={true}
                    />

                    <Separator className="my-2" />

                    <PresetButtons
                      presets={pricePresets}
                      onSelectPreset={setPricePreset}
                      cols={3}
                      hoverColors="hover:border-red-200 hover:bg-red-50"
                    />

                    <Button type="button" size="sm" onClick={handlePriceRangeApply} className="w-full bg-red-500 text-white hover:bg-red-600">
                      価格帯を適用
                    </Button>
                  </div>
                </FilterSection>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
});
