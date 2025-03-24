import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuctionWithTask } from "@/lib/auction/auction-service";
import { AuctionEventType } from "@/lib/auction/types";

// 設定パラメータ
const MAX_CONNECTIONS_PER_AUCTION = 1000; // オークションごとの最大接続数
const CONNECTION_TIMEOUT = 60 * 60 * 1000; // 60分タイムアウト
const HEARTBEAT_INTERVAL = 30000; // 30秒ごとにハートビート
const MAX_EVENT_HISTORY = 50; // オークションごとのイベント履歴最大数

// イベント履歴データ型
type EventHistoryItem = {
  id: number; // イベントID
  type: AuctionEventType; // イベントタイプ
  data: Record<string, any>; // イベントデータ
  timestamp: number; // タイムスタンプ
};

// 接続管理クラス
class ConnectionManager {
  // オークションID => (クライアントID => コントローラー) の二層マップ
  private connections = new Map<string, Map<string, ReadableStreamController<Uint8Array>>>();
  // オークションID => イベント履歴 のマップ
  private eventHistories = new Map<string, EventHistoryItem[]>();
  // グローバルイベントIDカウンター
  private globalEventId = 1;
  // エンコーダー
  private encoder = new TextEncoder();

  // オークションごとの接続数を取得
  getConnectionCount(auctionId: string): number {
    return this.connections.get(auctionId)?.size || 0;
  }

  // 全ての接続数を取得
  getTotalConnectionCount(): number {
    let total = 0;
    for (const clientMap of this.connections.values()) {
      total += clientMap.size;
    }
    return total;
  }

  // クライアント接続を追加
  addConnection(auctionId: string, clientId: string, controller: ReadableStreamController<Uint8Array>): void {
    // オークションのマップがなければ初期化
    if (!this.connections.has(auctionId)) {
      this.connections.set(auctionId, new Map());
    }

    // クライアントを追加
    this.connections.get(auctionId)?.set(clientId, controller);
    console.log(`SSE接続確立: クライアント ${clientId} がオークション ${auctionId} に接続しました (接続数: ${this.getConnectionCount(auctionId)})`);
  }

  // クライアント接続を削除
  removeConnection(auctionId: string, clientId: string): void {
    const auctionClients = this.connections.get(auctionId);
    if (auctionClients) {
      auctionClients.delete(clientId);
      console.log(`SSE接続終了: クライアント ${clientId} がオークション ${auctionId} から切断しました (残り接続数: ${auctionClients.size})`);

      // オークションの接続がなくなったらマップからも削除
      if (auctionClients.size === 0) {
        this.connections.delete(auctionId);
        console.log(`オークション ${auctionId} の全ての接続が終了しました`);
      }
    }
  }

  // イベント履歴を記録
  addEventToHistory(auctionId: string, type: AuctionEventType, data: Record<string, any>): EventHistoryItem {
    const eventId = this.globalEventId++;

    // オークションのイベント履歴がなければ初期化
    if (!this.eventHistories.has(auctionId)) {
      this.eventHistories.set(auctionId, []);
    }

    const eventItem: EventHistoryItem = {
      id: eventId,
      type,
      data,
      timestamp: Date.now(),
    };

    // イベント履歴に追加
    const history = this.eventHistories.get(auctionId)!;
    history.push(eventItem);

    // 履歴サイズを制限
    if (history.length > MAX_EVENT_HISTORY) {
      history.shift();
    }

    return eventItem;
  }

  // 特定イベントID以降のイベントを取得
  getEventsSince(auctionId: string, lastEventId: number): EventHistoryItem[] {
    const history = this.eventHistories.get(auctionId) || [];
    return history.filter((event) => event.id > lastEventId);
  }

  // SSEメッセージ形式に変換
  formatEventMessage(event: EventHistoryItem): string {
    let message = "";

    message += `event: ${event.type}\n`;
    message += `id: ${event.id}\n`;
    message += `data: ${JSON.stringify(event.data)}\n\n`;

    return message;
  }

