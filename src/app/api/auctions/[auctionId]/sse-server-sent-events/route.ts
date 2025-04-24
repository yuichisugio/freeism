import { SSE_CONFIG } from "@/lib/auction/constants";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// Vercelが、キャッシュを無視して、常に最新のデータを取得するように指定
export const dynamic = "force-dynamic";

// エッジ環境で実行
export const runtime = "edge";

// エンコーダー
const encoder = new TextEncoder();

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * SSE heartbeat
 * クライアントへ 20s 間隔で送出する Transform
 * 25s 以内に 1 chunk 必須という Vercel Edge 制限に対応
 */
const createHeartbeatTransform = () => {
  let timer: ReturnType<typeof setInterval> | null = null;
  return new TransformStream<Uint8Array>({
    start(controller) {
      const send = () => {
        if (controller.desiredSize !== null) controller.enqueue(encoder.encode(":\n\n"));
      };
      timer = setInterval(() => {
        try {
          console.log("src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_createHeartbeatTransform_ハートビート完了");
          send();
        } catch (error) {
          console.log("src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_createHeartbeatTransform_ハートビートエラー", error);
          // ストリームが閉じられた場合はタイマー停止
          if (timer) clearInterval(timer);
        }
      }, SSE_CONFIG.HEARTBEAT_INTERVAL);
      controller.enqueue(encoder.encode("retry: 3000\n\n"));
      console.log("src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_createHeartbeatTransform_retry_3000_送信");
    },
    transform(chunk, ctrl) {
      ctrl.enqueue(chunk);
    },
    flush() {
      // 書き込み完了時にもタイマー停止
      if (timer) clearInterval(timer);
    },
  });
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * UpstashのRedisに接続して、指定されたチャンネルを購読する
 * @param {string} channel 購読するチャンネル名
 * @returns {AsyncIterable<Uint8Array>} チャンネルのメッセージを含む非同期イテラブル
 */
async function* upstashSubscribe(channel: string) {
  const url = `${process.env.UPSTASH_REDIS_REST_URL}/subscribe/${encodeURIComponent(channel)}`;
  let attempt = 0;
  while (true) {
    const abortController = new AbortController();
    // 28s で強制 Abort – Edge fetch の idle timeout を回避
    const timeout = setTimeout(() => abortController.abort(), 28_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          Accept: "text/event-stream",
        },
        // cache: "no-cache",削除
        next: { revalidate: 0 },
        signal: abortController.signal,
      });
      clearTimeout(timeout);
      console.log("src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_upstashSubscribe_fetch");
      if (!res.ok || !res.body) {
        const wait = Math.min(2 ** attempt * 1_000, 30_000);
        await new Promise((r) => setTimeout(r, wait));
        attempt++;
        continue;
      }
      attempt = 0;
      const reader = res.body.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        yield value;
      }
    } catch (error) {
      console.warn("src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_upstashSubscribe_fetch_reconnect", error);
      continue;
    }
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 初期データを送信する Transform
 * @param {string} auctionId オークションID
 * @returns {TransformStream<Uint8Array>} 初期データを含む TransformStream
 */
const createInitDataTransform = (auctionId: string) => {
  return new TransformStream<Uint8Array>({
    async start(ctrl) {
      const base = process.env.NODE_ENV === "production" ? `https://${process.env.DOMAIN}` : "http://localhost:3000";
      const res = await fetch(`${base}/api/auctions/${auctionId}/auction-data`, {
        headers: { "x-internal-secret": process.env.FREEISM_APP_API_SECRET_KEY ?? "" },
        cache: "no-cache",
      });
      console.log("src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_createInitDataTransform_fetch");
      if (res.ok) {
        const data = await res.text();
        console.log("src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_createInitDataTransform_enqueue", data);
        ctrl.enqueue(encoder.encode(`event: connection_established\ndata: ${data}\n\n`));
      }
    },
    transform(chunk, ctrl) {
      ctrl.enqueue(chunk);
    },
  });
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * GETリクエストを処理する
 * @param {Request} _req リクエストオブジェクト
 * @param {Promise<{ auctionId: string }>} params リクエストパラメータ
 * @returns {Promise<Response>} レスポンスオブジェクト
 */
export async function GET(_req: Request, { params }: { params: Promise<{ auctionId: string }> }) {
  const { auctionId } = await params;
  console.log("auctionId", auctionId);
  if (!auctionId) {
    return new Response(JSON.stringify({ error: "オークションIDが必要です" }), { status: 400 });
  }
  const channel = `auction:${auctionId}:events`;

  const upstream = readableFromAsyncIterable(upstashSubscribe(channel))
    .pipeThrough(createHeartbeatTransform())
    .pipeThrough(createInitDataTransform(auctionId));

  return new Response(upstream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 非同期イテラブルを ReadableStream に変換する
 * Polyfill for ReadableStream.from()
 * @param iter 非同期イテラブル
 * @returns ReadableStream
 */
function readableFromAsyncIterable<T>(iter: AsyncIterable<T>): ReadableStream<T> {
  const iterator = iter[Symbol.asyncIterator]();
  return new ReadableStream<T>({
    async pull(ctrl) {
      const result = await iterator.next();
      if (result.done) {
        ctrl.close();
      } else {
        ctrl.enqueue(result.value);
      }
    },
    async cancel() {
      if (typeof iterator.return === "function") {
        await iterator.return();
      }
    },
  });
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

export async function POST() {
  return new Response(null, { status: 405, headers: { Allow: "GET" } });
}

export async function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: "GET" } });
}

export async function PATCH() {
  return new Response(null, { status: 405, headers: { Allow: "GET" } });
}

export async function HEAD() {
  return new Response(null, { status: 405, headers: { Allow: "GET" } });
}

export async function OPTIONS() {
  // CORSプリフライトリクエストなどに対応する場合
  return new Response(null, {
    status: 204, // No Content
    headers: {
      Allow: "GET, OPTIONS", // 許可するメソッド
      "Access-Control-Allow-Origin": "YOUR_FRONTEND_URL",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization", // 必要なヘッダー
    },
  });
}
