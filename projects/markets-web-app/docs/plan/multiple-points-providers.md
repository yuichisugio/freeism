# 複数 Points 互換サービスへの接続設計

## 位置付け

Markets の管理者が複数の Points 互換サービスを登録し、利用者が提供先ごとに OAuth 連携する設計である。1 Auction は作成時に選んだ1提供先に固定し、その Auction の入札、即決、予約、capture、release は同じ提供先で完結する。

Markets ADMIN による精算の手動 retry は実装済みである。複数提供先の管理・OAuth・Auction・精算は本書を基に実装し、関連する v0.2 仕様と実装計画を同期する。

## 決定済みの要件

1. Markets 自身の ADMIN が接続先を管理する。管理画面は `/admin/points-connections`、API は `GET/POST /api/admin/points-connections`、`POST /api/admin/points-connections/{providerId}/activate`、`POST /api/admin/points-connections/{providerId}/stop` とする。利用者の `/settings/points-connection` とは分ける。
2. Markets の管理操作と精算の手動 retry は Markets の Better Auth admin プラグインで `user.role` に `admin` を含むか判定する。初期 ADMIN は Wrangler D1 SQL 操作で付与する。接続先 Points の ADMIN 資格は要求しない。
3. ADMIN が登録した複数の `ACTIVE` な提供先から、利用者はそれぞれを明示的に選び、個別に OAuth 連携できる。同一 Markets 利用者の複数提供先への連携を認める。同じ提供先に対する live な連携は1件とする。
4. 出品の作成または CSV import の開始時に提供先を1つ選ぶ。CSV は1回の import 全行を同じ提供先にする。出品確定後の Auction の提供先は変更しない。入札・即決には、その Auction の提供先に対する本人の `ACTIVE` な連携を要求する。
5. 提供先は OAuth 標準と Markets が使う Points domain API 契約に対応するサービスに限る。入力は任意の HTTPS origin を基本とし、ローカル開発時のみ loopback の HTTP origin を認める。保存済み接続先を選び外部 `fetch` と discovery を使う。接続先ごとの API adapter やアプリ間のコード共用・共有 package は設けず、各アプリで独立して実装する。
6. 鍵生成、秘密鍵の暗号化、有効化時の実トークン取得は Points の Accounts 接続管理方式を基準にする。ADMIN が秘密鍵を入力する方式にしない。

## 実装の主な参照先

| 責務 | 主なファイル・保存先 |
| --- | --- |
| 提供先の登録・認証 | `src/backend/db/schema/points-provider.ts`、`src/backend/points/manage-points-providers.ts`、`points-provider-context.ts`、`src/backend/http/routes/points-provider-routes.ts` |
| 利用者のOAuth連携 | `src/backend/db/schema/points-connection.ts`、`src/backend/points/points-link-saga.ts`、`points-token-store.ts`、`src/backend/http/routes/points-connection-routes.ts` |
| 出品・入札 | `src/backend/db/schema/auction.ts`、`src/backend/auction/import/`、`src/backend/db/d1-auction-repository.ts`、`src/backend/auction/execute-auction-command.ts` |
| 精算・再照合 | `src/backend/settlement/settlement-provider.ts`、`src/backend/db/d1-settlement-repository.ts`、`src/backend/settlement/`、`src/server.ts` |
| Markets ADMIN | `src/backend/auth/auth-options.ts`、`require-markets-admin.ts`、`src/backend/http/routes/settlement-admin-routes.ts` |

関連仕様は `docs/specification/v0.2/details-ja/markets-domain.md`、`auction.md`、`realtime-and-settlement.md`、およびリポジトリの `docs/web-app/v0.2/points-markets-contract.md` を参照する。

## 提供先登録と管理

`points_provider` に内部の不変 ID（`ppr_<uuid>`）、表示名、正規化した origin、issuer、API resource、登録済み Client ID、公開 JWK、暗号化した client assertion 用秘密鍵・DPoP 用秘密鍵、状態、作成・有効化・停止日時を保持する。issuer は origin、resource は `${origin}/api/v1` とする。状態は `PENDING_CLIENT_REGISTRATION`、`ACTIVE`、`STOPPED`。Markets 内の参照キーは `providerId` とし、origin は重複登録しない。`GET /api/points-providers` は `ACTIVE` な提供先のみを返す。

