import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAuctionByAuctionId } from "@/lib/auction/action/auction-retrieve";

/**
 * オークションデータを取得
 * @param request リクエスト
 * @param params パラメータ
 * @returns オークションデータ
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ auctionId: string }> }) {
  // 独自ヘッダーからAPIキーを取得
  const secret = request.headers.get("x-internal-secret");
  // 独自ヘッダーの環境変数が正しいか確認
  if (secret !== process.env.FREEISM_APP_API_SECRET_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // オークションIDを取得
  const { auctionId } = await params;
  // オークションデータを取得
  const auction = await getAuctionByAuctionId(auctionId);
  // オークションデータを返す
  return NextResponse.json(auction, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=1200",
    },
  });
}
