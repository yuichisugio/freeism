import { NextResponse } from "next/server";
import { getAuctionByAuctionId } from "@/lib/auction/action/auction-retrieve";

export async function GET({ params }: { params: Promise<{ auctionId: string }> }) {
  const { auctionId } = await params;
  const auction = await getAuctionByAuctionId(auctionId);
  return NextResponse.json(auction, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=1200",
    },
  });
}
