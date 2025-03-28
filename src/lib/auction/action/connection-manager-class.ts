import type { AuctionEventType, AuctionWithDetails } from "../types";

const MAX_EVENT_HISTORY = 50; // オークションごとのイベント履歴最大数

// イベント履歴データ型
type EventHistoryItem = {
  id: number; // イベントID
  type: AuctionEventType; // イベントタイプ
  data: Record<string, any>; // イベントデータ
  timestamp: number; // タイムスタンプ
};

// 接続管理クラス
export class ConnectionManager {
  // オークションID => (クライアントID => コントローラー) の二層マップ
  private connections = new Map<
    string,
    Map<string, { controller: ReadableStreamController<Uint8Array>; heartbeatInterval: NodeJS.Timeout | null; timeoutId: NodeJS.Timeout | null; isActive: boolean }>
  >();
  // オークションID => イベント履歴 のマップ
  private eventHistories = new Map<string, EventHistoryItem[]>();
  // グローバルイベントIDカウンター
  private globalEventId = 1;
  // エンコーダー
  private encoder = new TextEncoder();

  // コンストラクタ
  constructor() {
    console.log("[ConnectionManager Class] Instance created."); // コンストラクタログを追加
  }

  /**
   * オークションごとの接続数を取得
   * @param auctionId オークションID
   * @returns オークションごとの接続数
   */
  getConnectionCount(auctionId: string): number {
    // 正規化：文字列として扱うことを確実にする
    const normalizedAuctionId = String(auctionId);
    return this.connections.get(normalizedAuctionId)?.size || 0;
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
    console.log("[CM Class] addConnection start", auctionId, clientId);
    const normalizedAuctionId = String(auctionId);
    if (!this.connections.has(normalizedAuctionId)) {
      console.log(`[CM Class] Creating new map for auction ${normalizedAuctionId}`);
      this.connections.set(normalizedAuctionId, new Map());
    }
    const auctionClients = this.connections.get(normalizedAuctionId)!;
    if (auctionClients.has(clientId)) {
      console.log(`[CM Class] Client ${clientId} already connected. Cleaning up old connection.`);
      this.removeConnection(normalizedAuctionId, clientId);
    }
    auctionClients.set(clientId, { controller, heartbeatInterval, timeoutId, isActive: true });
    const currentCount = this.getConnectionCount(normalizedAuctionId);
    console.log(`[CM Class] SSE connection established: Client ${clientId} to auction ${normalizedAuctionId} (Count: ${currentCount})`);
    console.log("[CM Class] Current map keys:", Array.from(this.connections.keys()));
  }

  /**
   * クライアント接続を削除
   * @param auctionId オークションID
   * @param clientId クライアントID
   */
  removeConnection(auctionId: string, clientId: string): void {
    console.log("[CM Class] removeConnection start", auctionId, clientId);
    const normalizedAuctionId = String(auctionId);
    const auctionClients = this.connections.get(normalizedAuctionId);
    if (!auctionClients) {
      console.log(`[CM Class] No clients for auction ${normalizedAuctionId}`);
      return;
    }
    const connectionInfo = auctionClients.get(clientId);
    if (!connectionInfo) {
      console.log(`[CM Class] Client ${clientId} not found`);
      return;
    }
    if (!connectionInfo.isActive) {
      console.log(`[CM Class] Client ${clientId} already inactive`);
      return;
    }

    // Clear timers and set inactive
    if (connectionInfo.heartbeatInterval) clearInterval(connectionInfo.heartbeatInterval);
    if (connectionInfo.timeoutId) clearTimeout(connectionInfo.timeoutId);
    connectionInfo.isActive = false; // Set inactive FIRST

    // Try closing the stream controller
    try {
      // Check if controller exists and might be closable
      // Note: Checking controller state directly is tricky. Assuming it might need closing.
      if (connectionInfo.controller) {
        console.log(`[CM Class] Attempting to close controller for ${clientId}`);
        connectionInfo.controller.close();
      }
    } catch (e) {
      // Ignore errors, e.g., if already closed
      console.warn(`[CM Class] Error closing controller for ${clientId} (might be okay):`, e);
    }

    // Remove from map
    const deleted = auctionClients.delete(clientId);
    if (deleted) {
      console.log(`[CM Class] SSE connection ended: Client ${clientId} from auction ${normalizedAuctionId} (Remaining: ${auctionClients.size})`);
    }

    // Log if auction map becomes empty, but don't delete it immediately
    if (auctionClients.size === 0) {
      console.log(`[CM Class] Auction ${normalizedAuctionId} connection count is 0. Map retained.`);
      // Optional: Schedule delayed cleanup here
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
    // 正規化：文字列として扱うことを確実にする
    const normalizedAuctionId = String(auctionId);

    const eventId = this.globalEventId++;

    // オークションのイベント履歴がなければ初期化
    if (!this.eventHistories.has(normalizedAuctionId)) {
      this.eventHistories.set(normalizedAuctionId, []);
    }

    const eventItem: EventHistoryItem = {
      id: eventId,
      type,
      data,
      timestamp: Date.now(),
    };

    // イベント履歴に追加
    const history = this.eventHistories.get(normalizedAuctionId)!;
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
    // 正規化：文字列として扱うことを確実にする
    const normalizedAuctionId = String(auctionId);

    const history = this.eventHistories.get(normalizedAuctionId) || [];
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
  broadcastToAuction(auctionId: string, type: AuctionEventType, data: AuctionWithDetails, _clientId?: string): EventHistoryItem {
    console.log("[CM Class] broadcastToAuction start", auctionId, type);
    const normalizedAuctionId = String(auctionId);
    const event = this.addEventToHistory(normalizedAuctionId, type, data);
    const eventMessage = this.formatEventMessage(event);
    const encodedEventMessage = this.encoder.encode(eventMessage);

    console.log("[CM Class] All stored auction IDs:", Array.from(this.connections.keys()));
    const auctionClients = this.connections.get(normalizedAuctionId);
    console.log("[CM Class] Finding clients for:", normalizedAuctionId, "Result:", auctionClients ? "found" : "not found");

    if (!auctionClients) {
      console.warn("[CM Class] No clients found for auction:", normalizedAuctionId);
      return event;
    }

    const clientsToRemove: string[] = [];
    let sentCount = 0;
    for (const [clientId, connectionInfo] of auctionClients.entries()) {
      if (!connectionInfo.isActive) {
        // 送信する前にアクティブか確認
        // console.log(`[CM Class] Skipping inactive client ${clientId}`);
        continue;
      }
      try {
        connectionInfo.controller.enqueue(encodedEventMessage);
        sentCount++;
      } catch (e) {
        console.error(`[CM Class] Error sending to client ${clientId}:`, e);
        clientsToRemove.push(clientId);
      }
    }

    // Remove clients that caused errors
    for (const clientId of clientsToRemove) {
      this.removeConnection(normalizedAuctionId, clientId);
    }

    if (sentCount > 0) {
      console.log(`[CM Class] Broadcast event ${type} to ${sentCount} client(s) in auction ${normalizedAuctionId}`);
    } else if (auctionClients.size > 0 && clientsToRemove.length < auctionClients.size) {
      console.log(`[CM Class] No active clients to broadcast to in auction ${normalizedAuctionId}, but inactive connections exist.`);
    } else {
      console.log(`[CM Class] No clients to broadcast to in auction ${normalizedAuctionId}.`);
    }

    return event;
  }
}
