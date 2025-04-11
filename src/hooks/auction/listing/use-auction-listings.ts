"use client";

import type { AuctionFilterParams, AuctionListingResult, AuctionSortOption } from "@/lib/auction/type/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebounce } from "@/hooks/auction/bid/use-debounce";
import { getAuctionCategories, getAuctionListings, getAuctionPageSize } from "@/lib/auction/action/auction-listing";
import { toggleWatchlist } from "@/lib/auction/action/watchlist";
import { AUCTION_CONSTANTS } from "@/lib/auction/constants";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

type UseAuctionListingsReturn = {
  categories: string[];
  pageSize: number;
  auctions: AuctionListingResult["items"];
  totalCount: number;
  totalPages: number;
  searchQuery: string;
  filters: AuctionFilterParams;
  sortOption: AuctionSortOption;
  page: number;
  userPoints: number;
  isPending: boolean;
  setSearchQuery: (query: string) => void;
  handlePageChange: (newPage: number) => void;
  handleFilterChange: (newFilters: Partial<AuctionFilterParams>) => void;
  handleSortChange: (newSort: AuctionSortOption) => void;
  handleResetFilters: () => void;
  handleToggleWatchlist: (auctionId: string) => Promise<void>;
};

/**
 * オークション一覧画面のロジックを管理するカスタムフック
 * @returns オークション一覧画面のロジック
 * @description オークション一覧画面のロジックを管理するカスタムフック
 */
