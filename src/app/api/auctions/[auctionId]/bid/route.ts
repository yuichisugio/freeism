import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { placeBid } from "@/lib/auction/auction-service";
import { AuctionEventType } from "@/lib/auction/types";
import { type BidFormData } from "@/types/auction";
import { z } from "zod";

import { sendEventToAuctionSubscribers } from "../events/route";

// 入札データのバリデーションスキーマ
const bidSchema = z.object({
  amount: z.number().positive().int(),
  isAutoBid: z.boolean().optional(),
  maxAmount: z.number().positive().int().optional(),
});

/**
 * 入札処理を行うAPI
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ auctionId: string }> }) {
  // セッションからユーザー情報を取得
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    // リクエストボディを取得
    const body = await request.json();
    const { auctionId } = await params;

    // バリデーション
    const validatedData = bidSchema.parse(body);

    // 入札処理
    const result = await placeBid(
      auctionId,
      {
        auctionId,
        amount: validatedData.amount,
        isAutoBid: validatedData.isAutoBid || false,
        maxAmount: validatedData.maxAmount,
      },
      session.user.id,
    );

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    // 入札成功時に接続中のクライアントに通知
    if (result.bid) {
      await sendEventToAuctionSubscribers(auctionId, {
        type: AuctionEventType.NEW_BID,
        data: {
          bid: {
            ...result.bid,
            user: {
              id: session.user.id,
              name: session.user.name || null,
              email: "",
              emailVerified: null,
              image: session.user.image || null,
              isAppOwner: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      bid: result.bid,
      message: result.message,
    });
  } catch (error) {
    console.error("入札エラー:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "入力データが不正です", details: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: "入札処理中にエラーが発生しました" }, { status: 500 });
  }
}

// POSTのみ許可
export async function GET() {
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
