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

    console.log(`route.ts_GET_SSE接続確立中: Client=${clientId} (オークション: ${auctionId}, クエリパラメータから: ${queryAuctionId ?? "N/A"})`);

    // パスパラメータとクエリパラメータのオークションIDが一致するか確認（オプショナル）
    if (queryAuctionId && queryAuctionId !== auctionId) {
      console.warn(
        `src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_警告: パスパラメータのオークションID (${auctionId}) とクエリパラメータのオークションID (${queryAuctionId}) が一致しません。パスパラメータを優先します。`,
      );
    }

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

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * クリーンアップ関数
     * 接続終了時にリソースを解放する
     */
    const cleanup = () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (connectionTimeout) clearTimeout(connectionTimeout);
      subscription?.unsubscribe().catch(console.error);
      streamController?.close();
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * Redis Pub/Sub 購読開始
     * ストリーム作成前に購読を開始して、接続直後のメッセージを見逃さないようにする
     */
    try {
      console.log(
        `src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_Pub/Sub_購読開始_clientId: ${clientId}, redisClientKey: ${redisClientKey}`,
      );
      subscription = redis.subscribe<string>(redisClientKey);

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

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ReadableStream の設定と作成
     */
    const stream = new ReadableStream<Uint8Array>({
      async start(controller: ReadableStreamDefaultController<Uint8Array>) {
        streamController = controller;
        console.log(`SSE stream started for client ${clientId}, auction ${auctionId}`);

        // Heartbeat interval
        heartbeatInterval = setInterval(() => {
          controller.enqueue(encoder.encode(":\n\n"));
        }, SSE_CONFIG.HEARTBEAT_INTERVAL);

        // --- 接続タイムアウト設定 ---
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
            if (!streamController) return;
            let payload: unknown;
            try {
              payload = JSON.parse(message);
            } catch {
              payload = message;
            }
            const sse = `event: new_bid\nid: ${Date.now()}\ndata: ${JSON.stringify(payload)}\n\n`;
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
    // ここで cleanup を呼ぶべきか検討 (リソースが確保されている可能性があるため)
    // ただし、どの段階でエラーが発生したか不明なため、安全に実行できるか注意が必要

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