  // オークションの購読者全員にイベントを送信
  broadcastToAuction(auctionId: string, type: AuctionEventType, data: Record<string, any>): EventHistoryItem {
    // イベントを履歴に追加
    const event = this.addEventToHistory(auctionId, type, data);

    // イベントメッセージを送信用のフォーマット
    const eventMessage = this.formatEventMessage(event);

    // エンコードされたメッセージを取得
    const encodedEventMessage = this.encoder.encode(eventMessage);

    // オークションの購読者を取得
    const auctionClients = this.connections.get(auctionId);

    // オークションの購読者がいる場合
    if (auctionClients && auctionClients.size > 0) {
      // 削除すべき接続を追跡
      const clientsToRemove: string[] = [];

      // 全クライアントに送信
      for (const [clientId, controller] of auctionClients.entries()) {
        try {
          // エンコードされたメッセージを送信
          controller.enqueue(encodedEventMessage);
        } catch (e) {
          // エラーが発生した場合は接続を削除する配列に追加
          console.error(`クライアント ${clientId} へのメッセージ送信エラー:`, e);
          clientsToRemove.push(clientId);
        }
      }

      // エラーが発生した接続を削除
      for (const clientId of clientsToRemove) {
        // 接続を削除
        this.removeConnection(auctionId, clientId);
      }

      console.log(`オークション ${auctionId} の ${auctionClients.size} クライアントにイベント ${type} を送信しました`);
    }

    return event;
  }

  // ハートビートメッセージを送信
  sendHeartbeat(auctionId: string): void {
    const heartbeatMessage = this.encoder.encode(": heartbeat\n\n");
    const auctionClients = this.connections.get(auctionId);

    if (auctionClients && auctionClients.size > 0) {
      const clientsToRemove: string[] = [];

      for (const [clientId, controller] of auctionClients.entries()) {
        try {
          controller.enqueue(heartbeatMessage);
        } catch (e) {
          console.error(`クライアント ${clientId} へのハートビート送信エラー:`, e);
          clientsToRemove.push(clientId);
        }
      }

      // エラーが発生した接続を削除
      for (const clientId of clientsToRemove) {
        this.removeConnection(auctionId, clientId);
      }
    }
  }
}

