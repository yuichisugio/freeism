# Terraform 全廃と `cf` CLI への完全移行計画

作成日: 2026-10-26
状態: 計画確定（未実行）。敵対的レビューの指摘を反映済み。決めることはすべて決定済み。

この計画は、`2026-09-30-cf-only-environment.ja.md`（edge 設定を `cf` を呼ぶ自前の再現スクリプトで管理する計画）に代わるものである。

## 目的と方針

- 目的：Terraform のコードと state、Cloudflare を操作する自前のスクリプトをなくし、Cloudflare の構成を各アプリの `cloudflare.config.ts` と `cf` のコマンドだけで扱う。
- 方針
  - 宣言して反映するものは、各アプリの `cloudflare.config.ts`（Main・Docs は `cf migrate` が作る `wrangler.config.ts`）だけにする。Worker・バインディング・カスタムドメイン・Cron・回数制限・観測の設定を書く。
  - 設定ファイルで書けない資源（DNS・Rulesets・通知など）は、Worker の設定かアプリのコードへ移すか、使わない。
  - 移せないものは、環境を作るときに一度だけ実行するコマンドとして運用の文書に書く。差分を取って反映するスクリプトは作らない。
  - CI の配信に渡す秘密は `CLOUDFLARE_API_TOKEN` だけにする。アカウントIDは各設定の `accountId` に書き、環境は `--mode staging`／`--mode production` で選ぶ。
  - アプリの秘密情報は事前に一度だけ登録し、配信のたびには渡さない。
  - 「自前のスクリプトを置かない」の対象は、Cloudflare を操作するスクリプト（配信・D1 更新・プレビュー・設定の検証）とする。HTTP で疎通を確かめるスモークテストは残す。

## 前提として確認した事実（2026-10-26）

