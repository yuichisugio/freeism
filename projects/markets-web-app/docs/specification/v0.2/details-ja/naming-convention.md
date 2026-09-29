# Webアプリ v0.2 命名規則

## 1. 適用範囲

この規則は`projects/points-web-app`、`projects/markets-web-app`、両者のOpenAPI/IaC/CIへ適用する。外部protocol、generated code、Cloudflare/Better Authの予約名は変更しない。

## 2. repository・service・domain

- project directory: `points-web-app`、`markets-web-app`
- Worker service: `points-worker`、`auction-worker`
- domain: `points.freeism.app`、`markets.freeism.app`
- class/type/component: `PascalCase`
- TypeScript関数・変数・property: `camelCase`
- file/directory/route segment: `kebab-case`
- environment variable・enum wire value: `SCREAMING_SNAKE_CASE`
- D1 table/column/index/constraint: `snake_case`

「Markets」と「Auction」の使い分け:

- product/project/domain境界は`Markets`を使う。
- Worker名とAuction domain objectだけは承認済み名称`auction-worker`、`AuctionRoom`を使う。
- 新規文書・型で旧一般名`freeismApp`、`webApp`、`auctionService`をサービス全体の名前に使わない。

## 3. ID

- opaque IDはdomain prefix付きのURL-safe stringにする。例: `pusr_`, `musr_`, `evc_`, `pkg_`, `fix_`, `auc_`, `stl_`。
- IDを整数の連番やemailで公開しない。
- OAuth identityは`providerId` + `accountId`。
- Points–Markets主体は`issuer` + `subject`。
- idempotencyは`Idempotency-Key` header、内部propertyは`idempotencyKey`。
- correlationは`requestId`、`workflowInstanceId`、`planHash`。

## 4. 金額と時刻

- 表示値文字列: `amount`またはdomain名付き`fixAmount`。
- scale済み整数: suffix `Scaled`。例: `amountScaled`、`minimumUnitScaled`。
- Markets内部で扱うpackage tickの個数: suffix `TickCount`。例: `priceTickCount`、`buyNowPriceTickCount`。
- Points wireで扱うscale済みpackage価格は外部契約名`priceTicks`を維持する。
- Package構成比: 正の整数`weight`と合計`totalWeight`。`ratioScaled`や`rateFloat`へ近似しない。
- timestamp property: `createdAt`、`effectiveAt`、`expiresAt`。UTC RFC 3339。
- duration: unitをsuffixに含める。例: `leaseSeconds`、`freshAgeSeconds`。

## 5. revisionとstate

- 不変entityの版: `revision`、IDは`{domain}RevisionId`。
- concurrency check: `expectedRevision`または`expectedAuctionVersion`。
- Auction event sequence: `bidSeq`、同額到達順は`reachedSequence`。
- state/status enumはdomainごとに1語へ統一し、booleanの組合せで状態機械を表さない。
- terminal stateから戻す`reset*`/`undo*`を経済domainへ作らない。

## 6. HTTP/OpenAPI

- public path: `/api/v1/...`
- browser BFF path: `/api/...`
- OAuth/Discovery: Better Authと標準の`/.well-known/...`
- JSON propertyは`camelCase`。
- success envelopeは`data`、metadataは`meta`。
- errorはRFC 9457で、機械判定codeは`SCREAMING_SNAKE_CASE`。
- headerは標準表記`Idempotency-Key`、`Authorization`、`Content-Type`、`X-Request-Id`。
- DBの`snake_case`をAPIへそのまま露出しない。

## 7. Hono

- route file: `{resource}-routes.ts`
- middleware: 名詞または目的の`*-middleware.ts`
- use case: 動詞開始の`create-*`, `verify-*`, `capture-*`。
- repository interface: `{Domain}Repository`、実装は`D1{Domain}Repository`。
- Hono bindings型: `Bindings`、request context variables: `Variables`。
- Points/Markets backendの型を相互importせず、OpenAPI generated clientの型を使う。

## 8. Drizzle/D1

- schema sourceはdomainごとに分割し、table constantはcamelCase複数形。例: `fixRevisions`。
- DB名はsnake_case複数形。例: `fix_revisions`。
- FKは`{target}_id`、Drizzle propertyは`{target}Id`。
- unique/check/indexへ目的を含む明示名を付ける。
- migration file名はtoolが生成するsequence + kebab/snakeの説明を既存tool規約に合わせる。手書きでsequenceを偽造しない。
- D1 bindingは各appで`DB`、Service Bindingは意味のある`POINTS_SERVICE`等を使う。

## 9. Durable Object/Workflow

- DO class: `AuctionRoom`
- DO binding: `AUCTION_ROOMS`
- Workflow class: `AuctionSettlementWorkflow`
- Workflow binding: `AUCTION_SETTLEMENT`
- DO IDは`auctionId`から決定論的に導出し、任意user inputをそのまま名前にしない。
- Workflow instance IDはSettlement ID + immutable settlement revision + 単調なworkflow attemptで一意にし、Cloudflareの100文字上限内にする。初回は`attempt:0`、手動retryは同じ業務revisionのままattemptだけを増やし、完了済みinstance IDを再利用しない。

## 10. frontend

- route componentはTanStack Routerの予約命名に従う。
- React component `PascalCase`、hook `useXxx`、fileは`kebab-case.tsx`。
- server state key factoryは`camelCase`。domain namespaceを先頭elementにする。
- browser公開環境変数は`VITE_`prefix。ただしsecret、token、client secretへ絶対に付けない。
- `NEXT_PUBLIC_`、Server Action名、Next.js予約file名を新規コードへ持ち込まない。

## 11. test

- test fileは`*.test.ts`/`*.test.tsx`。
- Workers integrationは`*.worker.test.ts`。
- contract fixtureは`test/fixtures`、秘密を含む実credentialを置かない。
- test名は期待behaviorを表し、実装method名だけにしない。

## 12. script

- package scriptはnamespaceを`:`で区切る。例: `test:worker`、`db:migrate:staging`。
- scripts内の単語は`kebab-case`。
- environmentを省略したproduction commandを作らない。
- `npm`/`npx`をrepository script/docsへ追加せず、pnpm/Vite Plusの正本commandを使う。

## 13. 例外

- OAuth wire field、JWT claim、RFC header、Better Auth generated schemaは外部互換名を維持する。
- generated OpenAPI clientは手編集しない。
- Cloudflare binding/config fieldは公式schemaの名前を維持する。
- 例外を増やす場合は理由とsourceを近接commentまたは仕様へ記録する。
