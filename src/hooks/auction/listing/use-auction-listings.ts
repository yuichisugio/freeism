"use client";

import type { AuctionFilterTypes, AuctionListingResult, AuctionListingsConditions, AuctionSortField, SortDirection } from "@/lib/auction/type/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuctionCount, getAuctionListings } from "@/lib/auction/action/auction-listing";
import { toggleWatchlist } from "@/lib/auction/action/watchlist";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

type UseAuctionListingsReturn = {
  // state
  auctions: AuctionListingResult;
  totalAuctionsCount: number;
  listingsConditions: AuctionListingsConditions;
  isLoading: boolean;

  // action
  handleToggleWatchlist: (auctionId: string) => Promise<void>;
  setListingsConditions: (newListingsConditions: AuctionListingsConditions) => void;
};

/**
 * オークション一覧画面のロジックを管理するカスタムフック
 * @returns オークション一覧画面のロジック
 * @description オークション一覧画面のロジックを管理するカスタムフック
 */
export function useAuctionListings(): UseAuctionListingsReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ルーター
  const router = useRouter();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // URLからパラメータを取得
  const searchParams = useSearchParams();

  // ページ数のURLパラメータ
  const currentPage = Number(searchParams.get("page") ?? 1);

  // カテゴリのURLパラメータ（複数可能）
  const currentCategoriesParams = searchParams.getAll("category");
  const currentCategories = currentCategoriesParams.length > 0 ? currentCategoriesParams : ["すべて"];

  // ステータスのURLパラメータ（複数可能）
  const currentStatusParams = searchParams.getAll("status");
  const currentStatus = currentStatusParams.length > 0 ? currentStatusParams.map((status) => status as AuctionFilterTypes) : ["all" as const];

  // ソートのURLパラメータ
  const currentSort = searchParams.get("sort") as AuctionSortField | null;

  // ソートの降順/昇順の方向のURLパラメータ
  const currentSortDirection = searchParams.get("sort_direction") as SortDirection | null;

  // 検索クエリのURLパラメータ
  const currentQuery = searchParams.get("q");

  // 価格範囲フィルター
  const minBid = searchParams.get("min_bid") ? Number(searchParams.get("min_bid")) : null;
  const maxBid = searchParams.get("max_bid") ? Number(searchParams.get("max_bid")) : null;

  // 残り時間範囲フィルター (時間単位: 0-720時間 = 0-30日)
  const minRemainingTime = searchParams.get("min_remaining_time") ? Number(searchParams.get("min_remaining_time")) : null;
  const maxRemainingTime = searchParams.get("max_remaining_time") ? Number(searchParams.get("max_remaining_time")) : null;

  // グループリスト。複数あるのでgetAllで取得?groupId=1&groupId=2&groupId=3
  const groupIds = searchParams.getAll("group_id");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // オークション情報
  const [auctions, setAuctions] = useState<AuctionListingResult>([]);
  // 総オークション件数
  const [totalAuctionsCount, setTotalAuctionsCount] = useState<number>(0);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // フィルター状態。
  // 基本はuse-auction-filtersで使用するが、子コンポーネントに渡すために、ここで定義
  const [listingsConditions, setListingsConditions] = useState<AuctionListingsConditions>({
    categories: currentCategories,
    status: currentStatus,
    minBid: minBid,
    maxBid: maxBid,
    minRemainingTime: minRemainingTime,
    maxRemainingTime: maxRemainingTime,
    groupIds: groupIds.length > 0 ? groupIds : null,
    searchQuery: currentQuery,
    sort:
      currentSort && currentSortDirection
        ? [
            {
              field: currentSort,
              direction: currentSortDirection,
            },
          ]
        : null,
    page: currentPage,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ウォッチリストの変更を追跡
  const [watchlistChanges, setWatchlistChanges] = useState<Set<string>>(new Set());
  // ウォッチリストの変更を保存するタイムアウト
  const saveWatchlistTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // データ読み込み中の状態
  const [isLoading, setIsLoading] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * URLパラメータを更新する関数
   * 必要なパラメータのみURLに含める（デフォルト値は含めない）
   */
  const updateUrlParams = useCallback(
    (newListingsConditions: AuctionListingsConditions) => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      console.log("src/hooks/auction/listing/use-auction-listings.ts_updateUrlParams_start", newListingsConditions);
      console.log(
        "src/hooks/auction/listing/use-auction-listings.ts_updateUrlParams_sort",
        newListingsConditions.sort ? JSON.stringify(newListingsConditions.sort) : "null",
      );

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // URLパラメータを作成
      const params = new URLSearchParams();

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // ページ数
      if (newListingsConditions.page > 1) {
        params.set("page", String(newListingsConditions.page));
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // カテゴリ - 複数選択可能になったため、各カテゴリを追加
      if (newListingsConditions.categories && newListingsConditions.categories.length > 0) {
        // "すべて"が含まれる場合は他のカテゴリを無視
        if (newListingsConditions.categories.includes("すべて")) {
          // すべての場合はパラメータを追加しない（デフォルト値）
        } else {
          // 複数カテゴリを追加
          newListingsConditions.categories.forEach((category) => {
            if (category) params.append("category", category);
          });
        }
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // ステータス
      if (newListingsConditions.status && newListingsConditions.status.length > 0 && newListingsConditions.status[0] !== "all") {
        newListingsConditions.status.forEach((status) => {
          params.append("status", status);
        });
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // ソート - 複数選択可能になったため、最初のソート条件のみ使用
      if (newListingsConditions.sort && newListingsConditions.sort.length > 0) {
        console.log("src/hooks/auction/listing/use-auction-listings.ts_updateUrlParams_listingsConditions.sort_start");
        const firstSort = newListingsConditions.sort[0];

        if (firstSort.field) {
          params.set("sort", firstSort.field);
          console.log("src/hooks/auction/listing/use-auction-listings.ts_updateUrlParams_firstSort.field", firstSort.field);
        }

        // ソート方向
        if (firstSort.direction) {
          params.set("sort_direction", firstSort.direction);
          console.log("src/hooks/auction/listing/use-auction-listings.ts_updateUrlParams_firstSort.direction", firstSort.direction);
        }
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 検索クエリ
      if (newListingsConditions.searchQuery) {
        params.set("q", newListingsConditions.searchQuery);
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 価格範囲
      if (newListingsConditions.minBid !== null && newListingsConditions.minBid !== undefined && newListingsConditions.minBid !== 0) {
        params.set("min_bid", String(newListingsConditions.minBid));
      }
      if (newListingsConditions.maxBid !== null && newListingsConditions.maxBid !== undefined && newListingsConditions.maxBid !== 0) {
        params.set("max_bid", String(newListingsConditions.maxBid));
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 残り時間範囲
      if (
        newListingsConditions.minRemainingTime !== null &&
        newListingsConditions.minRemainingTime !== undefined &&
        newListingsConditions.minRemainingTime !== 0
      ) {
        params.set("min_remaining_time", String(newListingsConditions.minRemainingTime));
      }
      if (
        newListingsConditions.maxRemainingTime !== null &&
        newListingsConditions.maxRemainingTime !== undefined &&
        newListingsConditions.maxRemainingTime !== 0
      ) {
        params.set("max_remaining_time", String(newListingsConditions.maxRemainingTime));
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // グループID
      if (newListingsConditions.groupIds && newListingsConditions.groupIds.length > 0) {
        newListingsConditions.groupIds.forEach((id) => params.append("group_id", id));
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // URLパラメータを作成
      const newUrl = `/dashboard/auction${params.toString() ? `?${params.toString()}` : ""}`;

      console.log("src/hooks/auction/listing/use-auction-listings.ts_updateUrlParams_newUrl", newUrl);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 指定URLに画面遷移。scroll: false を追加してページスクロールを防止
      router.push(newUrl, { scroll: false });

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
    },
    [router],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークション一覧データと総件数を取得する関数
   * @returns Promise<void>
   */
  const getAuctionListingsData = useCallback(async (conditions: AuctionListingsConditions) => {
    console.log("src/hooks/auction/listing/use-auction-listings.ts_getAuctionListingsData_start", conditions);
    try {
      // データ取得中の状態
      setIsLoading(true);

      // オークション一覧データと総件数を並列で取得
      const [listingsResult, countResult] = await Promise.all([
        getAuctionListings({ listingsConditions: conditions }),
        getAuctionCount({ listingsConditions: conditions }),
      ]);

      // 結果の設定
      setAuctions(listingsResult);
      setTotalAuctionsCount(countResult);

      console.log("src/hooks/auction/listing/use-auction-listings.ts_getAuctionListingsData_success", {
        auctionsCount: listingsResult.length,
        totalCount: countResult,
      });
    } catch (error) {
      console.error("use-auction-listings_getAuctionListingsData_error", error);
    } finally {
      // データ取得中の状態を解除
      setIsLoading(false);
    }
  }, []); // 依存配列は空

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 初期データ読み込みとフィルタ条件変更時のデータ再取得
   */
  useEffect(() => {
    console.log("src/hooks/auction/listing/use-auction-listings.ts_useEffect[listingsConditions]_start", listingsConditions);
    void getAuctionListingsData(listingsConditions);
  }, [listingsConditions, getAuctionListingsData]); // listingsConditions が変更されたら再取得

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
          1000 * 60 * 10, // 10分後に保存 (例)
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
    // state
    auctions,
    totalAuctionsCount,
    listingsConditions,
    isLoading,

    // action
    handleToggleWatchlist,
    setListingsConditions: (newListingsConditions: AuctionListingsConditions) => {
      console.log("src/hooks/auction/listing/use-auction-listings.ts_setListingsConditions_newConditions", newListingsConditions);
      setListingsConditions(newListingsConditions);
      console.log("src/hooks/auction/listing/use-auction-listings.ts_setListingsConditions_after_state_update", newListingsConditions);
      updateUrlParams(newListingsConditions);
    },
  };
}
