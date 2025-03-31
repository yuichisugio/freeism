import { type Metadata } from "next";
import { AuctionHistory } from "@/components/auction/auction-history/auction-history";
import { MainTemplate } from "@/components/layout/maintemplate";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

export const metadata: Metadata = {
  title: "入札・落札履歴 | Freeism",
  description: "入札した商品・落札した商品・出品した商品の履歴です",
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

export default function AuctionHistoryPage() {
  return (
    <MainTemplate title="入札・落札履歴" description="入札した商品・落札した商品・出品した商品の履歴です">
      <AuctionHistory />
    </MainTemplate>
  );
}
