"use client";

import type { AuctionListingsConditions } from "@/types/auction-types";
import { memo, useMemo } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/Pagination";
import { usePagination } from "@/hooks/utils/use-pagination";
import { AUCTION_CONSTANTS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションページネーションのprops
 */
type AuctionPaginationProps = {
  listingsConditions: AuctionListingsConditions;
  setListingsConditionsAction: (newListingsConditions: AuctionListingsConditions) => void;
  totalAuctionsCount: number;
  auctionsCountPerPage: number;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションページネーションコンポーネント
 * @param currentPage 現在のページ
 * @param totalPages 総ページ数
 * @param showPageInfo ページ情報表示有無
 */
export const AuctionPagination = memo(function AuctionPagination({
  listingsConditions,
  setListingsConditionsAction,
  totalAuctionsCount,
  auctionsCountPerPage,
}: AuctionPaginationProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * totalAuctionsCount を使って totalPages を計算
   */
  const totalPages = useMemo(() => Math.ceil(totalAuctionsCount / AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE), [totalAuctionsCount]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ページネーションのボタンの基礎クラス
   */
  const baseButtonClass = useMemo(
    () => "hover:bg-black/5 bg-background flex h-10 w-10 items-center justify-center rounded-md border sm:w-auto sm:min-w-10 sm:px-3",
    [],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * カスタムフックからページネーションロジックを取得
   * @param currentPage 現在のページ
   * @param totalPages 総ページ数
   * @param totalCount 総件数
   */
  const { pageNumbers, hasPreviousPage, hasNextPage, isFirstPage, isLastPage } = usePagination({
    currentPage: listingsConditions.page,
    totalPages: totalPages,
    totalCount: totalAuctionsCount,
    maxPageToShow: AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ページネーションのボタンをクリックした際の処理
   * @param page クリックされたページの番号
   */
  const handlePageChange = (page: number) => {
    if (page === listingsConditions.page) return; // すでに表示中のページをクリックしても何もしない
    setListingsConditionsAction({ ...listingsConditions, page });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <>
      <div className="mt-8 flex justify-center">
        <div className="flex flex-col items-center gap-2">
          <Pagination>
            <PaginationContent className="flex-wrap gap-2">
              {/* 最初のページボタン */}
              {!isFirstPage && (
                <PaginationItem>
                  <PaginationLink className={cn(baseButtonClass)} onClick={() => handlePageChange(1)} aria-label="Go to first page">
                    <ChevronsLeftIcon className="size-4" />
                    <span className="hidden sm:ml-1 sm:inline">最初</span>
                  </PaginationLink>
                </PaginationItem>
              )}

              {/* 前のページに進むかどうか */}
              {hasPreviousPage && (
                <PaginationItem>
                  <PaginationPrevious
                    className={cn(baseButtonClass)}
                    onClick={() => handlePageChange(listingsConditions.page - 1)}
                    aria-label="Go to previous page"
                  />
                </PaginationItem>
              )}

              {/* ページネーションの表示 */}
              {pageNumbers.map((page, index) => {
                if (page === -1 || page === -2) {
                  return (
                    <PaginationItem key={`ellipsis-${index}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  );
                }

                const isActive = page === listingsConditions.page;

                return (
                  <PaginationItem key={page}>
                    <PaginationLink
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => handlePageChange(page)}
                      className={cn(baseButtonClass, isActive ? "bg-primary cursor-not-allowed bg-blue-100" : "hover:bg-black/10")}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}

              {/* 次のページに進むかどうか */}
              {hasNextPage && (
                <PaginationItem>
                  <PaginationNext
                    className={cn(baseButtonClass)}
                    aria-label="Go to next page"
                    onClick={() => handlePageChange(listingsConditions.page + 1)}
                  />
                </PaginationItem>
              )}

              {/* 最後のページボタン */}
              {!isLastPage && (
                <PaginationItem>
                  <PaginationLink className={cn(baseButtonClass)} onClick={() => handlePageChange(totalPages)} aria-label="Go to last page">
                    <span className="hidden sm:mr-1 sm:inline">最後</span>
                    <ChevronsRightIcon className="size-4" />
                  </PaginationLink>
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
        </div>
      </div>

      {/* 現在のページと総ページ数の表示 */}
      <div className="mt-4 text-center text-sm text-gray-500">
        {listingsConditions.page} / {totalPages} ページ
      </div>

      {/* 商品数と合計ページ数の表示 (totalAuctionsCount を使用) */}
      <div className="mt-2 text-center text-sm text-gray-500">
        全{totalAuctionsCount}件中
        {Math.min(AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE, totalAuctionsCount, auctionsCountPerPage)}件を表示
      </div>
    </>
  );
});
