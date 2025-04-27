import type { AUCTION_CONSTANTS } from "@/lib/auction/constants";
import type { AuctionStatus, BidStatus, TaskStatus } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入札履歴の型
 * オークション履歴で使用
 */
export type BidHistoryItem = {
  id: string;
  auctionId: string;
  amount: number;
  isAutoBid: boolean;
  status: BidStatus;
  createdAt: Date;
  auction: {
    id: string;
    task: {
      id: string;
      task: string;
      detail: string | null;
      imageUrl: string | null;
      status: TaskStatus;
    };
    currentHighestBid: number;
    endTime: Date;
    status: AuctionStatus;
  };
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション履歴で使用
 */
export type WonAuctionItem = {
  id: string;
  taskId: string;
  currentHighestBid: number;
  endTime: Date;
  status: AuctionStatus;
  createdAt: Date;
  task: {
    id: string;
    task: string;
    detail: string | null;
    imageUrl: string | null;
    status: TaskStatus;
    creator: {
      id: string;
      name: string | null;
      image: string | null;
    };
    deliveryMethod: string | null;
  };
  reviews: {
    id: string;
    rating: number;
    comment: string | null;
    isSellerReview: boolean;
  }[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション履歴で使用
 */
export type CreatedAuctionItem = {
  id: string;
  taskId: string;
  currentHighestBid: number;
  endTime: Date;
  status: AuctionStatus;
  createdAt: Date;
  task: {
    id: string;
    task: string;
    detail: string | null;
    imageUrl: string | null;
    status: TaskStatus;
    deliveryMethod: string | null;
  };
  winner: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
  reviews: {
    id: string;
    rating: number;
    comment: string | null;
    isSellerReview: boolean;
  }[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 出品者の評価の型
 */
export type SellerRating = {
  fullStars: number;
  hasHalfStar: boolean;
  emptyStars: number;
  ratingValue: number | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * フィルターのprops
 */
export type UseAuctionFiltersProps = {
  listingsConditions: AuctionListingsConditions;
  setListingsConditionsAction: (newListingsConditions: AuctionListingsConditions) => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションの出品一覧をフィルター・ソートするためのパラメータの型定義
 */
export type AuctionListingsConditions = {
  categories: ((typeof AUCTION_CONSTANTS.AUCTION_CATEGORIES)[number] | null)[] | null;
  status: AuctionFilterTypes[] | null;
  statusConditionJoinType: "OR" | "AND"; // ステータス条件の結合タイプ（OR/AND）
  minBid: number | null;
  maxBid: number | null;
  minRemainingTime: number | null;
  maxRemainingTime: number | null;
  groupIds: string[] | null;
  searchQuery: string | null;
  sort: Array<{ field: AuctionSortField; direction: SortDirection }> | null;
  page: number;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ステータスの型
 */
export type AuctionFilterTypes = "all" | "watchlist" | "not_bidded" | "bidded" | "ended" | "not_ended" | "not_started" | "started";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ソートField
 */
export type AuctionSortField = "newest" | "time_remaining" | "bids" | "price";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ソートDirection
 */
export type SortDirection = "asc" | "desc";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションのフィルターのprops
 */
export type AuctionFiltersProps = {
  listingsConditions: AuctionListingsConditions;
  setListingsConditionsAction: (newListingsConditions: AuctionListingsConditions) => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションのカードの型
 */
export type AuctionCard = {
  id: string; // オークションのID
  title: string; // title
  imageUrl: string | null; // 画像
  currentBid: number; //最高額
  endTime: Date; // オークションの終了時刻
  startTime: Date; // オークションの開始時刻
  status: AuctionStatus; // オークションのステータス
  isWatched: boolean; // オークションがウォッチリストに登録されているかどうか
  bidsCount: number; //入札数
  category: string | null; // カテゴリ
  seller: {
    rating: number | null; // 出品者の評価
    name: string | null; // 出品者の名前
    image: string | null; // 出品者の画像
  };
  group: {
    id: string; // グループのID
    name: string; // グループの名前
  };
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
/**
 * オークション出品リストの型
 */
export type AuctionListingResult = Array<AuctionCard>;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションの出品リストのカードのprops
 */
export type AuctionCardProps = {
  auction: AuctionCard;
  onToggleWatchlistAction: (auctionId: string) => Promise<void>;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入札フォームの型
 */
export type BidFormData = {
  amount: number;
  isAutoBid: boolean;
  auctionId: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション入札時に、更新した情報の型
 * その情報をsse接続で伝えて、state更新する
 */
export type UpdateAuctionWithDetails = {
  id: string;
  currentHighestBid: number;
  currentHighestBidderId: string | null;
  status: AuctionStatus;
  extensionTotalCount: number;
  extensionLimitCount: number;
  extensionTotalTime: number;
  extensionLimitTime: number;
  bidHistories: {
    id: string;
    amount: number;
    createdAt: Date | string;
    isAutoBid: boolean;
    user: {
      name: string | null;
    };
  }[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション入札画面に必要な全ての情報
 */
export type AuctionWithDetails = UpdateAuctionWithDetails & {
  startTime: Date;
  endTime: Date;
  task: {
    task: string;
    detail: string | null;
    imageUrl: string | null;
    status: TaskStatus;
    category: string | null;
    group: {
      id: string;
      name: string;
      depositPeriod: number;
    };
    creator: {
      id: string;
      name: string | null;
    };
  };
  watchlists: {
    id: string;
  }[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * カウントダウン表示のprops
 */
export type CountdownDisplayProps = {
  countdownState: CountdownState;
  countdownAction: () => string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * カウントダウンタイマーの状態
 */
export type CountdownState = {
  days: number;
  hours: number;
  minutes: number;
  isExpired: boolean;
  isUrgent: boolean;
  isCritical: boolean;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
