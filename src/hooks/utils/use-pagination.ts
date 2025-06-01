"use client";

import { useMemo } from "react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ページネーションフックのプロップ
 */
export type UsePaginationProps = {
  currentPage: number;
  totalPages: number;
  maxPageToShow: number; // 飛べるページの表示数を指定。これ以上の場合は「...」を表示
  totalCount: number;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ページネーションフックの返り値
 */
export type UsePaginationResult = {
  pageNumbers: number[];
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  totalPages: number;
  isFirstPage: boolean;
  isLastPage: boolean;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ページネーションフック
 * @param {UsePaginationProps} props ページネーションフックのプロップ
 * @returns {UsePaginationResult} ページネーションフックの返り値
 */
export function usePagination({ currentPage, totalPages, maxPageToShow = 10 }: UsePaginationProps): UsePaginationResult {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 表示するページ番号を生成
  const pageNumbers = useMemo(() => {
    const pages = [];

    // paginationの表示するページ数が、総ページ数より少ない場合
    if (totalPages <= maxPageToShow) {
      // 全ページ数が少ない場合は全て表示
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // 現在のページの周辺を表示（最大10ページ）
      let startPage: number;
      let endPage: number;

      // 現在のページが前半に位置する場合
      if (currentPage <= Math.ceil(maxPageToShow / 2)) {
        startPage = 1;
        endPage = maxPageToShow - 1; // 最後のページの前に「...」を表示するため
      }
      // 現在のページが後半に位置する場合
      else if (currentPage > totalPages - Math.floor(maxPageToShow / 2)) {
        startPage = totalPages - (maxPageToShow - 2); // 最初のページの後に「...」を表示するため
        endPage = totalPages;
      }
      // 現在のページが中央に位置する場合
      else {
        startPage = currentPage - Math.floor((maxPageToShow - 4) / 2); // 両端に「...」を表示するため
        endPage = startPage + (maxPageToShow - 4) - 1;
      }

      // ページ番号を追加
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      // 省略記号を追加
      if (startPage > 1) {
        if (startPage > 2) {
          pages.unshift(-1); // -1は「...」を示す
        }
        pages.unshift(1); // 最初のページは常に表示
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          pages.push(-2); // -2は「...」を示す
        }
        pages.push(totalPages); // 最後のページは常に表示
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

  // 最初のページかどうか
  const isFirstPage = useMemo(() => currentPage === 1, [currentPage]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 最後のページかどうか
  const isLastPage = useMemo(() => currentPage === totalPages, [currentPage, totalPages]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    pageNumbers,
    hasPreviousPage,
    hasNextPage,
    totalPages,
    isFirstPage,
    isLastPage,
  };
}