| 項目 | 事実 | 出典 |
|---|---|---|
| `cf` の状態 | 最新は `1.0.0-beta.21`。ベータで、コマンド・設定・ビルド出力は安定版の前に変わり得る。beta.15〜21 でも互換性を壊す変更が続いている | https://developers.cloudflare.com/cf/ 、`cf` の CHANGELOG |
| Node.js | `^22.23.0 \|\| ^24.22.0 \|\| ^26.12.0`（`engines`）。範囲はとびとびで、奇数版は対象外 | https://unpkg.com/cf@1.0.0-beta.21/package.json |
| ビルドの委譲 | `cf` 自身はバンドラーではない。Vite のアプリは `@cloudflare/vite-plugin@beta`（v2）が必要で、v1 は受け付けない（beta.3）。Vite plugin がないアプリは Wrangler 4.136.0 以上でビルドする。`package.json` の `scripts` は実行しない | https://developers.cloudflare.com/cf/projects/ 、/cf/wrangler/migrate/ 、`cf` の CHANGELOG |
| `cloudflare.config.ts` で書けるもの | Worker、バインディング（`d1`・`kv`・`r2`・`rateLimit`・`durableObject`・`workflow`・`secret`・`sendEmail`・Analytics Engine など）、`triggers`（`fetch`・`scheduled`・`email`）、`domains`、`assets`（`runWorkerFirst` は `boolean` かパスの配列）、`observability`、`exports`、`limits`、`placement`、`previewUrls`、`workersDev` | https://developers.cloudflare.com/cf/projects/cloudflare-config/ |
| 書けないもの | DNS レコード、zone の設定、WAF・Rulesets、通知 | 同上 |
| 環境の切り替え | `defineConfig()` に関数を渡し、`mode` ごとに完全な設定を返す。別の Worker にするには `name` を変える | 同上 |
| `cf migrate` | 変換するもの：バインディング・routes・Cron・環境のブロック。変換しないもの：Durable Object の migrations、Workflow、D1 の migrations の設定、secret、preview 用の ID。変換後は `TODO(@cloudflare)` と先頭の `throw` を解消する必要がある。`wrangler.jsonc` は残るが、`cf` は読まない | https://developers.cloudflare.com/cf/wrangler/migrate/ |
| D1 | `id` で既存の D1 を指す。ID を省くと `cf deploy` が作る場合があり、`--no-provision`（beta.13）で作らせない。マイグレーションは `cf d1 migrations apply <DATABASE_ID> --dir <dir>`（既定はリモート、ID でだけ指定） | `cf` の CHANGELOG |
| secret | `bindings.secret()` で宣言し、値は `cf workers secrets bulk`／`update` か `cf deploy --secrets-file` で登録する。`cf deploy` は既存の secret を保持する（beta.7） | `cf` の CHANGELOG・コマンド一覧 |
| PR プレビュー | `cf previews deploy <name> --mode <mode>`、削除は `cf previews delete <name> --worker <W>`。URL は `<preview-name>-<worker-name>.<subdomain>.workers.dev`。プレビューは本番の設定を引き継がず、secret は Previews 共通の設定（`wrangler preview base-config secret put` かダッシュボード）で登録する。`cf` にこの登録のコマンドはない。上限は Workers Free で1 Worker あたり100件で、超えると古いものから自動で消える | https://developers.cloudflare.com/workers/previews/ |
| 版と配信 | `cf workers versions create`、`cf workers deployments create`（前の版へ戻すのにも使う） | `cf` のコマンド一覧 |
| 通知 | `cf alerting policies create --body @file.json`。命令型で、2回実行すると2つ作られる | `cf` のコマンド一覧 |
| Rulesets | rule 単位の削除 `cf rulesets rules delete` と、入口の確認 `cf rulesets entrypoint get` がある。`cf dns`・`cf rulesets` には `--zone` か `CLOUDFLARE_ZONE_ID` が要る | `cf` のコマンド一覧、/cf/ci/ |
| カスタムドメイン | DNS と証明書を自動で作る。既存の CNAME があるホスト名には作れない（A の扱いは文書にない）。ホスト名の完全一致 | https://developers.cloudflare.com/workers/configuration/routing/custom-domains/ |
| WAF | zone の Free プランでは Free Managed Ruleset が既定で有効。Terraform が指定している `efb7b8c949ac4650a09736fc376e9aee`（Cloudflare Managed Ruleset）と、60秒の回数制限ルールは Free の zone では使えないので、実在しない可能性がある | https://developers.cloudflare.com/waf/get-started/ 、/waf/managed-rules/ 、/waf/rate-limiting-rules/ |
| プラン | zone も Workers も Free（2026-10-26 決定）。Workers Free は全 Worker 合計で1日10万要求、1回の CPU 時間は10ms。D1 は7日分を Time Travel で戻せる | https://developers.cloudflare.com/workers/platform/limits/ 、https://developers.cloudflare.com/d1/reference/time-travel/ |
| CI | `CLOUDFLARE_API_TOKEN` が保存済みのログインより優先。アカウントは `CLOUDFLARE_ACCOUNT_ID` → 設定の `accountId` → 保存済み → 唯一のもの、の順。非対話で破壊的なコマンドは `--force` が要る | https://developers.cloudflare.com/cf/ci/ |
| `cf` でできないこと | live tail（`wrangler tail`）、Previews 共通の secret の登録 | /cf/wrangler/reference/ 、/workers/previews/ |

## 今の構成と移行先

### Terraform が持つ資源（`modules/web-app-edge/main.tf`）

Free の zone では作れない資源があるので、どれも「実在すれば」扱う。

| 資源 | 環境 | 移行先 | 移行の作業 |
|---|---|---|---|
| `www.freeism.app` の A `192.0.2.1`（proxied） | production | `www-redirect` の Worker のカスタムドメイン | 一度だけ消し、`www-redirect` を配信する |
| `www` → `https://freeism.app/` の301（rule の `ref` は `redirect_www_to_portal`） | production | `www-redirect` の Worker のコード | rule だけを一度だけ消す |
| Managed WAF（rule の `ref` は `execute_cloudflare_managed_ruleset`） | production | Free Managed Ruleset（既定で有効） | 実在すれば、rule だけを一度だけ消す。入口の ruleset ごとは消さない |
| Markets の WebSocket の回数制限（rule の `ref` は `markets_websocket_upgrade_by_ip`） | production | Markets の `rateLimit` バインディング | Markets の回数制限が動いてから、実在すれば rule だけを消す |
| 通知3件（障害・edge 5xx・使用量80%） | 両環境 | 既存のまま残す | Terraform をやめても残る。新しい環境用に、本文の JSON を `infra/cloudflare/notifications/` に置き、一度だけ実行する `cf alerting policies create --body @…` を運用の文書に書く |
| Email Routing の設定と宛先 | production／両環境 | 既存のまま残す | 新しい環境用の手順だけを運用の文書に書く |
| Zero Trust Access（staging） | staging | 不要（BASIC 認証に統一済み） | 実在すれば一度だけ消す。`terraform apply` は実行しない |

