import React from "react";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "入札・落札履歴 | Freeism",
  description: "入札した商品・落札した商品・出品した商品の履歴です",
};

export default function AuctionHistoryPage() {
  return (
    <div className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold">入札・落札履歴</h1>
      <div className="rounded-lg bg-white p-6 shadow">
        <p className="py-8 text-center text-gray-500">こちらの機能は準備中です。次のステップで実装予定です。</p>
      </div>
    </div>
  );
}
