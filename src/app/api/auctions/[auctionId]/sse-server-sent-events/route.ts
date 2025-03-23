import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuctionWithTask } from "@/lib/auction/auction-service";
import { AuctionEventType } from "@/lib/auction/types";

// イベントデータの型定義
type AuctionEventData = {
  type: AuctionEventType;
  data: Record<string, any>;
};

// 接続管理
const connections = new Map<string, Set<ReadableStreamController<Uint8Array>>>();

/**
 * SSEエンドポイント
 * オークションの初期データと、新しい入札が発生した場合のイベントを送信
 * @param request リクエスト
 * @param params パラメータ
 * @returns レスポンス
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ auctionId: string }> }) {
  const { auctionId } = await params;

  // 認証チェック
  const session = await auth();
  if (!session?.user?.id) {
    console.error("SSE接続認証エラー: ユーザーセッションが存在しません");
    return new Response(
      JSON.stringify({
        error: "認証が必要です",
        detail: "ログインしてください",
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-transform",
        },
      },
    );
  }

  try {
    // オークション情報を取得
    const auction = await getAuctionWithTask(auctionId);
    if (!auction) {
      console.error(`SSE接続エラー: オークションID ${auctionId} が見つかりません`);
      return new Response(
        JSON.stringify({
          error: "オークションが見つかりません",
          detail: "指定されたオークションは存在しないか削除されました",
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-transform",
          },
        },
      );
    }

    // ストリームとエンコーダーの設定
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start: async (controller) => {
        // コネクションの初期化
        if (!connections.has(auctionId)) {
          connections.set(auctionId, new Set());
        }

        // このコネクションを登録
        connections.get(auctionId)?.add(controller);

        // 初期データの送信
        const initialData: AuctionEventData = {
          type: AuctionEventType.INITIAL,
          data: { auction },
        };

        try {
          controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify(initialData)}\n\n`));
          console.log(`SSE接続確立: ユーザー ${session.user?.id} がオークション ${auctionId} に接続しました`);
        } catch (e) {
          console.error("SSE初期データ送信エラー:", e);
        }

        // 60分後にタイムアウト
        const timeoutId = setTimeout(
          () => {
            try {
              controller.close();
              connections.get(auctionId)?.delete(controller);
              console.log(`SSEタイムアウト: ユーザー ${session.user?.id} のオークション ${auctionId} への接続がタイムアウトしました`);
            } catch (e) {
              console.error("コントローラーのクローズ中にエラーが発生しました:", e);
            }
          },
          60 * 60 * 1000,
        );

        // クリーンアップ関数
        return () => {
          clearTimeout(timeoutId);
          connections.get(auctionId)?.delete(controller);
          if (connections.get(auctionId)?.size === 0) {
            connections.delete(auctionId);
          }
          console.log(`SSE接続終了: ユーザー ${session.user?.id} がオークション ${auctionId} から切断しました`);
        };
      },
    });

    // レスポンスヘッダーの設定
    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("SSEセットアップエラー:", error);
    return new Response(
      JSON.stringify({
        error: "サーバーエラー",
        detail: "SSE接続の確立中に問題が発生しました",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-transform",
        },
      },
    );
  }
}

/**
 * 特定のオークションの全接続に対してイベントを送信
 * @param auctionId オークションID
 * @param eventData イベントデータ
 */
export async function sendEventToAuctionSubscribers(auctionId: string, eventData: AuctionEventData) {
  // エンコーダーを作成
  const encoder = new TextEncoder();
  // メッセージを作成
  const message = `event: message\ndata: ${JSON.stringify(eventData)}\n\n`;
  // connectionsに保存しているauctionIdキーを指定して、そのauctionIdを受信しているユーザーのcontroller一覧を取得
  const controllers = connections.get(auctionId);

  // コントローラーが存在し、かつサイズが0より大きい場合は、コントローラーを繰り返し処理
  if (controllers && controllers.size > 0) {
    for (const controller of controllers) {
      try {
        // エンコーダーを使用してメッセージをエンコードして、enqueueメソッドに渡して送信
        controller.enqueue(encoder.encode(message));
      } catch (e) {
        console.error("SSEメッセージ送信中にエラーが発生しました:", e);
        controllers.delete(controller);
      }
    }
  }
}

// GET以外のメソッドを禁止
export async function POST() {
  return new NextResponse(null, { status: 405 });
}

export async function PUT() {
  return new NextResponse(null, { status: 405 });
}

export async function DELETE() {
  return new NextResponse(null, { status: 405 });
}

export async function PATCH() {
  return new NextResponse(null, { status: 405 });
}

export const dynamic = "force-dynamic";
