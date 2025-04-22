import type { AuctionWithDetails } from "@/lib/auction/type/types";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAuctionByAuctionId } from "@/lib/auction/action/auction-retrieve";
import { SSE_CONFIG } from "@/lib/auction/constants";
import { redis } from "@/lib/redis"; // Assuming this is correctly configured Upstash Redis client
import { getAuthSession } from "@/lib/utils";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// Vercelが、キャッシュを無視して、常に最新のデータを取得するように指定
export const dynamic = "force-dynamic";

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
     * 認証チェック
     */
    const session = await getAuthSession();
    const userId = session?.user?.id;

    // ログインしていない場合は401エラーを返す
    if (!userId) {
      return new NextResponse(JSON.stringify({ error: "認証が必要です", detail: "ログインしてください" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.log(`src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_認証チェック_end`);

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

    // クライアントIDを取得 (デフォルトはuserId)
    const clientId = url.searchParams.get("clientId") ?? userId;

    // URLからオークションIDを取得（パスパラメータと一致するか確認用）
    const queryAuctionId = url.searchParams.get("auctionId");

    console.log(
      `src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_SSE接続確立中: Client=${clientId} (オークション: ${auctionId}, クエリパラメータから: ${queryAuctionId ?? "N/A"})`,
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
    // ストリームコントローラー
    let streamController: ReadableStreamController<Uint8Array> | null = null;
    // ハートビートタイマー
    let heartbeatInterval: NodeJS.Timeout | null = null;
    // 接続タイムアウト
    let connectionTimeout: NodeJS.Timeout | null = null;
    // 購読オブジェクト
    let subscription: ReturnType<typeof redis.subscribe<string>> | null = null;
    // Encoderを定義
    const encoder = new TextEncoder();
    console.log(`src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_ストリーム作成とPub/Subの設定に必要な変数_end`);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * クリーンアップ関数
     * 接続終了時にリソースを解放する
     */
    const cleanup = () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (connectionTimeout) clearTimeout(connectionTimeout);
      if (subscription) {
        subscription
          .unsubscribe()
          .then(() => {
            console.log(
              `src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_Pub/Sub購読解除_clientId: ${clientId}, redisClientKey: ${redisClientKey}`,
            );
          })
          .catch(console.error);
        streamController?.close();
      }
    };
    console.log(`src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_クリーンアップ関数の定義_end`);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * Redis Pub/Sub 購読開始
     * ストリーム作成前に購読を開始して、接続直後のメッセージを見逃さないようにする
     */
    try {
      console.log(
        `src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_Pub/Sub_購読開始_clientId: ${clientId}, redisClientKey: ${redisClientKey}`,
      );
      subscription = redis.subscribe([redisClientKey]);

      console.log(
        `src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_Pub/Sub購読成功_clientId: ${clientId}, redisClientKey: ${redisClientKey}`,
      );
    } catch (subError) {
      console.error(
        `src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_Pub/Sub購読エラー_clientId: ${clientId}, redisClientKey: ${redisClientKey}:`,
        subError,
      );
      return new Response(JSON.stringify({ error: "Failed to subscribe to auction events" }), { status: 500 });
    }
    console.log(`src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_Pub/Sub購読成功_end`);
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ReadableStream の設定と作成
     */
    const stream = new ReadableStream<Uint8Array>({
      async start(controller: ReadableStreamDefaultController<Uint8Array>) {
        streamController = controller;
        console.log(
          `src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_SSEストリーム開始: client ${clientId}, auction ${auctionId}`,
        );

        // ---------------- ハートビート ----------------
        heartbeatInterval = setInterval(() => {
          controller.enqueue(encoder.encode(":\n\n"));
        }, SSE_CONFIG.HEARTBEAT_INTERVAL);

        // ---------------- 接続タイムアウト設定 ----------------
        connectionTimeout = setTimeout(() => {
          cleanup();
        }, SSE_CONFIG.CONNECTION_TIMEOUT);

        // ----------------- 初期データの送信 -----------------
        console.log(
          `src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_初期データ取得: オークション ${auctionId} のデータを取得します`,
        );
        getAuctionByAuctionId(auctionId)
          .then((auctionData) => {
            if (!auctionData) throw new Error(`Auction ${auctionId} not found`);
            const msg = `event: connection_established\nid: ${Date.now()}\ndata: ${JSON.stringify(auctionData)}\n\n`;
            controller.enqueue(encoder.encode(msg));
            console.log(`src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_初期データ送信: ${msg}`);
          })
          .catch((err) => {
            console.error("Initial data send error:", err);
            cleanup();
            controller.error(err instanceof Error ? err : new Error(String(err)));
            return;
          });

        // ----------------------- Pub/Subメッセージ受信 -----------------------
        subscription.on("message", ({ message, channel }) => {
          try {
            const trimmed = message.trim();
            if (!trimmed) return; // 空文字列を無視
            if (trimmed === ":") return; // ハートビートを無視
            // data: プレフィックス対応
            const jsonStr = trimmed.startsWith("{") ? trimmed : trimmed.startsWith("data: ") ? trimmed.slice(6) : trimmed;
            if (!streamController) return;
            let payload: { data: AuctionWithDetails; timestamp: number };
            try {
              payload = JSON.parse(jsonStr) as { data: AuctionWithDetails; timestamp: number };
            } catch {
              payload = { data: JSON.parse(jsonStr) as AuctionWithDetails, timestamp: Date.now() };
            }
            const sse = `event: new_bid\nid: ${payload.timestamp}\ndata: ${JSON.stringify(payload.data)}\n\n`;
            streamController.enqueue(encoder.encode(sse));
            console.log(`src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_Pub/Subメッセージ受信: ${message}, ${channel}`);
          } catch (e) {
            console.error("Message processing error:", e);
          }
        });

        // ----------------------- サブスクリプションエラー -----------------------
        subscription.on("error", (err: unknown) => {
          console.error("Subscription error:", err);
          void cleanup();
          controller.error(err instanceof Error ? err : new Error(String(err)));
        });

        // ----------------------- クライアント中止 -----------------------
        request.signal.addEventListener("abort", () => void cleanup(), { once: true });
      },
      cancel() {
        cleanup();
      },
    });

    // ----------- レスポンス返却 -----------
    console.log(`src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_レスポンス返却: Returning SSE stream for ${clientId}`);
    return new NextResponse(stream, {
      status: 200, // Statusを明示
      headers: {
        "Content-Type": "text/event-stream",
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