export function useAuctionListings(): UseAuctionListingsReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  // Next.js関連
  const router = useRouter();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // URLからパラメータを取得
  const searchParams = useSearchParams();

  // ページ数のURLパラメータ
  const currentPage = Number(searchParams.get("page") ?? "1");

  // カテゴリのURLパラメータ
  const currentCategory = searchParams.get("category") ?? "すべて";

  // ステータスのURLパラメータ
  const currentStatus = (searchParams.get("status") ?? "all") as AuctionFilterParams["status"];

  // ソートのURLパラメータ
  const currentSort = (searchParams.get("sort") ?? "newest") as AuctionSortOption;

  // 検索クエリのURLパラメータ
  const currentQuery = searchParams.get("q") ?? "";

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // カテゴリと表示件数。直接定数からデフォルト値を設定
  const [categories, setCategories] = useState<string[]>(AUCTION_CONSTANTS.AUCTION_CATEGORIES);

  // 表示件数
  const [pageSize, setPageSize] = useState(AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // オークション情報
  const [auctions, setAuctions] = useState<AuctionListingResult["items"]>([]);
  // 合計件数
  const [totalCount, setTotalCount] = useState(0);
  // 合計ページ数
  const [totalPages, setTotalPages] = useState(1);
  // ユーザーポイント
  const [userPoints, setUserPoints] = useState(0);
  // 検索クエリ
  const [searchQuery, setSearchQuery] = useState(currentQuery);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // カスタムフックから、デバンスした検索クエリを取得.特定のイベントが発生してから一定期間処理を待機し、その期間内に同じイベントが発生しなかった場合にのみ関数を実行する手法
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // フィルター状態
  const [filters, setFilters] = useState<AuctionFilterParams>({
    category: currentCategory,
    status: currentStatus,
    searchQuery: currentQuery,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ソート状態
  const [sortOption, setSortOption] = useState<AuctionSortOption>(currentSort);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ページネーション
  const [page, setPage] = useState(currentPage);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ウォッチリストの変更を追跡
  const [watchlistChanges, setWatchlistChanges] = useState<Set<string>>(new Set());
  const saveWatchlistTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // データ読み込み中の状態
  const [isPending, setIsPending] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークション一覧データを取得する関数
   * @returns Promise<void>
   */
  const getAuctionListingsData = useCallback(async () => {
    try {
      // ーーーーーーーーーーーーーーー

      // オークション一覧データを取得
      const result = await getAuctionListings({ page, pageSize, filters, sort: sortOption });

      // ーーーーーーーーーーーーーーー

      // 結果の設定
      setAuctions(result.items);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
      setUserPoints(result.userTotalPoints);

      // ーーーーーーーーーーーーーーー

      // 成功ログ
      console.log("use-auction-listings_fetchListings_success", { totalCount: result.totalCount, totalPages: result.totalPages, itemsCount: result.items.length });

      // ーーーーーーーーーーーーーーー
    } catch (error) {
      // エラーログ
      console.error("use-auction-listings_fetchListings_error", error);
      // 必要に応じてエラー状態を設定するなどの処理を追加
    }
  }, [page, pageSize, filters, sortOption]); // 依存関係を維持

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 初期データ（カテゴリ一覧とページサイズ）を取得する関数
   * @returns Promise<void>
   */
  const getAuctionCategoriesAndPagesize = useCallback(async () => {
    try {
      console.log("use-auction-listings_loadInitialData_start");

      // ーーーーーーーーーーーーーーー

      // カテゴリとページサイズを並行して取得（パフォーマンス最適化）
      const [categoriesData, pageSizeData] = await Promise.all([getAuctionCategories(), getAuctionPageSize()]);

      // ーーーーーーーーーーーーーーー

      // カテゴリデータのバリデーション。カテゴリデータが存在し、配列で、要素が1以上の場合。
      if (categoriesData && Array.isArray(categoriesData) && categoriesData.length > 0) {
        // カテゴリデータをstateに保存
        setCategories(categoriesData);
      } else {
        // 無効なカテゴリデータの場合、エラーログを出力
        console.error("use-auction-listings_loadInitialData_invalidCategories", categoriesData);
      }

      // ーーーーーーーーーーーーーーー

      // ページサイズの設定
      setPageSize(pageSizeData);
      // 成功ログ
      console.log("use-auction-listings_loadInitialData_success", { categories: categoriesData?.length || 0, pageSize: pageSizeData });

      // ーーーーーーーーーーーーーーー
    } catch (error) {
      // エラーログ
      console.error("use-auction-listings_loadInitialData_error", error);
    }
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * URLパラメータを更新する関数
   * 無限ループを防ぐため、適切なタイミングでのみ呼び出す
   */
  const updateUrlParams = useCallback(() => {
    // ーーーーーーーーーーーーーーー

    // URLパラメータを作成
    const params = new URLSearchParams();

    // ーーーーーーーーーーーーーーー

    // 必要なパラメータのみURLに含める（デフォルト値は含めない）
    if (page > 1) params.set("page", String(page));
    if (filters.category && filters.category !== "すべて") params.set("category", filters.category);
    if (filters.status && filters.status !== "all") params.set("status", filters.status);
    if (sortOption !== "newest") params.set("sort", sortOption);
    if (filters.searchQuery) params.set("q", filters.searchQuery);

    // ーーーーーーーーーーーーーーー

    // URLパラメータを作成
    const newUrl = `/dashboard/auction${params.toString() ? `?${params.toString()}` : ""}`;

    // ーーーーーーーーーーーーーーー

    // 指定URLに画面遷移。scroll: false を追加してページスクロールを防止
    router.push(newUrl, { scroll: false });

    // ーーーーーーーーーーーーーーー
  }, [page, filters, sortOption, router]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データ取得とURL更新を行う共通処理（各種ハンドラから呼び出される）
   * @returns Promise<void>
   */
  const fetchDataAndUpdateUrl = useCallback(async () => {
    try {
      setIsPending(true);
      console.log("use-auction-listings_fetchDataAndUpdateUrl_start", {
        page,
        category: filters.category,
        status: filters.status,
        sort: sortOption,
        searchQuery: filters.searchQuery,
      }); // リクエスト情報
      // URL更新（無限ループを防ぐためにuseEffectではなくハンドラ内で呼び出す）
      updateUrlParams();
      // データ取得
      await getAuctionListingsData();
    } finally {
      setIsPending(false);
    }
  }, [getAuctionListingsData, updateUrlParams, page, filters, sortOption]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 初期設定データの取得と初回データ読み込み
   */
  useEffect(() => {
    // マウント時に1回だけ実行
    const initializeData = async () => {
      setIsPending(true);
      try {
        await getAuctionCategoriesAndPagesize();
        await getAuctionListingsData();
      } finally {
        setIsPending(false);
      }
    };

    void initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 依存配列を空にして初回レンダリング時のみ実行（無限ループ防止）

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 検索クエリ変更時
   * @param debouncedSearchQuery デバンスした検索クエリ
   * @param filters.searchQuery フィルターの検索クエリ
   * @param fetchDataAndUpdateUrl データ取得とURL更新
   */
  useEffect(() => {
    if (debouncedSearchQuery !== filters.searchQuery) {
      setFilters((prev) => ({ ...prev, searchQuery: debouncedSearchQuery }));
      setPage(1); // 検索時は1ページ目に戻す
      // 検索クエリ変更時にデータ取得とURL更新
      void fetchDataAndUpdateUrl();
    }
  }, [debouncedSearchQuery, filters.searchQuery, fetchDataAndUpdateUrl]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ページ変更ハンドラ
   * @param newPage 新しいページ
   * @returns Promise<void>
   */
  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      // ページ変更時にデータ取得とURL更新
      void fetchDataAndUpdateUrl();
    },
    [fetchDataAndUpdateUrl],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルター変更ハンドラ
   * @param newFilters 新しいフィルター
   * @returns Promise<void>
   */
  const handleFilterChange = useCallback(
    (newFilters: Partial<AuctionFilterParams>) => {
      setFilters((prev) => ({ ...prev, ...newFilters }));
      setPage(1); // フィルター変更時は1ページ目に戻す
      // フィルター変更時にデータ取得とURL更新
      void fetchDataAndUpdateUrl();
    },
    [fetchDataAndUpdateUrl],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ソート変更ハンドラ
   * @param newSort 新しいソートオプション
   * @returns Promise<void>
   */
  const handleSortChange = useCallback(
    (newSort: AuctionSortOption) => {
      setSortOption(newSort);
      setPage(1); // ソート変更時は1ページ目に戻す
      // ソート変更時にデータ取得とURL更新
      void fetchDataAndUpdateUrl();
    },
    [fetchDataAndUpdateUrl],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルターリセットハンドラ
   * @returns Promise<void>
   */
  const handleResetFilters = useCallback(() => {
    setFilters({
      category: "すべて",
      status: "all",
      searchQuery: "",
    });
    setSearchQuery("");
    setSortOption("newest");
    setPage(1);
    // リセット後にデータ取得とURL更新
    void fetchDataAndUpdateUrl();
  }, [fetchDataAndUpdateUrl]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ウォッチリスト
   * ウォッチリスト切り替えハンドラ
   * @param auctionId オークションID
   * @returns Promise<void>
   */
  const handleToggleWatchlist = useCallback(
    async (auctionId: string) => {
      try {
        // 楽観的UI更新
        setAuctions((prev) => prev.map((auction) => (auction.id === auctionId ? { ...auction, isWatched: !auction.isWatched } : auction)));

        // 変更を追跡
        setWatchlistChanges((prev) => {
          const newChanges = new Set(prev);
          if (newChanges.has(auctionId)) {
            newChanges.delete(auctionId);
          } else {
            newChanges.add(auctionId);
          }
          return newChanges;
        });

        // 既存のタイマーをクリア
        if (saveWatchlistTimeoutRef.current) {
          clearTimeout(saveWatchlistTimeoutRef.current);
        }

        // 一定時間後に一括保存
        saveWatchlistTimeoutRef.current = setTimeout(
          () => {
            if (watchlistChanges.size > 0) {
              // 各変更を処理
              const changes = Array.from(watchlistChanges);
              for (const id of changes) {
                void toggleWatchlist(id).catch((error) => {
                  console.error("ウォッチリストの更新に失敗しました", error);
                });
              }
              // 変更リストをクリア
              setWatchlistChanges(new Set());
            }
          },
          1000 * 60 * 10,
        );
      } catch (error) {
        console.error("ウォッチリストの更新に失敗しました", error);
      }
    },
    [watchlistChanges],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ウォッチリスト
   * 画面を離れる時に未保存のウォッチリストの変更を保存
   */
  useEffect(() => {
    return () => {
      // クリーンアップ関数：コンポーネントがアンマウントされる時に実行。そのためクリーンアップ部分に記載
      const saveRemainingChanges = async () => {
        if (watchlistChanges.size > 0) {
          const changes = Array.from(watchlistChanges);
          for (const id of changes) {
            void toggleWatchlist(id).catch((error) => {
              console.error("クリーンアップ時のウォッチリスト更新に失敗しました", error);
            });
          }
        }
      };

      if (saveWatchlistTimeoutRef.current) {
        clearTimeout(saveWatchlistTimeoutRef.current);
      }

      void saveRemainingChanges();
    };
  }, [watchlistChanges]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    // 総合的なローディング状態を返す
    categories,
    pageSize,
    auctions,
    totalCount,
    totalPages,
    searchQuery,
    filters,
    sortOption,
    page,
    userPoints,
    isPending,
    setSearchQuery,
    handlePageChange,
    handleFilterChange,
    handleSortChange,
    handleResetFilters,
    handleToggleWatchlist,
  };
}
