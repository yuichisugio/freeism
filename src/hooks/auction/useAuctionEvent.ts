"use client";

import type { AuctionEventData, AuctionWithDetails, BidHistoryWithUser } from "@/lib/auction/types";
import { useEffect, useRef, useState } from "react";
import { MAX_RETRIES } from "@/lib/auction/constants";
import { AuctionEventType } from "@/lib/auction/types";

/**
 * オークションSSEを購読するカスタムフック
 * @param auctionId オークションID
 * @param initialAuction 初期オークションデータ
 * @returns オークション情報、入札履歴、ローディング状態、エラー、終了時間延長状態
 */
export function useAuctionEvent(auctionId: string, initialAuction?: AuctionWithDetails) {
  const [auction, setAuction] = useState<AuctionWithDetails | undefined>(initialAuction);
  const [bidHistory, setBidHistory] = useState<BidHistoryWithUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [endTimeExtended, setEndTimeExtended] = useState<boolean>(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef<number>(0);

  useEffect(() => {
    // 初期データがあればそれを使用
    if (initialAuction) {
      setAuction(initialAuction);
      setBidHistory(initialAuction.bids as BidHistoryWithUser[]);
      setLoading(false);
    }

    const connect = () => {
      try {
        const eventSource = new EventSource(`/api/auctions/${auctionId}/sse-server-sent-events`, {
          withCredentials: true, // 認証情報を含める
        });
        eventSourceRef.current = eventSource;

        eventSource.onmessage = (event) => {
          try {
            const eventData: AuctionEventData = JSON.parse(event.data);

            // イベントタイプごとの処理
            switch (eventData.type) {
              case AuctionEventType.INITIAL:
                if (eventData.data.auction) {
                  setAuction(eventData.data.auction);
                  setBidHistory(eventData.data.auction.bids as BidHistoryWithUser[]);
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
          } catch (err) {
            console.error("SSEメッセージのパース中にエラーが発生しました:", err);
          }
        };

        eventSource.onerror = (err) => {
          // エラーの詳細をログに出力
          console.error("SSE接続エラー: 再接続を試みます", { readyState: eventSource.readyState });

          // 接続が閉じられた場合のみクローズ処理を行う
          if (eventSource.readyState === EventSource.CLOSED) {
            eventSource.close();
            eventSourceRef.current = null;

            // エラー状態を設定
            setError("リアルタイム更新の接続が切断されました。再接続しています...");

            // 接続再試行
            if (retryCountRef.current < MAX_RETRIES) {
              // 指数バックオフ + ランダム要素を加えたジッターで再接続
              const baseDelay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
              const jitter = Math.random() * 1000; // 0-1000msのランダム値
              const retryDelay = baseDelay + jitter;

              retryCountRef.current++;
              console.log(`SSE再接続を${retryDelay}ms後に試みます (${retryCountRef.current}/${MAX_RETRIES}回目)`);

              setTimeout(() => {
                if (!eventSourceRef.current) {
                  connect();
                }
              }, retryDelay);
            } else {
              // 最大リトライ回数を超えた場合
              setError("リアルタイム更新を利用できません。ページを再読み込みしてください。");
            }
          }
        };
      } catch (err) {
        console.error("SSE接続の確立に失敗しました:", err);
        setError("リアルタイム更新を開始できませんでした");
        setLoading(false);
      }
    };

    // 最初の接続を確立
    connect();

    // クリーンアップ
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [auctionId, initialAuction]);

  return {
    auction,
    bidHistory,
    loading,
    error,
    endTimeExtended,
  };
}
