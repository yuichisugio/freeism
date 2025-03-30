"use client";

import type { AuctionFilterParams, AuctionSortOption } from "@/lib/auction/types";
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { useAuctionFilters } from "@/hooks/auction/listing/useAuctionFilters";
import { type AuctionFiltersProps } from "@/lib/auction/types";
import { cn } from "@/lib/utils";
import { ArrowDownCircle, ArrowUpCircle, BarChart4, Calendar, Check, ChevronsUpDown, Clock, EyeIcon, Filter, ShieldAlert, ShieldCheck, Sparkles, TimerIcon, X } from "lucide-react";

/**
 * オークションフィルターコンポーネント
 * @param filters フィルター
 * @param onFilterChangeAction フィルター変更アクション
 * @param sortOption ソートオプション
 * @param onSortChangeAction ソート変更アクション
 * @param categories カテゴリー
 * @param onResetFilters フィルターリセットアクション
 */
export default function AuctionFilters({ filters, onFilterChangeAction, sortOption, onSortChangeAction, categories = [], onResetFilters }: AuctionFiltersProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // カスタムフックからロジックを取得
  const {
    priceRange,
    timeRange,
    groups,
    showFilters,
    activeFilterCount,
    openGroupCombobox,
    setOpenGroupCombobox,
    handlePriceRangeChange,
    handlePriceRangeApply,
    handleTimeRangeChange,
    handleTimeRangeApply,
    toggleFilterDisplay,
    setPricePreset,
    setTimePreset,
    resetPriceRange,
    resetTimeRange,
  } = useAuctionFilters({
    filters,
    onFilterChangeAction,
    sortOption,
    onSortChangeAction,
    onResetFilters,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // フィルターのリセット
  const handleResetFilters = () => {
    resetPriceRange();
    resetTimeRange();
    if (onResetFilters) {
      onResetFilters();
    }
  };

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

  // 時間範囲の表示
  const formatTimeDisplay = (hours: number) => {
    if (hours < 1) return "即時";
    if (hours < 24) return `${hours}時間`;
    const days = Math.floor(hours / 24);
    return `${days}日`;
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="mb-4">
      {/* フィルターボタン */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={toggleFilterDisplay} className={cn("flex items-center gap-2", showFilters && "border-blue-300 bg-blue-50")}>
          <Filter className="h-4 w-4" />
          <span>並び替え・フィルター</span>
          {activeFilterCount > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600">{activeFilterCount}</span>}
        </Button>

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleResetFilters} className="text-red-500 hover:bg-red-50 hover:text-red-600">
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
                <Card className="overflow-hidden border shadow-sm">
                  <CardHeader className="bg-blue-50 p-3">
                    <CardTitle className="text-sm font-medium text-blue-800">並び替え</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3">
                    <RadioGroup value={sortOption} onValueChange={(value) => onSortChangeAction(value as AuctionSortOption)} className="grid gap-2">
                      {sortOptions.map((option) => (
                        <label
                          key={option.value}
                          className={cn(
                            "flex cursor-pointer items-center rounded-md border p-3 transition-all hover:border-blue-200 hover:bg-blue-50",
                            sortOption === option.value ? "border-blue-500 bg-blue-50 shadow-sm" : "border-gray-200",
                          )}
                        >
                          <RadioGroupItem value={option.value} id={`sort-${option.value}`} className="sr-only" />
                          <div className="flex w-full items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={cn("flex h-8 w-8 items-center justify-center rounded-full", sortOption === option.value ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500")}>
                                {option.icon}
                              </div>
                              <span className="text-sm font-medium">{option.label}</span>
                            </div>
                            {sortOption === option.value && <Check className="h-4 w-4 text-blue-500" />}
                          </div>
                        </label>
                      ))}
                    </RadioGroup>
                  </CardContent>
                </Card>

                {/* ステータスセクション */}
                <Card className="overflow-hidden border shadow-sm">
                  <CardHeader className="bg-green-50 p-3">
                    <CardTitle className="text-sm font-medium text-green-800">ステータス</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3">
                    <RadioGroup value={filters.status || "all"} onValueChange={(value) => onFilterChangeAction({ status: value as AuctionFilterParams["status"] })} className="grid gap-2">
                      {statusOptions.map((option) => (
                        <label
                          key={option.value}
                          className={cn(
                            "flex cursor-pointer items-center rounded-md border p-3 transition-all hover:border-green-200 hover:bg-green-50",
                            filters.status === option.value ? "border-green-500 bg-green-50 shadow-sm" : "border-gray-200",
                          )}
                        >
                          <RadioGroupItem value={option.value} id={option.value} className="sr-only" />
                          <div className="flex w-full items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className={cn("flex h-8 w-8 items-center justify-center rounded-full", filters.status === option.value ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500")}
                              >
                                {option.icon}
                              </div>
                              <span className="text-sm font-medium">{option.label}</span>
                            </div>
                            {filters.status === option.value && <Check className="h-4 w-4 text-green-500" />}
                          </div>
                        </label>
                      ))}
                    </RadioGroup>
                  </CardContent>
                </Card>

                {/* グループセクション */}
                <Card className="overflow-hidden border shadow-sm">
                  <CardHeader className="bg-purple-50 p-3">
                    <CardTitle className="text-sm font-medium text-purple-800">グループ</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3">
                    <Popover open={openGroupCombobox} onOpenChange={setOpenGroupCombobox}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={openGroupCombobox} className="w-full justify-between border-gray-200 bg-white py-6 hover:border-purple-200">
                          {filters.groupId ? groups.find((group) => group.id === filters.groupId)?.name || "グループを選択" : "グループを選択"}
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
                                  onFilterChangeAction({ groupId: undefined });
                                  setOpenGroupCombobox(false);
                                }}
                                className={cn("transition-colors duration-150 hover:bg-purple-50", !filters.groupId && "bg-purple-50")}
                              >
                                <Check className={cn("mr-2 h-4 w-4", !filters.groupId ? "opacity-100" : "opacity-0")} />
                                すべてのグループ
                              </CommandItem>
                              {groups.map((group) => (
                                <CommandItem
                                  key={group.id}
                                  value={group.name}
                                  onSelect={() => {
                                    onFilterChangeAction({ groupId: group.id });
                                    setOpenGroupCombobox(false);
                                  }}
                                  className={cn("transition-colors duration-150 hover:bg-purple-50", filters.groupId === group.id && "bg-purple-50")}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", filters.groupId === group.id ? "opacity-100" : "opacity-0")} />
                                  {group.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </CardContent>
                </Card>

                {/* 残り時間セクション */}
                <Card className="overflow-hidden border shadow-sm">
                  <CardHeader className="bg-amber-50 p-3">
                    <CardTitle className="text-sm font-medium text-amber-800">残り時間</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3">
                    <div className="space-y-5">
                      <Slider defaultValue={timeRange} min={0} max={720} step={1} value={timeRange} onValueChange={handleTimeRangeChange} className="mt-6" />

                      <div className="flex justify-between text-sm">
                        <span>{formatTimeDisplay(timeRange[0])}</span>
                        <span>{formatTimeDisplay(timeRange[1])}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="min-time" className="mb-1 block text-xs text-gray-500">
                            最小時間
                          </label>
                          <select
                            id="min-time"
                            value={timeRange[0]}
                            onChange={(e) => {
                              const value = Math.min(parseInt(e.target.value), timeRange[1] - 1);
                              handleTimeRangeChange([value, timeRange[1]]);
                            }}
                            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors focus:border-amber-300 focus:ring-2 focus:ring-amber-100 focus:outline-none"
                          >
                            <option value="0">即時</option>
                            <option value="1">1時間</option>
                            <option value="6">6時間</option>
                            <option value="12">12時間</option>
                            <option value="24">1日</option>
                            <option value="48">2日</option>
                            <option value="72">3日</option>
                            <option value="168">1週間</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="max-time" className="mb-1 block text-xs text-gray-500">
                            最大時間
                          </label>
                          <select
                            id="max-time"
                            value={timeRange[1]}
                            onChange={(e) => {
                              const value = Math.max(timeRange[0] + 1, parseInt(e.target.value));
                              handleTimeRangeChange([timeRange[0], value]);
                            }}
                            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors focus:border-amber-300 focus:ring-2 focus:ring-amber-100 focus:outline-none"
                          >
                            <option value="1">1時間</option>
                            <option value="6">6時間</option>
                            <option value="12">12時間</option>
                            <option value="24">1日</option>
                            <option value="48">2日</option>
                            <option value="72">3日</option>
                            <option value="168">1週間</option>
                            <option value="336">2週間</option>
                            <option value="720">30日</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setTimePreset(0, 1)} className="text-xs hover:border-amber-200 hover:bg-amber-50">
                          1時間以内
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setTimePreset(0, 24)} className="text-xs hover:border-amber-200 hover:bg-amber-50">
                          24時間以内
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setTimePreset(0, 168)} className="text-xs hover:border-amber-200 hover:bg-amber-50">
                          1週間以内
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setTimePreset(0, 720)} className="text-xs hover:border-amber-200 hover:bg-amber-50">
                          すべて
                        </Button>
                      </div>

                      <Button type="button" size="sm" onClick={handleTimeRangeApply} className="w-full bg-amber-500 text-white hover:bg-amber-600">
                        残り時間を適用
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* 価格帯セクション */}
                <Card className="overflow-hidden border shadow-sm">
                  <CardHeader className="bg-red-50 p-3">
                    <CardTitle className="text-sm font-medium text-red-800">価格帯</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3">
                    <div className="space-y-5">
                      <Slider defaultValue={priceRange} min={0} max={10000} step={100} value={priceRange} onValueChange={handlePriceRangeChange} className="mt-6" />

                      <div className="flex justify-between text-sm">
                        <span>{priceRange[0].toLocaleString()} ポイント</span>
                        <span>{priceRange[1].toLocaleString()} ポイント</span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="min-price" className="mb-1 block text-xs text-gray-500">
                            最小価格
                          </label>
                          <input
                            id="min-price"
                            type="number"
                            min={0}
                            max={priceRange[1] - 100}
                            value={priceRange[0]}
                            onChange={(e) => {
                              const value = Math.max(0, Math.min(priceRange[1] - 100, parseInt(e.target.value) || 0));
                              handlePriceRangeChange([value, priceRange[1]]);
                            }}
                            className="border-input bg-background h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus:border-red-300 focus:ring-2 focus:ring-red-100 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label htmlFor="max-price" className="mb-1 block text-xs text-gray-500">
                            最大価格
                          </label>
                          <input
                            id="max-price"
                            type="number"
                            min={priceRange[0] + 100}
                            max={10000}
                            value={priceRange[1]}
                            onChange={(e) => {
                              const value = Math.max(priceRange[0] + 100, Math.min(10000, parseInt(e.target.value) || 0));
                              handlePriceRangeChange([priceRange[0], value]);
                            }}
                            className="border-input bg-background h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus:border-red-300 focus:ring-2 focus:ring-red-100 focus:outline-none"
                          />
                        </div>
                      </div>

                      <Separator className="my-2" />

                      <div className="grid grid-cols-3 gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setPricePreset(0, 500)} className="text-xs hover:border-red-200 hover:bg-red-50">
                          ~500 P
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setPricePreset(500, 1000)} className="text-xs hover:border-red-200 hover:bg-red-50">
                          500~1,000 P
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setPricePreset(1000, 2000)} className="text-xs hover:border-red-200 hover:bg-red-50">
                          1,000~2,000 P
                        </Button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setPricePreset(2000, 3000)} className="text-xs hover:border-red-200 hover:bg-red-50">
                          2,000~3,000 P
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setPricePreset(3000, 5000)} className="text-xs hover:border-red-200 hover:bg-red-50">
                          3,000~5,000 P
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setPricePreset(5000, 10000)} className="text-xs hover:border-red-200 hover:bg-red-50">
                          5,000+ P
                        </Button>
                      </div>

                      <Button type="button" size="sm" onClick={handlePriceRangeApply} className="w-full bg-red-500 text-white hover:bg-red-600">
                        価格帯を適用
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
