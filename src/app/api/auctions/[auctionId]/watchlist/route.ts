import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAuctionWatched, toggleWatchlist } from "@/lib/auction/auction-service";

/**
 * ウォッチリストの状態を取得
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ auctionId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const userId = session.user.id;
  const { auctionId } = await params;

  try {
    const isWatched = await isAuctionWatched(userId, auctionId);
    return NextResponse.json({ isWatched });
  } catch (error) {
    console.error("ウォッチリスト確認エラー:", error);
    return NextResponse.json({ error: "ウォッチリストの確認中にエラーが発生しました" }, { status: 500 });
  }
}

/**
 * ウォッチリストの状態を切り替え
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ auctionId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const userId = session.user.id;
  const { auctionId } = await params;

  try {
    const isWatched = await toggleWatchlist(userId, auctionId);
    return NextResponse.json({ isWatched });
  } catch (error) {
    console.error("ウォッチリスト更新エラー:", error);
    return NextResponse.json({ error: "ウォッチリストの更新中にエラーが発生しました" }, { status: 500 });
  }
}

// GET, POST以外は許可しない
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
