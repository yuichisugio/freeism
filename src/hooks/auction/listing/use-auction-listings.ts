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
  const currentPage = Number(searchParams.get("page") ?? "1");

  // カテゴリのURLパラメータ
  const currentCategories = (searchParams.get("category") ?? "すべて") as AuctionListingsConditions["categories"];

  // ステータスのURLパラメータ
  const currentStatus = (searchParams.get("status") ?? "all") as unknown as AuctionListingsConditions["status"];

  // ソートのURLパラメータ
  const currentSort = (searchParams.get("sort") ?? "newest") as AuctionSortField;

  // ソートの降順/昇順の方向のURLパラメータ
  const currentSortDirection = (searchParams.get("sort_direction") ?? "asc") as SortDirection;

  // 検索クエリのURLパラメータ
  const currentQuery = searchParams.get("q") ?? ("" as AuctionListingsConditions["searchQuery"]);

  // 価格範囲フィルター
  const minBid = Number(searchParams.get("min_bid")) ?? null;
  const maxBid = Number(searchParams.get("max_bid")) ?? null;

  // 残り時間範囲フィルター (時間単位: 0-720時間 = 0-30日)
  const minRemainingTime = Number(searchParams.get("min_remaining_time")) ?? null;
  const maxRemainingTime = Number(searchParams.get("max_remaining_time")) ?? null;

  // グループリスト。複数あるのでgetAllで取得?groupId=1&groupId=2&groupId=3
  const groupIds = searchParams.getAll("group_id") ?? null;

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
    groupIds: groupIds,
    searchQuery: currentQuery,
    sort: {
      field: currentSort,
      direction: currentSortDirection,
    },
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
    // URLパラメータを作成
    const params = new URLSearchParams();

    // ページ数
    if (listingsConditions.page > 1) params.set("page", String(listingsConditions.page));

    // カテゴリ
    if (listingsConditions.categories && listingsConditions.categories !== "すべて") params.set("category", listingsConditions.categories);

    // ステータス
    if (listingsConditions.status && listingsConditions.status[0] !== "all") params.set("status", listingsConditions.status[0]);

    // ソート
    if (listingsConditions.sort?.field) params.set("sort", listingsConditions.sort?.field);

    // 検索クエリ
    if (listingsConditions.searchQuery) params.set("q", listingsConditions.searchQuery);

    // 価格範囲
    if (listingsConditions.minBid !== null) params.set("min_bid", String(listingsConditions.minBid));
    if (listingsConditions.maxBid !== null) params.set("max_bid", String(listingsConditions.maxBid));

    // 残り時間範囲
    if (listingsConditions.minRemainingTime !== null) params.set("min_remaining_time", String(listingsConditions.minRemainingTime));
    if (listingsConditions.maxRemainingTime !== null) params.set("max_remaining_time", String(listingsConditions.maxRemainingTime));

    // グループID
    if (listingsConditions.groupIds && listingsConditions.groupIds.length > 0) {
      listingsConditions.groupIds.forEach((id) => params.append("group_id", id));
    }

    // ソート方向
    if (listingsConditions.sort?.direction) params.set("sort_direction", listingsConditions.sort.direction);

    // URLパラメータを作成
    const newUrl = `/dashboard/auction${params.toString() ? `?${params.toString()}` : ""}`;

    // 指定URLに画面遷移。scroll: false を追加してページスクロールを防止
    router.push(newUrl, { scroll: false });
  }, [listingsConditions, router]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークション一覧データを取得する関数
   * @returns Promise<void>
   */
  const getAuctionListingsData = useCallback(async () => {
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
  }, [listingsConditions]);

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
   * フィルターの変更を追跡
   */
  useEffect(() => {
    void updateUrlParams();
  }, [updateUrlParams]);

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
    setListingsConditions,
    updateUrlParams,
  };
}