### Wrangler が持つ資源（5アプリ）

| アプリ | 設定ファイル | 移すもの | 注意 |
|---|---|---|---|
| Points | `cloudflare.config.ts`（Vite plugin v2） | Worker、カスタムドメイン、D1（ID 固定）、`assets`、`observability`、staging の `previewUrls`、secret の宣言 | `OPS_METRICS` は仕様上廃止済みなので移さない |
| Markets | `cloudflare.config.ts`（Vite plugin v2） | 上に加えて、Durable Object（`exports.durableObject`）、Workflow、Cron、`sendEmail`、Analytics Engine（`OPS_METRICS`）、production の `limits` | Workflow は今の名前（`auction-settlement-staging`／`-production`）と `limits.steps: 25000` を変えずに `exports.workflow({ name, limits })` で書く。名前を変えると別の Workflow になる |
| Accounts | `cloudflare.config.ts`（Vite plugin v2） | 上に加えて、`rateLimit`（namespace 1000・1001・1002）、`cache`、`placement`、`exports`、Preview の設定 | 配信用の CI がないので、手順を `cf` に置き換える |
| Main | `wrangler.config.ts`（Wrangler 4.136.0 以上でビルド） | 静的配信と `freeism.app` のカスタムドメイン | `astro build` を先に実行する。`www` は別の Worker（下記） |
| Docs | `wrangler.config.ts`（Wrangler 4.136.0 以上でビルド） | 静的配信とカスタムドメイン | 同上 |

### `www` 転送用の Worker

- `www` の転送は、Main とは別の小さな Worker（`www-redirect`）で行う。
  - 置き場所は `projects/main-web-app/www-redirect/` とし、`cloudflare.config.ts` と入口のコードだけを持つ。静的ファイルは持たない。
  - `domains` は `www.freeism.app` だけ（production の `mode` だけ）とし、全要求に `https://freeism.app/` への301（パスとクエリは捨てる）を返す。
- Main に `www` を足して `runWorkerFirst: true` にすると、Main への全要求で Worker が動き、全 Worker 合計で1日10万要求の無料枠を消費する。別の Worker なら、Worker が動くのは `www` への要求だけで済む。
- Main は今のまま、静的配信と `freeism.app` のカスタムドメインだけを持つ。

## 決めたこと

- **本番の配信**：段階的な配信はしない。staging で確かめた後、本番は `cf deploy` で一度に配信し、配信後の疎通確認で問題があれば前の版へ戻す（2026-10-26 決定）。
  - 今の本番の CI も段階的な配信をしていないので、CI の流れは変わらない。
  - Points 仕様の段階的な配信の箇条（`wrangler versions upload`／`versions deploy`、`Cloudflare-Workers-Version-Overrides` による確認、`wrangler triggers deploy`）を消す。
- **Accounts の回数制限**：WAF の回数制限は使わず、Better Auth の標準の制限と Workers の `rateLimit` に任せる（2026-10-26 決定）。
  - 今ある `URL_VERIFICATION_RATE_LIMITER`（Web 検証、ユーザーIDごとに60秒10回）は残す。
  - 資源 API の一括照会（一覧取得・照合）に、`rateLimit` バインディングを1つ足す。キーは認証済みの呼び出し元の Client ID、上限は60秒60回、namespace は今の 1000〜1002 と重ならない値を環境ごとに決める。超えたら `429` と `Retry-After` を返す。
  - Points は Accounts の `429` を `503 ACCOUNTS_UNAVAILABLE` として扱い、`Retry-After` を写す（Points 仕様のとおり）。
  - Accounts の仕様（506・607〜612行）から、WAF の Rate Limiting と Cloudflare のプランごとの設定の記述を消す。

