import { type User } from "./user";

export type Category = {
  id: string;
  name: string;
};

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

export type BidFormData = {
  auctionId: string;
  amount: number;
  isAutoBid?: boolean;
  maxAmount?: number; // 自動入札の最大金額
};

export type BidHistory = {
  id: string;
  auctionId: string;
  userId: string;
  amount: number;
  createdAt: string; // ISO日付文字列
  isAutoBid?: boolean;
};

export type BidHistoryWithUser = {
  user?: User;
} & BidHistory;

export type WatchlistItem = {
  id: string;
  auctionId: string;
  userId: string;
  auction?: Auction;
};
