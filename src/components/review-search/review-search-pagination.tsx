"use client";

import { memo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ページネーション用の型定義
 */
export type ReviewPaginationProps = {
  currentPage: number; // 現在のページ番号
  totalPages: number; // 総ページ数
  onPageChange: (page: number) => void; // ページ変更時のコールバック
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ページネーションコンポーネント
 * 大量のレビューデータを複数ページに分けて表示する際に使用
 * 現在のページ周辺のページ番号を表示し、効率的なナビゲーションを提供
 */
export const ReviewPagination = memo(function ReviewPagination({
  currentPage,
  totalPages,
  onPageChange,
}: ReviewPaginationProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 表示する最大ページ番号ボタン数
   */
  const maxVisiblePages = 7;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 表示するページ番号の範囲を計算
   */
  const getVisiblePageNumbers = useCallback(() => {
    if (totalPages <= maxVisiblePages) {
      // 総ページ数が最大表示数以下の場合、すべてのページを表示
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const halfVisible = Math.floor(maxVisiblePages / 2);
    let start = currentPage - halfVisible;
    let end = currentPage + halfVisible;

    // 開始ページが1未満にならないよう調整
    if (start < 1) {
      start = 1;
      end = Math.min(maxVisiblePages, totalPages);
    }

    // 終了ページが総ページ数を超えないよう調整
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, totalPages - maxVisiblePages + 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [currentPage, totalPages, maxVisiblePages]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 表示するページ番号の範囲を計算
   */
  const visiblePages = getVisiblePageNumbers();
  const showFirstPage = visiblePages[0] > 1; // 最初のページを個別表示するか
  const showLastPage = visiblePages[visiblePages.length - 1] < totalPages; // 最後のページを個別表示するか
  const showStartEllipsis = visiblePages[0] > 2; // 開始省略記号を表示するか
  const showEndEllipsis = visiblePages[visiblePages.length - 1] < totalPages - 1; // 終了省略記号を表示するか

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ページネーションの表示
   */
  return (
    <div className="flex items-center justify-center gap-1">
      {/* 前のページボタン */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-gray-700"
      >
        <ChevronLeft className="h-4 w-4" />
        前へ
      </Button>

      {/* 最初のページ（1ページ目）*/}
      {showFirstPage && (
        <>
          <Button
            variant={currentPage === 1 ? "default" : "outline"}
            size="sm"
            onClick={() => onPageChange(1)}
            className={`min-w-[40px] rounded-md px-3 py-2 text-sm font-medium ${
              currentPage === 1
                ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            1
          </Button>
          {showStartEllipsis && (
            <span className="flex items-center px-2 text-gray-500">
              <MoreHorizontal className="h-4 w-4" />
            </span>
          )}
        </>
      )}

      {/* 表示範囲内のページ番号 */}
      {visiblePages.map((pageNum) => (
        <Button
          key={pageNum}
          variant={currentPage === pageNum ? "default" : "outline"}
          size="sm"
          onClick={() => onPageChange(pageNum)}
          className={`min-w-[40px] rounded-md px-3 py-2 text-sm font-medium ${
            currentPage === pageNum
              ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
              : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900"
          }`}
        >
          {pageNum}
        </Button>
      ))}

      {/* 最後のページ */}
      {showLastPage && (
        <>
          {showEndEllipsis && (
            <span className="flex items-center px-2 text-gray-500">
              <MoreHorizontal className="h-4 w-4" />
            </span>
          )}
          <Button
            variant={currentPage === totalPages ? "default" : "outline"}
            size="sm"
            onClick={() => onPageChange(totalPages)}
            className={`min-w-[40px] rounded-md px-3 py-2 text-sm font-medium ${
              currentPage === totalPages
                ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            {totalPages}
          </Button>
        </>
      )}

      {/* 次のページボタン */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-gray-700"
      >
        次へ
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
});
