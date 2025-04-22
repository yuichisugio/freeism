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
  lastReceivedMessage: string | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションSSEを購読するカスタムフック（拡張版）
 * @param {AuctionWithDetails} 初期オークションデータ
 * @returns {UseAuctionEventResult} オークション情報、入札履歴、接続状態、ユーティリティ関数
 */
export function useAuctionEvent(initialAuction: AuctionWithDetails): UseAuctionEventResult {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const [auction, setAuction] = useState<AuctionWithDetails | undefined>(initialAuction);
  const [bidHistory, setBidHistory] = useState<BidHistoryWithUser[]>(initialAuction.bidHistories ?? []);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastEventId, setLastEventId] = useState<number>(0);
  const [clientId] = useState<string>(initialAuction.options?.clientId ?? `c-${crypto.randomUUID()}`);
  const [lastMsg, setLastMsg] = useState<string | null>(null);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ref
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef<boolean>(true);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const applyAuction = useCallback((data: AuctionWithDetails) => {
    setAuction((prev) => ({ ...prev, ...data }));
    if (data.bidHistories) setBidHistory(data.bidHistories);
    setLoading(false);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /** ------- connect ------- */
  const connect = useCallback(() => {
    if (eventSourceRef.current) return; // 既に接続中
    setLoading(true);
    const params = new URLSearchParams({ clientId, lastEventId: String(lastEventId), auctionId: initialAuction.id });
    const url = `/api/auctions/${initialAuction.id}/sse-server-sent-events?${params}`;

    const es = new EventSource(url); // ★ ここが核心 ★
    eventSourceRef.current = es;

    es.onopen = () => {
      console.info("[SSE] open", url);
      setError(null);
      setLoading(false);
    };

    es.onmessage = (ev) => {
      if (typeof ev.data !== "string" || !ev.data.startsWith("subscribe,")) {
        setLastMsg(ev.data as string);
        try {
          const payload = JSON.parse(ev.data as string) as AuctionEventData;
          if (!payload.data) {
            console.warn("[SSE] payload.data is undefined");
            return;
          }
          setLastEventId(Number(ev.lastEventId ?? 0));
          console.log("src/hooks/auction/bid/use-auction-event.ts_es.onmessage_payload.data", payload.data);
          applyAuction(payload.data); // type 判定は省略例。必要なら switch する
        } catch (e) {
          console.error("[SSE] JSON parse error", e);
          setError("受信データの解析に失敗しました");
        }
      }

      es.onerror = (ev: Event) => {
        console.error("[SSE] error", ev);
        setError("接続が中断されました。再接続を試行します…");
        es.close();
        eventSourceRef.current = null;
        reconnectTimer.current = setTimeout(connect, 5000);
      };
    };
  }, [clientId, lastEventId, initialAuction.id, applyAuction]);

  /** ------- disconnect ------- */
  const disconnect = useCallback(async () => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setLoading(false);
  }, []);

  /** ------- visibility handling ------- */
  useEffect(() => {
    const handler = () => {
      isVisibleRef.current = document.visibilityState === "visible";
      if (isVisibleRef.current && !eventSourceRef.current) connect();
      if (!isVisibleRef.current && eventSourceRef.current) void disconnect();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [connect, disconnect]);

  /** ------- mount / unmount ------- */
  useEffect(() => {
    connect();
    return () => {
      void disconnect();
    };
  }, [connect, disconnect]);

  return { auction, bidHistory, loading, error, lastEventId, clientId, lastReceivedMessage: lastMsg, reconnect: connect, disconnect };
}
