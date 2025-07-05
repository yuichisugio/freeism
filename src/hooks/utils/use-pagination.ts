"use client";

import { useMemo } from "react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ページネーションフックのプロップ。
 * maxPageToShowは、飛べるページのボタンの表示数を指定。これ以上の場合は「...」を表示。
 */
export type UsePaginationProps = {
  currentPage: number;
  totalPages: number;
  maxPageToShow: number;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ページネーションフックの返り値
 * -1は、ページ番号の前に「...」を示し、続きのページがあることを示す。
 * -2は、ページ番号の後に「...」を示す。
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
export function usePagination({ currentPage, totalPages, maxPageToShow }: UsePaginationProps): UsePaginationResult {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * プロップが無効な場合はエラーを投げる
   */
  if (
    !currentPage ||
    !totalPages ||
    !maxPageToShow ||
    !Number.isSafeInteger(currentPage) ||
    !Number.isSafeInteger(totalPages) ||
    !Number.isSafeInteger(maxPageToShow) ||
    currentPage < 1 ||
    totalPages < 1 ||
    maxPageToShow < 1
  ) {
    throw new Error("ページネーションフックのプロップが無効です。");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 表示するページ番号を生成
   */
  const pageNumbers: number[] = useMemo(() => {
    const pages: number[] = [];

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

      // 現在のページが前半に位置する場合。Math.ceilは切り上げ
      if (currentPage <= Math.ceil(maxPageToShow / 2)) {
        startPage = 1;
        endPage = maxPageToShow - 1; // 最後のページの前に「...」を表示するため
      }
      // 現在のページが後半に位置する場合。Math.floorは切り捨て
      else if (currentPage > totalPages - Math.floor(maxPageToShow / 2)) {
        startPage = totalPages - (maxPageToShow - 2); // 最初のページの後に「...」を表示するため
        endPage = totalPages;
      }
      // 現在のページが中央に位置する場合。Math.floorは切り捨て
      else {
        startPage = currentPage - Math.floor((maxPageToShow - 4) / 2); // 両端に「...」を表示するため
        endPage = startPage + (maxPageToShow - 4) - 1;
      }

      // ページ番号を追加
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      // 省略記号を追加。.unshiftは配列の先頭に追加
      if (startPage > 1) {
        if (startPage > 2) {
          pages.unshift(-1); // -1は「...」を示す
        }
        pages.unshift(1); // 最初のページは常に表示
      }

      // 省略記号を追加。.pushは配列の末尾に追加
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          pages.push(-2); // -2は「...」を示す
        }
        pages.push(totalPages); // 最後のページは常に表示
      }
    }

    return pages;
  }, [currentPage, totalPages, maxPageToShow]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 前のページに進むかどうか
   */
  const hasPreviousPage = useMemo(() => currentPage > 1, [currentPage]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 次のページに進むかどうか
   */
  const hasNextPage = useMemo(() => currentPage < totalPages, [currentPage, totalPages]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 最初のページかどうか
   */
  const isFirstPage = useMemo(() => currentPage === 1, [currentPage]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 最後のページかどうか
   */
  const isLastPage = useMemo(() => currentPage === totalPages, [currentPage, totalPages]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ページネーションフックの返り値
   */
  return {
    pageNumbers,
    hasPreviousPage,
    hasNextPage,
    totalPages,
    isFirstPage,
    isLastPage,
  };
}
