import { type Metadata } from "next";
import AuctionListings from "@/components/auction/AuctionListings";
import { MainTemplate } from "@/components/layout/maintemplate";

export const metadata: Metadata = {
  title: "オークション商品一覧 | Freeism",
  description: "出品されているオークション商品一覧です",
};

export default function AuctionPage() {
  return (
    <MainTemplate title="オークション商品一覧" description="出品されているオークション商品一覧です">
      <AuctionListings />
    </MainTemplate>
  );
}
