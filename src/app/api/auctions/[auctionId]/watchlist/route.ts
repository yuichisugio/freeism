import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { serverIsAuctionWatched, serverToggleWatchlist } from "@/lib/auction/action/watchlist";
import { getAuthSession } from "@/lib/utils";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ウォッチリストの状態を取得
 * @param request リクエスト
 * @param params パラメータ
 * @returns レスポンス
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ auctionId: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const userId = session.user.id;
  const { auctionId } = await params;

  try {
    const isWatched = await serverIsAuctionWatched(userId, auctionId);
    return NextResponse.json({ isWatched });
  } catch (error) {
    console.error("ウォッチリスト確認エラー:", error);
    return NextResponse.json({ error: "ウォッチリストの確認中にエラーが発生しました" }, { status: 500 });
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ウォッチリストの状態を切り替え
 * @param request リクエスト
 * @param params パラメータ
 * @returns レスポンス
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ auctionId: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const userId = session.user.id;
  const { auctionId } = await params;

  try {
    const isWatched = await serverToggleWatchlist(userId, auctionId);
    return NextResponse.json({ isWatched });
  } catch (error) {
    console.error("ウォッチリスト更新エラー:", error);
    return NextResponse.json({ error: "ウォッチリストの更新中にエラーが発生しました" }, { status: 500 });
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// GET, POST以外は許可しない
export async function PUT() {
  return new NextResponse(null, { status: 405 });
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

export async function DELETE() {
  return new NextResponse(null, { status: 405 });
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

export async function PATCH() {
  return new NextResponse(null, { status: 405 });
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

export const dynamic = "force-dynamic";
