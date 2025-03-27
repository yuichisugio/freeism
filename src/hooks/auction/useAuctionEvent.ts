"use client";

import type { AuctionEventData, AuctionWithDetails, BidHistoryWithUser, EventHistoryItem } from "@/lib/auction/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { BUFFER_INTERVAL } from "@/lib/auction/constants";
import { AuctionEventType } from "@/lib/auction/types";

/**
 * オークションSSEを購読するカスタムフック（拡張版）
 * @param initialAuction 初期オークションデータ
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
  const batchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // バッチ処理するために、Eventを貯めているRef
  const batchPoolRef = useRef<EventHistoryItem[]>([]);
  // 接続を再確立する予約タイマー
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // オークションID
  const auctionId = initialAuction.id;

  // オプション
  const { reconnectOnVisibility = true, batchMode = true } = initialAuction.options || {};

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * サーバーから受け取ったデータを処理するヘルパー関数
   * auctionDataをinitialAuctionと同じ形式に変換し、ステートを更新
   * @param auctionData サーバーから受け取ったデータ
   * @param receivedClientId 受信したクライアントID（オプション）
   */
  const processServerAuctionData = useCallback(
    (auctionData: any, receivedClientId: string | null = null) => {
      console.log("SSE_processServerAuctionData_start", auctionData);

      // サーバーから受け取ったデータがない場合は処理しない
      if (!auctionData) return;

      // サーバーから受け取ったauctionDataをinitialAuctionと同じ形式に変換
      const processedAuction: AuctionWithDetails = {
        ...initialAuction, // ベースとして初期データを使用
        ...auctionData, // サーバーからのデータで上書き
        // 必要に応じて不足プロパティを追加
        options: {
          reconnectOnVisibility: true,
          batchMode: true,
          clientId: receivedClientId || clientId,
        },
        // 日付オブジェクトを文字列から変換（必要な場合）
        startTime: auctionData.startTime ? new Date(auctionData.startTime) : initialAuction.startTime,
        endTime: auctionData.endTime ? new Date(auctionData.endTime) : initialAuction.endTime,
        createdAt: auctionData.createdAt ? new Date(auctionData.createdAt) : initialAuction.createdAt,
        updatedAt: auctionData.updatedAt ? new Date(auctionData.updatedAt) : initialAuction.updatedAt,
      };

      // 変換したデータをステートに設定
      setAuction(processedAuction);
      console.log("SSE_processServerAuctionData_setAuction", processedAuction);

      // 入札履歴があれば設定
      if (auctionData.bidHistories && Array.isArray(auctionData.bidHistories)) {
        setBidHistory(auctionData.bidHistories);
      }
    },
    [clientId, initialAuction],
  );

  /**
   * イベントデータを処理する関数
   * @param eventData イベントデータ
   */
  const processEventData = useCallback(
    (eventData: AuctionEventData) => {
      console.log("SSE_processEventData_start", eventData);

      // ローディング状態を解除する（どのイベントタイプでも）
      setLoading(false);

      // イベントタイプごとの処理
      switch (eventData.type) {
        // 新規入札イベント
        case AuctionEventType.NEW_BID:
          console.log("SSE_processEventData_NEW_BID", eventData);
          processServerAuctionData(eventData);
          break;

        // 接続確立イベント
        case AuctionEventType.CONNECTION_ESTABLISHED:
          console.log("SSE_processEventData_CONNECTION_ESTABLISHED", eventData);
          // 接続確立イベントを受け取ったらクライアントIDを更新
          if (eventData.data.clientId) {
            setClientId(eventData.data.clientId);
            console.log("SSE_processEventData_CONNECTION_ESTABLISHED_setClientId", eventData.data.clientId);
          }
          // 接続確立イベントを受け取ったらオークション情報を更新
          processServerAuctionData(eventData);
          console.log("SSE_processEventData_CONNECTION_ESTABLISHED_processServerAuctionData");
          break;

        // エラーイベント
        case AuctionEventType.ERROR:
          console.log("SSE_processEventData_ERROR", eventData);
          if (eventData.data.error) {
            setError(eventData.data.error);
          }
          break;
      }
    },
    [processServerAuctionData],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * イベントをバッチ処理するために、貯めておく関数
   * @param event イベント
   */
  const processEvent = useCallback(
    (event: EventHistoryItem) => {
      console.log("SSE_processEvent_start", event);
      // バッチ処理を行うモード以外 or 即時実行する場合
      if (!batchMode || event.type === AuctionEventType.CONNECTION_ESTABLISHED) {
        setClientId(event.data.clientId);

        processEventData({
          type: event.type as AuctionEventType,
          data: event.data,
        });
        console.log("SSE_processEvent_processEventData");
      }
      // バッチ処理のPoolに追加
      else {
        batchPoolRef.current.push(event);
        console.log("SSE_processEvent_batchPoolRef.current", batchPoolRef.current);
      }
    },
    [batchMode, processEventData],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 切断関数
   */
  const disconnect = useCallback(() => {
    console.log("disconnect called from", new Error().stack);

    // 接続状態を先に更新して非同期処理を保護
    isConnectedRef.current = false;

    // 接続を中断（少し遅延を入れて非同期処理の完了を待つ）
    setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        console.log("SSE_disconnect_abortControllerRef.current", abortControllerRef.current);
      }

      // バッファインターバルをクリア
      if (batchIntervalRef.current) {
        clearInterval(batchIntervalRef.current);
        batchIntervalRef.current = null;
        console.log("SSE_disconnect_batchIntervalRef.current", batchIntervalRef.current);
      }

      // 再接続タイマーをクリア
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
        console.log("SSE_disconnect_reconnectTimerRef.current", reconnectTimerRef.current);
      }

      console.log("SSE_disconnect_接続を切断しました");
    }, 100);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 再接続関数
   */
  const reconnect = useCallback(() => {
    console.log("SSE_reconnect_接続を手動で再接続します");
    disconnect();

    // 少し待ってから再接続
    setTimeout(() => {
      if (connectRef.current) {
        connectRef.current();
      }
    }, 300);
  }, [disconnect]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * SSEイベントを処理する関数
   * @param text SSEメッセージ
   */
  const processSSEEvent = useCallback(
    (text: string) => {
      console.log("SSE_processSSEEvent_start", text);

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

      console.log(`SSE_processSSEEvent_SSEイベント解析結果: type=${event}, id=${id}, データ長=${data?.length || 0}`);

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
        console.log("SSE_processSSEEvent_type:", event, "eventData:", eventData);

        // イベントIDの設定
        if (id) {
          const eventId = parseInt(id, 10);
          if (!isNaN(eventId)) {
            setLastEventId(eventId);
            console.log(`SSE_processSSEEvent_イベントIDを更新しました: ${eventId}`);
          }
        }

        // イベントタイプに応じた処理
        console.log(`SSE_processSSEEvent_SSEイベントを処理します: ${event}`);
        processEvent({
          id: id ? parseInt(id, 10) : Date.now(),
          type: event as AuctionEventType,
          data: eventData || {}, // データが無い場合は空オブジェクトを設定
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error(`SSE_processSSEEvent_SSEメッセージ処理中にエラーが発生しました:`, error);
      }
    },
    [processEvent],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * SSEストリームを処理する関数
   * @param response レスポンス
   */
  const handleSSEStream = useCallback(
    async (response: Response) => {
      console.log("SSE_handleSSEStream_start");
      // レスポンスのBodyを取得
      const reader = response.body?.getReader();

      // レスポンスのBodyが取得できない場合はエラー
      if (!reader) {
        setLoading(false); // リーダー取得エラー時にローディング状態を解除
        throw new Error("SSE_handleSSEStream_SSEレスポンスのBodyが取得できません");
      }

      // テキストデコーダーを作成
      const decoder = new TextDecoder();
      // バッファを初期化
      let buffer = "";

      try {
        // 接続状態の更新
        isConnectedRef.current = true;
        console.log("SSE_handleSSEStream_SSE接続状態を「接続中」に設定しました");
        setLoading(false);

        // 受信ループ
        while (isConnectedRef.current) {
          try {
            const { value, done } = await reader.read();

            if (done) {
              console.log("SSE_handleSSEStream_SSEストリームが終了しました");
              setLoading(false);
              break;
            }

            // バッファに追加して処理
            buffer += decoder.decode(value, { stream: true });
            console.log("SSE_handleSSEStream_SSEストリームからデータを受信しました:", buffer.length, "バイト\n", buffer);
            processSSEEvent(buffer);
          } catch (readError) {
            // 読み取り中のエラーをキャッチして、AbortErrorなら静かに終了
            if ((readError as Error).name === "AbortError") {
              console.log("SSE_handleSSEStream_SSEストリームの読み取りが中断されました");
              setLoading(false); // 中断時にローディング状態を解除
              break;
            } else {
              throw readError; // それ以外のエラーは再スロー
            }
          }
        }
      } catch (err: unknown) {
        if ((err as Error).name !== "AbortError") {
          console.error("SSE_handleSSEStream_SSEストリーム処理中にエラーが発生しました:", err);
          setError("リアルタイム更新の接続が切断されました。再接続しています...");
          setLoading(false); // エラー時にローディング状態を解除

          // エラー時の再接続
          setTimeout(() => {
            if (connectRef.current && isConnectedRef.current) {
              connectRef.current();
            }
          }, 1000);
        } else {
          setLoading(false); // 中断時にもローディング状態を解除
        }
      } finally {
        // 読み取りが終了したら必ず読み取りを解放
        try {
          reader.releaseLock();
        } catch (e) {
          console.log("SSE_handleSSEStream_リーダーロックの解放に失敗しました", e);
        }
        isConnectedRef.current = false;
        setLoading(false); // 最終的にローディング状態を解除
      }
    },
    [processSSEEvent],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 接続関数
   */
  const connect = useCallback(() => {
    // 既存の接続をクリーンアップ
    if (abortControllerRef.current) {
      const controller = abortControllerRef.current;
      abortControllerRef.current = null;
      controller.abort();
    }

    try {
      // URLパラメータの構築
      const params = new URLSearchParams();
      // clientIdがある場合はクエリパラメータに追加
      if (clientId) {
        params.append("clientId", clientId);
      }
      // lastEventIdがある場合はクエリパラメータに追加
      if (lastEventId > 0) {
        params.append("lastEventId", lastEventId.toString());
      }

      // オークションIDもクエリパラメータに追加
      params.append("auctionId", auctionId);

      // URLの作成
      const baseUrl = `/api/auctions/${auctionId}/sse-server-sent-events`;
      const url = `${baseUrl}?${params.toString()}`;
      console.log("SSE_connect_SSE接続URL:", url);

      // 中断用のコントローラーを作成
      abortControllerRef.current = new AbortController();

      // 接続試行前に少し待機（メッセージチャネルが完全に閉じるのを待つ）
      setTimeout(() => {
        // この時点でabortControllerRefがnullになっていたら、その間に別の処理が入ったということ
        if (!abortControllerRef.current) {
          return;
        }

        console.log(`SSE_connect_SSE接続を開始します: ${url}`);

        // fetchを使ってSSE接続を開始
        fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        })
          .then((response) => {
            console.log(`SSE_connect_SSE接続レスポンス:`, response.status, response.statusText);

            if (!response.ok) {
              setLoading(false);
              throw new Error(`SSE_connect_SSE接続に失敗しました: ${response.status} ${response.statusText}`);
            }

            console.log(`SSE_connect_SSE接続が成功し、ストリーム処理を開始します`);
            handleSSEStream(response);
          })
          .catch((err) => {
            if ((err as Error).name !== "AbortError") {
              console.error("SSE_connect_SSE接続の確立に失敗しました:", err);
              setError("リアルタイム更新を開始できませんでした");
              setLoading(false);
            }
          });
      }, 100);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("SSE_connect_SSE接続の確立に失敗しました:", err);
        setError("リアルタイム更新を開始できませんでした");
        setLoading(false);
      }
    }
  }, [auctionId, clientId, lastEventId, handleSSEStream]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * バッファ処理(バッチ処理)を行うインターバル設定
   */
  useEffect(() => {
    // バッチ処理を行うモードの場合は、Intervalを設定
    if (batchMode) {
      console.log("SSE_useEffect_batchMode_true");
      // IntervalのIDを、refに保存
      batchIntervalRef.current = setInterval(() => {
        // batchPoolRef.currentは配列で、バッファ内にイベントがある場合
        if (batchPoolRef.current.length > 0) {
          console.log("SSE_useEffect_batchMode_true_batchPoolRef.current.length > 0");
          // バッファ内のイベントを取り出して、バッファの中身をゼロにする
          const events = [...batchPoolRef.current];
          batchPoolRef.current = [];

          // バッチ処理のPool内の各イベントをひとつづつ処理
          for (const event of events) {
            // バッファ内のイベントをひとつづつ処理
            processEventData({
              type: event.type as AuctionEventType,
              data: event.data,
            });
          }
        }
      }, BUFFER_INTERVAL);
    }

    // バッファ処理(バッチ処理)を行うIntervalをクリーンアップ
    return () => {
      if (batchIntervalRef.current) {
        clearInterval(batchIntervalRef.current);
        batchIntervalRef.current = null;
      }
    };
  }, [batchMode, processEventData, processServerAuctionData]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * connectRef に connect 関数を格納
   * 初めて開いたときに、接続を確立するための処理
   */
  useEffect(() => {
    connectRef.current = connect;
    console.log("SSE_useEffect_connectRef.current", connectRef.current);
  }, [connect]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 初期化処理。
   * 初めて開いたときに、接続を確立するための処理
   */
  useEffect(() => {
    console.log("SSE_useEffect_初期化処理開始");

    // 接続を確立
    connect();

    // クリーンアップ
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ページビジビリティの変更を監視
   * 再度開いたときに、再接続するための処理
   */
  useEffect(() => {
    if (reconnectOnVisibility) {
      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          // 表示状態になった時、接続されていなければ再接続
          if (!isConnectedRef.current) {
            console.log("SSE_useEffect_ページが表示されたため、SSE接続を再開します");
            // ブラウザのイベントループを一周待ってから実行
            setTimeout(() => {
              if (connectRef.current) {
                connectRef.current();
              }
            }, 150);
          }
        } else if (document.visibilityState === "hidden") {
          // 非表示状態になった時、まだ接続中なら切断
          if (isConnectedRef.current) {
            console.log("SSE_useEffect_ページが非表示になったため、SSE接続を閉じます");
            // 即時ではなく次のティックで実行
            setTimeout(() => {
              disconnect();
            }, 100);
          }
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }
  }, [reconnectOnVisibility, disconnect]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // useAuctionEvent の返り値
  return {
    auction, // オークション情報
    bidHistory, // 入札履歴
    loading, // ローディング状態
    error, // エラー
    clientId, // クライアントID
    lastEventId, // 最後に受信したイベントID
    reconnect, // 手動で再接続するための関数
    disconnect, // 手動で切断するための関数
    lastReceivedMessage, // 最後に受信したSSEメッセージ（デバッグ用）
  };
}
