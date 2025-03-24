import { type AuctionReview, type Task } from "@prisma/client";

// 受信したイベントデータの型
export type EventHistoryItem = {
  id: number;
  type: AuctionEventType | typeof ExtendedEventType.CONNECTION_ESTABLISHED;
  data: Record<string, any>;
  timestamp: number;
};

// 拡張イベントタイプの定義（接続確立メッセージ用）
export const ExtendedEventType = {
  CONNECTION_ESTABLISHED: "connection_established" as const,
};

// 接続状態の型
export type ConnectionStatus = "初期化中" | "接続中" | "切断" | "エラー";

// カウントダウン表示のprops
export type CountdownDisplayProps = {
  countdownState: CountdownState;
  countdownAction: () => string;
};

// 入札フォームのprops
export type BidFormProps = {
  auction: Auction;
  onCancelAction: () => void;
};

// 入札履歴のprops
export type BidHistoryProps = {
  auctionId: string;
  initialBids?: BidHistoryWithUser[];
};

// カウントダウンタイマーの状
export type CountdownState = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
};

// カテゴリ
export type Category = {
  id: string;
  name: string;
};

// 入札フォームデータの型
export type BidFormData = {
  auctionId: string;
  amount: number;
  isAutoBid?: boolean;
  maxAmount?: number; // 自動入札の最大金額
};

// 入札履歴
export type BidHistory = {
  id: string;
  auctionId: string;
  userId: string;
  amount: number;
  createdAt: string; // ISO日付文字列
  isAutoBid?: boolean;
  status?: string;
};

// 入札履歴の拡張型
export type BidHistoryWithUser = {
  user?: User;
} & BidHistory;

// ウォッチリスト
export type WatchlistItem = {
  id: string;
  auctionId: string;
  userId: string;
  auction?: Auction;
};

// ユーザー
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

// ユーザーのプロフィール
export type UserProfile = {
  bio?: string;
  location?: string;
  website?: string;
  phoneNumber?: string;
  soldCount?: number;
  boughtCount?: number;
  rating?: number;
} & User;

// ユーザー認証
export type UserAuth = {
  userId: string;
  email: string;
  username: string;
  avatarUrl?: string;
};

// オークション
export type Auction = {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  startingPrice: number;
  currentPrice: number;
  bidCount?: number;
  startTime: string; // ISO日付文字列
  endTime: string; // ISO日付文字列
  sellerId: string;
  seller?: User;
  categories?: Category[];
  watchCount?: number;
  depositPeriod?: number; // ポイント預かり期間（日数）
};

// オークションと関連データを含む拡張型
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
  winnerId: string | null;
  extensionCount: number;
  version: number;
  title: string;
  description: string;
  startingPrice: number;
  currentPrice: number;
  sellerId: string;
  task: Task & {
    group: any;
    creator: any;
  };
  depositPeriod: number;
  currentHighestBidder: User | null;
  winner: User | null;
  bids: Array<BidHistory & { user: any }>;
  options: {
    reconnectOnVisibility?: boolean; // ページが表示されたときに再接続
    bufferEvents?: boolean; // イベントをバッファリング
    clientId?: string; // カスタムクライアントID
  };
};

// オークションSSEイベントタイプ
export enum AuctionEventType {
  INITIAL = "initial",
  NEW_BID = "new_bid",
  AUCTION_UPDATE = "auction_update",
  AUCTION_EXTENSION = "auction_extension",
  AUCTION_ENDED = "auction_ended",
  ERROR = "error",
}

// オークションSSEイベントデータ
export type AuctionEventData = {
  type: AuctionEventType;
  data: {
    auction?: AuctionWithDetails;
    bid?: BidHistoryWithUser;
    message?: string;
    newEndTime?: string;
    error?: string;
  };
};

// レビュー情報
export type AuctionReviewWithUsers = AuctionReview & {
  reviewer: User;
  reviewee: User;
};
