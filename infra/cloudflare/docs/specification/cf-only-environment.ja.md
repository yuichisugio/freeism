# Cloudflare 環境の cf CLI 再現仕様

更新日: 2026-09-30
状態: 実装前

## 目的と境界

Cloudflare の権限を持つ担当者が、このリポジトリと環境別の入力値を使い、`cf` CLI を実行するコマンド群で staging／production の同等構成を作成・検証できるようにする。
Cloudflare API の操作は、バージョンを固定した `cf` を経由する。
`cloudflare.config.ts` は各 Worker とその binding・domain・trigger を表し、DNS、Rulesets、Zero Trust Access、通知、Email Routing は `cf` の API コマンドへ渡すリポジトリ管理の設定と再現スクリプトで表す。

初期対象は既存の Cloudflare アカウントと `freeism.app` zone の採用・再現である。
別アカウントに同じドメインを移す場合は、対象アカウント・zone の権限、レジストラ側の委任、および外部サービスの設定を別途準備する。
既存 D1／Durable Object／Workflow の運用データの複製は構成再現と分けて扱う。

## 入力とコマンド契約

- 公開設定: `staging`／`production`、Worker 名・domain、静的な edge ルール、D1 名、Access 対象 host。
- 実行時入力: `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_ZONE_ID`、権限を限定した `CLOUDFLARE_API_TOKEN`、JSON 配列形式の `FREEISM_ACCESS_ALLOWED_EMAILS`、`FREEISM_OPS_ALERT_EMAIL`。
- Worker deploy 時の `FREEISM_SECRETS_FILE` は担当アプリ・環境の Secret ファイルへの絶対パスとし、共有ストレージや Secret manager から実行直前に用意する。
- 秘密値: Worker ごと・環境ごとに安全な保管元から供給する JSON または `.env` ファイル。ファイルの内容をログや Git に含めない。
- 操作: 読み取り専用の `plan`、構成を収束する `apply`、API read-back による `verify`、アプリ別の D1 migration と Worker deploy を公開する。
- `plan` は現状を `cf` の list/get で取得して差分を表示する。`cf --dry-run` の HTTP リクエスト表示を現状との差分判定には使わない。
- 同じ入力で二度目に `apply` すると変更が発生しない。名前・scope が重複する、対象 account／zone が一致しない、読み取り権限が足りない場合は書き込み前に停止する。
- 対象外リソースを変更・削除しない。適用前の対象設定と ID を記録し、適用後は再取得して比較する。

## 構成の期待値

| 対象 | staging | production |
| --- | --- | --- |
| Worker | Main、Docs、Points、Markets、Accounts の staging 設定 | 同じ 5 アプリの production 設定 |
| D1 | Points、Markets、Accounts の環境別 DB | Points、Markets、Accounts の環境別 DB |
| Access | `staging.points.freeism.app` と `staging.markets.freeism.app` に 8 時間の self-hosted app。許可メールの再利用可能 policy、binding cookie、HttpOnly、SameSite strict。 | 対象なし |
| DNS | zone 共通設定を所有しない | `www.freeism.app` の proxied A、`192.0.2.1`、自動 TTL |
| Rulesets | zone 共通設定を所有しない | `www.freeism.app` から `https://freeism.app/` への 301（元 path/query を破棄）、Cloudflare Managed Ruleset `efb7b8c949ac4650a09736fc376e9aee` の実行、Markets WebSocket upgrade の IP・colo 単位 30 回／60 秒制限と 429 応答 |
| 通知 | Workers 障害、zone の edge 5xx、Workers 使用量 80% の 3 policy | 同じ 3 policy |
| メール | 検証済み運用宛先 | 検証済み運用宛先と Email Routing の zone 設定 |

この表の固定値は `infra/cloudflare/modules/web-app-edge/main.tf` と `edge.tftest.hcl` の現行契約に対応する。
現行 HCL は Email Routing の有効状態を明示していないため、移行前に `cf email-routing settings get` の結果を記録し、期待状態との差を確認する。
apex の DNS は独立した edge レコードとして扱わず、Worker custom domain の公開経路で管理する。
既存 zone phase ruleset を更新するときは、対象外の rule を保持する。

## 配信順序と安全条件

1. 対象 account／zone、既存リソースの ID と設定、Terraform state の保全状態を読み取り専用で確認する。
2. staging Access と共通通知の設定を採用・検証する。
3. 新規 D1 は名前で先に作成・解決し、UUID を取得して migration を適用してから Worker を公開する。既存 D1 は同じ DB を採用する。
4. 5 アプリの build と設定同等性を検証し、staging の実デプロイ・smoke を完了する。
5. production は承認付きで Worker と zone 共通設定を順序付けて適用し、HTTP・Access・D1・通知の read-back と実経路を検証する。
6. 再実行が無変更であり、CI と運用手順が `cf` 経由で成立してから Terraform 管理を終了する。既存の state とバックアップは復旧証跡として保全する。

Points／Markets の production D1 migration 前に、現在の Time Travel bookmark、未適用 migration、SQL SHA-256 の証跡を引き継ぐ。
Accounts の Preview、Markets の Durable Object／Workflow は個別の動作ゲートを通す。
Markets の Workflow binding と Main／Docs のビルド経路で同等性を確認できなければ、そのアプリの切り替えを停止し、既存の配信経路を保持する。

## 完了条件

- 5 アプリの staging／production 設定と build 出力が現行契約を満たし、直接実行するデプロイ・型生成・D1 操作コマンドが `cf` に統一されている。
- staging と production で `plan` → `apply` → `verify` が成功し、二度目の `plan` と `apply` は差分・変更がゼロである。
- staging Access は許可／拒否を実際の経路で確認する。production の `www` 301、WAF、レート制限、通知、各アプリの health／smoke を確認する。
- Secrets の値は外部から供給し、既存 D1 のデータと ID を保ち、新規環境では migration 済み DB が Worker 公開前に存在する。
- 変更前の Cloudflare 設定と Terraform state の復旧用 snapshot、実行ログ、read-back 結果を残す。

## 参照

- `cf@1.0.0-beta.5` の Worker provisioning: https://github.com/cloudflare/cf/blob/69dd4d691a632df125973f9e7146cd6017f3d3aa/packages/cli/src/lib/deploy-input.ts#L65-L93
- `cloudflare.config.ts` の設定型: https://github.com/cloudflare/workers-sdk/blob/d866c0922b8973b38aac0eddf1fdd86a3ac0c7bd/packages/config/src/types.ts#L66-L86
- `cf` の JSON ファイル入力: https://github.com/cloudflare/cf/blob/69dd4d691a632df125973f9e7146cd6017f3d3aa/packages/cli/src/lib/body-parser.ts#L73-L117
- Email Routing 宛先の検証: https://developers.cloudflare.com/email-service/configuration/email-routing-addresses/