管理画面では一覧、作成、Client ID を入力して有効化、停止を行う。作成 body は `{origin, displayName, reason}`、有効化は `{clientId, reason}`、停止は `{reason}` とし、変更操作に `Idempotency-Key` を付ける。表示するのは接続名、origin、状態、公開 JWK Set、Markets の OAuth callback URL 2件（link・unlink）、登録手順と監査情報とし、秘密鍵・トークンは返さない。管理 API は `callbackUrls: {link, unlink}` を返す。変更操作は Markets ADMIN、fresh なログイン、CSRF、理由、冪等キーを要求し、監査記録を残す。初期 ADMIN の `user.role` は Wrangler D1 SQL 操作で設定する。

作成時に HTTPS origin（開発環境だけ loopback HTTP）を正規化し、discovery の issuer が選択 origin と一致すること、authorize/token/JWKS endpoint が同一 origin に属することと、対応する認証方式を検査する。有効化時に `points.reservations.status` scope の実トークン取得を確認する。その他の Points domain API は各操作で契約どおり扱い、redirect 後も同じ origin の境界を守る。Points の `accounts-origin.ts`、`accounts-discovery.ts`、`accounts-http.ts` の方式を基準に実装する。

Markets が client assertion 用と DPoP 用の Ed25519 鍵を生成し、`POINTS_KEY_ENCRYPTION_KEY`（base64 の32 byte鍵）で暗号化して D1 に保存する。ADMIN は公開鍵と `APP_ORIGIN` 配下の `/api/points-connection/callback`、`/api/points-connection/unlink/callback` を提供先のOAuth Clientへ登録し、払い出された Client ID を Markets に入力する。有効化では client credentials の `points.reservations.status` scope で実トークン取得に成功した時だけ `ACTIVE` にする。M2M token は要求ごとに接続先の鍵で取得する。鍵と既存 USER token は停止後の精算・解除が完了できるよう保持する。ログ、管理応答、監査イベントに秘密情報を含めない。鍵生成・暗号化・実証の参考実装は Points の `src/backend/usecases/manage-accounts-connections.ts` と `src/backend/accounts/` であり、コードは各アプリに独立して置く。

## 利用者連携と提供先 ID

利用者画面 `/settings/points-connection` は提供先一覧と本人の提供先別連携状態を表示する。`GET /api/points-connection` は `{data: [{providerId, displayName, status, connection: null | {id, status, pendingAction?}}]}` を返し、既存連携のある `STOPPED` 提供先も表示する。連携開始 `POST /api/points-connection/start` は body の `providerId` を必須とし、解除開始は `{providerId, reason}` を受ける。callback URL、PKCE、nonce、state、session、連携試行、確認・取消、解除のすべてをその ID に束縛する。callback の `iss` を必須とし、ID token の署名・nonce・issuer・audience・subject と introspection の subject を state の提供先と照合する。`REAUTH_REQUIRED`の連携は同じ提供先へ再連携してから解除する。

`points_oauth_state`、`points_connection`、解除の一回限り state に `providerId` を保存する。外部 Points subject は `(providerId, subject)` を名前空間にする。同じ subject 文字列や package ID が異なる提供先から返ることは正常とする。利用者 token は既存の Better Auth 暗号化保存を使い、Better Auth `providerId='points'` と `accountId='${providerId}|${subject}'` で識別する。解除用一回限り token は別の暗号化 account に保存する。refresh token の回転と account 削除はその `accountId` に限定する。再認可では新しい link attempt を使い、Markets と Points の connection ID、subject、user/client を維持して grant version を更新する。

## Auction、CSV、bid、精算