## 段階と作業

各段階は、前の段階の確認が通ってから進める。DNS・Rulesets・Zero Trust・通知など一度だけの操作は、運営者が `cf auth login` で自分の権限で行う。CI のトークンは、Workers・D1・カスタムドメインの配信に必要な権限だけにする。

### 段階0：準備と技術の確認（Cloudflare への書き込みなし）

- [ ] 版を固定する
  - root の devDependency に `cf@1.0.0-beta.21` を入れる。
  - Points・Markets・Accounts の `@cloudflare/vite-plugin` を v2 beta（`@beta`）へ更新する。
  - Main・Docs の `wrangler` を 4.136.0 以上へ更新する。
  - いずれも、`pnpm-workspace.yaml` の `minimumReleaseAge`（4,320分）を満たすか、例外にするかを決める。
- [ ] Node.js：`.node-version` を `24.22.1` にし、CI は `node-version: latest` をやめて `node-version-file` で読む。
- [ ] 技術の確認（1つでも満たせなければ、そのアプリの移行を止める）
  - Points・Markets が、vite-plus の `vite` の別名と Vite plugin v2 beta で `cf build` できること。
  - `@cloudflare/vitest-plugin`（Points 仕様のとおり `@cloudflare/vitest-pool-workers` から移す）と `createTestHarness()` が、Vite plugin v2 beta と同時に動くこと。`cloudflare.config.ts` を読めない場合は、テスト用に `wrangler.jsonc` を残し、`cf migrate` で作った設定を正本とする。`wrangler.jsonc` を直接読むテスト（Points の `static-routing.worker.test.ts`・`test/e2e/points-markets-contract.spec.ts`、Accounts の `oauth-client-test-helpers.ts`）と、`wrangler.jsonc` を読むソース（Markets・Accounts の `basic-auth-middleware.ts`、Accounts の `public-profile.ts`）の直し方も決める。
  - `cf migrate --dry-run` で、`ratelimits`・`custom_domain`・`previews`・`send_email`・`limits`・Analytics Engine の変換を確かめる。
  - `cf previews deploy points-pr-<N> --mode staging` で、プレビューごとの `APP_ORIGIN` を設定できること（設定の関数で、ビルド時の環境変数 `PR_NUMBER` から組み立てる）。
  - 開発サーバーの D1（Vite plugin v2 の `.cloudflare/state/`）へ、マイグレーションと初期データを入れる方法。`cf` の `--local` は別の保存先を使うため、そのままでは入らない。
  - `cf deploy --no-provision` と `cf previews delete` の非対話での動き（`--help` で確かめる）。
- [ ] CSP の `_headers` の生成を、`vite.config.ts` のプラグイン（ビルドの最後に `_headers` を出力する処理）へ移す。`cf build` だけで出力に入るようにし、`dist/server/wrangler.json` を前提にした今の生成スクリプトと、Markets の `assert-worker-build.mjs` への依存をなくす。
- [ ] 読み取りで、ロールバック用の今の設定を取得する
  - DNS の `www` レコード、`http_request_dynamic_redirect`・`http_request_firewall_managed`・`http_ratelimit` の各入口の ruleset（`cf rulesets entrypoint get <phase>`）、各 Worker のカスタムドメイン、Zero Trust Access の有無。
  - 取得した JSON と、R2 の Terraform の state（`cf r2 objects get`）は、メールアドレスなどを含むので、リポジトリの外（運営者の手元の非公開の保管先）に置く。以後 `terraform apply` は実行しない。
  - Free Managed Ruleset が有効なことを確かめる。

### 段階1：staging への移行（CI も同時に切り替える）

- [ ] 5アプリで `cf migrate --dry-run` を見てから `cf migrate` を実行し、`TODO(@cloudflare)` と先頭の `throw` を解消する。
- [ ] `mode`（`development`・`staging`・`production`）ごとに、Worker 名・ドメイン・D1 の ID・変数を返す設定にする。D1 は今の ID をそのまま書く。
  - `www-redirect` の本番の設定（`www.freeism.app`）は、この段階ではまだ配信しない（段階3の別の変更で配信する）。
