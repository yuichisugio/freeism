import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAuctionMessages, getAuctionSellerInfo } from "@/lib/auction/action/message";
import { getAuthSession } from "@/lib/utils";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * リクエスト型定義
 */
type MessageRequestBody = {
  message: string;
  recipientId: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションメッセージを取得するAPI
 * @param req リクエスト
 * @param params パラメータ
 * @returns オークションメッセージ
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ auctionId: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { auctionId } = await params;
    if (!auctionId) {
      return NextResponse.json({ error: "オークションIDが必要です" }, { status: 400 });
    }
    // 出品者情報を取得
    const sellerInfoResponse = await getAuctionSellerInfo(auctionId);

    // メッセージを取得
    const messagesResponse = await getAuctionMessages(auctionId);

    return NextResponse.json({
      messages: messagesResponse.success ? messagesResponse.messages : [],
      sellerId: sellerInfoResponse.success ? sellerInfoResponse.sellerId : null,
      sellerInfo: sellerInfoResponse.success ? sellerInfoResponse.sellerInfo : null,
      success: messagesResponse.success && sellerInfoResponse.success,
      error: messagesResponse.success ? (sellerInfoResponse.success ? null : sellerInfoResponse.error) : messagesResponse.error,
    });
  } catch (error) {
    console.error("メッセージ取得APIエラー:", error);
    return NextResponse.json({ error: "メッセージの取得に失敗しました" }, { status: 500 });
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションメッセージを送信するAPI
 * @param req リクエスト
 * @param params パラメータ
 * @returns オークションメッセージ
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ auctionId: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { auctionId } = await params;
    if (!auctionId) {
      return NextResponse.json({ error: "オークションIDが必要です" }, { status: 400 });
    }
    const { message, recipientId } = (await req.json()) as MessageRequestBody;

    if (!message || !recipientId) {
      return NextResponse.json({ error: "メッセージと受信者IDは必須です" }, { status: 400 });
    }

    // サーバーアクションを呼び出してメッセージを送信
    const result = await import("@/lib/auction/action/message").then((module) => module.sendAuctionMessage(auctionId, message, recipientId));

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
  } catch (error) {
    console.error("メッセージ送信APIエラー:", error);
    return NextResponse.json({ error: "メッセージの送信に失敗しました" }, { status: 500 });
  }
}
