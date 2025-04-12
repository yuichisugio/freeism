"use client";

import type { AuctionListingsConditions, AuctionSortField } from "@/lib/auction/type/types";
import type { ReactNode } from "react";
import { memo, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import SearchBar from "@/components/ui/SearchBar";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { useAuctionFilters } from "@/hooks/auction/listing/use-auction-filters";
import { AUCTION_CONSTANTS } from "@/lib/auction/constants";
import { type AuctionFiltersProps } from "@/lib/auction/type/types";
import { cn } from "@/lib/utils";
import {
  ArrowDownCircle,
  ArrowUpCircle,
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
  { value: "time_remaining", label: "終了時間が近い順", icon: <Clock className="h-4 w-4" /> },
  { value: "price_asc", label: "価格が安い順", icon: <ArrowDownCircle className="h-4 w-4" /> },
  { value: "price_desc", label: "価格が高い順", icon: <ArrowUpCircle className="h-4 w-4" /> },
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
 * 共通ラジオオプションコンポーネント
 */
type RadioOptionProps = {
  value: string;
  label: string;
  icon: ReactNode;
  isSelected: boolean;
  accentColor: string;
  bgColorSelected: string;
  bgColorIcon: string;
  textColorIcon: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 共通ラジオオプションコンポーネント
 */
function RadioOption({ value, label, icon, isSelected, accentColor, bgColorSelected, bgColorIcon }: RadioOptionProps) {
  return (
    <label
      className={cn(
        "hover:border-opacity-80 flex cursor-pointer items-center rounded-md border p-3 transition-all",
        isSelected ? `border-${accentColor}-500 ${bgColorSelected} shadow-sm` : "border-gray-200",
      )}
    >
      <RadioGroupItem value={value} id={`option-${value}`} className="sr-only" />
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-full", isSelected ? bgColorIcon : "bg-gray-100 text-gray-500")}>
            {icon}
          </div>
          <span className="text-sm font-medium">{label}</span>
        </div>
        {isSelected && <Check className={`h-4 w-4 text-${accentColor}-500`} />}
      </div>
    </label>
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

    // action
    setChangingSearchQuery,
    setOpenGroupCombobox,
    handleCategorySelect,
    handlePriceRangeChange,
    handlePriceRangeApply,
    handleTimeRangeChange,
    handleTimeRangeApply,
    toggleFilterDisplay,
    setPricePreset,
    setTimePreset,
    handleFilterChange,
    handleSortChange,
    handleResetAllFilters,
    handleSearchQueryEnter,
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

  return (
    <div className="mb-4 w-full">
      {/* 検索バー */}
      <form
        className="mb-4 flex w-full"
        onSubmit={(e) => {
          e.preventDefault();
          handleSearchQueryEnter(changingSearchQuery ?? "");
        }}
      >
        <SearchBar placeholder="商品名や説明文を検索..." value={changingSearchQuery ?? ""} onChange={(e) => setChangingSearchQuery(e.target.value)} />
        <Button type="submit" size="sm" className="bg-blue-500 text-white hover:bg-blue-600">
          検索
        </Button>
      </form>

      {/* カテゴリタブ */}
      <div className="relative mx-2 mb-4 sm:mx-0">
        <div className="scrollbar-hide flex overflow-x-auto pb-2 sm:pb-0">
          <div className="flex items-center justify-start space-x-1 sm:space-x-2">
            {categoriesList && categoriesList.length > 0 ? (
              categoriesList.map((category: string) => (
                <button
                  key={category}
                  className={`rounded-md px-3 py-1.5 text-sm whitespace-nowrap sm:px-4 sm:py-2 ${listingsConditions.categories === category ? "bg-primary bg-blue-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                  onClick={() => handleCategorySelect(category)}
                >
                  {category}
                </button>
              ))
            ) : (
              <div className="text-red-500">カテゴリが読み込まれていません ({categoriesList ? categoriesList.length : "undefined"})</div>
            )}
          </div>
        </div>

        {/* スクロールフェードの装飾 - 横スクロールのUIヒントになります */}
        <div className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-white to-transparent sm:hidden"></div>
      </div>

      {/* フィルターボタン */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleFilterDisplay}
          className={cn("flex items-center gap-2", showFilters && "border-blue-300 bg-blue-50")}
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
            className="text-red-500 hover:bg-red-50 hover:text-red-600"
          >
            <X className="mr-1 h-4 w-4" />
            リセット
          </Button>
        )}
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
                  <RadioGroup
                    value={listingsConditions.sort?.field ?? "newest"}
                    onValueChange={(value) =>
                      handleSortChange({
                        field: value as AuctionSortField,
                        direction: listingsConditions.sort?.direction ?? "asc",
                      })
                    }
                    className="grid gap-2"
                  >
                    {sortOptions.map((option) => (
                      <RadioOption
                        key={option.value}
                        value={option.value}
                        label={option.label}
                        icon={option.icon}
                        isSelected={listingsConditions.sort?.field === option.value}
                        accentColor="blue"
                        bgColorSelected="bg-blue-50"
                        bgColorIcon="bg-blue-100 text-blue-600"
                        textColorIcon="text-blue-600"
                      />
                    ))}
                  </RadioGroup>
                </FilterSection>

                {/* ステータスセクション */}
                <FilterSection title="ステータス" bgColor="bg-green-50" textColor="text-green-800">
                  <RadioGroup
                    value={listingsConditions.status?.[0] ?? "all"}
                    onValueChange={(value) =>
                      handleFilterChange({
                        status: [value] as AuctionListingsConditions["status"],
                      })
                    }
                    className="grid gap-2"
                  >
                    {statusOptions.map((option) => (
                      <RadioOption
                        key={option.value}
                        value={option.value}
                        label={option.label}
                        icon={option.icon}
                        isSelected={listingsConditions.status?.[0] === option.value}
                        accentColor="green"
                        bgColorSelected="bg-green-50"
                        bgColorIcon="bg-green-100 text-green-600"
                        textColorIcon="text-green-600"
                      />
                    ))}
                  </RadioGroup>
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
                        {listingsConditions.groupIds?.[0]
                          ? (auctions.find((auction) => auction.group.id === listingsConditions.groupIds?.[0])?.group.name ?? "グループを選択")
                          : "グループを選択"}
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
                                handleFilterChange({ groupIds: null });
                                setOpenGroupCombobox(false);
                              }}
                              className={cn("transition-colors duration-150 hover:bg-purple-50", !listingsConditions.groupIds && "bg-purple-50")}
                            >
                              <Check className={cn("mr-2 h-4 w-4", !listingsConditions.groupIds ? "opacity-100" : "opacity-0")} />
                              すべてのグループ
                            </CommandItem>
                            {auctions.map((auction) => (
                              <CommandItem
                                key={auction.group.id}
                                value={auction.group.name}
                                onSelect={() => {
                                  handleFilterChange({ groupIds: [auction.group.id] });
                                  setOpenGroupCombobox(false);
                                }}
                                className={cn(
                                  "transition-colors duration-150 hover:bg-purple-50",
                                  listingsConditions.groupIds?.[0] === auction.group.id && "bg-purple-50",
                                )}
                              >
                                <Check
                                  className={cn("mr-2 h-4 w-4", listingsConditions.groupIds?.[0] === auction.group.id ? "opacity-100" : "opacity-0")}
                                />
                                {auction.group.name}
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
                      defaultValue={[listingsConditions.minRemainingTime ?? 0, listingsConditions.maxRemainingTime ?? 720]}
                      min={0}
                      max={2160}
                      step={1}
                      value={[listingsConditions.minRemainingTime ?? 0, listingsConditions.maxRemainingTime ?? 720]}
                      onValueChange={handleTimeRangeChange}
                      className="mt-6"
                    />

                    <div className="flex justify-between text-sm">
                      <span>{formatTimeDisplay(listingsConditions.minRemainingTime ?? 0)}</span>
                      <span>{formatTimeDisplay(listingsConditions.maxRemainingTime ?? 720)}</span>
                    </div>

                    <RangeInputFields
                      minValue={listingsConditions.minRemainingTime}
                      maxValue={listingsConditions.maxRemainingTime}
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
                      defaultValue={[listingsConditions.minBid ?? 0, listingsConditions.maxBid ?? 100000]}
                      min={0}
                      max={100000}
                      step={100}
                      value={[listingsConditions.minBid ?? 0, listingsConditions.maxBid ?? 100000]}
                      onValueChange={handlePriceRangeChange}
                      className="mt-6"
                    />

                    <div className="flex justify-between text-sm">
                      <span>{listingsConditions.minBid?.toLocaleString()} ポイント</span>
                      <span>{listingsConditions.maxBid?.toLocaleString()} ポイント</span>
                    </div>

                    <RangeInputFields
                      minValue={listingsConditions.minBid}
                      maxValue={listingsConditions.maxBid}
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
