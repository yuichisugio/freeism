"use client";

import { useMemo } from "react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ページネーションフックのプロップ
 */
type UsePaginationProps = {
  currentPage: number;
  totalPages: number;
  maxPageToShow?: number;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ページネーションフックの返り値
 */
type UsePaginationResult = {
  pageNumbers: number[];
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  totalPages: number;
  currentPage: number;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ページネーションフック
 * @param {UsePaginationProps} props ページネーションフックのプロップ
 * @returns {UsePaginationResult} ページネーションフックの返り値
 */
export function usePagination({ currentPage, totalPages, maxPageToShow = 7 }: UsePaginationProps): UsePaginationResult {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 表示するページ番号を生成
  const pageNumbers = useMemo(() => {
    const pages = [];

    if (totalPages <= maxPageToShow) {
      // 全ページ数が少ない場合は全て表示
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // 現在のページの前後を表示
      let startPage = Math.max(1, currentPage - Math.floor(maxPageToShow / 2));
      const endPage = Math.min(totalPages, startPage + maxPageToShow - 1);

      // endPageが上限を超えた場合、startPageを調整
      if (endPage === totalPages) {
        startPage = Math.max(1, endPage - maxPageToShow + 1);
      }

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
  }, [currentPage, totalPages, maxPageToShow]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 前のページに進むかどうか
  const hasPreviousPage = useMemo(() => currentPage > 1, [currentPage]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 次のページに進むかどうか
  const hasNextPage = useMemo(() => currentPage < totalPages, [currentPage, totalPages]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    pageNumbers,
    hasPreviousPage,
    hasNextPage,
    totalPages,
    currentPage,
  };
}
