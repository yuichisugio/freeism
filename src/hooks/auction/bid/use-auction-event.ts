"use client";

import type { AuctionEventData, AuctionWithDetails, BidHistoryWithUser } from "@/lib/auction/type/types";
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
  lastEventId: number;
  reconnect: () => void;
  disconnect: () => Promise<void>;
  clientId: string;
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
  const [auction, setAuction] = useState<AuctionWithDetails | undefined>(initialAuction);
  // 入札履歴
  const [bidHistory, setBidHistory] = useState<BidHistoryWithUser[]>(initialAuction.bidHistories ?? []);
  // ローディング
  const [loading, setLoading] = useState<boolean>(true);
  // エラー
  const [error, setError] = useState<string | null>(null);
  // 最後のイベントID
  const [lastEventId, setLastEventId] = useState<number>(0);
  // クライアントID
  const [clientId] = useState<string>(initialAuction.options?.clientId ?? `c-${crypto.randomUUID()}`);
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
   * オークション情報を更新する
   * @param {AuctionWithDetails} data
   */
  const applyAuction = useCallback((data: AuctionWithDetails) => {
    console.log("src/hooks/auction/bid/use-auction-event.ts_applyAuction_data", data);
    setAuction((prev) => ({ ...prev, ...data }));
    if (data.bidHistories) setBidHistory(data.bidHistories);
    setLoading(false);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークションSSEを購読する
   */
  const connect = useCallback(() => {
    if (eventSourceRef.current) return; // 既に接続中
    setLoading(true);
    const params = new URLSearchParams({ clientId, lastEventId: String(lastEventId), auctionId: initialAuction.id });
    const url = `/api/auctions/${initialAuction.id}/sse-server-sent-events?${params}`;
    console.log("src/hooks/auction/bid/use-auction-event.ts_connect_url", url);

    const es = new EventSource(url); // ★ ここが核心 ★
    eventSourceRef.current = es;

    es.onopen = () => {
      console.info("src/hooks/auction/bid/use-auction-event.ts_es.onopen", url);
      setError(null);
      setLoading(false);
    };

    es.onmessage = (ev) => {
      const raw = ev.data as string; // ex. "message,auction:…:events,{\"data\":{…}}"
      const jsonStart = raw.indexOf("{");
      const jsonStr = raw.substring(jsonStart);
      if (jsonStart === -1 || typeof jsonStr !== "string") return;

      try {
        console.log("src/hooks/auction/bid/use-auction-event.ts_es.onmessage_jsonStr", jsonStr);
        const payload = JSON.parse(jsonStr) as AuctionEventData;
        if (!payload.data) {
          console.warn("src/hooks/auction/bid/use-auction-event.ts_es.onmessage_payload.data is undefined");
          return;
        }
        setLastMsg(raw);
        setLastEventId(Number(ev.lastEventId ?? 0));
        console.log("src/hooks/auction/bid/use-auction-event.ts_es.onmessage_payload.data", payload.data);
        applyAuction(payload.data); // type 判定は省略例。必要なら switch する
      } catch (e) {
        console.error("src/hooks/auction/bid/use-auction-event.ts_es.onmessage_JSON parse error", e);
        setError("受信データの解析に失敗しました");
      }
    };

    es.onerror = (ev: Event) => {
      console.error("src/hooks/auction/bid/use-auction-event.ts_es.onerror", ev);
      setError("接続が中断されました。再接続を試行します…");
      es.close();
      eventSourceRef.current = null;
      reconnectTimer.current = setTimeout(connect, 5000);
    };
  }, [clientId, lastEventId, initialAuction.id, applyAuction]);

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
  return { auction, bidHistory, loading, error, lastEventId, clientId, lastMsg, reconnect: connect, disconnect };
}
