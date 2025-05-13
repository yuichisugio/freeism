"use client";

import { useMemo } from "react";
import { PaginationNext, PaginationPrevious } from "@/components/ui/Pagination";
import { usePagination } from "@/hooks/utils/use-pagination";
import { TABLE_CONSTANTS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ページネーションのprops
 */
export type ShareTablePaginationProps = {
  currentPage: number;
  onPageChange: (page: number) => void;
  totalRowCount: number;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ページネーションのコンポーネント
 */
export function ShareTablePagination({ pagination }: { pagination: ShareTablePaginationProps }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  /**
   * ページネーションのprops
   */
  const { currentPage, onPageChange, totalRowCount } = pagination;

  /**
   * ページネーションの条件
   */
  // TotalPageを計算
  const calculatedTotalPages = useMemo(() => Math.ceil((totalRowCount ?? 0) / TABLE_CONSTANTS.ITEMS_PER_PAGE), [totalRowCount]);
  // ページネーションの条件
  const { totalPages, pageNumbers, hasPreviousPage, hasNextPage, isFirstPage, isLastPage } = usePagination({
    totalPages: calculatedTotalPages,
    currentPage: currentPage ?? 1,
    maxPageToShow: TABLE_CONSTANTS.ITEMS_PER_PAGE,
    totalCount: totalRowCount ?? 0,
  });
  // 表示アイテム範囲の計算
  const startItem = totalRowCount > 0 ? (currentPage - 1) * TABLE_CONSTANTS.ITEMS_PER_PAGE + 1 : 0;
  const endItem = Math.min(currentPage * TABLE_CONSTANTS.ITEMS_PER_PAGE, totalRowCount);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ページネーションのコンポーネント
   */
  return (
    <div className="flex items-center justify-between border-t border-blue-100 px-4 py-3">
      <div className="text-sm font-medium text-neutral-600">{totalRowCount > 0 ? `${startItem}-${endItem} / ${totalRowCount}件` : `0 / 0件`}</div>
      {totalPages > 0 && (
        <div className="flex items-center space-x-1">
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
