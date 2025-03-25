const { createServer } = require("http2");
const { parse } = require("url");
const next = require("next");
const fs = require("fs");
const path = require("path");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// 自己署名証明書の作成方法:
// openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj '/CN=localhost' -keyout localhost-privkey.pem -out localhost-cert.pem

// HTTP/2サーバーのオプション
const options = {
  // 本番環境では正式な証明書を使用してください
  // 開発環境では自己署名証明書を使用
  key: fs.readFileSync("localhost-privkey.pem"),
  cert: fs.readFileSync("localhost-cert.pem"),
  allowHTTP1: true, // HTTP/1.1フォールバックを許可
};

app.prepare().then(() => {
  // HTTP/2サーバーを作成
  createServer(options, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);

      // SSEリクエストを特別に処理
      if (req.url.includes("/api/auctions") && req.url.includes("/sse-server-sent-events")) {
        // HTTP/2用に最適化されたSSEリクエストのヘッダー
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("X-Accel-Buffering", "no");
      }

      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  }).listen(3000, (err) => {
    if (err) throw err;
    console.log("> HTTP/2サーバーが起動しました: https://localhost:3000");
  });
});
