import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { AuctionEventType } from "@/lib/auction/types";

// 設定パラメータ
const MAX_CONNECTIONS_PER_AUCTION = 1000; // オークションごとの最大接続数
const CONNECTION_TIMEOUT = 60 * 60 * 1000; // 60分タイムアウト
const HEARTBEAT_INTERVAL = 30000; // 30秒ごとにハートビート
const MAX_EVENT_HISTORY = 50; // オークションごとのイベント履歴最大数
export const runtime = "nodejs"; // Edgeランタイムを使用する場合は 'edge' に変更
// 重要: サーバーのタイムアウトを無効化
export const maxDuration = 300;

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
  private connections = new Map<
    string,
    Map<
      string,
      {
        controller: ReadableStreamController<Uint8Array>;
        heartbeatInterval: NodeJS.Timeout | null;
        timeoutId: NodeJS.Timeout | null;
        isActive: boolean; // 接続がアクティブかどうかを示すフラグ
      }
    >
  >();
  // オークションID => イベント履歴 のマップ
  private eventHistories = new Map<string, EventHistoryItem[]>();
  // グローバルイベントIDカウンター
  private globalEventId = 1;
  // エンコーダー
  private encoder = new TextEncoder();

  /**
   * オークションごとの接続数を取得
   * @param auctionId オークションID
   * @returns オークションごとの接続数
   */
  getConnectionCount(auctionId: string): number {
    return this.connections.get(auctionId)?.size || 0;
  }

  /**
   * 全ての接続数を取得
   * @returns 全ての接続数
   */
  getTotalConnectionCount(): number {
    let total = 0;
    for (const clientMap of this.connections.values()) {
      total += clientMap.size;
    }
    return total;
  }

  /**
   * クライアント接続を追加
   * @param auctionId オークションID
   * @param clientId クライアントID
   * @param controller コントローラー
   * @param heartbeatInterval ハートビート間隔
   * @param timeoutId タイムアウトID
   */
  addConnection(auctionId: string, clientId: string, controller: ReadableStreamController<Uint8Array>, heartbeatInterval: NodeJS.Timeout | null = null, timeoutId: NodeJS.Timeout | null = null): void {
    // オークションのマップがなければ初期化
    if (!this.connections.has(auctionId)) {
      this.connections.set(auctionId, new Map());
    }

    // クライアントを追加
    const auctionClients = this.connections.get(auctionId);
    if (auctionClients) {
      auctionClients.set(clientId, {
        controller,
        heartbeatInterval,
        timeoutId,
        isActive: true,
      });
    }

    console.log(`SSE接続確立: クライアント ${clientId} がオークション ${auctionId} に接続しました (接続数: ${this.getConnectionCount(auctionId)})`);
  }

  /**
   * クライアント接続を削除
   * @param auctionId オークションID
   * @param clientId クライアントID
   */
  removeConnection(auctionId: string, clientId: string): void {
    console.log("removeConnection", auctionId, clientId);

    const auctionClients = this.connections.get(auctionId);
    console.log("removeConnection_auctionClients");

    // オークションのマップがなければ初期化
    if (!auctionClients) return;

    const connectionInfo = auctionClients.get(clientId);
    console.log("removeConnection_connectionInfo");
    if (!connectionInfo) return;

    // 既にクリーンアップ済みならスキップ
    if (!connectionInfo.isActive) {
      console.log(`クライアント ${clientId} の接続は既にクリーンアップ済みです`);
      return;
    }

    // タイマーのクリーンアップ
    if (connectionInfo.heartbeatInterval) {
      clearInterval(connectionInfo.heartbeatInterval);
      connectionInfo.heartbeatInterval = null;
    }

    if (connectionInfo.timeoutId) {
      clearTimeout(connectionInfo.timeoutId);
      connectionInfo.timeoutId = null;
    }

    // アクティブフラグを更新
    connectionInfo.isActive = false;

    // マップから削除
    auctionClients.delete(clientId);

    console.log(`SSE接続終了: クライアント ${clientId} がオークション ${auctionId} から切断しました (残り接続数: ${auctionClients.size})`);

    if (auctionClients.size === 0) {
      this.connections.delete(auctionId);
      console.log(`オークション ${auctionId} の全ての接続が終了しました`);
    }
  }

  /**
   * イベント履歴を記録
   * @param auctionId オークションID
   * @param type イベントタイプ
   * @param data イベントデータ
   * @returns イベント履歴
   */
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

  /**
   * 特定イベントID以降のイベントを取得
   * @param auctionId オークションID
   * @param lastEventId 最後のイベントID
   * @returns イベント履歴
   */
  getEventsSince(auctionId: string, lastEventId: number): EventHistoryItem[] {
    const history = this.eventHistories.get(auctionId) || [];
    return history.filter((event) => event.id > lastEventId);
  }

  /**
   * SSEメッセージ形式に変換
   * @param event イベント履歴
   * @returns SSEメッセージ
   */
  formatEventMessage(event: EventHistoryItem): string {
    let message = "";

    message += `event: ${event.type}\n`;
    message += `id: ${event.id}\n`;
    message += `data: ${JSON.stringify(event.data)}\n\n`;

    return message;
  }

  /**
   * オークションの購読者全員にイベントを送信
   * @param auctionId オークションID
   * @param type イベントタイプ
   * @param data イベントデータ
   * @returns イベント履歴
   */
  broadcastToAuction(auctionId: string, type: AuctionEventType, data: Record<string, any>): EventHistoryItem {
    console.log("broadcastToAuction", auctionId, type, data);
    // イベントを履歴に追加
    const event = this.addEventToHistory(auctionId, type, data);

    // イベントメッセージを送信用のフォーマット
    const eventMessage = this.formatEventMessage(event);

    console.log("broadcastToAuction_eventMessage", eventMessage);

    // エンコードされたメッセージを取得
    const encodedEventMessage = this.encoder.encode(eventMessage);

    // オークションの購読者を取得
    const auctionClients = this.connections.get(auctionId);

    // オークションの購読者がいる場合
    if (auctionClients && auctionClients.size > 0) {
      // 削除すべき接続を追跡
      const clientsToRemove: string[] = [];

      // 全クライアントに送信
      for (const [clientId, connectionInfo] of auctionClients.entries()) {
        try {
          connectionInfo.controller.enqueue(encodedEventMessage);
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
    } else {
      console.log(`オークション ${auctionId} に接続者がいません`);
    }

    return event;
  }
}

// グローバルなシングルトンとして確実に共有するため、キャッシュやモジュールの再読み込みに対応した実装に変更
let globalConnectionManager: ConnectionManager | null = null;

export function getConnectionManager(): ConnectionManager {
  if (!globalConnectionManager) {
    globalConnectionManager = new ConnectionManager();
    // グローバルオブジェクトに保存して確実に共有されるようにする
    if (typeof global !== "undefined") {
      (global as any).__connectionManager = globalConnectionManager;
    }
  }

  // すでにグローバルに保存されたインスタンスがあればそれを使用
  if (typeof global !== "undefined" && (global as any).__connectionManager) {
    return (global as any).__connectionManager;
  }

  return globalConnectionManager;
}

// 使用時
const connectionManager = getConnectionManager();

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

    // コントローラーの状態管理用の変数
    let isControllerClosed = false;

    // クライアントが接続を閉じた時の処理
    const handleAbort = () => {
      console.log("sse-abort", clientId);
      connectionManager.removeConnection(auctionId, clientId);
      console.log(`クライアントが接続を中断: ${clientId} (オークション: ${auctionId})`);
    };

    // abortイベントリスナーを登録
    request.signal.addEventListener("abort", handleAbort);

    // ストリームの設定
    const stream = new ReadableStream({
      start: async (controller) => {
        // ハートビートタイマー設定
        const heartbeatInterval = setInterval(() => {
          try {
            // コントローラーが閉じられているか、コネクションが無効になっていたら
            // ハートビートを送信しない
            if (isControllerClosed || !connectionManager.getConnectionCount(auctionId)) {
              clearInterval(heartbeatInterval);
              return;
            }
            console.log("sse-heartbeat_start", controller);
            controller.enqueue(encoder.encode(":\n\n"));
            console.log("sse-heartbeat_end", controller);
          } catch (error) {
            // エラーが発生した場合はタイマーをクリアして接続削除
            clearInterval(heartbeatInterval);
            console.log("sse-heartbeat_clearInterval", controller);
            isControllerClosed = true;
            connectionManager.removeConnection(auctionId, clientId);
            console.log("sse-heartbeat_removeConnection", controller);
            console.log(`ハートビート中にエラーが発生したため接続を削除: ${clientId},${error}`);
          }
        }, HEARTBEAT_INTERVAL);

        // 一定時間後にタイムアウト
        const timeoutId = setTimeout(() => {
          try {
            if (!isControllerClosed) {
              isControllerClosed = true;
              controller.close();
            }
            clearInterval(heartbeatInterval);
            connectionManager.removeConnection(auctionId, clientId);
            console.log(`SSEタイムアウト: ユーザー ${session.user?.id} のオークション ${auctionId} への接続がタイムアウトしました`);
          } catch (e) {
            console.error("コントローラーのクローズ中にエラーが発生しました:", e);
          }
        }, CONNECTION_TIMEOUT);

        // コネクションの登録
        connectionManager.addConnection(auctionId, clientId, controller, heartbeatInterval, timeoutId);
        console.log("connectionManager.addConnection", auctionId, clientId, controller);

        try {
          // 接続成功メッセージを送信
          const connectionMessage = `event: connection_established\nid: 0\ndata: ${JSON.stringify({ clientId })}\n\n`;
          controller.enqueue(encoder.encode(connectionMessage));
          console.log(`クライアント ${clientId} への接続確立メッセージを送信しました`);

          // 最後のイベントID以降のイベントを送信（再接続時）
          if (lastEventId > 0) {
            const missedEvents = connectionManager.getEventsSince(auctionId, lastEventId);

            if (missedEvents.length > 0) {
              console.log(`クライアント ${clientId} に ${missedEvents.length} 件の未受信イベントを送信します`);

              for (const event of missedEvents) {
                if (!isControllerClosed) {
                  controller.enqueue(encoder.encode(connectionManager.formatEventMessage(event)));
                }
              }
            }
          }
        } catch (error) {
          console.error("接続確立メッセージ送信中にエラーが発生しました:", error);
          isControllerClosed = true;
        }

        // クリーンアップ関数
        return () => {
          console.log("sse-cleanup", controller);
          isControllerClosed = true;
          clearTimeout(timeoutId);
          clearInterval(heartbeatInterval);
          connectionManager.removeConnection(auctionId, clientId);
        };
      },
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
  console.log("sendEventToAuctionSubscribers", auctionId, type, data);
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
