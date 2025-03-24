"use client";

import type { AuctionFilterParams, AuctionSortOption } from "@/app/actions/auction";
import React, { useEffect, useState } from "react";
import { getUserGroups } from "@/app/actions/auction";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Filter } from "lucide-react";

type AuctionFiltersProps = {
  filters: AuctionFilterParams;
  onFilterChangeAction: (filters: Partial<AuctionFilterParams>) => void;
  sortOption: AuctionSortOption;
  onSortChangeAction: (sort: AuctionSortOption) => void;
};

export default function AuctionFilters({ filters, onFilterChangeAction, sortOption, onSortChangeAction }: AuctionFiltersProps) {
  // 価格範囲フィルター
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  // グループリスト
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  // フィルターパネルの表示状態
  const [showFilters, setShowFilters] = useState(false);

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

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-2">
          <Filter className="h-4 w-4" />
          詳細フィルター
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">並び替え:</span>
          <Select value={sortOption} onValueChange={(value) => onSortChangeAction(value as AuctionSortOption)}>
            <SelectTrigger className="h-9 w-[180px]">
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
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="status">
            <AccordionTrigger className="text-sm">ステータス</AccordionTrigger>
            <AccordionContent>
              <RadioGroup value={filters.status || "all"} onValueChange={(value) => onFilterChangeAction({ status: value as AuctionFilterParams["status"] })} className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all">すべて</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="watchlist" id="watchlist" />
                  <Label htmlFor="watchlist">ウォッチリスト</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="not_bidded" id="not_bidded" />
                  <Label htmlFor="not_bidded">未入札</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="bidded" id="bidded" />
                  <Label htmlFor="bidded">入札済み</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ended" id="ended" />
                  <Label htmlFor="ended">終了済み</Label>
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
                <Button size="sm" variant="outline" onClick={handlePriceRangeApply} className="w-full">
                  適用
                </Button>
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
      )}
    </div>
  );
}
