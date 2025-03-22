import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuctionBidHistory } from "@/lib/auction/auction-service";

/**
 * オークション入札履歴を取得するAPI
 */
export async function GET(request: NextRequest, { params }: { params: { auctionId: string } }) {
  try {
    const auctionId = params.auctionId;

    // 該当するオークションの入札履歴を取得
    const bids = await getAuctionBidHistory(auctionId, 20);

    return NextResponse.json({ bids });
  } catch (error) {
    console.error("入札履歴取得エラー:", error);
    return NextResponse.json({ error: "入札履歴の取得に失敗しました" }, { status: 500 });
  }
}

// GET以外のメソッドを禁止
export async function POST() {
  return new NextResponse(null, { status: 405 });
}

export async function PUT() {
  return new NextResponse(null, { status: 405 });
}

export async function DELETE() {
  return new NextResponse(null, { status: 405 });
}

export async function PATCH() {
  return new NextResponse(null, { status: 405 });
}

export const dynamic = "force-dynamic";
