"use client";

import type { AuctionFilterTypes, AuctionListingResult, AuctionListingsConditions, AuctionSortField, SortDirection } from "@/lib/auction/type/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getAuctionListingsAndCount } from "@/lib/auction/action/auction-listing";
import { serverToggleWatchlist } from "@/lib/auction/action/watchlist";
import { useSession } from "next-auth/react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション一覧画面のロジックを管理するカスタムフックの戻り値の型
 */
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

  // オークション一覧データと総件数を並列で取得
  const { data: session } = useSession();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("ユーザーIDが取得できませんでした");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * URLからパラメータを取得
   */
  const searchParams = useSearchParams();

  // ページ数のURLパラメータ
  const currentPage = Number(searchParams.get("page") ?? 1);

  // カテゴリのURLパラメータ（複数可能）
  const currentCategoriesParams = searchParams.getAll("category");
  const currentCategories = currentCategoriesParams.length > 0 ? currentCategoriesParams : ["すべて"];

  // ステータスのURLパラメータ（複数可能）
  const currentStatusParams = searchParams.getAll("status");
  const currentStatus = currentStatusParams.length > 0 ? currentStatusParams.map((status) => status as AuctionFilterTypes) : ["all" as const];

  // ステータス結合タイプのURLパラメータ
  const currentStatusJoinType = searchParams.get("status_join_type") as "OR" | "AND" | null;

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

  /**
   * オークション一覧画面のstate
   */
  // オークション情報
  const [auctions, setAuctions] = useState<AuctionListingResult>([]);
  // 総オークション件数
  const [totalAuctionsCount, setTotalAuctionsCount] = useState<number>(0);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルター状態。
   * 基本はuse-auction-filtersで使用するが、子コンポーネントに渡すために、ここで定義
   */
  const [listingsConditions, setListingsConditions] = useState<AuctionListingsConditions>({
    categories: currentCategories,
    status: currentStatus,
    statusConditionJoinType: currentStatusJoinType ?? "OR", // デフォルトはOR
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

  /**
   * ウォッチリスト関連
   */
  // ウォッチリストの変更を追跡
  const [watchlistChanges, setWatchlistChanges] = useState<Set<string>>(new Set());
  // ウォッチリストの変更を保存するタイムアウト
  const saveWatchlistTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データ読み込み中の状態
   */
  const [isLoading, setIsLoading] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * URLパラメータを更新する関数
   * 必要なパラメータのみURLに含める（デフォルト値は含めない）
   */
  const updateUrlParams = useCallback((newListingsConditions: AuctionListingsConditions) => {
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
    if (newListingsConditions.categories && newListingsConditions.categories.length > 0 && !newListingsConditions.categories.includes("すべて")) {
      // 複数カテゴリを追加
      newListingsConditions.categories.forEach((category) => {
        if (category) params.append("category", category);
      });
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // ステータス
    if (newListingsConditions.status && newListingsConditions.status.length > 0 && newListingsConditions.status[0] !== "all") {
      newListingsConditions.status.forEach((status) => {
        params.append("status", status);
      });

      // ステータス結合タイプ
      if (newListingsConditions.statusConditionJoinType && newListingsConditions.statusConditionJoinType === "AND") {
        params.set("status_join_type", newListingsConditions.statusConditionJoinType);
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // ソート - 複数選択可能になったため、最初のソート条件のみ使用
    if (newListingsConditions.sort && newListingsConditions.sort.length > 0) {
      console.log("src/hooks/auction/listing/use-auction-listings.ts_updateUrlParams_listingsConditions.sort_start");
      const firstSort = newListingsConditions.sort[0];
      const defaultSort = newListingsConditions.searchQuery ? "relevance" : "newest";

      if (firstSort.field && firstSort.field !== defaultSort) {
        params.set("sort", firstSort.field);
        console.log("src/hooks/auction/listing/use-auction-listings.ts_updateUrlParams_firstSort.field", firstSort.field);
      }

      // ソート方向
      if (firstSort.direction && firstSort.direction !== "desc") {
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
    window.history.pushState({}, "", newUrl);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークション一覧データと総件数を取得する関数
   * @returns Promise<void>
   */
  const getAuctionListingsData = useCallback(
    async (conditions: AuctionListingsConditions) => {
      console.log("src/hooks/auction/listing/use-auction-listings.ts_getAuctionListingsData_start", conditions);
      try {
        // データ取得中の状態
        setIsLoading(true);

        // Promise.all を使わずに、新しい関数を呼び出す
        const { listings: listingsResult, count: countResult } = await getAuctionListingsAndCount({ listingsConditions: conditions, userId });

        // 結果の設定
        setAuctions(listingsResult);
        setTotalAuctionsCount(countResult);

        console.log("src/hooks/auction/listing/use-auction-listings.ts_getAuctionListingsData_success", {
          auctionsCount: listingsResult.length,
          totalCount: countResult,
        });
      } catch (error) {
        console.error("use-auction-listings_getAuctionListingsData_error", error);
        // エラー時にもstateを初期化することが望ましい場合がある
        setAuctions([]);
        setTotalAuctionsCount(0);
      } finally {
        // データ取得中の状態を解除
        setIsLoading(false);
      }
    },
    [userId],
  );

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
        setAuctions((prev) => prev.map((auction) => (auction.id === auctionId ? { ...auction, is_watched: !auction.is_watched } : auction)));

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
            const changesToSave = Array.from(watchlistChanges);
            if (changesToSave.length > 0) {
              console.log(`Saving ${changesToSave.length} watchlist changes...`);
              // 非同期で各変更をサーバーに送信
              Promise.all(changesToSave.map((id) => serverToggleWatchlist(id, userId)))
                .then(() => {
                  console.log("Watchlist changes saved successfully.");
                  // 保存成功後にローカルの変更追跡リストをクリア
                  setWatchlistChanges(new Set());
                })
                .catch((error) => {
                  console.error("ウォッチリストの一括更新に失敗しました", error);
                  // エラーハンドリング: 必要であればUIを元に戻すなどの処理
                  // ここでは、失敗した変更は watchlistChanges に残るため、
                  // 次回のタイマーやアンマウント時に再試行される可能性がある
                });
            }
          },
          3000, // 10分後に保存 (例)
        );
      } catch (error) {
        console.error("ウォッチリストの更新に失敗しました", error);
      }
    },
    [watchlistChanges, userId],
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
            void serverToggleWatchlist(id, userId).catch((error) => {
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
  }, [watchlistChanges, userId]);

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
      updateUrlParams(newListingsConditions);
      console.log("src/hooks/auction/listing/use-auction-listings.ts_setListingsConditions_after_state_update", newListingsConditions);
      setListingsConditions(newListingsConditions);
    },
  };
}
