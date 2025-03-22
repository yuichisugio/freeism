import React from "react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/Pagination";

interface CustomPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function CustomPagination({ currentPage, totalPages, onPageChange }: CustomPaginationProps) {
  // 表示するページ番号を生成
  const getPageNumbers = () => {
    const pages = [];
    const maxPageToShow = 5;

    if (totalPages <= maxPageToShow) {
      // 全ページ数が少ない場合は全て表示
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // 現在のページの前後を表示
      const startPage = Math.max(1, currentPage - 2);
      const endPage = Math.min(totalPages, startPage + maxPageToShow - 1);

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      // 最初のページに...を追加
      if (startPage > 1) {
        pages.unshift(-1); // -1は省略記号を示す
        pages.unshift(1);
      }

      // 最後のページに...を追加
      if (endPage < totalPages) {
        pages.push(-2); // -2は省略記号を示す
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <Pagination>
      <PaginationContent>
        {currentPage > 1 && (
          <PaginationItem>
            <PaginationPrevious onClick={() => onPageChange(currentPage - 1)} />
          </PaginationItem>
        )}

        {getPageNumbers().map((page, index) => {
          if (page === -1 || page === -2) {
            return (
              <PaginationItem key={`ellipsis-${index}`}>
                <span className="flex size-9 items-center justify-center">...</span>
              </PaginationItem>
            );
          }

          return (
            <PaginationItem key={page}>
              <PaginationLink isActive={page === currentPage} onClick={() => onPageChange(page)}>
                {page}
              </PaginationLink>
            </PaginationItem>
          );
        })}

        {currentPage < totalPages && (
          <PaginationItem>
            <PaginationNext onClick={() => onPageChange(currentPage + 1)} />
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
}
