import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SSE_CONFIG } from "@/lib/auction/constants";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// Vercelが、キャッシュを無視して、常に最新のデータを取得するように指定
export const dynamic = "force-dynamic";

// エッジ環境で実行
export const runtime = "edge";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * SSEエンドポイント
 * オークションの初期データと、新しい入札やオークション更新が発生した場合のイベントを送信
 * @param request リクエスト
 * @param params パラメータ
 * @returns レスポンス
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ auctionId: string }> }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  try {
    console.log(`src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_start`);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * クエリパラメータを取得
     */
    const url = new URL(request.url);

    console.log(`src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_受信したリクエストURL: ${request.url}`);

    // auctionIdを取得
    const { auctionId } = await params;
    if (!auctionId) {
      return new NextResponse(JSON.stringify({ error: "オークションIDが必要です" }), { status: 400 });
    }

    // URLからオークションIDを取得（パスパラメータと一致するか確認用）
    const queryAuctionId = url.searchParams.get("auctionId");

    console.log(
      `src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_SSE接続確立中: (オークション: ${auctionId}, クエリパラメータから: ${queryAuctionId ?? "N/A"})`,
    );

    // パスパラメータとクエリパラメータのオークションIDが一致するか確認（オプショナル）
    if (queryAuctionId && queryAuctionId !== auctionId) {
      console.warn(
        `src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_警告: パスパラメータのオークションID (${auctionId}) とクエリパラメータのオークションID (${queryAuctionId}) が一致しません。パスパラメータを優先します。`,
      );
    }
    console.log(`src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_クエリパラメータ取得_end`);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ストリーム作成とPub/Subの設定に必要な変数
     */
    // Pub/Subチャンネル名
    const redisClientKey = `auction:${auctionId}:events`;
    // ハートビートタイマー
    let heartbeatInterval: NodeJS.Timeout | null = null;
    // Encoderを定義
    const encoder = new TextEncoder();
    console.log(`src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_ストリーム作成とPub/Subの設定に必要な変数_end`);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * UpstashのREST APIを使用してSSEストリームを取得
     */
    const channel = encodeURIComponent(redisClientKey);
    const redisRestUrl = `${process.env.UPSTASH_REDIS_REST_URL}/subscribe/${channel}`;
    console.log(`src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_Upstash_REST_API_URL: ${redisRestUrl}`);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * UpstashからSSEストリームを取得
     */
    const upstream = await fetch(redisRestUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        Accept: "text/event-stream",
      },
    });
    if (!upstream.body) {
      return new NextResponse("Upstream stream unavailable", { status: 502 });
    }
    console.log(`src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_Upstash_fetch_end`);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * クリーンアップ関数
     * 接続終了時にリソースを解放する
     */
    const cleanup = () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    };
    console.log(`src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_クリーンアップ関数の定義_end`);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * クライアントの abort を監視してクリーンアップ
     */
    request.signal.addEventListener("abort", () => {
      console.log("Client aborted — cleaning up heartbeat");
      cleanup();
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * TransformStream でチャンク透過＋心拍挿入
     */
    const transformStream = new TransformStream<Uint8Array>({
      // GET実行時に実行する内容
      start(controller) {
        // ハートビートタイマー
        heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(":\n\n"));
          } catch (e) {
            // ストリーム閉鎖時の enqueue エラーを握りつぶし、クリーンアップ
            console.warn("Heartbeat enqueue failed:", e);
            cleanup();
          }
        }, SSE_CONFIG.HEARTBEAT_INTERVAL);

        console.log(
          `src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_初期データ取得: オークション ${auctionId} のデータを取得します`,
        );

        // オークションデータの取得ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
        let url = "";
        if (process.env.NODE_ENV === "production") {
          url = `https://${process.env.DOMAIN}/api/auctions/${auctionId}/auction-data`;
          console.log(`src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_production環境`, url);
        } else {
          url = `http://localhost:3000/api/auctions/${auctionId}/auction-data`;
          console.log(`src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_development環境`, url);
        }
        const secret = process.env.FREEISM_APP_API_SECRET_KEY;
        fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "x-internal-secret": secret ?? "", // 独自のヘッダーに環境変数を添付
          },
          next: { revalidate: 86400 },
        })
          .then((res) => res.json())
          .then((auctionData) => {
            if (!auctionData) throw new Error(`Auction ${auctionId} not found`);
            const msg = `event: connection_established\ndata: ${auctionData}\ntimestamp: ${Date.now()}\n\n`;
            controller.enqueue(encoder.encode(msg));
            console.log(`src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_初期データ送信: ${msg}`);
          })
          .catch((err) => {
            console.error("Initial data send error:", err);
            cleanup();
            controller.error(err instanceof Error ? err : new Error(String(err)));
            return;
          });

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      },
      transform(chunk, controller) {
        // 元の SSE メッセージはそのまま流す
        controller.enqueue(chunk);
      },
      flush(controller) {
        void cleanup();
        controller.terminate();
      },
    });

    // Upstash → Transform → クライアント
    const readable = upstream.body.pipeThrough(transformStream);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * レスポンスを返す
     */
    return new NextResponse(readable, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    // GETハンドラ全体の予期せぬエラー
    console.error(`src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_全体エラー`, error);

    return new Response(
      JSON.stringify({
        error: "サーバー内部エラー",
        detail: "SSE接続の処理中に予期せぬ問題が発生しました。",
        // エラーの詳細を本番環境で公開しないように注意
        errorMessage: error instanceof Error ? error.message : String(error), // 開発用
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-transform",
        },
      },
    );
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

export async function POST() {
  return new NextResponse(null, { status: 405, headers: { Allow: "GET" } });
}

export async function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: "GET" } });
}

export async function PATCH() {
  return new NextResponse(null, { status: 405, headers: { Allow: "GET" } });
}

export async function HEAD() {
  return new NextResponse(null, { status: 405, headers: { Allow: "GET" } });
}

export async function OPTIONS() {
  // CORSプリフライトリクエストなどに対応する場合
  return new NextResponse(null, {
    status: 204, // No Content
    headers: {
      Allow: "GET, OPTIONS", // 許可するメソッド
      "Access-Control-Allow-Origin": "YOUR_FRONTEND_URL",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization", // 必要なヘッダー
    },
  });
}
