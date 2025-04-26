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
  auctions: AuctionListingResult;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションの出品一覧をフィルター・ソートするためのパラメータの型定義
 */
export type AuctionListingsConditions = {
  categories: ((typeof AUCTION_CONSTANTS.AUCTION_CATEGORIES)[number] | null)[] | null;
  status: AuctionFilterTypes[] | null;
  statusConditionJoinType?: "OR" | "AND"; // ステータス条件の結合タイプ（OR/AND）
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
  auctions: AuctionListingResult;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入札フォームの型
 */
export type BidFormData = {
  amount: number;
  isAutoBid?: boolean;
  auctionId?: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション入札画面に必要な全ての情報
 */
export type AuctionWithDetails = {
  id: string;
  startTime: Date;
  endTime: Date;
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
 * オークションのカードの型
 */
export type AuctionCard = {
  id: string;
  taskId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  currentBid: number;
  bidToBeatAmount: number;
  endTime: Date;
  startTime: Date;
  status: AuctionStatus;
  isWatched: boolean;
  bidsCount: number;
  category: string | null;
  seller: {
    id: string;
    name: string | null;
    image: string | null;
    rating: number | null;
  };
  group: {
    id: string;
    name: string;
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
