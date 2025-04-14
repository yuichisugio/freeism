"use client";

import type { AuctionSortField } from "@/lib/auction/type/types";
import type { ReactNode } from "react";
import { memo, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import SearchBar from "@/components/ui/SearchBar";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { useAuctionFilters } from "@/hooks/auction/listing/use-auction-filters";
import { AUCTION_CONSTANTS } from "@/lib/auction/constants";
import { type AuctionFiltersProps, type AuctionFilterTypes } from "@/lib/auction/type/types";
import { cn } from "@/lib/utils";
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

// ソートオプション設定
const sortOptions = [
  { value: "newest", label: "新着順", icon: <Sparkles className="h-4 w-4" /> },
  { value: "time_remaining", label: "終了時間順", icon: <Clock className="h-4 w-4" /> },
  { value: "price", label: "入札額", icon: <ArrowDownCircle className="h-4 w-4" /> },
  { value: "bids", label: "入札数順", icon: <BarChart4 className="h-4 w-4" /> },
];

// ステータスオプション設定
const statusOptions = [
  { value: "all", label: "すべて", icon: <EyeIcon className="h-4 w-4" /> },
  { value: "watchlist", label: "ウォッチリスト", icon: <ShieldCheck className="h-4 w-4" /> },
  { value: "not_bidded", label: "未入札", icon: <ShieldAlert className="h-4 w-4" /> },
  { value: "bidded", label: "入札済み", icon: <Check className="h-4 w-4" /> },
  { value: "not_ended", label: "終了済み以外", icon: <TimerIcon className="h-4 w-4" /> },
  { value: "ended", label: "終了済み", icon: <Calendar className="h-4 w-4" /> },
];

// 残り時間のプリセット
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

// 価格のプリセット
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
function FilterSection({ title, bgColor, textColor, children }: FilterSectionProps) {
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
function PresetButtons({ presets, onSelectPreset, cols, hoverColors }: PresetButtonsProps) {
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
}

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
function RangeInputFields({
  minValue,
  maxValue,
  defaultMaxValue,
  onRangeChange,
  minLabel,
  maxLabel,
  step,
  focusColors,
  isPrice = false,
}: RangeInputFieldsProps) {
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
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションフィルターコンポーネント
 * @param listingsConditions フィルター
 * @param setListingsConditions フィルター変更アクション
 */
export const AuctionFilters = memo(function AuctionFilters({
  listingsConditions,
  setListingsConditionsAction,
  auctions,
}: AuctionFiltersProps): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // カスタムフックからロジックを取得
  const {
    // state
    showFilters,
    activeFilterCount,
    openGroupCombobox,
    changingSearchQuery,
    draftConditions,

    // action
    setChangingSearchQuery,
    setOpenGroupCombobox,
    handleCategorySelect,
    handleStatusSelect,
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
  } = useAuctionFilters({
    listingsConditions,
    setListingsConditionsAction,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 時間範囲の表示
  const formatTimeDisplay = useCallback((hours: number) => {
    if (hours < 1) return "即時";
    if (hours < 24) return `${hours}時間`;
    const days = Math.floor(hours / 24);
    return `${days}日`;
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // カテゴリリスト
  const categoriesList = useMemo(() => AUCTION_CONSTANTS.AUCTION_CATEGORIES, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // カテゴリが選択されているかチェック
  const isCategorySelected = useCallback(
    (category: string) => {
      if (!draftConditions.categories || !Array.isArray(draftConditions.categories)) {
        return category === "すべて";
      }
      return draftConditions.categories.includes(category);
    },
    [draftConditions.categories],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ステータスが選択されているかチェック
  const isStatusSelected = useCallback(
    (status: string) => {
      if (!draftConditions.status || !Array.isArray(draftConditions.status)) {
        return status === "all";
      }
      return draftConditions.status.includes(status as AuctionFilterTypes);
    },
    [draftConditions.status],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // グループが選択されているかチェック
  const isGroupSelected = useCallback(
    (groupId: string | null) => {
      if (groupId === null) {
        return !draftConditions.groupIds || draftConditions.groupIds.length === 0;
      }
      return draftConditions.groupIds?.includes(groupId) ?? false;
    },
    [draftConditions.groupIds],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ソート値を安全に取得する関数
  const getSortField = useCallback(() => {
    if (Array.isArray(draftConditions.sort) && draftConditions.sort.length > 0) {
      return draftConditions.sort[0].field;
    }
    return "newest";
  }, [draftConditions.sort]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ソート方向を安全に取得する関数
  const getSortDirection = useCallback(() => {
    if (Array.isArray(draftConditions.sort) && draftConditions.sort.length > 0) {
      return draftConditions.sort[0].direction;
    }
    return "asc";
  }, [draftConditions.sort]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ユニークなグループを取得
  const uniqueGroups = useMemo((): Array<{ id: string; name: string }> => {
    // ユニークなグループIDを抽出
    const uniqueGroupsMap = new Map<string, { id: string; name: string }>();
    auctions.forEach((auction) => {
      if (auction.group?.id && auction.group?.name && !uniqueGroupsMap.has(auction.group.id)) {
        uniqueGroupsMap.set(auction.group.id, {
          id: auction.group.id,
          name: auction.group.name,
        });
      }
    });
    // Map からユニークなグループの配列を作成
    return Array.from(uniqueGroupsMap.values());
  }, [auctions]);

  // すべてのグループが選択されているかを確認
  const areAllGroupsSelected = useMemo(() => {
    if (!draftConditions.groupIds || draftConditions.groupIds.length === 0) {
      return true;
    }

    if (uniqueGroups.length === 0) {
      return true;
    }

    // すべてのグループIDが選択されているかチェック
    return (
      uniqueGroups.length === draftConditions.groupIds.length &&
      uniqueGroups.every((group) => {
        return draftConditions.groupIds?.includes(group.id);
      })
    );
  }, [draftConditions.groupIds, uniqueGroups]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="mb-4 w-full">
      {/* 検索バー */}
      <form
        className="mb-4 w-full"
        onSubmit={(e) => {
          e.preventDefault();
          handleSearchQueryEnter(changingSearchQuery ?? "");
        }}
      >
        <div className="flex w-full overflow-hidden rounded-lg border border-gray-200">
          <SearchBar
            placeholder="商品名や説明文を検索..."
            value={changingSearchQuery ?? ""}
            onChange={(e) => setChangingSearchQuery(e.target.value)}
            className="flex-1 rounded-l-lg border-0 focus:border-blue-300 focus:ring-1 focus:ring-blue-200"
          />
          <Button type="submit" size="sm" className="rounded-l-none rounded-r-lg bg-blue-500 px-6 text-white hover:bg-blue-600">
            検索
          </Button>
        </div>
      </form>

      {/* カテゴリタブ */}
      <div className="relative mx-2 mb-4 sm:mx-0">
        <div className="scrollbar-hide flex overflow-x-auto pb-2 sm:pb-0">
          <div className="flex items-center justify-start space-x-1 sm:space-x-2">
            {categoriesList && categoriesList.length > 0 ? (
              categoriesList.map((category: string) => (
                <button
                  key={category}
                  className={`rounded-md px-3 py-1.5 text-sm whitespace-nowrap sm:px-4 sm:py-2 ${isCategorySelected(category) ? "bg-primary bg-blue-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                  onClick={() => {
                    handleCategorySelect(category);
                  }}
                >
                  {category}
                </button>
              ))
            ) : (
              <div className="text-red-500">カテゴリが読み込まれていません ({categoriesList ? categoriesList.length : "undefined"})</div>
            )}
          </div>
        </div>
      </div>

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
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium">並び順</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSortDirectionToggle}
                      className={cn(
                        "flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1 transition-colors",
                        getSortDirection() === "asc" ? "bg-blue-50 hover:bg-blue-100" : "bg-gray-50 hover:bg-gray-100",
                      )}
                    >
                      {getSortDirection() === "asc" ? (
                        <>
                          <ArrowUp className="h-3.5 w-3.5" />
                          <span className="text-xs">昇順</span>
                        </>
                      ) : (
                        <>
                          <ArrowDown className="h-3.5 w-3.5" />
                          <span className="text-xs">降順</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="grid gap-2">
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        className={cn(
                          "hover:border-opacity-80 flex w-full cursor-pointer items-center rounded-md border p-3 text-left transition-all",
                          getSortField() === option.value ? "border-blue-500 bg-blue-50 shadow-sm" : "border-gray-200",
                        )}
                        onClick={() =>
                          handleSortChange({
                            field: option.value as AuctionSortField,
                            direction: getSortDirection() ?? "asc",
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSortChange({
                              field: option.value as AuctionSortField,
                              direction: getSortDirection() ?? "asc",
                            });
                          }
                        }}
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
                          : (auctions.find((auction) => auction.group?.id && draftConditions.groupIds?.includes(auction.group.id))?.group?.name ??
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
                            {uniqueGroups.map((group) => (
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
