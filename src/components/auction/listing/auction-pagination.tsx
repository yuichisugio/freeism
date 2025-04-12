"use client";

import type { AuctionListingResult, AuctionListingsConditions } from "@/lib/auction/type/types";
import { memo } from "react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/Pagination";
import { usePagination } from "@/hooks/auction/listing/use-pagination";
import { AUCTION_CONSTANTS } from "@/lib/auction/constants";

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
  const { pageNumbers, hasPreviousPage, hasNextPage } = usePagination({
    currentPage: listingsConditions.page,
    totalPages: Math.ceil(auctions.length / AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE),
    maxPageToShow: 5,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="flex flex-col items-center gap-2">
      <Pagination>
        <PaginationContent>
          {/* 前のページに進むかどうか */}
          {hasPreviousPage && (
            <PaginationItem>
              <PaginationPrevious onClick={() => setListingsConditionsAction({ ...listingsConditions, page: listingsConditions.page - 1 })} />
            </PaginationItem>
          )}

          {/* ページネーションの表示 */}
          {pageNumbers.map((page, index) => {
            if (page === -1 || page === -2) {
              return (
                <PaginationItem key={`ellipsis-${index}`}>
                  <span className="flex size-9 items-center justify-center">...</span>
                </PaginationItem>
              );
            }

            return (
              <PaginationItem key={page}>
                <PaginationLink
                  isActive={page === listingsConditions.page}
                  onClick={() => setListingsConditionsAction({ ...listingsConditions, page })}
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            );
          })}

          {/* 次のページに進むかどうか */}
          {hasNextPage && (
            <PaginationItem>
              <PaginationNext onClick={() => setListingsConditionsAction({ ...listingsConditions, page: listingsConditions.page + 1 })} />
            </PaginationItem>
          )}
        </PaginationContent>
      </Pagination>

      <div className="text-muted-foreground text-sm">
        {listingsConditions.page} / {auctions.length / AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE} ページ
      </div>
    </div>
  );
});
