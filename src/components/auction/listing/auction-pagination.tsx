"use client";

import type { AuctionListingResult, AuctionListingsConditions } from "@/lib/auction/type/types";
import { memo } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/Pagination";
import { usePagination } from "@/hooks/auction/listing/use-pagination";
import { AUCTION_CONSTANTS } from "@/lib/auction/constants";
import { ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションページネーションのprops
 */
type AuctionPaginationProps = {
  listingsConditions: AuctionListingsConditions;
  setListingsConditionsAction: (newListingsConditions: AuctionListingsConditions) => void;
  auctions: AuctionListingResult;
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
  auctions,
}: AuctionPaginationProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  console.log("src/components/auction/listing/auction-pagination.tsx_AuctionPagination_start");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // カスタムフックからページネーションロジックを取得
  const { pageNumbers, hasPreviousPage, hasNextPage, isFirstPage, isLastPage } = usePagination({
    currentPage: listingsConditions.page,
    totalPages: Math.ceil(auctions.length / AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE),
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const handlePageChange = (page: number) => {
    setListingsConditionsAction({ ...listingsConditions, page });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const totalPages = Math.ceil(auctions.length / AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  if (totalPages <= 1) return null;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <>
      <div className="mt-8 flex justify-center">
        <div className="flex flex-col items-center gap-2">
          <Pagination>
            <PaginationContent className="flex-wrap gap-1 md:gap-2">
              {/* 最初のページボタン */}
              {!isFirstPage && (
                <PaginationItem>
                  <PaginationLink
                    className="bg-background hidden h-9 min-w-9 rounded-md border text-xs md:flex md:items-center md:justify-center md:px-3 md:py-2 md:text-sm"
                    onClick={() => handlePageChange(1)}
                  >
                    <ChevronsLeftIcon className="size-4 md:mr-1" />
                    <span className="hidden md:inline">最初</span>
                  </PaginationLink>
                </PaginationItem>
              )}

              {/* 前のページに進むかどうか */}
              {hasPreviousPage && (
                <PaginationItem>
                  <PaginationPrevious className="bg-background h-9 rounded-md border" onClick={() => handlePageChange(listingsConditions.page - 1)} />
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

                return (
                  <PaginationItem key={page}>
                    <PaginationLink
                      className={`bg-background h-9 min-w-9 rounded-md border ${
                        page === listingsConditions.page
                          ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                          : "hover:border-primary hover:bg-primary/10"
                      }`}
                      isActive={page === listingsConditions.page}
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}

              {/* 次のページに進むかどうか */}
              {hasNextPage && (
                <PaginationItem>
                  <PaginationNext className="bg-background h-9 rounded-md border" onClick={() => handlePageChange(listingsConditions.page + 1)} />
                </PaginationItem>
              )}

              {/* 最後のページボタン */}
              {!isLastPage && (
                <PaginationItem>
                  <PaginationLink
                    className="bg-background hidden h-9 min-w-9 rounded-md border text-xs md:flex md:items-center md:justify-center md:px-3 md:py-2 md:text-sm"
                    onClick={() => handlePageChange(totalPages)}
                  >
                    <span className="hidden md:inline">最後</span>
                    <ChevronsRightIcon className="size-4 md:ml-1" />
                  </PaginationLink>
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>

          {/* 現在のページと総ページ数の表示 */}
          <div className="text-muted-foreground text-sm">
            {listingsConditions.page} / {totalPages} ページ
          </div>
        </div>
      </div>

      {/* 商品数と合計ページ数の表示 */}
      <div className="mt-4 text-center text-sm text-gray-500">
        全{auctions.length}件中
        {Math.min(listingsConditions.page * AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE, auctions.length)}件を表示
      </div>
    </>
  );
});
