import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuctionWithTask } from "@/lib/auction/auction-service";

/**
 * オークション詳細を取得するAPI
 */
export async function GET(request: NextRequest, { params }: { params: { auctionId: string } }) {
  try {
    // セッションからユーザー情報を取得
    const session = await auth();
    const currentUserId = session?.user?.id;
    const auctionId = params.auctionId;

    // オークション情報を取得
    const auction = await getAuctionWithTask(auctionId);

    if (!auction) {
      return NextResponse.json({ error: "オークションが見つかりませんでした" }, { status: 404 });
    }

    // 現在のユーザーがオークションの出品者（タスク作成者）かどうかを判定
    const isOwnAuction = auction.task.creatorId === currentUserId;

    return NextResponse.json({
      auction,
      isOwnAuction,
    });
  } catch (error) {
    console.error("オークション詳細取得エラー:", error);
    return NextResponse.json({ error: "オークション詳細の取得に失敗しました" }, { status: 500 });
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
