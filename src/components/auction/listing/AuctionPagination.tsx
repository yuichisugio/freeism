"use client";

import React from "react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/Pagination";
import { usePagination } from "@/hooks/auction/listing/usePagination";

// ページネーションのprops
type AuctionPaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChangeAction: (page: number) => void;
  showPageInfo?: boolean;
};

export default function AuctionPagination({ currentPage, totalPages, onPageChangeAction, showPageInfo = false }: AuctionPaginationProps) {
  // カスタムフックからページネーションロジックを取得
  const { pageNumbers, hasPreviousPage, hasNextPage } = usePagination({ currentPage, totalPages });

  return (
    <div className="flex flex-col items-center gap-2">
      <Pagination>
        <PaginationContent>
          {hasPreviousPage && (
            <PaginationItem>
              <PaginationPrevious onClick={() => onPageChangeAction(currentPage - 1)} />
            </PaginationItem>
          )}

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
                <PaginationLink isActive={page === currentPage} onClick={() => onPageChangeAction(page)}>
                  {page}
                </PaginationLink>
              </PaginationItem>
            );
          })}

          {hasNextPage && (
            <PaginationItem>
              <PaginationNext onClick={() => onPageChangeAction(currentPage + 1)} />
            </PaginationItem>
          )}
        </PaginationContent>
      </Pagination>

      {showPageInfo && (
        <div className="text-muted-foreground text-sm">
          {currentPage} / {totalPages} ページ
        </div>
      )}
    </div>
  );
}
