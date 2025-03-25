"use client";

import { createContext, useContext } from "react";

// AuctionEventコンテキストの型定義
export type AuctionEventContextType = {
  setIsBidding: (isBidding: boolean) => void;
};

// AuctionEventコンテキストの作成
export const AuctionEventContext = createContext<AuctionEventContextType | null>(null);

/**
 * AuctionEventコンテキストを使用するカスタムフック
 * @returns AuctionEventコンテキスト
 */
export function useAuctionEventContext(): AuctionEventContextType | null {
  return useContext(AuctionEventContext);
}
