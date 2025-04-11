"use client";

import { memo } from "react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/Pagination";
import { usePagination } from "@/hooks/auction/listing/use-pagination";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションページネーションのprops
 */
type AuctionPaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChangeAction: (page: number) => void;
  showPageInfo?: boolean;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションページネーションコンポーネント
 * @param currentPage 現在のページ
 * @param totalPages 総ページ数
 * @param onPageChangeAction ページ変更アクション
 * @param showPageInfo ページ情報表示有無
 */
export const AuctionPagination = memo(function AuctionPagination({ currentPage, totalPages, onPageChangeAction, showPageInfo = false }: AuctionPaginationProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  console.log("src/components/auction/listing/auction-pagination.tsx_AuctionPagination_start");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // カスタムフックからページネーションロジックを取得
  const { pageNumbers, hasPreviousPage, hasNextPage } = usePagination({ currentPage, totalPages });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
});
