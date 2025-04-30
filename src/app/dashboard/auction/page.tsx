import { type Metadata } from "next";
import { AuctionListings } from "@/components/auction/listing/auction-listings";
import { MainTemplate } from "@/components/layout/maintemplate";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

export const metadata: Metadata = {
  title: "オークション商品一覧 | Freeism",
  description: "出品されているオークション商品一覧です",
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

export default async function AuctionPage() {
  console.log("src/app/dashboard/auction/page.tsx_AuctionPage_start");
  return (
    <MainTemplate title="オークション商品一覧" description="出品されているオークション商品一覧です">
      <AuctionListings />
    </MainTemplate>
  );
}
