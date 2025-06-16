import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getUpdatedAuctionByAuctionId } from "@/lib/auction/action/auction-retrieve";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 動的なルーティングを強制
 */
export const dynamic = "force-dynamic";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションデータを取得
 * @param request リクエスト
 * @param params パラメータ
 * @returns オークションデータ
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ auctionId: string }> }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  try {
    /**
     * 独自ヘッダーからAPIキーを取得
     */
    // 独自ヘッダーからAPIキーを取得
    const secret = request.headers.get("x-internal-secret");
    const secretKey = process.env.FREEISM_APP_API_SECRET_KEY;
    // 独自ヘッダーの環境変数が正しいか確認
    if (secret !== secretKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * オークションIDを取得
     */
    const { auctionId } = await params;
    if (!auctionId) {
      return NextResponse.json({ error: "オークションIDが必要です" }, { status: 400 });
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * オークションデータを取得
     */
    const auction = await getUpdatedAuctionByAuctionId(auctionId);
    if (!auction) {
      return NextResponse.json({ error: "オークションが見つかりません" }, { status: 400 });
    }
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * オークションデータを返す
     */
    return NextResponse.json(auction, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error(`src/app/api/auctions/[auctionId]/auction-data/route.ts_GET_error: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({ error: "エラーが発生しました" }, { status: 500 });
  }
}
