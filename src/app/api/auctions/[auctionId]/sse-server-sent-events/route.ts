import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuctionByAuctionId } from "@/lib/auction/action/auction-retrieve";
import { SSE_CONFIG } from "@/lib/auction/constants";
import { connectionManager } from "@/lib/auction/server-sent-events/connection-manager-singleton";

/**
 * SSEエンドポイント
 * オークションの初期データと、新しい入札やオークション更新が発生した場合のイベントを送信
 * @param request リクエスト
 * @param params パラメータ
 * @returns レスポンス
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ auctionId: string }> }) {
  // パラメータを取得
  const { auctionId } = await params;

  // クエリパラメータを取得
  const url = new URL(request.url);
  console.log(`route.ts_GET_受信したリクエストURL: ${request.url}`);

  // クライアントIDを取得
  const clientId = url.searchParams.get("clientId") ?? `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // 最後のイベントIDを取得
  const lastEventId = parseInt(url.searchParams.get("lastEventId") ?? "0", 10);

  // URLからオークションIDを取得（パスパラメータと一致するか確認用）
  const queryAuctionId = url.searchParams.get("auctionId");

  console.log(`route.ts_GET_SSE接続確立中: ${clientId} (オークション: ${auctionId}, クエリパラメータから: ${queryAuctionId}, 最後のイベントID: ${lastEventId})`);

  // パスパラメータとクエリパラメータのオークションIDが一致するか確認（オプショナル）
  if (queryAuctionId && queryAuctionId !== auctionId) {
    console.warn(`route.ts_GET_警告: パスパラメータのオークションID (${auctionId}) とクエリパラメータのオークションID (${queryAuctionId}) が一致しません。パスパラメータを優先します。`);
  }

  // 認証チェック
  const session = await auth();
  console.log(`route.ts_GET_セッション: ${session ? "あり" : "なし"}, ユーザーID: ${session?.user?.id ?? "なし"}`);

  // ログインしていない場合は401エラーを返す
  if (!session?.user?.id) {
    console.error("route.ts_GET_SSE接続認証エラー: ユーザーセッションが存在しません");
    return new Response(
      JSON.stringify({
        error: "認証が必要です",
        detail: "ログインしてください",
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-transform",
        },
      },
    );
  }

  try {
    const connectionCount = connectionManager.getConnectionCount(auctionId);
    // 接続数制限チェック
    console.log(`route.ts_GET_オークション ${auctionId} の現在の接続数: ${connectionCount}`);

    if (connectionCount >= SSE_CONFIG.MAX_CONNECTIONS_PER_AUCTION) {
      return new Response(
        JSON.stringify({
          error: "接続数制限超過",
          detail: "現在、このオークションへの接続数が上限に達しています。しばらく経ってから再度お試しください。",
        }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-transform",
            "Retry-After": "60",
          },
        },
      );
    }

    // ストリームとエンコーダーの設定
    const encoder = new TextEncoder();

    // クライアントが接続を閉じた時の処理
    const handleAbort = () => {
      try {
        console.log(`route.ts_GET_クライアント ${clientId} の接続が中断されました (abort)`);

        connectionManager.removeConnection(auctionId, clientId);
      } catch (error) {
        console.error(`route.ts_GET_クライアント ${clientId} のabortハンドリング中にエラーが発生:`, error);
      }
    };

    // abortイベントリスナーを登録
    request.signal.addEventListener("abort", handleAbort);

    console.log(`route.ts_GET_オークション ${auctionId} のデータを取得します`);
    const auctionData = await getAuctionByAuctionId(auctionId);
    console.log(`route.ts_GET_オークションデータ取得結果:`, auctionData ? "成功" : "失敗");
    if (!auctionData) {
      console.error(`[API Route GET] Auction data not found for ID: ${auctionId}`);
      return new Response(JSON.stringify({ error: "Auction not found" }), { status: 404 });
    }

    // ストリームの設定
    const stream = new ReadableStream({
      start: async (controller) => {
        console.log(`[API Route Stream Start] Client ${clientId}, Auction ${auctionId}`);
        let heartbeatInterval: NodeJS.Timeout | null = null;
        let timeoutId: NodeJS.Timeout | null = null;

        // ハートビートタイマー設定
        heartbeatInterval = setInterval(() => {
          try {
            console.log(`route.ts_GET_クライアント ${clientId} にハートビートを送信します`);
            controller.enqueue(encoder.encode(":\n\n"));
          } catch (error) {
            console.warn(`[API Route Stream Heartbeat] Error sending heartbeat to ${clientId}, closing connection:`, error);
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            connectionManager.removeConnection(auctionId, clientId);
            try {
              controller.close();
            } catch {} // Attempt to close controller on error
          }
        }, SSE_CONFIG.HEARTBEAT_INTERVAL);

        // 一定時間後にタイムアウト
        timeoutId = setTimeout(() => {
          try {
            console.log(`[API Route Stream Timeout] Client ${clientId}, Auction ${auctionId}`);
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            connectionManager.removeConnection(auctionId, clientId);
            try {
              controller.close();
            } catch {} // Attempt to close controller on timeout
          } catch (e) {
            console.error("route.ts_GET_コントローラーのクローズ中にエラーが発生しました:", e);
          }
        }, SSE_CONFIG.CONNECTION_TIMEOUT);

        // コネクションの登録
        connectionManager.addConnection(auctionId, clientId, controller, heartbeatInterval, timeoutId);
        console.log(`route.ts_GET_クライアント ${clientId} の接続を登録しました (オークション: ${auctionId})`);

        try {
          // 接続成功メッセージを送信
          const connectionMessage = `event: connection_established\nid: 0\ndata: ${JSON.stringify(auctionData)}\n\n`;
          controller.enqueue(encoder.encode(connectionMessage));
          console.log(`route.ts_GET_クライアント ${clientId} への接続確立メッセージを送信しました`);

          // 最後のイベントID以降のイベントを送信（再接続時）
          if (lastEventId > 0) {
            const missedEvents = connectionManager.getEventsSince(auctionId, lastEventId);

            if (missedEvents.length > 0) {
              console.log(`route.ts_GET_クライアント ${clientId} に ${missedEvents.length} 件の未受信イベントを送信します`);

              for (const event of missedEvents) {
                controller.enqueue(encoder.encode(connectionManager.formatEventMessage(event)));
              }
            } else {
              console.log(`route.ts_GET_クライアント ${clientId} の未受信イベントはありません (lastEventId: ${lastEventId})`);
            }
          }
        } catch (error) {
          console.error("route.ts_GET_接続確立メッセージ送信中にエラーが発生しました:", error);
          if (heartbeatInterval) clearInterval(heartbeatInterval);
          if (timeoutId) clearTimeout(timeoutId);
          connectionManager.removeConnection(auctionId, clientId); // Clean up on start error
          try {
            controller.error(error);
          } catch {} // Signal error to the stream
        }

        // クリーンアップ関数
        return () => {
          console.log(`route.ts_GET_クライアント ${clientId} の接続をクリーンアップします`);
          clearTimeout(timeoutId);
          clearInterval(heartbeatInterval);
          connectionManager.removeConnection(auctionId, clientId);
        };
      },
      cancel: (reason) => {
        // Stream cancellation from client or controller.error()
        console.log(`[API Route Stream Cancel] Client ${clientId}, Reason: ${reason}`);
        // Abort handler should already trigger removeConnection, but ensure cleanup
        connectionManager.removeConnection(auctionId, clientId);
      },
    });

    console.log(`route.ts_GET_クライアント ${clientId} にSSEストリームレスポンスを返します`);
    // レスポンスヘッダーの設定
    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("route.ts_GET_SSEセットアップエラー:", error);
    return new Response(
      JSON.stringify({
        error: "サーバーエラー",
        detail: "SSE接続の確立中に問題が発生しました",
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

// GET以外のメソッドを禁止
export async function POST(request: NextRequest, { params }: { params: Promise<{ auctionId: string }> }) {
  // GETリクエストと同じロジックをコールする（HTTPメソッドの違いによる混乱を避けるため）
  return GET(request, { params });
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
