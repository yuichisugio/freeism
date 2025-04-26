import type { AUCTION_CONSTANTS } from "@/lib/auction/constants";
import type { AuctionReview, AuctionStatus, BidStatus, TaskStatus } from "@prisma/client";

// 入札履歴の基本型
export type BidHistory = {
  id: string;
  auctionId: string;
  userId: string;
  amount: number;
  createdAt: string; // ISO日付文字列
  isAutoBid?: boolean;
};

// 出品商品詳細画面のprops
export type AuctionCreatedDetailProps = {
  auction: Auction & {
    task: {
      id: string;
      task: string;
      detail?: string | null;
      status: TaskStatus;
      imageUrl?: string | null;
      creatorId: string;
      deliveryMethod?: string | null;
    };
    winner?: {
      id: string;
      name?: string | null;
      image?: string | null;
    } | null;
    reviews: AuctionReview[];
    bidHistories: BidHistory[];
    currentHighestBid: number;
    status: AuctionStatus;
    startTime: Date;
    endTime: Date;
  };
  winnerRating: number;
  winnerReviews: AuctionReview[];
};

// 入札履歴の型
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

// オークション履歴のタブ
export type AuctionHistoryTabs = "bids" | "won" | "created";

// オークションカードのprops
export type AuctionCardHookProps = {
  auction: {
    id: string;
    startTime: Date | string;
    endTime: Date | string;
    status: string;
    isWatched: boolean;
    seller: {
      rating: number | null;
      name?: string | null;
      image?: string | null;
    };
  };
  onToggleWatchlistAction: (id: string) => Promise<void>;
};

export type SellerRating = {
  fullStars: number;
  hasHalfStar: boolean;
  emptyStars: number;
  ratingValue: number | null;
};

// フィルターのprops
export type UseAuctionFiltersProps = {
  listingsConditions: AuctionListingsConditions;
  setListingsConditionsAction: (newListingsConditions: AuctionListingsConditions) => void;
  auctions: AuctionListingResult;
};

// カウントダウンの状態
export type TimeRemaining = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  isUrgent: boolean;
  isCritical: boolean;
};

export type UseCountdownProps = {
  endTime: Date | string;
  onExpire?: () => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションの出品一覧をフィルター・ソートするためのパラメータの型定義
 * @description オークションの出品一覧をフィルター・ソートするためのパラメータの型定義
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

// ステータスの型
export type AuctionFilterTypes = "all" | "watchlist" | "not_bidded" | "bidded" | "ended" | "not_ended" | "not_started" | "started";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// ソートField
export type AuctionSortField = "newest" | "time_remaining" | "bids" | "price";

// ソートDirection
export type SortDirection = "asc" | "desc";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// フィルターのprops
export type AuctionFiltersProps = {
  listingsConditions: AuctionListingsConditions;
  setListingsConditionsAction: (newListingsConditions: AuctionListingsConditions) => void;
  auctions: AuctionListingResult;
};

// 出品商品一覧取得のパラメータ型
export type GetAuctionListingsParams = {
  page?: number;
  pageSize?: number;
  filters?: AuctionListingsConditions;
  sort?: AuctionSortField;
};

// 入札フォームデータ型
export type BidFormData = {
  amount: number;
  isAutoBid?: boolean;
  user_id?: string;
  auctionId?: string;
  maxAmount?: number; // 自動入札の最大金額
};

// Userの型定義
export type User = {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  createdAt: string; // ISO日付文字列
  name?: string | null;
  emailVerified?: Date | null;
  image?: string | null;
  isAppOwner?: boolean;
  updatedAt?: Date;
};

// カテゴリ
export type Category = {
  id: string;
  name: string;
};

// Auction型
export type Auction = {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  currentHighestBid: number;
  startTime: string;
  endTime: string;
  creatorId: string;
  status?: string; // オークションのステータス（ACTIVE, ENDED, など）
  highestBidderId?: string | null; // 非推奨: 今後はcurrentHighestBidderIdを使用
  currentHighestBidderId?: string | null; // 最高入札者ID
  seller?:
    | {
        id: string;
        username: string;
        email: string | null;
        createdAt: string;
        avatarUrl?: string;
      }
    | User;
  bidCount?: number;
  categories?: string[] | Category[];
  watchCount?: number;
  depositPeriod?: number;
};

// 入札履歴とユーザー情報を含む型
export type BidHistoryWithUser = BidHistory & {
  user?: User;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション詳細情報を含む型
 */
export type AuctionWithDetails = {
  id: string;
  status: string;
  startTime: Date;
  endTime: Date;
  currentHighestBid: number;
  currentHighestBidderId: string | null;
  bidHistories: {
    id: string; // 入札履歴のID
    amount: number; // 入札金額
    createdAt: string; // ISO日付文字列
    isAutoBid?: boolean; // 自動入札かどうか
    user: {
      id: string;
      name: string;
    };
  }[];
  extensionCount: number; // オークションの延長回数
  extensionTime: number; // オークションの延長時間
  title: string;
  description: string;
  task: {
    task: string;
    detail: string | null;
    imageUrl: string | null;
    status: TaskStatus;
    group: {
      id: string;
      name: string;
      depositPeriod: number;
    };
    creator: {
      id: string;
      name: string;
    };
  };
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// オークションリスト結果型
export type AuctionListingResult = Array<{
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
}>;

// 接続状態の型
export type ConnectionStatus = "初期化中" | "接続中" | "切断" | "エラー" | "タイムアウト";

// カウントダウン表示のprops
export type CountdownDisplayProps = {
  countdownState: CountdownState;
  countdownAction: () => string;
};

// 入札フォームのprops
export type BidFormProps = {
  auction: Auction;
};

// 入札履歴のprops
export type BidHistoryProps = {
  initialBids: AuctionWithDetails["bidHistories"];
};

// カウントダウンタイマーの状
export type CountdownState = {
  days: number;
  hours: number;
  minutes: number;
  isExpired: boolean;
};

// ウォッチリスト
export type WatchlistItem = {
  id: string;
  auctionId: string;
  userId: string;
  auction?: Auction;
};

// ユーザーのプロフィール
export type UserProfile = User & {
  bio?: string;
  location?: string;
  website?: string;
  phoneNumber?: string;
  soldCount?: number;
  boughtCount?: number;
  rating?: number;
};

// ユーザー認証
export type UserAuth = {
  userId: string;
  email: string;
  username: string;
  avatarUrl?: string;
};

// レビュー情報
export type AuctionReviewWithUsers = AuctionReview & {
  reviewer: User;
  reviewee: User;
};

// "use server"ファイルでは定数の直接エクスポートではなく、関数としてエクスポートする
export async function getExtendedEventType() {
  return {
    CONNECTION_ESTABLISHED: "connection_established" as const,
  };
}

// オークションカードのprops
export type AuctionCardProps = {
  auction: {
    id: string;
    taskId: string;
    title: string;
    description?: string;
    imageUrl?: string;
    currentBid: number;
    bidToBeatAmount: number;
    endTime: Date;
    startTime: Date;
    status: AuctionStatus;
    isWatched: boolean;
    bidsCount: number;
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
  onToggleWatchlistAction: (auctionId: string) => Promise<void>;
};

// オークションカード用カウントダウンのprops
export type CardCountdownProps = {
  endTime: Date;
  className?: string;
  onExpire?: () => void;
};
