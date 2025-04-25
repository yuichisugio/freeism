// Vercelが、キャッシュを無視して、常に最新のデータを取得するように指定
export const dynamic = "force-dynamic";

// エッジ環境で実行
export const runtime = "edge";

// エンコーダーとデコーダー
const encoder = new TextEncoder();
const decoder = new TextDecoder();

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * UpstashのRedisに接続して、指定されたチャンネルを購読し、メッセージデータを整形して送出する
 * @param {string} channel 購読するチャンネル名
 * @returns {AsyncIterable<Uint8Array>} 整形されたメッセージデータ (`data: {...}\n\n`) を含む非同期イテラブル
 */
async function* upstashSubscribe(channel: string): AsyncIterable<Uint8Array> {
  const url = `${process.env.UPSTASH_REDIS_REST_URL}/subscribe/${encodeURIComponent(channel)}`;
  let attempt = 0;

  while (true) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          Accept: "text/event-stream",
        },
        next: { revalidate: 0 },
      });
      console.log("src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_upstashSubscribe_fetch", res.status);

      if (!res.ok || !res.body) {
        console.warn("src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_upstashSubscribe_fetch_error", res.status, res.statusText);
        const wait = Math.min(2 ** attempt * 1_000, 30_000);
        await new Promise((r) => setTimeout(r, wait));
        attempt++;
        continue;
      }
      attempt = 0;
      const reader = res.body.getReader();

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          console.log("src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_upstashSubscribe_reader_done");
          break; // ストリームが終了したら内側のループを抜ける
        }
        if (!value) continue;
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
  console.log("src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts_GET_auctionId", auctionId);
  if (!auctionId) {
    return new Response(JSON.stringify({ error: "オークションIDが必要です" }), { status: 400 });
  }
  const channel = `auction:${auctionId}:events`;

  const upstream = readableFromAsyncIterable(upstashSubscribe(channel)).pipeThrough(createInitDataTransform(auctionId));

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
function readableFromAsyncIterable(iter: AsyncIterable<Uint8Array>): ReadableStream<Uint8Array> {
  const iterator = iter[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      const result = await iterator.next();
      if (result.done) {
        ctrl.close();
      } else {
        const decodedValue = decoder.decode(result.value, { stream: true });
        const value = `event: upstash_redis\ndata: ${decodedValue}\n\n`;
        ctrl.enqueue(encoder.encode(value));
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
