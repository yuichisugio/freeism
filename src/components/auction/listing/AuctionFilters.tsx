"use client";

import type { AuctionFilterParams, AuctionSortOption } from "@/lib/auction/types";
import React, { useEffect, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { getUserGroups } from "@/lib/auction/action/user";
import { Filter, X } from "lucide-react";

type AuctionFiltersProps = {
  filters: AuctionFilterParams;
  onFilterChangeAction: (filters: Partial<AuctionFilterParams>) => void;
  sortOption: AuctionSortOption;
  onSortChangeAction: (sort: AuctionSortOption) => void;
  categories?: string[];
  onResetFilters?: () => void;
};

export default function AuctionFilters({ filters, onFilterChangeAction, sortOption, onSortChangeAction, categories = [], onResetFilters }: AuctionFiltersProps) {
  // 価格範囲フィルター
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  // グループリスト
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  // フィルターパネルの表示状態
  const [showFilters, setShowFilters] = useState(false);
  // アクティブなフィルターの数をカウント
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  // グループ情報を取得
  useEffect(() => {
    async function fetchGroups() {
      const userGroups = await getUserGroups();
      const groupData = userGroups.map((membership) => ({
        id: membership.group.id,
        name: membership.group.name,
      }));
      setGroups(groupData);
    }

    fetchGroups();
  }, []);

  // アクティブなフィルターの数を計算
  useEffect(() => {
    let count = 0;
    if (filters.category && filters.category !== "すべて") count++;
    if (filters.status && filters.status !== "all") count++;
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) count++;
    if (filters.remainingTime && filters.remainingTime !== "all") count++;
    if (filters.groupId) count++;
    if (filters.searchQuery) count++;

    setActiveFilterCount(count);
  }, [filters]);

  // 価格範囲変更時のハンドラー
  const handlePriceRangeChange = (value: [number, number]) => {
    setPriceRange(value);
  };

  // 価格範囲適用時のハンドラー
  const handlePriceRangeApply = () => {
    onFilterChangeAction({
      minPrice: priceRange[0],
      maxPrice: priceRange[1],
    });
  };

  // フィルターのリセット
  const handleResetFilters = () => {
    setPriceRange([0, 10000]);
    if (onResetFilters) {
      onResetFilters();
    }
  };

  return (
    <div className="rounded-lg border bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="h-auto gap-1 py-1.5 text-xs whitespace-nowrap sm:h-9 sm:gap-2 sm:text-sm">
          <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          詳細フィルター
          {activeFilterCount > 0 && <span className="bg-primary ml-1 flex h-4 w-4 items-center justify-center rounded-full text-xs text-white sm:h-5 sm:w-5">{activeFilterCount}</span>}
        </Button>

        <div className="ml-auto flex flex-1 items-center gap-1 sm:flex-none sm:gap-2">
          <span className="text-xs whitespace-nowrap text-gray-500 sm:text-sm">並び替え:</span>
          <Select value={sortOption} onValueChange={(value) => onSortChangeAction(value as AuctionSortOption)}>
            <SelectTrigger className="h-8 min-w-[120px] text-xs sm:h-9 sm:w-[180px] sm:text-sm">
              <SelectValue placeholder="並び替え" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">新着順</SelectItem>
              <SelectItem value="time_remaining">終了時間が近い順</SelectItem>
              <SelectItem value="price_asc">価格が安い順</SelectItem>
              <SelectItem value="price_desc">価格が高い順</SelectItem>
              <SelectItem value="bids">入札数順</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {showFilters && (
        <div className="mt-4 border-t pt-4">
          <Accordion type="single" collapsible className="w-full" defaultValue="status">
            {categories.length > 0 && (
              <AccordionItem value="category">
                <AccordionTrigger className="py-2 text-sm">カテゴリー</AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-4">
                    {categories.map((category) => (
                      <div key={category} className="flex items-center space-x-2">
                        <RadioGroupItem value={category} id={`category-${category}`} />
                        <Label htmlFor={`category-${category}`} className="text-sm">
                          {category}
                        </Label>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            <AccordionItem value="status">
              <AccordionTrigger className="py-2 text-sm">ステータス</AccordionTrigger>
              <AccordionContent>
                <RadioGroup
                  value={filters.status || "all"}
                  onValueChange={(value) => onFilterChangeAction({ status: value as AuctionFilterParams["status"] })}
                  className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="all" />
                    <Label htmlFor="all" className="text-sm">
                      すべて
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="watchlist" id="watchlist" />
                    <Label htmlFor="watchlist" className="text-sm">
                      ウォッチリスト
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="not_bidded" id="not_bidded" />
                    <Label htmlFor="not_bidded" className="text-sm">
                      未入札
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="bidded" id="bidded" />
                    <Label htmlFor="bidded" className="text-sm">
                      入札済み
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ended" id="ended" />
                    <Label htmlFor="ended" className="text-sm">
                      終了済み
                    </Label>
                  </div>
                </RadioGroup>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="price">
              <AccordionTrigger className="text-sm">価格帯</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <Slider defaultValue={priceRange} min={0} max={10000} step={100} value={priceRange} onValueChange={handlePriceRangeChange} className="mt-6" />

                  <div className="flex justify-between text-sm">
                    <span>{priceRange[0].toLocaleString()} ポイント</span>
                    <span>{priceRange[1].toLocaleString()} ポイント</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-1/2">
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
                          setPriceRange([value, priceRange[1]]);
                        }}
                        className="border-input bg-background h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors"
                      />
                    </div>
                    <div className="w-1/2">
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
                          setPriceRange([priceRange[0], value]);
                        }}
                        className="border-input bg-background h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => setPriceRange([0, 1000])} className="text-xs">
                      ~1,000 P
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setPriceRange([1000, 5000])} className="text-xs">
                      1,000~5,000 P
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setPriceRange([5000, 10000])} className="text-xs">
                      5,000+ P
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => setPriceRange([0, 10000])} className="w-1/2">
                      リセット
                    </Button>
                    <Button type="button" size="sm" onClick={handlePriceRangeApply} className="w-1/2">
                      適用
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="time">
              <AccordionTrigger className="text-sm">残り時間</AccordionTrigger>
              <AccordionContent>
                <RadioGroup
                  value={filters.remainingTime || "all"}
                  onValueChange={(value) =>
                    onFilterChangeAction({
                      remainingTime: value as AuctionFilterParams["remainingTime"],
                    })
                  }
                  className="flex flex-col space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="time-all" />
                    <Label htmlFor="time-all">すべて</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="1h" id="time-1h" />
                    <Label htmlFor="time-1h">1時間以内</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="1d" id="time-1d" />
                    <Label htmlFor="time-1d">24時間以内</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="1w" id="time-1w" />
                    <Label htmlFor="time-1w">1週間以内</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="1m" id="time-1m" />
                    <Label htmlFor="time-1m">1ヶ月以内</Label>
                  </div>
                </RadioGroup>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="group">
              <AccordionTrigger className="text-sm">グループ</AccordionTrigger>
              <AccordionContent>
                <Select value={filters.groupId || ""} onValueChange={(value) => onFilterChangeAction({ groupId: value || undefined })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="グループを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">すべてのグループ</SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}

      {showFilters && activeFilterCount > 0 && (
        <div className="mt-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={handleResetFilters} className="flex items-center gap-2 text-red-500 hover:text-red-600">
            <X className="h-4 w-4" />
            フィルターをリセット
          </Button>
        </div>
      )}
    </div>
  );
}
