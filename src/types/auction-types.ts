import type { AUCTION_CONSTANTS } from "@/lib/constants";
import type { AuctionReview, BidStatus, TaskStatus } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * フィルターの型
 */
export type AuctionCreatedTabFilter = "creator" | "executor" | "reporter" | "ended" | "active" | "pending" | "all" | "supplier_done";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入札履歴の型
 * オークション履歴で使用
 */
export type BidHistoryItem = {
  auctionId: string;
  bidStatus: BidStatus;
  lastBidAt: Date;
  taskId: string;
  taskName: string;
  taskStatus: TaskStatus;
  currentHighestBid: number;
  auctionEndTime: Date;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション履歴で使用
 */
export type WonAuctionItem = {
  auctionId: string;
  taskId: string;
  currentHighestBid: number;
  auctionEndTime: Date;
  taskStatus: TaskStatus;
  auctionCreatedAt: Date;
  taskName: string;
  deliveryMethod: string | null;
  rating: number | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション履歴で使用
 */
export type CreatedAuctionItem = {
  auctionId: string;
  currentHighestBid: number;
  auctionEndTime: Date;
  taskStatus: TaskStatus;
  auctionCreatedAt: Date;
  taskId: string;
  taskName: string;
  deliveryMethod: string | null;
  winnerId: string | null;
  winnerName: string | null;
  isCreator: boolean;
  isExecutor: boolean;
  isReporter: boolean;
  taskRole: TaskRole[];
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
  categories: (typeof AUCTION_CONSTANTS.AUCTION_CATEGORIES)[number][] | null;
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
export type AuctionSortField = "relevance" | "newest" | "time_remaining" | "bids" | "price" | "score";

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
 * サジェストの型
 */
export type Suggestion = {
  id: string; // Task ID or Auction ID
  text: string; // Suggestion text (e.g., task name)
  highlighted: string; // Highlighted text
  score: number;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションのカードの型
 */
export type AuctionCard = {
  id: string; // オークションのID
  current_highest_bid: number; // 最高額
  end_time: Date; // オークションの終了時刻
  start_time: Date; // オークションの開始時刻
  status: TaskStatus;
  task: string; // タスクのタイトル
  detail: string | null; // タスクの詳細
  image_url: string | null; // taskの画像
  category: string | null; // カテゴリ
  group_id: string; // グループのID
  group_name: string; // グループの名前
  bids_count: number; // 入札数
  is_watched: boolean; // オークションがウォッチリストに登録されているかどうか
  score: number | null; // pgroonga_score
  task_highlighted: string | null; // タスクのタイトルのハイライト
  detail_highlighted: string | null; // タスクの詳細のハイライト
  executors_json:
    | {
        id: string | null; // listのidとして使用
        rating: number | null; // Executorの評価
        userId: string | null; // listのidとして使用
        userImage: string | null; // taskExecutorのicon画像
        userSettingsUsername: string | null; // app内で表示される名前
      }[]
    | string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
/**
 * オークション出品リストの型
 */
export type AuctionListingResult = Array<AuctionCard>;

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
  status: TaskStatus;
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
      settings: {
        username: string; // app内で表示される名前
      } | null;
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
    executors: {
      id: string;
      user: {
        id: string;
        settings: {
          username: string;
        } | null;
      } | null;
    }[];
  };
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

/**
 * フィルター条件の型定義 (AND/OR)
 */
export type FilterCondition = "and" | "or";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 落札詳細画面に必要な情報
 */
export type AuctionWonDetail = {
  auctionId: string;
  auctionEndTime: Date;
  auctionStartTime: Date;
  currentHighestBid: number;
  winnerId: string;
  reviews: Pick<AuctionReview, "id" | "reviewerId" | "rating" | "comment">[];
  taskId: string;
  taskName: string;
  taskDetail: string | null;
  taskStatus: TaskStatus;
  taskDeliveryMethod: string | null;
  taskImageUrl: string | null;
  creator: {
    creatorUserId: string;
    creatorAppUserName: string | null;
    creatorUserImage: string | null;
  };
  reporters: {
    reporterUserId: string;
    reporterAppUserName: string | null;
    reporterUserImage: string | null;
  }[];
  executors: {
    executorUserId: string;
    executorAppUserName: string | null;
    executorUserImage: string | null;
  }[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 出品詳細画面用: 必要なプロパティのみ
 */
export type AuctionHistoryCreatedDetail = {
  id: string;
  currentHighestBid: number;
  startTime: Date;
  endTime: Date;
  task: {
    id: string;
    task: string;
    detail: string | null;
    imageUrl: string | null;
    status: TaskStatus;
    deliveryMethod: string | null;
    creatorId: string;
  };
  winner: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
  winnerId: string | null;
  bidHistories: {
    id: string;
    amount: number;
    isAutoBid: boolean;
    createdAt: Date;
    user: {
      id: string;
      name: string | null;
      image: string | null;
    };
  }[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

export type TaskRole = "SUPPLIER" | "EXECUTOR" | "REPORTER";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
