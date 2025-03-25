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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 接続状態を管理するための参照
  const isConnectedRef = useRef<boolean>(false);
  // fetch APIのコントローラー
  const abortControllerRef = useRef<AbortController | null>(null);

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

    // 接続を中断
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 接続状態を更新
    isConnectedRef.current = false;

    // バッファインターバルをクリア
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
    }, 300);
  }, [disconnect]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // SSEイベントを処理する関数
  const processSSEEvent = useCallback(
    (text: string) => {
      // SSEメッセージを解析
      const lines = text.split("\n");
      let event = "message";
      let data = "";
      let id = "";

      for (const line of lines) {
        if (line.startsWith("event:")) {
          event = line.substring(6).trim();
        } else if (line.startsWith("data:")) {
          data = line.substring(5).trim();
        } else if (line.startsWith("id:")) {
          id = line.substring(3).trim();
        }
      }

      // データが空の場合はハートビートなどの特殊メッセージとして扱い、そのまま処理を終了
      if (!data) {
        return;
      }

      // デバッグ用に最後に受信したメッセージを保存
      setLastReceivedMessage(
        JSON.stringify({
          type: event,
          lastEventId: id,
          data,
          timestamp: new Date().toISOString(),
        }),
      );

      try {
        // メッセージデータのパース
        const eventData = JSON.parse(data);

        // イベントIDの設定
        if (id) {
          const eventId = parseInt(id, 10);
          if (!isNaN(eventId)) {
            setLastEventId(eventId);
          }
        }

        // 接続確立メッセージの処理
        if (event === ExtendedEventType.CONNECTION_ESTABLISHED && eventData.clientId) {
          setClientId(eventData.clientId);
          setLoading(false); // 接続確立時にローディング状態を解除
          return;
        }

        // イベントタイプに応じた処理
        processEvent({
          id: id ? parseInt(id, 10) : Date.now(),
          type: event as AuctionEventType,
          data: eventData || {}, // データが無い場合は空オブジェクトを設定
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error(`SSEメッセージ処理中にエラーが発生しました:`, error);
      }
    },
    [processEvent],
  );

  // SSEストリームを処理する関数
  const handleSSEStream = useCallback(
    async (response: Response) => {
      if (!response.ok) {
        throw new Error(`SSE接続に失敗しました: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("SSEレスポンスのBodyが取得できません");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      try {
        // 接続状態の更新
        isConnectedRef.current = true;
        setConnectionStatus("接続中");
        setLoading(false);
        if (error) {
          setError(null);
        }

        // 接続成功したらカウンターをリセット
        reconnectAttemptsRef.current = 0;

        // 受信ループ
        while (isConnectedRef.current) {
          const { value, done } = await reader.read();

          if (done) {
            console.log("SSEストリームが終了しました");
            break;
          }

          // バッファに追加して処理
          buffer += decoder.decode(value, { stream: true });

          // イベントの区切り文字 '\n\n' でメッセージを分割
          const messages = buffer.split("\n\n");
          buffer = messages.pop() || ""; // 最後の部分は完全なメッセージでない可能性があるのでバッファに残す

          // 完全なメッセージを処理
          for (const message of messages) {
            if (message.trim()) {
              processSSEEvent(message);
            }
          }
        }
      } catch (err: unknown) {
        if ((err as Error).name !== "AbortError") {
          console.error("SSEストリーム処理中にエラーが発生しました:", err);
          setConnectionStatus("エラー");
          setError("リアルタイム更新の接続が切断されました。再接続しています...");

          // エラー時の再接続
          setTimeout(() => {
            if (connectRef.current && isConnectedRef.current) {
              connectRef.current();
            }
          }, 1000);
        }
      } finally {
        isConnectedRef.current = false;
      }
    },
    [error, processSSEEvent],
  );

  // 接続関数
  const connect = useCallback(() => {
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

    // 既存の接続をクリーンアップ
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
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
      console.log("SSE接続URL:", url);

      // 中断用のコントローラーを作成
      abortControllerRef.current = new AbortController();

      // fetchを使ってSSE接続を開始
      fetch(url, {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache",
          Accept: "text/event-stream",
        },
        credentials: "include", // 認証情報を含める
        signal: abortControllerRef.current.signal,
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`SSE接続に失敗しました: ${response.status} ${response.statusText}`);
          }
          return handleSSEStream(response);
        })
        .catch((error) => {
          if (error.name !== "AbortError") {
            console.error("SSE接続の確立に失敗しました:", error);
            setConnectionStatus("エラー");
            setError("リアルタイム更新を開始できませんでした");
            setLoading(false);
          }
        });
    } catch (err) {
      console.error("SSE接続の確立に失敗しました:", err);
      setConnectionStatus("エラー");
      setError("リアルタイム更新を開始できませんでした");
      setLoading(false);
    }
  }, [auctionId, clientId, lastEventId, handleSSEStream]);

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
        if (document.visibilityState === "visible" && !isConnectedRef.current) {
          console.log("ページが表示されたため、SSE接続を再開します");
          if (connectRef.current) {
            connectRef.current();
          }
        } else if (document.visibilityState === "hidden" && isConnectedRef.current) {
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
    reconnect, // 手動で再接続するための関数
    disconnect, // 手動で切断するための関数
    lastReceivedMessage, // 最後に受信したSSEメッセージ（デバッグ用）
  };
}