- Auction 作成・CSV import validate に `providerId` を入力する。サーバーは登録済み `ACTIVE` 提供先と既存の seller 権限条件を確認する。package revision 取得、eligibility receipt、内容 hash はその提供先へだけ要求する。CSV の preview、validate、commit の command hash・冪等性には同じ `providerId` を含め、commit で別の値を指定しても再利用できないよう receipt と結び付ける。開始前 PATCH の command hash・冪等性にも Auction の `providerId` を含める。
- `auctions.provider_id` を正本にし、`auction_revisions.points_issuer` はその提供先から導く。package snapshot は提供先 ID を名前空間に含め、revision ID 単独 unique と content hash 由来の snapshot ID を複合化する。component は package snapshot の FK から提供先を辿る。revision、plan、round、winner、outbox も既存 FK または Auction ID から復元し、`providerId` を重複保存しない。
- bid と即決は Auction の `providerId` と一致する本人の `ACTIVE` 連携、および提供先自体の`ACTIVE`状態をサーバーで検査する。提供先停止後も既存AutoBidの取消と開始前Auction取消は受け付ける。入札後に連携が失効した場合、精算時は同じ提供先の再認可が必要になる。
- plan hash と冪等キーに提供先 ID を含める。外部 reservation ID と capture receipt ID も提供先別に識別する。outbox/Workflow は Auction または保存済み plan から提供先 ID を再読込し、reserve、reservation status/release、capture/status/release、未使用予約の release、reconcile、cron の定期 status/release、手動 retry のすべてで同じ ID を使う。winner の `pointsConnectionId` が当該提供先の本人連携であることを毎回確認する。capture の全 winner は同じ Points へ1要求で送り、既存の全件原子性を守る。
- 提供先ごとに status、`Retry-After`、一時障害を分類し、ログには内部 `providerId`、Auction/settlement/request ID のみを記録する。公開 API、WebSocket、proof には秘密 token、残高、内部 Points user ID を出さない。

## OAuth と停止の境界

Accounts 接続と同じ `private_key_jwt`、DPoP、JWT/ID Token 検証、discovery、クライアント管理の方式を採る。Markets–Points の USER Authorization Code/refresh は残高確認と予約作成、M2M Client Credentials は link-attempt と既存予約の status/capture/release に使う。Accounts、Points、Markets 間でコードを import したり共有 package に切り出したりせず、それぞれで独立して実装する。

`STOPPED` の提供先では新規連携、出品、入札、即決を受け付けない。既存AutoBidの取消と開始前Auction取消は受け付ける。停止前に成立した入札/即決は、停止後に精算が始まる場合も含め、同じ提供先で USER refresh と reserve、M2M status/capture/release を続ける。refresh の確定失効または更新後401では連携を`REAUTH_REQUIRED`にし、その既存連携の本人だけ同じ提供先への再認可を開始できる。`ACTIVE`な既存連携の解除も受け付ける。必要な鍵、USER token とM2Mクライアント設定を保持する。

## 実装順と検証

1. Markets/Points 双方の仕様と管理・OAuth・精算のテスト観点を更新する。Better Auth admin プラグイン、oauth4webapi、Cloudflare Workers の外部 `fetch` と Wrangler の現行公式仕様を実装前に確認する。
2. 接続先 schema、ADMIN route と画面、鍵 vault/discovery/外部 HTTP/M2M token取得を作り、管理の権限・origin 制限・鍵秘匿・有効化の実トークン証明を先にテストする。
3. 利用者の提供先選択、state・token・refresh・解除を提供先別にし、既存 Points 1先での連携フローを保つ。次に Auction/CSV/bid の提供先固定と照合を追加する。
4. 精算の plan、round、Workflow、capture、reconciliation、手動 retry から Auction の提供先 ID を辿る。途中失敗から再起動した場合も、保存済み Auction の提供先を使うことを確認する。固定 env/Service Binding の参照を最後に除く。
5. 単体テストを主軸に、少なくとも「異なる提供先が同じ subject/package/revision/reservation/capture receipt ID を返す」「A の Auction に B の連携だけを持つ入札者は拒否」「CSV preview は別提供先で commit 不可」「import/更新の同一冪等キーを異なる提供先へ流用できない」「B の Token/鍵で A の API を呼ばない」「refresh の回転と `REAUTH_REQUIRED` は提供先別」「Workflow 再起動後も元の提供先で reserve/capture/release」「cron 再照合も元の提供先へ向く」「停止後は新規操作を拒否し、既存精算・refresh・解除は継続」「Markets ADMIN 以外は管理と手動 retry を拒否」を検証する。最後に対象テスト、型検査、Worker 結合テストのログを確認する。

後方互換移行は正式リリース前の現状では要求しない。ただし既存の保存データを利用する環境があるかを配備前に確認し、必要ならその環境用のデータ移行を別途明示する。