- [ ] Markets の Durable Object・Workflow を `exports` に手で書く。今動いているクラスと名前を変えない。
- [ ] secret を `bindings.secret()` で宣言し、staging の値を一度だけ登録する（`cf workers secrets bulk`）。Points・Accounts の Previews 共通の secret も一度だけ登録する（`wrangler preview base-config secret put` かダッシュボード）。
- [ ] `package.json` の `scripts` を `cf` の呼び出しに置き換える。
  - 例：`cf build --mode staging`、`cf d1 migrations apply <ID> --dir drizzle`、`cf deploy --prebuilt --mode staging --no-provision`、`cf workers types`。
  - Main・Docs は `astro build && cf build --mode staging`。
  - Cloudflare を操作する自前スクリプトを削除する：Points の `migrate-d1.ts`・`deploy-generated.ts`・`generated-worker-config.ts`・`preview-generated.ts`、Markets の `migrate-d1.mjs`・`deploy-generated.mjs`・`assert-worker-build.mjs`。スモークテストは残す。
- [ ] CI の YAML を、`scripts` の変更と同じ変更で切り替える。
  - `cloudflare-test.yml`・`cloudflare-production.yml`：`build:assert` などの削除したスクリプトの呼び出しを外し、Terraform のファイル名を含む `paths-ignore` を外す。
  - `points-pr-preview.yml`：`cf previews deploy` にし、PR を閉じたときに `cf previews delete <name> --worker points-worker-staging` を実行する（非対話で中断しないことを確かめる）。プレビューの URL は決まった形なので、`cf` の出力は解析しない。
  - Main・Docs・`www-redirect` の配信も `cf deploy` にする。
  - 秘密は `CLOUDFLARE_API_TOKEN` だけにし、`CLOUDFLARE_ACCOUNT_ID` は設定の `accountId` へ移す。
- [ ] `test/*` で staging へ配信し、各アプリのスモークと Points の E2E を通す。この段階の変更は、段階2が済むまで `main` へマージしない。

### 段階2：edge 設定の置き換え（staging で確かめる）

- [ ] Markets：`rateLimit` バインディング（60秒30回、キーは `CF-Connecting-IP`、namespace はアカウント内で一意な値）を足し、`/api/auctions/*/events` の WebSocket の接続要求で判定して、超えたら429を返す。Markets 仕様の回数制限と「edge の WAF・rate limit は Terraform で管理する」の記述を直す。
- [ ] `www-redirect`：`cloudflare.config.ts` と入口のコードを作り、単体テストで確かめる（本番への配信は段階3）。
- [ ] Accounts：資源 API の一括照会に、Client ID をキーにした `rateLimit` バインディング（60秒60回）を足し、超えたら `429` と `Retry-After` を返す。staging で Points からの照会が上限内に収まることを確かめる。

### 段階3：本番の切り替え（`main` へのマージから始める）

本番の secret を先に一度だけ登録してから、段階1・2の変更を `main` へマージする。マージで本番の CI が `cf deploy --prebuilt --mode production --no-provision` で一度に配信する。

- [ ] 5アプリが今と同じカスタムドメイン・D1・Cron で配信されたことを、段階0の取得結果と比べて確かめる。
- [ ] Markets の回数制限が本番で効くことを確かめてから、`markets_websocket_upgrade_by_ip` の rule が実在すれば、`cf rulesets rules delete` で消す。
- [ ] `www` を切り替える（利用の少ない時間に行う）
  1. `redirect_www_to_portal` の rule と、`www` の A レコードを一度だけ消す。この間、`www` は届かない。
  2. `www-redirect` を本番へ配信する変更をマージし、配信する。
  3. `www` が `https://freeism.app/` へ301で転送されることを確かめる。
- [ ] `execute_cloudflare_managed_ruleset` の rule が実在すれば、Free Managed Ruleset が有効なことを確かめてから消す。
- [ ] Zero Trust Access が実在すれば、一度だけ消す。

**戻し方**

