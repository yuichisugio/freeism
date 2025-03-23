import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * SSEエンドポイントへリダイレクト
 *
 * 注: クライアント側コードとの互換性のために、/api/auctions/[auctionId]/events から
 * /api/auctions/[auctionId]/sse-server-sent-events へリダイレクトします
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ auctionId: string }> }) {
  const { auctionId } = await params;

  // SSEエンドポイントへリダイレクト
  return NextResponse.redirect(new URL(`/api/auctions/${auctionId}/sse-server-sent-events`, request.url));
}

export const dynamic = "force-dynamic";
