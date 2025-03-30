import { type AuctionReview, type AuctionStatus, type BidStatus, type Task, type TaskStatus } from "@prisma/client";

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
  filters: AuctionFilterParams;
  onFilterChangeAction: (filters: Partial<AuctionFilterParams>) => void;
  sortOption: AuctionSortOption;
  onSortChangeAction: (sort: AuctionSortOption) => void;
  categories?: string[];
  onResetFilters?: () => void;
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

// フィルタリングパラメータの型定義
export type AuctionFilterParams = {
  category?: string;
  status?: "all" | "watchlist" | "not_bidded" | "bidded" | "ended" | "not_ended";
  minPrice?: number;
  maxPrice?: number;
  remainingTime?: "1h" | "1d" | "1w" | "1m" | "all";
  groupId?: string;
  searchQuery?: string;
};

// フィルターのprops
export type AuctionFiltersProps = {
  filters: AuctionFilterParams;
  onFilterChangeAction: (filters: Partial<AuctionFilterParams>) => void;
  sortOption: AuctionSortOption;
  onSortChangeAction: (sort: AuctionSortOption) => void;
  categories?: string[];
  onResetFilters?: () => void;
};

// ソートオプションの型定義
export type AuctionSortOption = "newest" | "time_remaining" | "price_asc" | "price_desc" | "bids";

// 出品商品一覧取得のパラメータ型
export type GetAuctionListingsParams = {
  page?: number;
  pageSize?: number;
  filters?: AuctionFilterParams;
  sort?: AuctionSortOption;
};

// 入札フォームデータ型
export type BidFormData = {
  amount: number;
  isAutoBid?: boolean;
  user_id?: string;
  auctionId?: string;
  maxAmount?: number; // 自動入札の最大金額
};

// オークションイベントタイプ
export enum AuctionEventType {
  CONNECTION_ESTABLISHED = "connection_established",
  NEW_BID = "new_bid",
  ERROR = "error",
  AUCTION_UPDATE = "auction_update",
  AUCTION_EXTENSION = "auction_extension",
  AUCTION_ENDED = "auction_ended",
}

// イベント履歴データ型
export type EventHistoryItem = {
  id: number;
  type: AuctionEventType;
  data: AuctionWithDetails;
  timestamp: number;
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
  sellerId: string;
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

// 入札履歴の基本型
export type BidHistory = {
  id: string;
  auctionId: string;
  userId: string;
  amount: number;
  createdAt: string; // ISO日付文字列
  isAutoBid?: boolean;
  status?: string;
};

// 入札履歴とユーザー情報を含む型
export type BidHistoryWithUser = BidHistory & {
  user?: User;
};

// タスクグループの型定義
export type TaskGroup = {
  id: string;
  name: string;
};

// オークション詳細情報を含む型
export type AuctionWithDetails = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  status: string;
  taskId: string;
  startTime: Date;
  endTime: Date;
  currentHighestBid: number;
  currentHighestBidderId: string | null;
  bidHistories: BidHistory[];
  winnerId: string | null;
  extensionCount: number;
  version: number;
  title: string;
  description: string;
  currentPrice: number;
  sellerId: string;
  task: Task & {
    group: TaskGroup;
    creator: User;
  };
  depositPeriod: number;
  currentHighestBidder: User | null;
  winner: User | null;
  watchlists?: WatchlistItem[];
  options?: {
    reconnectOnVisibility?: boolean; // ページが表示されたときに再接続
    batchMode?: boolean; // イベントをバッファリング
    clientId?: string; // カスタムクライアントID
  };
  bid?: BidHistoryWithUser;
};

// オークションリスト結果型
export type AuctionListingResult = {
  items: Array<{
    id: string;
    taskId: string;
    title: string;
    description: string | null; // nullを許容するように修正
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
  totalCount: number;
  currentPage: number;
  totalPages: number;
  userTotalPoints: number;
};

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
  initialBids: BidHistoryWithUser[];
};

// カウントダウンタイマーの状
export type CountdownState = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
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

// オークションSSEイベントデータ
export type AuctionEventData = {
  type: AuctionEventType;
  data?: AuctionWithDetails;
  error?: string;
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