- Worker：`cf workers deployments create` で、前の版を100%にする。
- DNS：段階0で取得した JSON から `cf dns records create --body @…` で戻す。
- Rulesets：段階0で取得した rule を `cf rulesets rules create` で戻す。
- D1：`cf d1 time-travel restore` で、問題が起きる前の時刻へ戻す（Workers Free は7日分）。

### 段階4：Terraform の削除

- [ ] `infra/cloudflare/` の `*.tf`、`.terraform.lock.hcl`、`environments/`、`modules/`、`edge.tftest.hcl`、`scripts/bootstrap-terraform-state.mjs` を削除する。
- [ ] state の R2 バケット `freeism-terraform-state` は、段階0で取り出した state を保管したうえで、運営者が決めた期間の後に一度だけ消す。
- [ ] `wrangler` の依存は、Main・Docs のビルド（4.136.0 以上）、Previews 共通の secret の登録、`wrangler tail`、段階0で必要と分かったテスト用だけに残す。

### 段階5：文書

- [ ] `infra/cloudflare/docs/specification/cf-only-environment.ja.md` を、この計画の構成（設定ファイルと一度だけのコマンド）へ書き直す。`plan`・`apply`・`verify` の要件と自前スクリプトの記述を消す。
- [ ] 運用の文書を作る：新しい環境を作る一度だけのコマンド（D1 の作成、secret と Previews 共通の secret の登録、通知の作成、Email Routing の宛先の検証。`cf dns`・`cf rulesets` には `--zone` が要ること）と、戻し方と、障害時に `wrangler tail` でログを見る手順。
- [x] Points 仕様（2026-10-26に先行して反映。段階0の確認で違いが出たら直す）：デプロイ設定の節の Wrangler・Terraform の記述（`wrangler deploy`・`versions upload`・`wrangler preview`・`wrangler d1 migrations apply`・「Terraform は DNS・WAF・レート制限」・`.wrangler/deploy/config.json`）を `cf` に直し、本番の段階的な配信の箇条を消して `cf deploy` による一度の配信にする。
- [ ] Markets 仕様：WAF・Terraform・`wrangler secret put`・「IaC の分担」の記述を直す。
- [ ] Accounts 仕様と README：WAF の回数制限の記述を、Better Auth の標準の制限と `rateLimit` に任せる形にする（506行は2026-10-26に反映済み。607〜612行は未反映）。README の `wrangler` の手順を `cf` に直す。
- [ ] 旧計画 `2026-09-30-cf-only-environment.ja.md` の冒頭に、この計画に置き換えたことを書く。

## 完了の条件

- リポジトリに Terraform のファイルと、Cloudflare を操作する自前のスクリプトがない。
- 5アプリの staging・production が、各設定ファイルと `cf` のコマンドで配信できる。CI の配信に渡す秘密は `CLOUDFLARE_API_TOKEN` だけ。
- 本番の `www` の301、Free Managed Ruleset、Markets の回数制限、通知、各アプリの疎通を確かめた。
- 既存の D1 の ID とデータ、各 Worker のカスタムドメインが変わっていない。

## 危険と止める条件

| 危険 | 止める条件・対策 |
|---|---|
| `cf` と Vite plugin v2 がベータで、版の更新で動きが変わる | 版を固定し、更新は staging で確かめてから行う |
| テスト基盤が v2 beta や `cloudflare.config.ts` に対応していない | 段階0で確かめる。対応していなければ、そのアプリの移行を止める |
| `www` の切り替えの間、`www` が届かない | 利用の少ない時間に行い、失敗したら段階0の取得結果から A レコードと rule を戻す |
| カスタムドメインが残った A レコードと衝突する、外したドメインが消えない | 段階3の手順で A レコードを先に消す。予定と違えば戻す |
| Durable Object の変更は元に戻せない | Markets の `exports` は、今動いているクラスと名前を変えない。staging で確かめてから本番へ配信する |
| D1 を誤って新しく作る | `cf deploy` に `--no-provision` を付ける（フラグの有無は段階0で `cf deploy --help` で確かめる）。D1 の `id` を設定に書けば、作られない |
| 本番の CI が `main` へのマージで自動配信する | 段階1・2の変更は、本番の secret を登録し、段階3の準備が済むまで `main` へマージしない |
