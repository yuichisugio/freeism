"use client";

import { useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/share/table/table-dropdown-menu";
import { Button } from "@/components/ui/button";
import { PaginationNext, PaginationPrevious } from "@/components/ui/Pagination";
import { usePagination } from "@/hooks/utils/use-pagination";
import { AUCTION_HISTORY_CONSTANTS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ページネーションのprops
 */
type ShareTablePaginationProps = {
  currentPage: number;
  onPageChange: (page: number) => void;
  totalRowCount: number;
  itemPerPage: number;
  onItemPerPageChange: (itemPerPage: number) => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ページネーションのコンポーネント
 */
export function AuctionHistoryPagination({ pagination }: { pagination: ShareTablePaginationProps }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  /**
   * ページネーションのprops
   */
  const { currentPage, onPageChange, totalRowCount, itemPerPage, onItemPerPageChange } = pagination;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ページネーションの条件
   */
  // TotalPageを計算
  const calculatedTotalPages = useMemo(
    () => Math.ceil((totalRowCount ?? 0) / itemPerPage),
    [totalRowCount, itemPerPage],
  );
  // ページネーションの条件
  const { totalPages, pageNumbers, hasPreviousPage, hasNextPage, isFirstPage, isLastPage } = usePagination({
    totalPages: calculatedTotalPages,
    currentPage: currentPage ?? 1,
    maxPageToShow: 6,
  });
  // 表示アイテム範囲の計算
  const startItem = totalRowCount > 0 ? (currentPage - 1) * itemPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemPerPage, totalRowCount);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 表示件数のドロップダウンメニュー
   */
  const selectValue = [
    Math.floor(AUCTION_HISTORY_CONSTANTS.ITEMS_PER_PAGE / 5),
    Math.floor(AUCTION_HISTORY_CONSTANTS.ITEMS_PER_PAGE / 4),
    Math.floor(AUCTION_HISTORY_CONSTANTS.ITEMS_PER_PAGE / 3),
    Math.floor(AUCTION_HISTORY_CONSTANTS.ITEMS_PER_PAGE / 2),
    AUCTION_HISTORY_CONSTANTS.ITEMS_PER_PAGE,
  ]
    .filter((value) => value > 0)
    .sort((a, b) => a - b);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ページネーションのコンポーネント
   */
  return (
    <div className="flex items-center justify-between px-4 py-3">
      {/* 件数を表示 */}
      <div className="flex items-center">
        <div className="mr-4 text-sm font-medium text-neutral-600 focus:outline-none focus-visible:ring-0">
          {totalRowCount > 0 ? `${totalRowCount}件中${startItem}〜${endItem}件` : `0件 / 0件`}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="px-3 focus:outline-none focus-visible:ring-0">
              表示件数 / {itemPerPage}件
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 focus:outline-none focus-visible:ring-0">
            <DropdownMenuLabel>表示件数</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* DropdownMenuRadioGroupを使用して単一選択を実現 */}
            <DropdownMenuRadioGroup
              value={itemPerPage.toString()} // 現在のitemPerPageを文字列で設定
              onValueChange={(value: string) => {
                onItemPerPageChange(Number(value)); // 選択された値を数値に変換してコールバックを呼ぶ
              }}
            >
              {selectValue.map((value) => (
                <DropdownMenuRadioItem
                  key={value}
                  value={value.toString()} // valueも文字列で設定
                >
                  {value} 件
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* ページネーションのボタン */}
      {totalPages > 0 && (
        <div className="flex items-center space-x-1">
          {/* ページ番号を入力 */}
          <input
            type="number"
            placeholder="page"
            onChange={(e) => setTimeout(() => onPageChange(Number(e.target.value)), 2000)}
            className="w-20 rounded-md border border-blue-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors hover:bg-blue-50"
          />
          {/* 最初のページボタン */}
          {!isFirstPage && (
            <button
              onClick={() => onPageChange(1)}
              className="inline-flex h-8 items-center justify-center rounded-md border border-blue-200 bg-white px-3 text-sm shadow-sm transition-colors hover:bg-blue-50"
              aria-label="最初のページへ"
            >
              <ChevronsLeftIcon className="mr-1 h-4 w-4" />
              <span className="hidden sm:block">最初</span>
            </button>
          )}
          {/* 前のページ */}
          {hasPreviousPage && (
            <button
              onClick={() => onPageChange(currentPage - 1)}
              className="inline-flex h-8 items-center justify-center rounded-md border border-blue-200 bg-white px-5 text-sm shadow-sm transition-colors hover:bg-blue-50"
              aria-label="前のページへ"
            >
              <PaginationPrevious className="h-4 w-4" />
            </button>
          )}
          {/* ページ番号 */}
          <div className="flex items-center">
            {pageNumbers.map((page, index) => {
              if (page === -1 || page === -2) {
                return (
                  <div key={`ellipsis-${index}`} className="px-1">
                    <span className="text-neutral-500">...</span>
                  </div>
                );
              }
              const isActive = page === currentPage;
              return (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  disabled={isActive}
                  className={cn(
                    "mx-0.5 inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "cursor-not-allowed border border-blue-600 bg-blue-50 text-blue-600"
                      : "border border-blue-200 bg-white hover:bg-blue-50",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  {page}
                </button>
              );
            })}
          </div>
          {/* 次のページ */}
          {hasNextPage && (
            <button
              onClick={() => onPageChange(currentPage + 1)}
              className="inline-flex h-8 items-center justify-center rounded-md border border-blue-200 bg-white px-5 text-sm shadow-sm transition-colors hover:bg-blue-50"
              aria-label="次のページへ"
            >
              <PaginationNext className="h-4 w-4" />
            </button>
          )}
          {/* 最後のページボタン */}
          {!isLastPage && totalPages > 0 && (
            <button
              onClick={() => onPageChange(totalPages)}
              className="inline-flex h-8 items-center justify-center rounded-md border border-blue-200 bg-white px-3 text-sm shadow-sm transition-colors hover:bg-blue-50"
              aria-label="最後のページへ"
            >
              <span className="hidden sm:block">最後</span>
              <ChevronsRightIcon className="ml-1 h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
