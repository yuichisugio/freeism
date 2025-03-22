import { type Auction, type AuctionReview, type BidHistory, type Task, type User } from "@prisma/client";

// オークションと関連データを含む拡張型
export type AuctionWithDetails = Auction & {
  task: Task;
  currentHighestBidder: User | null;
  winner: User | null;
  bids: BidHistory[];
};

// 入札フォームデータの型
export type BidFormData = {
  auctionId: string;
  amount: number;
  isAutoBid?: boolean;
  maxAmount?: number; // 自動入札の最大金額
};

// 入札履歴の拡張型
export type BidHistoryWithUser = BidHistory & {
  user: User;
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
