"use client";

import type { AuctionEventData, AuctionWithDetails, BidHistoryWithUser } from "@/lib/auction/type/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { AuctionEventType } from "@/lib/auction/type/types";

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
  const [clientId, setClientId] = useState<string>(initialAuction?.options?.clientId ?? `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  // 最後に受信したSSEメッセージ（デバッグ用）
  const [lastReceivedMessage, setLastReceivedMessage] = useState<string | null>(null);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 接続関数を保持する ref （明示的に Promise を返す関数とする）
  const connectFuncRef = useRef<(() => Promise<void>) | undefined>();
  // 切断関数を保持する ref （明示的に Promise を返す関数とする）
  const disconnectFuncRef = useRef<(() => Promise<void>) | undefined>();
  // 接続状態を管理するための参照
  const isConnectedRef = useRef<boolean>(false);
  // fetch APIのコントローラー
  const abortControllerRef = useRef<AbortController | null>(null);
  // 接続を再確立する予約タイマー
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // オークションID
  const auctionId = initialAuction.id;

  // オプション
  const { reconnectOnVisibility = true } = initialAuction.options ?? {};

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * サーバーから受け取ったデータを処理するヘルパー関数
   * auctionDataをinitialAuctionと同じ形式に変換し、ステートを更新
   * @param auctionData サーバーから受け取ったデータ
   * @param receivedClientId 受信したクライアントID（オプション）
   */
  const giveAuctionDataToState = useCallback(
    (auctionData: AuctionWithDetails, receivedClientId: string | null = null) => {
      console.log("SSE_giveAuctionDataToState_start", auctionData);

      // サーバーから受け取ったデータがない場合は処理しない
      if (!auctionData) {
        console.log("SSE_giveAuctionDataToState_auctionDataがないため処理をスキップします");
        return;
      }

      // サーバーから受け取ったauctionDataをinitialAuctionと同じ形式に変換
      const processedAuction: AuctionWithDetails = {
        ...initialAuction,
        ...auctionData,
        sellerId: auctionData.sellerId,
        bidHistories: auctionData.bidHistories,
        id: auctionData.id,
        currentHighestBid: auctionData.currentHighestBid,
        currentHighestBidderId: auctionData.currentHighestBidderId,
        currentHighestBidder: auctionData.currentHighestBidder,
        winnerId: auctionData.winnerId,
        winner: auctionData.winner,
        watchlists: auctionData.watchlists,
        bid: auctionData.bid,
        depositPeriod: auctionData.depositPeriod,
        task: auctionData.task,
        currentPrice: auctionData.currentPrice,
        version: auctionData.version,
        title: auctionData.title,
        description: auctionData.description,
        extensionCount: auctionData.extensionCount,
        status: auctionData.status,
        taskId: auctionData.taskId,
        options: {
          reconnectOnVisibility: true,
          clientId: receivedClientId ?? clientId,
        },
        // 日付オブジェクトを文字列から変換（必要な場合）
        startTime: auctionData.startTime ? new Date(auctionData.startTime) : initialAuction.startTime,
        endTime: auctionData.endTime ? new Date(auctionData.endTime) : initialAuction.endTime,
        createdAt: auctionData.createdAt ? new Date(auctionData.createdAt) : initialAuction.createdAt,
        updatedAt: auctionData.updatedAt ? new Date(auctionData.updatedAt) : initialAuction.updatedAt,
      };

      // 変換したデータをステートに設定
      setAuction(processedAuction);
      console.log("SSE_giveAuctionDataToState_setAuction", processedAuction);

      console.log("SSE_giveAuctionDataToState_setBidHistory_auctionData.bidHistories", auctionData.bidHistories);
      // 入札履歴があれば設定
      if (auctionData.bidHistories && Array.isArray(auctionData.bidHistories)) {
        setBidHistory(auctionData.bidHistories);
        console.log("SSE_giveAuctionDataToState_setBidHistory", auctionData.bidHistories);
      }

      setLoading(false);
    },
    [clientId, initialAuction],
  );

  /**
   * イベントデータを処理する関数
   * @param eventData イベントデータ
   */
  const processEventDataByType = useCallback(
    (eventData: AuctionEventData) => {
      console.log("SSE_processEventDataByType_start", eventData);

      // AuctionWithDetails型に変換
      const auctionData: AuctionWithDetails = {
        id: eventData.data?.id ?? initialAuction.id,
        createdAt: eventData.data?.createdAt ?? initialAuction.createdAt,
        updatedAt: eventData.data?.updatedAt ?? initialAuction.updatedAt,
        status: eventData.data?.status ?? initialAuction.status,
        taskId: eventData.data?.taskId ?? initialAuction.taskId,
        startTime: eventData.data?.startTime ?? initialAuction.startTime,
        endTime: eventData.data?.endTime ?? initialAuction.endTime,
        currentHighestBid: eventData.data?.currentHighestBid ?? initialAuction.currentHighestBid,
        currentHighestBidderId: eventData.data?.currentHighestBidderId ?? initialAuction.currentHighestBidderId,
        bidHistories: eventData.data?.bidHistories ?? initialAuction.bidHistories,
        winnerId: eventData.data?.winnerId ?? initialAuction.winnerId,
        extensionCount: eventData.data?.extensionCount ?? initialAuction.extensionCount,
        version: eventData.data?.version ?? initialAuction.version,
        title: eventData.data?.title ?? initialAuction.title,
        description: eventData.data?.description ?? initialAuction.description,
        task: eventData.data?.task ?? initialAuction.task,
        currentPrice: eventData.data?.currentPrice ?? initialAuction.currentPrice,
        sellerId: eventData.data?.sellerId ?? initialAuction.sellerId,
        depositPeriod: eventData.data?.depositPeriod ?? initialAuction.depositPeriod,
        currentHighestBidder: eventData.data?.currentHighestBidder ?? initialAuction.currentHighestBidder,
        winner: eventData.data?.winner ?? initialAuction.winner,
        watchlists: eventData.data?.watchlists ?? initialAuction.watchlists,
        bid: eventData.data?.bid ?? initialAuction.bid,
        options: {
          reconnectOnVisibility: true,
          clientId: clientId,
        },
      };

      console.log("SSE_processEventDataByType_auctionData", auctionData);

      // イベントタイプごとの処理
      switch (eventData.type) {
        // 新規入札イベント
        case AuctionEventType.NEW_BID:
          console.log("SSE_processEventDataByType_NEW_BID", auctionData);
          giveAuctionDataToState(auctionData);
          break;

        // 接続確立イベント
        case AuctionEventType.CONNECTION_ESTABLISHED:
          console.log("SSE_processEventDataByType_CONNECTION_ESTABLISHED", auctionData);
          // 接続確立イベントを受け取ったらクライアントIDを更新
          if (auctionData.options?.clientId) {
            setClientId(auctionData.options.clientId);
            console.log("SSE_processEventDataByType_CONNECTION_ESTABLISHED_setClientId", auctionData.options.clientId);
          }
          console.log("SSE_processEventDataByType_CONNECTION_ESTABLISHED_giveAuctionDataToState");
          // 接続確立イベントを受け取ったらオークション情報を更新
          giveAuctionDataToState(auctionData);
          break;

        // エラーイベント
        case AuctionEventType.ERROR:
          console.log("SSE_processEventDataByType_ERROR", auctionData);
          if (eventData.error) {
            setError(eventData.error);
          }
          break;
      }
    },
    [giveAuctionDataToState, initialAuction, clientId],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 切断関数
   */
  // Promise を返す形にリファクタリング
  const disconnect = useCallback(async (): Promise<void> => {
    console.log("disconnect called from", new Error().stack);

    // 接続状態を先に更新して非同期処理を保護
    isConnectedRef.current = false;

    // setTimeoutは使用しない。setTimeoutを使用すると再接続時に行うuseEffectの内容までclearされてしまう

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      console.log("SSE_disconnect_abortControllerRef.current", abortControllerRef.current);
    }

    // 再接続タイマーをクリア
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
      console.log("SSE_disconnect_reconnectTimerRef.current", reconnectTimerRef.current);
    }

    setLoading(false);

    console.log("SSE_disconnect_接続を切断しました");
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 再接続関数
   */
  const reconnect = useCallback(() => {
    console.log("SSE_reconnect_接続を手動で再接続します");
    void disconnect();

    // 少し待ってから接続処理を呼び出す (クリーンアップが完了するのを待つため)
    // 必要であれば reconnectTimerRef を使うなど、より堅牢な待機処理も可能
    setTimeout(() => {
      console.log("SSE_reconnect_connect関数を呼び出します");
      if (connectFuncRef.current) {
        void connectFuncRef.current();
      } else {
        console.warn("SSE_reconnect_connect関数が見つかりませんでした");
      }
    }, 300); // 300ms待機 (必要に応じて調整)
  }, [disconnect]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * SSEイベントを処理する関数
   * @param text SSEメッセージ
   */
  /**
   * SSEイベントを処理する関数
   * @param text SSEメッセージ (単一の message ブロック、\n\n で区切られた後の部分)
   */
  const editSSEdata = useCallback(
    (text: string) => {
      // text が空や空白文字だけの場合は処理しない
      if (!text || text.trim() === "") {
        console.log("SSE_editSSEdata_空のメッセージのためスキップ:", text);
        return;
      }
      console.log("SSE_editSSEdata_start processing:", text);

      // SSEメッセージを解析
      const lines = text.split("\n");
      let event = "message"; // デフォルトイベントタイプ
      let data = ""; // データ部分を格納 (複数行 data に対応するため初期化)
      let id = ""; // イベントIDを格納
      let hasDataField = false; // data: フィールドが存在したかのフラグ

      for (const line of lines) {
        if (line.startsWith("event:")) {
          event = line.substring(6).trim();
        } else if (line.startsWith("data:")) {
          hasDataField = true;
          // "data:" の後のスペースも考慮してトリムする
          // 複数行 data の場合、改行を保持して連結 (仕様に厳密に従うなら改行が必要)
          if (data === "") {
            // 最初の data 行
            data = line.substring(5).trimStart(); // 先頭のスペースのみ削除
          } else {
            // 2行目以降の data 行 (改行を挟んで連結)
            data += "\n" + line.substring(5).trimStart();
          }
        } else if (line.startsWith("id:")) {
          id = line.substring(3).trim();
        } else if (line.startsWith(":")) {
          // コメント行は完全に無視
          console.log("SSE_editSSEdata_コメント行を無視:", line);
          continue;
        } else if (line.trim() === "") {
          // 空行は無視
          continue;
        } else {
          // 不明な行、またはフィールド名のない行 (仕様では無視される)
          console.log("SSE_editSSEdata_不明な行:", line);
        }
      }

      console.log(`SSE_editSSEdata_SSEイベント解析結果: type=${event}, id=${id}, データ長=${data?.length || 0}, dataフィールド存在=${hasDataField}`);

      // ★★★ 修正点: dataフィールドが存在しなかった、または data が空文字列の場合は JSON.parse を試みない ★★★
      // eventタイプによってはdataが空でも意味を持つ場合があるため、イベントタイプで分岐
      if (!hasDataField || data === "") {
        console.log(`SSE_editSSEdata_data が空または data フィールドが存在しません。Event: ${event}, ID: ${id}`);
        // data が空でも処理が必要なイベントタイプ (例: ping) があればここで処理
        if (event === "ping") {
          console.log("SSE_editSSEdata_ping イベント受信");
          // 必要に応じて処理
          return;
        }
        // その他の data が空のイベントは無視、またはエラーとして扱う場合はここで処理
        console.log(`SSE_editSSEdata_イベント ${event} は data が空のため処理をスキップします。`);
        return; // スキップして終了
      }

      // data フィールドが存在し、空でない場合のみパースを試みる
      try {
        const eventData = JSON.parse(data) as { data: AuctionWithDetails };
        console.log("SSE_editSSEdata_パース成功 type:", event, "eventData:", eventData.data);

        // イベントIDの設定 (パース成功後)
        if (id) {
          const eventId = parseInt(id, 10);
          if (!isNaN(eventId)) {
            setLastEventId(eventId); // 状態更新
            console.log(`SSE_editSSEdata_イベントIDを更新しました: ${eventId}`);
          }
        }

        // デバッグ用に最後に受信したメッセージを保存
        setLastReceivedMessage(
          JSON.stringify({
            type: event,
            lastEventId: id,
            parsedDataAttempt: eventData,
            timestamp: new Date().toISOString(),
          }),
        );

        // イベントキューに追加
        processEventDataByType({
          type: event as AuctionEventType,
          data: eventData.data,
        });

        console.log(`SSE_editSSEdata_イベント ${event} をキューに追加しました`);
      } catch (error) {
        // JSON.parse でのエラーハンドリング
        console.error(`SSE_editSSEdata_JSONパース中にエラーが発生しました:`, error);
        console.error(`SSE_editSSEdata_パースに失敗した data:`, JSON.stringify(data)); // エスケープして表示
        setError(`受信データの解析に失敗しました (イベント: ${event})`); // エラー状態を更新
      }
    },
    [processEventDataByType],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * SSEストリームを処理する関数
   * @param response レスポンス
   */
  const handleSSEStream = useCallback(
    async (response: Response) => {
      console.log("SSE_handleSSEStream_start");
      const reader = response.body?.getReader();
      if (!reader) {
        setError("SSEレスポンスのBodyが取得できません"); // エラー状態も更新
        console.log("SSE_handleSSEStream_SSEレスポンスのBodyが取得できません");
        return; // Body がなければ処理終了
      }

      const decoder = new TextDecoder();
      let buffer = ""; // メッセージを蓄積するバッファ

      try {
        isConnectedRef.current = true;
        console.log("SSE_handleSSEStream_SSE接続状態を「接続中」に設定しました");

        while (isConnectedRef.current) {
          // isConnectedRef をループ条件に
          try {
            const { value, done } = await reader.read();

            if (done) {
              console.log("SSE_handleSSEStream_SSEストリームが終了しました");
              // ストリーム終了時に残っているバッファも処理
              if (buffer.trim().length > 0) {
                console.log("SSE_handleSSEStream_ストリーム終了、残バッファ処理:", buffer);
                // メッセージ区切りがない場合も考慮してそのまま処理
                editSSEdata(buffer);
              }
              break; // ストリーム終了なのでループを抜ける
            }

            // 受信データをバッファに追加
            buffer += decoder.decode(value, { stream: true });
            console.log("SSE_handleSSEStream_SSEストリームからデータ受信:", value.length, "バイト, バッファ:", buffer.length);

            // メッセージ区切り文字 "\n\n" で分割して処理
            let boundary = buffer.indexOf("\n\n");
            while (boundary >= 0) {
              const message = buffer.substring(0, boundary); // 区切り文字までのメッセージ
              buffer = buffer.substring(boundary + 2); // バッファから処理済みメッセージを削除 ("\n\n" の2文字分)

              if (message.trim().length > 0) {
                console.log("SSE_handleSSEStream_完全なメッセージを処理:", message);
                editSSEdata(message);
              }
              // 次の区切り文字を探す
              boundary = buffer.indexOf("\n\n");
            }
          } catch (readError) {
            // 読み取り中のエラーハンドリング
            if ((readError as Error).name === "AbortError") {
              console.log("SSE_handleSSEStream_SSEストリームの読み取りが中断されました (AbortError)");
              // AbortError は disconnect() によって意図的に発生するので、ここではエラー状態にしない
              setLoading(false);
            } else {
              // AbortError 以外の読み取りエラー
              console.error("SSE_handleSSEStream_ストリーム読み取り中にエラー:", readError);
              setError("リアルタイム更新中に読み取りエラーが発生しました。");
              setLoading(false);
              // 予期せぬエラーの場合は接続を切断する
              if (isConnectedRef.current && disconnectFuncRef.current) {
                void disconnectFuncRef.current();
              }
            }
            break; // エラー発生時はループを抜ける
          }
        }
      } catch (err: unknown) {
        // fetch 自体のエラーや、予期せぬエラー
        if ((err as Error).name !== "AbortError") {
          console.error("SSE_handleSSEStream_SSEストリーム処理中に予期せぬエラー:", err);
          setError("リアルタイム更新の接続で問題が発生しました。");
          setLoading(false);
          // 接続を切断
          if (isConnectedRef.current && disconnectFuncRef.current) {
            void disconnectFuncRef.current();
          }
        } else {
          console.log("SSE_handleSSEStream_予期せぬ AbortError をキャッチ");
          setLoading(false);
        }
      } finally {
        console.log("SSE_handleSSEStream_finallyブロック実行");
        // リーダーの解放を試みる
        try {
          if (reader) {
            await reader.cancel(); // ストリームをキャンセル
            reader.releaseLock();
            console.log("SSE_handleSSEStream_リーダーロックを解放しました");
          }
        } catch (e) {
          console.warn("SSE_handleSSEStream_リーダー解放/キャンセル中に警告:", e);
        }
        // isConnectedRef.current = false; // disconnect 関数内で false になるはず
        setLoading(false); // 最終的にローディング解除
        console.log("SSE_handleSSEStream_finally 処理完了");
      }
    },
    // processSSEEvent は useCallback でメモ化されている想定
    // disconnectFuncRef.current を使うようにしたので disconnect は依存から外せる
    [editSSEdata],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 接続関数
   */
  const connect = useCallback(async (): Promise<void> => {
    // 既に接続済み、または接続試行中の場合は処理を中断
    if (isConnectedRef.current) {
      console.log("SSE_connect_既に接続済みのためスキップ");
      return;
    }
    // 既存の接続をクリーンアップ
    if (abortControllerRef.current) {
      // const controller = abortControllerRef.current;
      // abortControllerRef.current = null;
      // controller.abort();
      console.log("SSE_connect_abortControllerRef.current_abort");
      return;
    }

    setLoading(true); // 接続試行中はローディング表示
    setError(null); // 既存のエラーをクリア

    // 中断用の新しい AbortController を作成
    const controller = new AbortController();
    abortControllerRef.current = controller; // Refに保存
    console.log("SSE_connect_新しいAbortControllerを作成・設定");

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

      // 接続試行前に少し待機（メッセージチャネルが完全に閉じるのを待つ）
      setTimeout(() => {
        // この時点でabortControllerRefがnullになっていたら、その間に別の処理が入ったということ
        // これでsse接続が2度行われる事象を防いでいるっぽい
        if (!abortControllerRef.current) {
          console.log("SSE_connect_abortControllerRefがnullになっていたため、接続をスキップします");
          return;
        }

        console.log(`SSE_connect_SSE接続を開始します: ${url}`);

        // fetchを使ってSSE接続を開始
        void fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
          signal: controller.signal, // AbortControllerのシグナルを渡す
        })
          .then((response) => {
            console.log(`SSE_connect_SSE接続レスポンス:`, response.status, response.statusText);

            // fetch呼び出し後に中断されたかチェック
            if (controller.signal.aborted) {
              console.log("SSE_connect_fetch レスポンス受信後、中断されました (AbortError)");
              // disconnect が呼ばれているはずなので、ここでは状態更新不要かも
              setLoading(false); // 念のためローディング解除
              return;
            }

            if (!response.ok) {
              setLoading(false);
              throw new Error(`SSE_connect_SSE接続に失敗しました: ${response.status} ${response.statusText}`);
            }

            // ★ 接続成功時の処理 ★
            console.log("SSE_connect_SSE接続成功");
            isConnectedRef.current = true; // 接続状態を true に設定
            setLoading(false); // ローディング解除
            setError(null); // エラー状態をクリア

            // ★ ストリーム処理を開始 ★
            console.log(`SSE_connect_SSE接続が成功し、ストリーム処理を開始します`);
            void handleSSEStream(response);
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
   * connectRef に connect 関数を格納
   * 初めて開いたときに、接続を確立するための処理
   */
  useEffect(() => {
    disconnectFuncRef.current = disconnect;
    console.log("SSE_useEffect_disconnectFuncRef.current", disconnectFuncRef.current);
  }, [disconnect]);

  useEffect(() => {
    connectFuncRef.current = connect;
    console.log("SSE_useEffect_connectFuncRef.current", connectFuncRef.current);
  }, [connect]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 初期化処理。
   * 初めて開いたときに、接続を確立するための処理
   */
  useEffect(() => {
    console.log("SSE_useEffect_初期化処理開始");

    // 接続を確立
    // connectFuncRef を介して最新の connect 関数を呼び出す
    // マウント時に一度だけ実行されることを保証
    if (connectFuncRef.current) {
      void connectFuncRef.current();
    }

    // クリーンアップ (アンマウント時)
    // disconnectFuncRef を介して最新の disconnect 関数を呼び出す
    return () => {
      console.log("SSE_useEffect_クリーンアップ実行 (修正後)");
      if (disconnectFuncRef.current) {
        void disconnectFuncRef.current();
      }
    };
  }, []); // ← 修正点: 依存配列を空にして、マウント/アンマウント時にのみ実行

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ページビジビリティの変更を監視
   * 再度開いたときに、再接続するための処理
   */
  useEffect(() => {
    // ページビジビリティの変更を監視する場合
    if (reconnectOnVisibility) {
      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          if (!isConnectedRef.current) {
            console.log("SSE_visibilitychange_ページが表示されたため再接続を試みます");
            // 再接続タイマーが動いていればクリア
            if (reconnectTimerRef.current) {
              clearTimeout(reconnectTimerRef.current);
              reconnectTimerRef.current = null;
            }
            // connect関数を直接呼び出すのではなく、ref経由で呼び出す
            //  即時再接続ではなく、少し待つ場合
            reconnectTimerRef.current = setTimeout(() => {
              console.log("SSE_visibilitychange_connect 呼び出し");
              if (connectFuncRef.current) {
                void connectFuncRef.current();
              } else {
                console.warn("SSE_visibilitychange_connect関数が見つかりませんでした");
              }
            }, 300); // 例: 300ms後に再接続
          } else {
            console.log("SSE_visibilitychange_ページが表示されましたが、既に接続済みです");
          }
        } else if (document.visibilityState === "hidden") {
          // 非表示状態になった時、まだ接続中なら切断
          if (isConnectedRef.current) {
            console.log("SSE_visibilitychange_ページが非表示になったため接続を切断します");
            // disconnect関数を直接呼び出すのではなく、ref経由で呼び出す
            if (disconnectFuncRef.current) {
              void disconnectFuncRef.current();
            }
          }
        }
      };

      // イベントリスナーの登録を useEffect の本体に移動
      document.addEventListener("visibilitychange", handleVisibilityChange);

      // イベントリスナーの削除を クリーンアップ関数に移動
      return () => {
        console.log("SSE_useEffect_visibilitychange リスナーを削除");
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        // タイマーが残っていればクリア
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      };
    }
    // reconnectOnVisibility が false の場合のクリーンアップ (何もしないが、return は必要)
    return () => {
      // visibilityの変更を監視しない場合のクリーンアップ関数
      // 何もしないが、リターン関数は必要
    };
  }, [reconnectOnVisibility]); // ★★★ 依存配列に connect と disconnect を含めない (ref経由で使うため) ★★★

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
