"use client";

import type { AuctionEventData, AuctionWithDetails, BidHistoryWithUser, ConnectionStatus, EventHistoryItem } from "@/lib/auction/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { BUFFER_INTERVAL } from "@/lib/auction/constants";
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
  // 最後に受信したSSEメッセージ（デバッグ用）
  const [lastReceivedMessage, setLastReceivedMessage] = useState<string | null>(null);
  // 入札処理中フラグ（接続安定性向上のため追加）
  const [isBidding, setIsBidding] = useState<boolean>(false);
  // 接続保護期間フラグ（接続を一時的に保護する期間）
  const isConnectionProtectedRef = useRef<boolean>(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // イベントソース
  const eventSourceRef = useRef<EventSource | null>(null);

  // 接続関数
  const connectRef = useRef<(() => void) | undefined>();

  // バッチ処理するインターバル時間を管理するref
  const bufferIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // バッチ処理するために、Eventを貯めているState
  const eventBufferRef = useRef<EventHistoryItem[]>([]);
  // 接続を再確立する予約タイマー
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  // 最後の再接続試行時間
  const lastReconnectTimeRef = useRef<number>(0);
  // 接続試行回数
  const reconnectAttemptsRef = useRef<number>(0);
  // 最大再接続回数（一定時間内に）
  const MAX_RECONNECT_ATTEMPTS = 5;
  // 再接続試行リセット時間（ミリ秒）
  const RECONNECT_RESET_TIME = 30000; // 30秒

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // オークションID
  const auctionId = initialAuction.id;

  // オプション
  const { reconnectOnVisibility = true, bufferEvents = true } = initialAuction.options || {};

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // イベントデータを処理する関数
  const processEventData = useCallback((eventData: AuctionEventData) => {
    // ローディング状態を解除する（どのイベントタイプでも）
    setLoading(false);

    // イベントタイプごとの処理
    switch (eventData.type) {
      case AuctionEventType.INITIAL:
        if (eventData.data.auction) {
          setAuction(eventData.data.auction);
          // 新しい入札履歴があれば設定
          if (eventData.data.auction.bidHistories) {
            setBidHistory(eventData.data.auction.bidHistories as BidHistoryWithUser[]);
          }
        }
        break;

      case AuctionEventType.NEW_BID:
        if (eventData.data.bid) {
          // 入札保護期間を設定（新しい入札イベントがきたら3秒間は接続を保護）
          isConnectionProtectedRef.current = true;
          setTimeout(() => {
            isConnectionProtectedRef.current = false;
          }, 3000);

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

      case AuctionEventType.CONNECTION_ESTABLISHED:
        // 接続確立イベントを受け取ったらクライアントIDを更新
        if (eventData.data.clientId) {
          setClientId(eventData.data.clientId);
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

  // イベントをバッチ処理するために、貯めておく関数
  const processEvent = useCallback(
    (event: EventHistoryItem) => {
      if (bufferEvents) {
        // バッファリングモードの場合、バッファに追加
        eventBufferRef.current.push(event);
      } else {
        // 即時処理モード
        if (event.type === ExtendedEventType.CONNECTION_ESTABLISHED) {
          // connection_established イベントの場合は clientId を更新
          if (event.data && event.data.clientId) {
            setClientId(event.data.clientId);
            // 接続確立時にローディング状態を解除
            setLoading(false);
          }
        } else {
          // その他のイベントを通常処理
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

  // 切断関数
  const disconnect = useCallback(() => {
    console.log("disconnect called from", new Error().stack);

    // 入札処理中またはBid/保護期間中は接続を維持
    if (isBidding || isConnectionProtectedRef.current) {
      console.log("入札処理中または保護期間中のため接続を維持します");
      return;
    }

    if (eventSourceRef.current) {
      console.log("実際に切断します");
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (bufferIntervalRef.current) {
      clearInterval(bufferIntervalRef.current);
      bufferIntervalRef.current = null;
    }

    // 再接続タイマーをクリア
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    setConnectionStatus("切断");
    console.log("SSE接続を切断しました");
  }, [isBidding]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 再接続関数
  const reconnect = useCallback(() => {
    // 入札処理中または保護期間中は再接続を遅延
    if (isBidding || isConnectionProtectedRef.current) {
      console.log("入札処理中または保護期間中のため再接続を遅延します");

      // 既存の再接続タイマーをクリア
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }

      // 3秒後に再接続を試みる
      reconnectTimerRef.current = setTimeout(() => {
        console.log("遅延再接続を実行します");
        reconnect();
      }, 3000);

      return;
    }

    console.log("SSE接続を手動で再接続します");
    disconnect();

    // 少し待ってから再接続
    setTimeout(() => {
      if (connectRef.current) {
        connectRef.current();
      }
    }, 300);
  }, [disconnect, isBidding]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 接続関数
  const connect = useCallback(() => {
    // 入札処理中は接続をスキップ
    if (isBidding) {
      console.log("入札処理中のため接続処理をスキップします");
      return;
    }

    // 短時間に何度も再接続しないようにする
    const now = Date.now();
    if (now - lastReconnectTimeRef.current < 1000) {
      // 1秒以内
      console.log("再接続試行が頻繁すぎるため、スキップします");

      // 一定回数以上の再接続試行があった場合は、より長い間隔で再試行
      reconnectAttemptsRef.current++;
      if (reconnectAttemptsRef.current > MAX_RECONNECT_ATTEMPTS) {
        console.log(`再接続試行回数が上限(${MAX_RECONNECT_ATTEMPTS}回)を超えました。しばらく待機します`);

        // 既存のタイマーをクリア
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
        }

        // より長い間隔で再試行
        reconnectTimerRef.current = setTimeout(() => {
          console.log("再接続カウンターをリセットして再試行します");
          reconnectAttemptsRef.current = 0;
          connect();
        }, RECONNECT_RESET_TIME);

        return;
      }

      // 少し待ってから再試行
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      reconnectTimerRef.current = setTimeout(
        () => {
          connect();
        },
        1000 + reconnectAttemptsRef.current * 500,
      ); // 徐々に間隔を広げる

      return;
    }

    // 再接続試行時間を更新
    lastReconnectTimeRef.current = now;

    // 既存の接続があれば閉じる
    if (eventSourceRef.current) {
      console.log("既存の接続を閉じます");
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

      // 入札中フラグを追加
      if (isBidding) {
        params.append("bidInProgress", "true");
      }

      // URLの作成
      const url = `/api/auctions/${auctionId}/sse-server-sent-events${params.toString() ? `?${params.toString()}` : ""}`;
      console.log("SSE接続URL:", url);

      // EventSourceの作成 - HTTP/2最適化
      const eventSource = new EventSource(url, {
        withCredentials: true, // 認証情報を含める
      });

      // イベントソースの参照を保存
      eventSourceRef.current = eventSource;

      // 接続成功時
      eventSource.onopen = () => {
        console.log("SSE接続確立");
        setConnectionStatus("接続中");

        // 接続成功したらカウンターをリセット
        reconnectAttemptsRef.current = 0;

        // ローディングをクリア
        setLoading(false);

        // エラーメッセージをクリア
        if (error) {
          setError(null);
        }
      };

      // メッセージ受信時
      eventSource.onmessage = (event) => {
        try {
          // デバッグ用に最後に受信したメッセージを保存
          setLastReceivedMessage(
            JSON.stringify({
              type: event.type || "message",
              lastEventId: event.lastEventId,
              data: event.data,
              timestamp: new Date().toISOString(),
            }),
          );

          // データが空の場合はハートビートなどの特殊メッセージとして扱い、そのまま処理を終了
          if (!event.data) {
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
          if (event.type === ExtendedEventType.CONNECTION_ESTABLISHED && data.clientId) {
            setClientId(data.clientId);
            setLoading(false); // 接続確立時にローディング状態を解除
            return;
          }

          // オークションイベントデータの処理
          if (data) {
            const eventData = data as AuctionEventData;
            processEventData(eventData);
          }
        } catch (err) {
          console.error("SSEメッセージ処理中にエラーが発生しました:", err);
          // エラー情報も保存
          setLastReceivedMessage(
            JSON.stringify({
              error: String(err),
              timestamp: new Date().toISOString(),
            }),
          );
        }
      };

      // 標準的なイベントタイプのハンドラ登録
      Object.values(AuctionEventType).forEach((eventType) => {
        eventSource.addEventListener(eventType, (e: MessageEvent) => {
          console.log("イベントタイプ:", eventType);
          console.log("e:", e);
          try {
            // デバッグ用に最後に受信したメッセージを保存
            setLastReceivedMessage(
              JSON.stringify({
                type: eventType,
                lastEventId: e.lastEventId,
                data: e.data,
                timestamp: new Date().toISOString(),
              }),
            );

            // イベントIDの抽出と保存（再接続用）
            if (e.lastEventId) {
              setLastEventId(parseInt(e.lastEventId, 10));
            }

            // データの有無を確認してからパース
            if (!e.data) {
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
            // エラー情報も保存
            setLastReceivedMessage(
              JSON.stringify({
                type: eventType,
                error: String(err),
                timestamp: new Date().toISOString(),
              }),
            );
          }
        });
      });

      // connection_established イベントの明示的な処理
      eventSource.addEventListener(ExtendedEventType.CONNECTION_ESTABLISHED, (e: MessageEvent) => {
        try {
          if (e.data) {
            const data = JSON.parse(e.data);
            if (data && data.clientId) {
              setClientId(data.clientId);
              setLoading(false); // 接続確立時にローディング状態を解除
            }
          }
        } catch (err) {
          console.error("connection_established イベント処理中にエラーが発生しました:", err);
        }
      });

      // エラーハンドラ
      eventSource.onerror = (event) => {
        // エラーの詳細をログに出力
        console.warn(`SSE接続エラー発生: readyState=${eventSource.readyState}`, event);

        // 入札中は即座に再接続を試みる
        if (isBidding || isConnectionProtectedRef.current) {
          console.log("入札中またはSSE保護中のエラー - 即座に再接続を試みます");
          eventSource.close();
          eventSourceRef.current = null;

          // 短い待機後に再接続
          setTimeout(() => {
            if (connectRef.current) {
              connectRef.current();
            }
          }, 100);

          return;
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

        // 短い遅延後に再接続
        setTimeout(() => {
          if (connectRef.current) {
            connectRef.current();
          }
        }, 1000);
      };
    } catch (err) {
      console.error("SSE接続の確立に失敗しました:", err);
      setConnectionStatus("エラー");
      setError("リアルタイム更新を開始できませんでした");
      setLoading(false);
    }
  }, [auctionId, clientId, lastEventId, error, processEventData, processEvent, isBidding]);

  // バッファ処理のインターバル設定
  useEffect(() => {
    if (bufferEvents) {
      bufferIntervalRef.current = setInterval(() => {
        if (eventBufferRef.current.length > 0) {
          // バッファ内のイベントを処理
          const events = [...eventBufferRef.current];
          eventBufferRef.current = [];

          // 各イベントを処理
          for (const event of events) {
            if (event.type === ExtendedEventType.CONNECTION_ESTABLISHED) {
              // connection_established イベントの場合は clientId を更新
              if (event.data && event.data.clientId) {
                setClientId(event.data.clientId);
                setLoading(false); // 接続確立時にローディング状態を解除
              }
            } else {
              // その他のイベントを通常処理
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

    // クリーンアップ
    return () => {
      disconnect();
    };
  }, [initialAuction, connect, disconnect]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ページビジビリティの変更を監視
  useEffect(() => {
    if (reconnectOnVisibility) {
      const handleVisibilityChange = () => {
        // 入札処理中はビジビリティによる接続・切断を無視
        if (isBidding || isConnectionProtectedRef.current) {
          console.log("入札処理中または保護期間中のためビジビリティ変更を無視します");
          return;
        }

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
  }, [reconnectOnVisibility, disconnect, isBidding]);

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
    reconnect, // 手動で再接続するための関数
    disconnect, // 手動で切断するための関数
    lastReceivedMessage, // 最後に受信したSSEメッセージ（デバッグ用）
    setIsBidding, // 入札処理中フラグの設定関数（外部から設定できるように公開）
  };
}
