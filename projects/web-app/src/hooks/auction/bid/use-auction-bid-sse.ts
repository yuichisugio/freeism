"use client";

import type { AuctionWithDetails } from "@/types/auction-types";
import { useCallback, useEffect, useRef, useState } from "react";

import { AUCTION_CONSTANTS } from "../../../lib/constants";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * SSEレスポンスの型定義
 */
type SSEResponse = {
  data: AuctionWithDetails | null;
} & AuctionWithDetails;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションSSEを購読するカスタムフック（拡張版）の型
 */
type UseAuctionBidSSEReturn = {
  auction: AuctionWithDetails | undefined;
  loading: boolean;
  error: string | null;
  reconnect: () => void;
  disconnect: () => Promise<void>;
  lastMsg: string | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションSSEを購読するカスタムフック（拡張版）
 * @param {AuctionWithDetails} 初期オークションデータ
 * @returns {UseAuctionEventResult} オークション情報、入札履歴、接続状態、ユーティリティ関数
 */
export function useAuctionBidSSE(initialAuction: AuctionWithDetails): UseAuctionBidSSEReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * state
   */
  // オークション情報
  const [auction, setAuction] = useState<AuctionWithDetails>(initialAuction);
  // ローディング
  const [loading, setLoading] = useState<boolean>(true);
  // エラー
  const [error, setError] = useState<string | null>(null);
  // 最後のメッセージ
  const [lastMsg, setLastMsg] = useState<string | null>(null);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ref
   */
  // EventSource
  const eventSourceRef = useRef<EventSource | null>(null);
  // 再接続タイマー
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  // ページが表示されているかどうか
  const isVisibleRef = useRef<boolean>(true);
  // 再接続回数
  const retryCountRef = useRef<number>(0);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * SSE接続のメッセージを処理
   * @param {AuctionWithDetails} data
   */
  const processSSEMessage = useCallback((ev: MessageEvent<string>) => {
    const raw = ev.data;

    const jsonStart = raw.indexOf("{");
    const jsonStr = raw.substring(jsonStart);
    if (jsonStart === -1 || typeof jsonStr !== "string") {
      return;
    }

    try {
      const payload = JSON.parse(jsonStr) as SSEResponse;
      if (!payload) {
        return;
      }
      // 初期データと入札時のデータではdataプロパティの有無で異なる場合がある
      const auctionData = payload.data ?? payload;
      setLastMsg(raw);
      setAuction((prev) => {
        // 以前の bidHistories
        const prevHistories = prev.bidHistories ?? [];

        // 今回の新着 bidHistories（今回は単一要素の配列想定）
        const incomingHistories = auctionData.bidHistories ?? [];

        // 新着履歴がない場合は、bidHistories以外だけを更新
        if (incomingHistories.length === 0) {
          return {
            ...prev,
            ...auctionData,
            bidHistories: prevHistories,
          };
        }

        const newHistories = [...incomingHistories, ...prevHistories].slice(
          0,
          AUCTION_CONSTANTS.DISPLAY.BID_HISTORY_LIMIT + 1,
        );

        return {
          // bidHistories 以外は全て auctionData で上書き
          ...prev,
          ...auctionData,
          bidHistories: newHistories,
        };
      });
      setLoading(false);
    } catch (e) {
      console.error("src/hooks/auction/bid/use-auction-event.ts_processSSEMessage_JSON parse error", e);
      setError("受信データの解析に失敗しました");
    }
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークションSSEを購読する
   */
  const connect = useCallback(() => {
    // 既に接続中
    if (eventSourceRef.current) {
      console.warn("src/hooks/auction/bid/use-auction-event.ts_connect_already_connected");
      return;
    }

    // ローディング
    setLoading(true);

    // URL
    const url = `/api/auctions/${initialAuction.id}/sse-server-sent-events`;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    // 接続確立の場合
    es.onopen = () => {
      // 成功したら試行回数をリセット
      retryCountRef.current = 0;
      setError(null);
      setLoading(false);
    };

    // event:の記載がないメッセージの場合。デフォでmessageタイプになる
    es.onmessage = (ev: MessageEvent<string>) => {
      processSSEMessage(ev);
    };

    // エラーの場合
    es.onerror = (ev: Event) => {
      console.error("src/hooks/auction/bid/use-auction-event.ts_es.onerror", ev);
      setError("接続が中断されました。再接続を試行します…");
      // 接続を閉じる
      es.close();
      // 再接続回数をインクリメント
      retryCountRef.current += 1;
      // 再接続回数が3回以下の場合
      if (retryCountRef.current <= 3) {
        // 1〜3 回までは再接続を試みる
        setError(`接続が中断されました。再接続を試行します…`);
        setTimeout(() => connect(), 5000);
      } else {
        // 4 回目以降はリロード促し文言
        setError("再接続に失敗しました。ページをリロードしてください。");
      }
    };
  }, [initialAuction.id, processSSEMessage]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークションSSEを切断する
   */
  const disconnect = useCallback(async () => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setLoading(false);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ページが表示されているかどうかをハンドリングする
   */
  useEffect(() => {
    const handler = () => {
      isVisibleRef.current = document.visibilityState === "visible";
      if (isVisibleRef.current && !eventSourceRef.current) connect();
      if (!isVisibleRef.current && eventSourceRef.current) void disconnect();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [connect, disconnect]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * mount / unmount
   */
  useEffect(() => {
    connect();
    return () => {
      void disconnect();
    };
  }, [connect, disconnect]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 返す
   */
  return { auction, loading, error, lastMsg, reconnect: connect, disconnect };
}