// シングルトンとしてコネクションマネージャを作成
const connectionManager = new ConnectionManager();

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

  // クライアントIDを取得
  const clientId = url.searchParams.get("clientId") || `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // 最後のイベントIDを取得
  const lastEventId = parseInt(url.searchParams.get("lastEventId") || "0", 10);

  // 認証チェック
  const session = await auth();

  // ログインしていない場合は401エラーを返す
  if (!session?.user?.id) {
    console.error("SSE接続認証エラー: ユーザーセッションが存在しません");
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
    // 接続数制限チェック
    if (connectionManager.getConnectionCount(auctionId) >= MAX_CONNECTIONS_PER_AUCTION) {
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

    // ストリームの設定
    const stream = new ReadableStream({
      start: async (controller) => {
        // コネクションの登録
        connectionManager.addConnection(auctionId, clientId, controller);

        // 接続成功メッセージを送信
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connection_established", clientId })}\n\n`));

        // オークション情報を取得
        if (lastEventId === 0) {
          const auction = await getAuctionWithTask(auctionId);
          if (auction) {
            controller.enqueue(
              encoder.encode(
                connectionManager.formatEventMessage({
                  id: 0,
                  type: AuctionEventType.INITIAL,
                  data: { auction },
                  timestamp: Date.now(),
                }),
              ),
            );
          }
        }

        // 最後のイベントID以降のイベントを送信（再接続時）
        if (lastEventId > 0) {
          const missedEvents = connectionManager.getEventsSince(auctionId, lastEventId);

          if (missedEvents.length > 0) {
            console.log(`クライアント ${clientId} に ${missedEvents.length} 件の未受信イベントを送信します`);

            for (const event of missedEvents) {
              controller.enqueue(encoder.encode(connectionManager.formatEventMessage(event)));
            }
          }
        }

        // ハートビートタイマー設定
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": heartbeat\n\n"));
          } catch (error) {
            // エラーが発生した場合はタイマーをクリアして接続削除
            clearInterval(heartbeatInterval);
            connectionManager.removeConnection(auctionId, clientId);
            console.log(`ハートビート中にエラーが発生したため接続を削除: ${clientId},${error}`);
          }
        }, HEARTBEAT_INTERVAL);

        // 一定時間後にタイムアウト
        const timeoutId = setTimeout(() => {
          try {
            controller.close();
            clearInterval(heartbeatInterval);
            connectionManager.removeConnection(auctionId, clientId);
            console.log(`SSEタイムアウト: ユーザー ${session.user?.id} のオークション ${auctionId} への接続がタイムアウトしました`);
          } catch (e) {
            console.error("コントローラーのクローズ中にエラーが発生しました:", e);
          }
        }, CONNECTION_TIMEOUT);

        // クリーンアップ関数
        return () => {
          clearTimeout(timeoutId);
          clearInterval(heartbeatInterval);
          connectionManager.removeConnection(auctionId, clientId);
        };
      },
    });

    // クライアントが接続を閉じた時の処理
    request.signal.addEventListener("abort", () => {
      connectionManager.removeConnection(auctionId, clientId);
      console.log(`クライアントが接続を中断: ${clientId} (オークション: ${auctionId})`);
    });

    // レスポンスヘッダーの設定
    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Nginxバッファリングの無効化
      },
    });
  } catch (error) {
    console.error("SSEセットアップエラー:", error);
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

/**
 * 特定のオークションの全接続に対してイベントを送信
 * @param auctionId オークションID
 * @param type イベントタイプ
 * @param data イベントデータ
 * @returns イベント
 */
export function sendEventToAuctionSubscribers(auctionId: string, type: AuctionEventType, data: Record<string, any>): EventHistoryItem {
  return connectionManager.broadcastToAuction(auctionId, type, data);
}

/**
 * オークション更新イベントの送信ヘルパー関数
 * @param auctionId オークションID
 * @param auction オークション情報
 */
export function sendAuctionUpdateEvent(auctionId: string, auction: Record<string, any>): EventHistoryItem {
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.AUCTION_UPDATE, { auction });
}

/**
 * 新規入札イベントの送信ヘルパー関数
 * @param auctionId オークションID
 * @param bid 入札情報
 * @param auction 更新されたオークション情報
 */
export function sendNewBidEvent(auctionId: string, bid: Record<string, any>, auction: Record<string, any>): EventHistoryItem {
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.NEW_BID, { bid, auction });
}

/**
 * オークション延長イベントの送信ヘルパー関数
 * @param auctionId オークションID
 * @param newEndTime 新しい終了時間
 * @param auction 更新されたオークション情報
 */
export function sendAuctionExtensionEvent(auctionId: string, newEndTime: string, auction: Record<string, any>): EventHistoryItem {
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.AUCTION_EXTENSION, { newEndTime, auction });
}

/**
 * オークション終了イベントの送信ヘルパー関数
 * @param auctionId オークションID
 * @param auction 最終的なオークション情報
 */
export function sendAuctionEndedEvent(auctionId: string, auction: Record<string, any>): EventHistoryItem {
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.AUCTION_ENDED, { auction });
}

/**
 * エラーイベントの送信ヘルパー関数
 * @param auctionId オークションID
 * @param error エラーメッセージ
 */
export function sendErrorEvent(auctionId: string, error: string): EventHistoryItem {
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.ERROR, { error });
}

// GET以外のメソッドを禁止
export async function POST() {
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
