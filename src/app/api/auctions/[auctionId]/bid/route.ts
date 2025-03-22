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
  amount: z.number().int().positive(),
  isAutoBid: z.boolean().optional(),
  maxAmount: z.number().int().positive().optional(),
});

/**
 * 入札APIエンドポイント
 */
export async function POST(request: NextRequest, { params }: { params: { auctionId: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validationResult = bidSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ error: "入力データが無効です", details: validationResult.error.format() }, { status: 400 });
    }

    const bidData: BidFormData = {
      auctionId: params.auctionId,
      amount: validationResult.data.amount,
      isAutoBid: validationResult.data.isAutoBid,
      maxAmount: validationResult.data.maxAmount,
    };

    const userId = session.user.id;
    const auctionId = params.auctionId;

    // 入札処理
    const result = await placeBid(auctionId, bidData, userId);

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
              id: userId,
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
      message: result.message,
      bid: result.bid,
    });
  } catch (error) {
    console.error("入札API処理エラー:", error);
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
