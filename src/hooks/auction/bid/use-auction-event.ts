"use client";

import type { AuctionWithDetails, BidHistoryWithUser } from "@/lib/auction/type/types";
import { useCallback, useEffect, useRef, useState } from "react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションSSEを購読するカスタムフック（拡張版）の型
 */
type UseAuctionEventResult = {
  auction: AuctionWithDetails | undefined;
  bidHistory: BidHistoryWithUser[];
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
export function useAuctionEvent(initialAuction: AuctionWithDetails): UseAuctionEventResult {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * state
   */
  // オークション情報
  const [auction, setAuction] = useState<AuctionWithDetails>(initialAuction);
  // 入札履歴
  const [bidHistory, setBidHistory] = useState<BidHistoryWithUser[]>(initialAuction.bidHistories ?? []);
  // ローディング
  const [loading, setLoading] = useState<boolean>(true);
  // エラー
  const [error, setError] = useState<string | null>(null);
  // 最後のメッセージ
  const [lastMsg, setLastMsg] = useState<string | null>(null);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ref
   */
  // EventSource
  const eventSourceRef = useRef<EventSource | null>(null);
  // 再接続タイマー
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  // ページが表示されているかどうか
  const isVisibleRef = useRef<boolean>(true);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * SSE接続のメッセージを処理
   * @param {AuctionWithDetails} data
   */
  const processSSEMessage = useCallback((ev: MessageEvent<string>) => {
    console.log("src/hooks/auction/bid/use-auction-event.ts_processSSEMessage_start");
    const raw = ev.data;
    console.log("src/hooks/auction/bid/use-auction-event.ts_processSSEMessage_raw", raw);
    const jsonStart = raw.indexOf("{");
    const jsonStr = raw.substring(jsonStart);
    if (jsonStart === -1 || typeof jsonStr !== "string") {
      console.log("src/hooks/auction/bid/use-auction-event.ts_processSSEMessage_jsonStr is not a string");
      return;
    }

    try {
      console.log("src/hooks/auction/bid/use-auction-event.ts_processSSEMessage_jsonStr", jsonStr);
      const payload = JSON.parse(jsonStr) as AuctionWithDetails;
      console.log("src/hooks/auction/bid/use-auction-event.ts_processSSEMessage_payload", payload);
      if (!payload) {
        console.warn("src/hooks/auction/bid/use-auction-event.ts_processSSEMessage_payload.data is undefined");
        return;
      }
      setLastMsg(raw);
      console.log("src/hooks/auction/bid/use-auction-event.ts_processSSEMessage_payload.data", payload);
      setAuction((prev) => ({ ...prev, ...payload }));
      if (payload.bidHistories) {
        console.log("src/hooks/auction/bid/use-auction-event.ts_processSSEMessage_payload.bidHistories", payload.bidHistories);
        setBidHistory(payload.bidHistories);
      }
      setLoading(false);
    } catch (e) {
      console.error("src/hooks/auction/bid/use-auction-event.ts_processSSEMessage_JSON parse error", e);
      setError("受信データの解析に失敗しました");
    }
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
    const params = new URLSearchParams({ auctionId: initialAuction.id });
    const url = `/api/auctions/${initialAuction.id}/sse-server-sent-events?${params}`;
    console.log("src/hooks/auction/bid/use-auction-event.ts_connect_url", url);

    const es = new EventSource(url);
    eventSourceRef.current = es;

    // 接続確立の場合
    es.onopen = () => {
      console.info("src/hooks/auction/bid/use-auction-event.ts_es.onopen", url);
      setError(null);
      setLoading(false);
    };

    // event:の記載がないメッセージの場合。デフォでmessageタイプになる
    es.onmessage = (ev: MessageEvent<string>) => {
      processSSEMessage(ev);
    };

    // 接続確立の場合
    es.addEventListener("connection_established", (ev: MessageEvent<string>) => {
      console.log("src/hooks/auction/bid/use-auction-event.ts_es.onmessage_connection_established", ev);
      processSSEMessage(ev);
    });

    // Upstash Redisの場合
    es.addEventListener("upstash_redis", (ev: MessageEvent<string>) => {
      console.log("src/hooks/auction/bid/use-auction-event.ts_es.onmessage_upstash_redis", ev);
      processSSEMessage(ev);
    });

    // エラーの場合
    es.onerror = (ev: Event) => {
      console.error("src/hooks/auction/bid/use-auction-event.ts_es.onerror", ev);
      setError("接続が中断されました。再接続を試行します…");
      es.close();
      eventSourceRef.current = null;
    };
  }, [initialAuction.id, processSSEMessage]);

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

  /**
   * mount / unmount
   */
  useEffect(() => {
    connect();
    return () => {
      void disconnect();
    };
  }, [connect, disconnect]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 返す
   */
  return { auction, bidHistory, loading, error, lastMsg, reconnect: connect, disconnect };
}
