import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAuctionByAuctionId } from "@/lib/auction/action/auction-retrieve";
import { getAuthSession } from "@/lib/utils";

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
    console.log(`src/app/api/auctions/[auctionId]/auction-data/route.ts_GET_start`);

    /**
     * 独自ヘッダーからAPIキーを取得
     */
    // 独自ヘッダーからAPIキーを取得
    const secret = request.headers.get("x-internal-secret");
    console.log(`src/app/api/auctions/[auctionId]/auction-data/route.ts_GET_secret`, secret);
    const secretKey = process.env.FREEISM_APP_API_SECRET_KEY;
    console.log(`src/app/api/auctions/[auctionId]/auction-data/route.ts_GET_secretKey`, secretKey);
    // 独自ヘッダーの環境変数が正しいか確認
    if (secret !== secretKey) {
      console.log(`src/app/api/auctions/[auctionId]/auction-data/route.ts_GET_header_Unauthorized`, secret, secretKey);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    /**
     * 認証されているユーザーのIDを取得
     * 認証されていない場合は401エラーを返す
     * 公開APIになっているので、第三者アクセスを防ぐための代表的手法として、セッションを検証
     */
    const session = await getAuthSession();
    const userId = session?.user?.id;
    if (!userId) {
      console.log(`src/app/api/auctions/[auctionId]/auction-data/route.ts_GET_session_Unauthorized`, userId);
      return NextResponse.json({ error: "ユーザーが認証されていません" }, { status: 401 });
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * オークションIDを取得
     */
    const { auctionId } = await params;
    if (!auctionId) {
      console.log(`src/app/api/auctions/[auctionId]/auction-data/route.ts_GET_BadRequest`, auctionId);
      return NextResponse.json({ error: "オークションIDが必要です" }, { status: 400 });
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * オークションデータを取得
     */
    const auction = await getAuctionByAuctionId(auctionId);
    if (!auction) {
      console.log(`src/app/api/auctions/[auctionId]/auction-data/route.ts_GET_NotFound`, auctionId);
      return NextResponse.json({ error: "オークションが見つかりません" }, { status: 400 });
    }
    console.log(`src/app/api/auctions/[auctionId]/auction-data/route.ts_GET_auction`, auction);
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * オークションデータを返す
     */
    return NextResponse.json(auction, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(`src/app/api/auctions/[auctionId]/auction-data/route.ts_GET_error: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({ error: "エラーが発生しました" }, { status: 500 });
  }
}
