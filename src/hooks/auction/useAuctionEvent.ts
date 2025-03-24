"use client";

import type { AuctionEventData, AuctionWithDetails, BidHistoryWithUser, ConnectionStatus, EventHistoryItem } from "@/lib/auction/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { BUFFER_INTERVAL, CONNECTION_TIMEOUT, HEARTBEAT_INTERVAL, HEARTBEAT_TIMEOUT, MAX_RETRIES, RETRY_DELAYS } from "@/lib/auction/constants";
import { AuctionEventType, ExtendedEventType } from "@/lib/auction/types";

/**
 * オークションSSEを購読するカスタムフック（拡張版）
 * @param initialAuction 初期オークションデータ
 * @param options 追加オプション
 * @returns オークション情報、入札履歴、接続状態、ユーティリティ関数
 */
export function useAuctionEvent(initialAuction: AuctionWithDetails) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // オークション情報
  const [auction, setAuction] = useState<AuctionWithDetails | undefined>(initialAuction);
  // 入札履歴
  const [bidHistory, setBidHistory] = useState<BidHistoryWithUser[]>(initialAuction?.bidHistories || []);
  // ローディング状態
  const [loading, setLoading] = useState<boolean>(true);
  // エラー
  const [error, setError] = useState<string | null>(initialAuction ? null : "オークションデータが見つかりません");
  // オークション延長通知
  const [endTimeExtended, setEndTimeExtended] = useState<boolean>(false);
  // 接続状態
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(initialAuction ? "初期化中" : "エラー");
  // イベントID
  const [lastEventId, setLastEventId] = useState<number>(0);
  // クライアントID
  const [clientId, setClientId] = useState<string>(initialAuction?.options?.clientId || `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // イベントソース
  const eventSourceRef = useRef<EventSource | null>(null);
  // リトライ回数
  const retryCountRef = useRef<number>(0);
  // 最後のハートビート時間
  const lastHeartbeatRef = useRef<number>(Date.now());
  // ハートビートタイムアウト
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // 接続関数
  const connectRef = useRef<(() => void) | undefined>();
  // 接続タイムアウト
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // バッチ処理するインターバル時間を管理するref
  const bufferIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // バッチ処理するために、Eventを貯めているState
  const eventBufferRef = useRef<EventHistoryItem[]>([]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // オークションID
  const auctionId = initialAuction.id;

  // オプション
  const { reconnectOnVisibility = true, bufferEvents = true } = initialAuction.options || {};

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // イベントデータを処理する関数
  const processEventData = useCallback((eventData: AuctionEventData) => {
    // イベントタイプごとの処理
    switch (eventData.type) {
      case AuctionEventType.INITIAL:
        if (eventData.data.auction) {
          setAuction(eventData.data.auction);
          setBidHistory(eventData.data.auction.bidHistories as BidHistoryWithUser[]);
        }
        setLoading(false);
        retryCountRef.current = 0; // 成功したらリトライカウンタをリセット
        break;

      case AuctionEventType.NEW_BID:
        if (eventData.data.bid) {
          // 既存の入札履歴の先頭に追加
          setBidHistory((prev) => [eventData.data.bid as BidHistoryWithUser, ...prev]);

          // オークション情報も更新
          if (eventData.data.auction) {
            setAuction(eventData.data.auction);
          }
        }
        break;

      case AuctionEventType.AUCTION_EXTENSION:
        if (eventData.data.auction) {
          setAuction(eventData.data.auction);
          setEndTimeExtended(true);
          // 3秒後に通知を非表示
          setTimeout(() => setEndTimeExtended(false), 3000);
        }
        break;

      case AuctionEventType.AUCTION_ENDED:
        if (eventData.data.auction) {
          setAuction(eventData.data.auction);
        }
        break;

      case AuctionEventType.AUCTION_UPDATE:
        if (eventData.data.auction) {
          setAuction(eventData.data.auction);
        }
        break;

      case AuctionEventType.ERROR:
        if (eventData.data.error) {
          setError(eventData.data.error);
        }
        break;
    }
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // イベントをバッファリングする関数
  const processEvent = useCallback(
    (event: EventHistoryItem) => {
      if (bufferEvents) {
        // バッファリングモードの場合、バッファに追加
        eventBufferRef.current.push(event);
      } else {
        // 即時処理モード（ConnectionEstablishedイベント以外を処理）
        if (event.type !== ExtendedEventType.CONNECTION_ESTABLISHED) {
          processEventData({
            type: event.type as AuctionEventType,
            data: event.data,
          });
        }
      }
    },
    [bufferEvents, processEventData],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ハートビートチェック関数
  const checkHeartbeat = useCallback(() => {
    // 現在時刻
    const now = Date.now();
    // 最後のハートビート時間からの経過時間
    const timeSinceLastHeartbeat = now - lastHeartbeatRef.current;

    // ハートビートタイムアウトの場合
    if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT) {
      console.warn(`SSEハートビート失敗: 最後の応答から${timeSinceLastHeartbeat}ms経過`);

      // 接続が生きていないと判断して再接続
      if (eventSourceRef.current) {
        console.log("ハートビートタイムアウトのため接続を再確立します");
        eventSourceRef.current.close();
        eventSourceRef.current = null;

        // エラー表示と再接続
        setError("リアルタイム更新の接続が切断されました。再接続しています...");
        setConnectionStatus("エラー");

        // connectRef経由で接続関数を呼び出す
        if (connectRef.current) {
          connectRef.current();
        }
      }
    }

    // 次のチェックをスケジュール
    heartbeatTimeoutRef.current = setTimeout(checkHeartbeat, HEARTBEAT_INTERVAL);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 切断関数
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }

    if (bufferIntervalRef.current) {
      clearInterval(bufferIntervalRef.current);
      bufferIntervalRef.current = null;
    }

    setConnectionStatus("切断");
    console.log("SSE接続を切断しました");
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 再接続関数
  const reconnect = useCallback(() => {
    console.log("SSE接続を手動で再接続します");
    disconnect();

    // 少し待ってから再接続
    setTimeout(() => {
      if (connectRef.current) {
        connectRef.current();
      }
    }, 100);
  }, [disconnect]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 接続関数
  const connect = useCallback(() => {
    // 既存の接続があれば閉じる
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setConnectionStatus("初期化中");
    setLoading(true);

    try {
      // URLパラメータの構築
      const params = new URLSearchParams();
      if (clientId) {
        params.append("clientId", clientId);
      }
      if (lastEventId > 0) {
        params.append("lastEventId", lastEventId.toString());
      }

      // URLの作成
      const url = `/api/auctions/${auctionId}/sse-server-sent-events${params.toString() ? `?${params.toString()}` : ""}`;

      // 接続タイムアウト設定
      connectionTimeoutRef.current = setTimeout(() => {
        console.error("SSE接続がタイムアウトしました");
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }

        setConnectionStatus("エラー");
        setError("接続タイムアウト。再接続しています...");

        // リトライロジックを開始
        if (retryCountRef.current < MAX_RETRIES) {
          const retryDelay = RETRY_DELAYS[Math.min(retryCountRef.current, RETRY_DELAYS.length - 1)];
          // ジッターを追加（0-500msのランダム値）
          const jitter = Math.random() * 500;
          const finalDelay = retryDelay + jitter;

          retryCountRef.current++;
          console.log(`SSE接続タイムアウト: ${finalDelay}ms後に再試行します (${retryCountRef.current}/${MAX_RETRIES}回目)`);

          setTimeout(() => {
            if (connectRef.current) {
              connectRef.current();
            }
          }, finalDelay);
        } else {
          setError("リアルタイム更新を利用できません。ページを再読み込みしてください。");
          setLoading(false);
        }
      }, CONNECTION_TIMEOUT);

      // EventSourceの作成
      const eventSource = new EventSource(url, {
        withCredentials: true, // 認証情報を含める
      });
      eventSourceRef.current = eventSource;

      // 接続成功時
      eventSource.onopen = () => {
        console.log("SSE接続確立");
        setConnectionStatus("接続中");

        // タイムアウトをクリア
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }

        // ローディングをクリア
        setLoading(false);

        // エラーメッセージをクリア
        if (error) {
          setError(null);
        }
      };

      // メッセージ受信時
      eventSource.onmessage = (event) => {
        // タイムアウトをクリア（メッセージ受信時も接続は生きている）
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }

        // ハートビートの更新
        lastHeartbeatRef.current = Date.now();

        try {
          // データが空の場合はハートビートなどの特殊メッセージとして扱い、そのまま処理を終了
          if (!event.data) {
            console.log("空のメッセージ受信（ハートビートの可能性）");
            return;
          }

          // メッセージデータのパース
          let data;
          try {
            data = JSON.parse(event.data);
          } catch (parseError) {
            console.error("SSEメッセージのパース中にエラーが発生しました:", parseError);
            console.debug("パースできなかったデータ:", event.data);
            return;
          }

          // イベントIDの抽出と保存（再接続用）
          if (event.lastEventId) {
            setLastEventId(parseInt(event.lastEventId, 10));
          }

          // 接続確立メッセージの処理
          if (data && data.type === ExtendedEventType.CONNECTION_ESTABLISHED && data.clientId) {
            setClientId(data.clientId);
            return;
          }

          // オークションイベントデータの処理
          if (data) {
            const eventData = data as AuctionEventData;
            processEventData(eventData);
          }
        } catch (err) {
          console.error("SSEメッセージ処理中にエラーが発生しました:", err);
        }
      };

      // 標準的なイベントタイプのハンドラ登録
      Object.values(AuctionEventType).forEach((eventType) => {
        eventSource.addEventListener(eventType, (e: MessageEvent) => {
          try {
            // イベントIDの抽出と保存（再接続用）
            if (e.lastEventId) {
              setLastEventId(parseInt(e.lastEventId, 10));
            }

            // ハートビートの更新
            lastHeartbeatRef.current = Date.now();

            // データの有無を確認してからパース
            if (!e.data) {
              console.log(`イベント ${eventType} にデータがありません`);
              return;
            }

            // 安全にJSONパースを試みる
            let eventData;
            try {
              eventData = JSON.parse(e.data);
            } catch (parseError) {
              console.error(`イベント ${eventType} のデータをパース中にエラーが発生しました:`, parseError);
              console.debug("パースできなかったデータ:", e.data);
              return;
            }

            // イベントタイプに応じた処理
            processEvent({
              id: e.lastEventId ? parseInt(e.lastEventId, 10) : Date.now(),
              type: eventType as AuctionEventType,
              data: eventData || {}, // データが無い場合は空オブジェクトを設定
              timestamp: Date.now(),
            });
          } catch (err) {
            console.error(`イベント ${eventType} 処理中にエラーが発生しました:`, err);
          }
        });
      });

      // エラーハンドラ
      eventSource.onerror = (event) => {
        // エラーの詳細をログに出力
        console.warn(`SSE接続エラー発生: readyState=${eventSource.readyState}`, event);

        // タイムアウトをクリア
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }

        // readyStateに基づいた処理（数値で比較）
        // 0: CONNECTING, 1: OPEN, 2: CLOSED
        if (eventSource.readyState === 0) {
          // EventSource.CONNECTING
          console.log("SSE接続中...");
          return; // 接続中の場合は処理を中断
        }

        // 接続が閉じた場合または不明な状態の場合は再接続を試みる
        eventSource.close();
        eventSourceRef.current = null;
        setConnectionStatus("エラー");

        // エラー状態を設定
        setError("リアルタイム更新の接続が切断されました。再接続しています...");

        // 接続再試行
        if (retryCountRef.current < MAX_RETRIES) {
          // 指数バックオフ + ジッターで再接続
          const baseDelay = RETRY_DELAYS[Math.min(retryCountRef.current, RETRY_DELAYS.length - 1)];
          const jitter = Math.random() * 1000; // 0-1000msのランダム値
          const retryDelay = baseDelay + jitter;

          retryCountRef.current++;
          console.log(`SSE再接続を${retryDelay}ms後に試みます (${retryCountRef.current}/${MAX_RETRIES}回目)`);

          // 確実にsetTimeoutが動作するようにする
          window.setTimeout(() => {
            if (!eventSourceRef.current && connectRef.current) {
              console.log("SSE再接続を開始します...");
              connectRef.current();
            }
          }, retryDelay);
        } else {
          // 最大リトライ回数を超えた場合
          console.error(`SSE最大再接続回数(${MAX_RETRIES})に達しました。再接続を停止します。`);
          setError("リアルタイム更新を利用できません。ページを再読み込みしてください。");
          setLoading(false);
        }
      };
    } catch (err) {
      console.error("SSE接続の確立に失敗しました:", err);
      setConnectionStatus("エラー");
      setError("リアルタイム更新を開始できませんでした");
      setLoading(false);
    }
  }, [auctionId, clientId, lastEventId, error, processEventData, processEvent]);

  // バッファ処理のインターバル設定
  useEffect(() => {
    if (bufferEvents) {
      bufferIntervalRef.current = setInterval(() => {
        if (eventBufferRef.current.length > 0) {
          // バッファ内のイベントを処理
          const events = [...eventBufferRef.current];
          eventBufferRef.current = [];

          // 各イベントを処理（ConnectionEstablishedイベント以外）
          for (const event of events) {
            if (event.type !== ExtendedEventType.CONNECTION_ESTABLISHED) {
              processEventData({
                type: event.type as AuctionEventType,
                data: event.data,
              });
            }
          }
        }
      }, BUFFER_INTERVAL);
    }

    return () => {
      if (bufferIntervalRef.current) {
        clearInterval(bufferIntervalRef.current);
        bufferIntervalRef.current = null;
      }
    };
  }, [bufferEvents, processEventData]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // connectRef に connect 関数を格納
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // 初期化処理
  useEffect(() => {
    // 初期データがあればそれを使用
    if (initialAuction) {
      setAuction(initialAuction);
      setBidHistory((initialAuction.bidHistories as BidHistoryWithUser[]) || []);
    }

    // 接続を確立
    connect();

    // ハートビートチェッカーを開始
    heartbeatTimeoutRef.current = setTimeout(checkHeartbeat, HEARTBEAT_INTERVAL);

    // クリーンアップ
    return () => {
      disconnect();
    };
  }, [initialAuction, connect, disconnect, checkHeartbeat]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ページビジビリティの変更を監視
  useEffect(() => {
    if (reconnectOnVisibility) {
      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible" && !eventSourceRef.current) {
          console.log("ページが表示されたため、SSE接続を再開します");
          if (connectRef.current) {
            connectRef.current();
          }
        } else if (document.visibilityState === "hidden" && eventSourceRef.current) {
          console.log("ページが非表示になったため、SSE接続を閉じます");
          disconnect();
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }
  }, [reconnectOnVisibility, disconnect]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    auction, // オークション情報
    bidHistory, // 入札履歴
    loading, // ローディング状態
    error, // エラー
    endTimeExtended, // オークション延長通知
    connectionStatus, // 接続状態
    clientId, // クライアントID
    lastEventId,
    retryCount: retryCountRef.current,
    reconnect, // 手動で再接続するための関数
    disconnect, // 手動で切断するための関数
  };
}
