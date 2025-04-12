"use client";

import type { AuctionListingResult, AuctionListingsConditions, AuctionSortField, SortDirection } from "@/lib/auction/type/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuctionListings } from "@/lib/auction/action/auction-listing";
import { toggleWatchlist } from "@/lib/auction/action/watchlist";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

type UseAuctionListingsReturn = {
  // state
  auctions: AuctionListingResult;
  listingsConditions: AuctionListingsConditions;
  isLoading: boolean;

  // action
  handleToggleWatchlist: (auctionId: string) => Promise<void>;
  setListingsConditions: (newListingsConditions: AuctionListingsConditions) => void;
  updateUrlParams: () => void;
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
  const currentStatus =
    currentStatusParams.length > 0
      ? currentStatusParams.map((status) => status as "all" | "watchlist" | "not_bidded" | "bidded" | "ended" | "not_ended")
      : ["all" as const];

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
  const updateUrlParams = useCallback(() => {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    console.log("src/hooks/auction/listing/use-auction-listings.ts_updateUrlParams_start", listingsConditions);
    console.log(
      "src/hooks/auction/listing/use-auction-listings.ts_updateUrlParams_sort",
      listingsConditions.sort ? JSON.stringify(listingsConditions.sort) : "null",
    );

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // URLパラメータを作成
    const params = new URLSearchParams();

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // ページ数
    if (listingsConditions.page > 1) {
      params.set("page", String(listingsConditions.page));
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // カテゴリ - 複数選択可能になったため、各カテゴリを追加
    if (listingsConditions.categories && listingsConditions.categories.length > 0) {
      // "すべて"が含まれる場合は他のカテゴリを無視
      if (listingsConditions.categories.includes("すべて")) {
        // すべての場合はパラメータを追加しない（デフォルト値）
      } else {
        // 複数カテゴリを追加
        listingsConditions.categories.forEach((category) => {
          if (category) params.append("category", category);
        });
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // ステータス
    if (listingsConditions.status && listingsConditions.status.length > 0 && listingsConditions.status[0] !== "all") {
      listingsConditions.status.forEach((status) => {
        params.append("status", status);
      });
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // ソート - 複数選択可能になったため、最初のソート条件のみ使用
    if (listingsConditions.sort && listingsConditions.sort.length > 0) {
      console.log("src/hooks/auction/listing/use-auction-listings.ts_updateUrlParams_listingsConditions.sort_start");
      const firstSort = listingsConditions.sort[0];

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
    if (listingsConditions.searchQuery) {
      params.set("q", listingsConditions.searchQuery);
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 価格範囲
    if (listingsConditions.minBid !== null && listingsConditions.minBid !== undefined && listingsConditions.minBid !== 0) {
      params.set("min_bid", String(listingsConditions.minBid));
    }
    if (listingsConditions.maxBid !== null && listingsConditions.maxBid !== undefined && listingsConditions.maxBid !== 0) {
      params.set("max_bid", String(listingsConditions.maxBid));
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 残り時間範囲
    if (
      listingsConditions.minRemainingTime !== null &&
      listingsConditions.minRemainingTime !== undefined &&
      listingsConditions.minRemainingTime !== 0
    ) {
      params.set("min_remaining_time", String(listingsConditions.minRemainingTime));
    }
    if (
      listingsConditions.maxRemainingTime !== null &&
      listingsConditions.maxRemainingTime !== undefined &&
      listingsConditions.maxRemainingTime !== 0
    ) {
      params.set("max_remaining_time", String(listingsConditions.maxRemainingTime));
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // グループID
    if (listingsConditions.groupIds && listingsConditions.groupIds.length > 0) {
      listingsConditions.groupIds.forEach((id) => params.append("group_id", id));
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // URLパラメータを作成
    const newUrl = `/dashboard/auction${params.toString() ? `?${params.toString()}` : ""}`;

    console.log("src/hooks/auction/listing/use-auction-listings.ts_updateUrlParams_newUrl", newUrl);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 指定URLに画面遷移。scroll: false を追加してページスクロールを防止
    router.push(newUrl, { scroll: false });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  }, [router, listingsConditions]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークション一覧データを取得する関数
   * @returns Promise<void>
   */
  const getAuctionListingsData = useCallback(async () => {
    console.log("src/hooks/auction/listing/use-auction-listings.ts_getAuctionListingsData_start");
    try {
      // ーーーーーーーーーーーーーーー

      // データ取得中の状態
      setIsLoading(true);

      // ーーーーーーーーーーーーーーー

      // オークション一覧データを取得
      const result = await getAuctionListings({ listingsConditions });

      // ーーーーーーーーーーーーーーー

      // 結果の設定
      setAuctions(result);

      // ーーーーーーーーーーーーーーー
    } catch (error) {
      // エラーログ
      console.error("use-auction-listings_fetchListings_error", error);

      // ーーーーーーーーーーーーーーー
    } finally {
      // データ取得中の状態を解除
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 依存配列を空にして初回レンダリング時のみ実行（無限ループ防止）

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 初期設定データの取得と初回データ読み込み
   * マウント時に1回だけ実行
   */
  useEffect(() => {
    const initializeData = async () => {
      await getAuctionListingsData();
    };
    void initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 依存配列を空にして初回レンダリング時のみ実行（無限ループ防止）

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
    // state
    auctions,
    listingsConditions,
    isLoading,

    // action
    handleToggleWatchlist,
    setListingsConditions: (newListingsConditions: AuctionListingsConditions) => {
      console.log("src/hooks/auction/listing/use-auction-listings.ts_setListingsConditions_newConditions", newListingsConditions);

      // オブジェクトの深いコピーを作成して変更を確実に検知させる
      const updatedConditions = JSON.parse(JSON.stringify(newListingsConditions)) as AuctionListingsConditions;

      // 状態を更新する前に、この関数のローカル変数を使用してURLパラメータを更新する
      // これにより非同期的な状態更新を待たずにURLパラメータを正確に設定できる
      const params = new URLSearchParams();

      // ページ数
      if (updatedConditions.page > 1) {
        params.set("page", String(updatedConditions.page));
      }

      // カテゴリ
      if (updatedConditions.categories && updatedConditions.categories.length > 0) {
        if (!updatedConditions.categories.includes("すべて")) {
          updatedConditions.categories.forEach((category) => {
            if (category) params.append("category", category);
          });
        }
      }

      // ステータス
      if (updatedConditions.status && updatedConditions.status.length > 0 && updatedConditions.status[0] !== "all") {
        updatedConditions.status.forEach((status) => {
          params.append("status", status);
        });
      }

      // ソート
      if (updatedConditions.sort && updatedConditions.sort.length > 0) {
        const firstSort = updatedConditions.sort[0];
        if (firstSort.field) {
          params.set("sort", firstSort.field);
        }
        if (firstSort.direction) {
          params.set("sort_direction", firstSort.direction);
        }
      }

      // 検索クエリ
      if (updatedConditions.searchQuery) {
        params.set("q", updatedConditions.searchQuery);
      }

      // 価格範囲
      if (updatedConditions.minBid !== null && updatedConditions.minBid !== undefined && updatedConditions.minBid !== 0) {
        params.set("min_bid", String(updatedConditions.minBid));
      }
      if (updatedConditions.maxBid !== null && updatedConditions.maxBid !== undefined && updatedConditions.maxBid !== 0) {
        params.set("max_bid", String(updatedConditions.maxBid));
      }

      // 残り時間範囲
      if (
        updatedConditions.minRemainingTime !== null &&
        updatedConditions.minRemainingTime !== undefined &&
        updatedConditions.minRemainingTime !== 0
      ) {
        params.set("min_remaining_time", String(updatedConditions.minRemainingTime));
      }
      if (
        updatedConditions.maxRemainingTime !== null &&
        updatedConditions.maxRemainingTime !== undefined &&
        updatedConditions.maxRemainingTime !== 0
      ) {
        params.set("max_remaining_time", String(updatedConditions.maxRemainingTime));
      }

      // グループID
      if (updatedConditions.groupIds && updatedConditions.groupIds.length > 0) {
        updatedConditions.groupIds.forEach((id) => params.append("group_id", id));
      }

      // URLを更新
      const newUrl = `/dashboard/auction${params.toString() ? `?${params.toString()}` : ""}`;
      console.log("src/hooks/auction/listing/use-auction-listings.ts_setListingsConditions_newUrl", newUrl);
      router.push(newUrl, { scroll: false });

      // 状態を更新
      setListingsConditions(updatedConditions);
      console.log("src/hooks/auction/listing/use-auction-listings.ts_setListingsConditions_after", updatedConditions);
    },
    updateUrlParams,
  };
}
