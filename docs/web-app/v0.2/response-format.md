# Hono HTTPレスポンス仕様

## 1. 対象

Points/MarketsのHono REST API、browser BFF、Service Binding APIへ適用する。WebSocket eventとOAuth標準endpointはそれぞれの標準contractを優先する。

## 2. 成功

```json
{
  "data": {},
  "meta": {
    "requestId": "req_01..."
  }
}
```

- 単一resource、配列、command resultはすべて`data`へ入れる。
- paginationは`meta.cursor`、`meta.hasMore`を使う。
- mutationは作成/更新されたresource ID、revision/version、idempotency resultを返す。
- `204`を使うendpointはbodyを返さない。成功messageだけの独自形を混在させない。

## 3. 失敗

RFC 9457 Problem Detailsを使う。

```json
{
  "type": "https://markets.freeism.app/problems/auction-version-conflict",
  "title": "Auction version conflict",
  "status": 409,
  "detail": "Reload the auction snapshot and retry.",
  "instance": "/api/auctions/auc_01.../bids",
  "code": "AUCTION_VERSION_CONFLICT",
  "requestId": "req_01...",
  "currentAuctionVersion": 43
}
```

- `type`は安定したHTTPS URI。
- `title`はcodeごとの短い固定文言。
- `status`はHTTP statusと一致。
- `detail`へsecret、SQL、stack、個人情報を入れない。
- `code`は安定した`SCREAMING_SNAKE_CASE`。
- field validationは`errors[]`へrow/field/codeを返す。

## 4. status

- `200`: read、idempotent command replay
- `201`: resource作成
- `202`: Workflow等の非同期開始
- `204`: bodyなしの成功
- `400`: malformed request
- `401`: session/bearerなし・無効
- `403`: 認証済みだが権限/scope不足
- `404`: resourceを開示できない場合を含むnot found
- `409`: revision/version/idempotency/state/残高競合
- `413`: body/file上限
- `415`: Content-Type/MIME不正
- `422`: field/domain validation
- `429`: rate limit。`Retry-After`必須
- `500`: 想定外内部error
- `502/503/504`: 外部依存・一時不能・timeout。retry可否をcodeで示す

残高不足は再計算可能な経済状態競合なので`409 INSUFFICIENT_BALANCE`とする。

## 5. idempotency

- critical mutationは`Idempotency-Key`必須。
- 同じkey/payload hashは同じstatus、data/problemへ収束する。
- 同じkeyでpayloadが異なる場合は`409 IDEMPOTENCY_KEY_REUSED`。
- `meta.requestId`はretryごとに異なり得るが、domain result IDは同じにする。

## 6. cache

- session/private API: `Cache-Control: private, no-store`
- OAuth/token/callback: `no-store`
- immutable public revision/proof: content hash付きの明示public cache
- mutable Auction snapshot: 短いcacheまたは`no-store`、ETag/versionを使用
- error responseは認証内容を共有cacheしない

## 7. security header

- JSON mutationは`Content-Type: application/json; charset=utf-8`
- browser downloadは正しい`Content-Disposition`と安全なfilename
- token/proofを含む可能性がある画面は`Referrer-Policy`を明示
- HTMLはCSP、`X-Content-Type-Options: nosniff`等の共通headerを適用
- header値、環境差、Static AssetsとWorker responseの適用範囲は[セキュリティ・テスト・デリバリー仕様 5.1](./security-and-delivery.md#51-http-security-header)を正本とする

## 8. WebSocket event

```json
{
  "type": "auction.updated",
  "auctionId": "auc_01...",
  "auctionVersion": 43,
  "bidSeq": 108,
  "occurredAt": "2026-07-11T12:00:00.000Z",
  "data": {}
}
```

- eventは4KiB以下。
- AutoBid上限、token、private balanceを含めない。
- errorをsocket内独自responseで処理せず、mutation errorはHTTP Problem Detailsで返す。
- gap時はHTTP snapshotへ戻る。

## 9. logとの分離

client responseの`detail`とserver logの内部情報を分離する。server logにもOAuth token、Cookie、CSV/HTML本文、AutoBid上限を残さない。

## 10. contract test

- success schema、Problem Details schema、status/body一致
- 全error codeの安定性
- validation errorsのrow/field
- idempotency replay/conflict
- private/public cache header
- 401/403/404の情報開示差
- WebSocket 4KiBと秘密field不在
- OpenAPIと実Hono responseの一致
