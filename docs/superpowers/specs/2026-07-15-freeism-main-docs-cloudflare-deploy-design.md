# Freeism portal / docs Cloudflare deployment design

## Goal

`projects/main-web-app` と `projects/docs-web-app` を Cloudflare Workers Static Assets へ配備し、test と production の両環境を公開する。ローカルの初回デプロイだけで終わらせず、GitHub Actions から同じbuild、検証、deploy、smoke testを再実行できる状態にする。

## Current state

- PR #2 は `main` へmerge済みで、両Astroサイトの実装は利用可能である。
- Cloudflare Pages projectは存在せず、静的サイト用Workerも未作成である。
- `freeism.app` は現在Cloudflare上で自己redirect loopを返す。
- `www.freeism.app` はVercel CNAMEを参照する。
- `docs.freeism.app`、`staging.freeism.app`、`staging.docs.freeism.app` は未作成である。
- GitHub Environmentは`web-app-production`だけが存在し、`web-app-staging`とCloudflare Actions secretsは未作成である。

## Chosen architecture

Cloudflare Workers Static Assetsを使い、サイトと環境ごとに独立したWorkerを持つ。

| Project | Environment | Worker | Custom domain |
| --- | --- | --- | --- |
| `projects/main-web-app` | staging | `main-web-app-staging` | `staging.freeism.app` |
| `projects/main-web-app` | production | `main-web-app-production` | `freeism.app` |
| `projects/docs-web-app` | staging | `docs-web-app-staging` | `staging.docs.freeism.app` |
| `projects/docs-web-app` | production | `docs-web-app-production` | `docs.freeism.app` |

各`wrangler.jsonc`は次を満たす。

- `assets.directory`はAstro／Blumeの`./dist`を指す。
- 静的サイト専用のためWorker entry scriptは持たない。
- `workers_dev`と`preview_urls`を無効にし、意図したcustom domainだけで公開する。
- missing assetは`404-page`として扱い、SPA fallbackで存在しないドキュメントを200にしない。
- HTML URLは`auto-trailing-slash`で既存Astro routeとcanonical URLを維持する。
- `staging`と`production`のWorker名、routeをnamed environmentへ明示する。
- Wranglerはmonorepoですでに検証済みのexact versionを両packageから直接利用する。

Cloudflare PagesとWorkers Builds Git連携は採用しない。既存のPoints／Marketsと同じWrangler、GitHub Environment、GitHub Actionsの運用境界を再利用し、deploy経路を一つに保つためである。

## DNS and first deployment

初回公開は次の順序を固定する。

1. staging 2 Workerをdeployし、`staging.freeism.app`と`staging.docs.freeism.app`を接続する。
2. stagingでHTTP status、主要コンテンツ、canonical URL、主要リンクを確認する。
3. production 2 Workerへassetsをuploadする。
4. apexからPointsへの旧redirect ruleと自己redirectを解除する。
5. `www.freeism.app`のVercel CNAMEを撤去し、`https://freeism.app/`へのpermanent redirectへ切り替える。
6. `freeism.app`と`docs.freeism.app`をproduction Workerのcustom domainへ接続する。
7. production smoke testとブラウザ確認を行う。

Worker custom domainが所有するDNS recordと、Terraformが所有するPoints／Markets用edge resourceを混在させない。既存Terraformのapex／www redirect定義はDEC-269へ合わせて更新し、将来applyしたときに旧Points redirectが復活しないようにする。初回cutoverでTerraform stateを安全に利用できない場合でも、review済みのWrangler／Cloudflare API操作だけを使い、Points／MarketsのWorker、D1、routeは変更しない。

stagingは公開情報だけを配る静的サイトなので、今回Cloudflare Access保護は追加しない。認証情報、個人情報、非公開データは配置しない。

## CI/CD

既存workflowへ無関係なPoints／Markets deployを追加発火させないため、portal/docs専用workflowを作る。

- `test/*`へのpush: stagingをbuild、test、deploy、smoke testする。
- `main`へのpush: productionをbuild、test、deploy、smoke testする。
- `paths`でmain/docsのsource、package manifest、lockfile、workflow、Wrangler設定に限定する。
- `permissions`は`contents: read`だけにする。
- stagingとproductionで別concurrency groupを使い、同じ環境へのdeployを直列化する。
- GitHub Environmentは`web-app-staging`と`web-app-production`を使う。
- `CLOUDFLARE_ACCOUNT_ID`と`CLOUDFLARE_API_TOKEN`はEnvironment secretsから読む。
- API tokenは対象accountと`freeism.app` zoneへ限定し、Worker deployに必要な権限だけを持つ。ローカルWrangler OAuth tokenはGitHubへ保存しない。
- GitHub Actionsは既存repoと同じpinned checkout、pnpm setup、Node setup actionを使い、`pnpm install --frozen-lockfile`を実行する。

production workflowは`main` push以外では起動しない。pull requestではdeployせず、package test、check、buildとworkflow contract testだけを実行する。

## Validation and smoke tests

実装時に次を自動検証する。

- 両`wrangler.jsonc`のWorker名、environment、custom domain、assets設定がexactである。
- mainサイトの既存5テスト、docsサイトの既存11テストが成功する。
- 両サイトのcheckとproduction buildが成功する。
- docs canonical 6ファイルのSHA-256が`main`で移動された原文と一致し、本文を変更していない。
- GitHub Actionsがstaging／production secretを交差参照しない。
- `test/*`と`main`のtrigger、paths、concurrencyが意図どおりである。
- deploy後の各URLが2xxを返し、期待するtitle／主要見出しを含む。
- docsの`/`、`/en/`、`/notes/`、`/en/notes/`と404 routeを確認する。
- portalからDocs、Points、MarketsへのHTTPSリンクを確認する。

ブラウザ確認では、desktop/mobile表示、JavaScript error、broken asset、リンク遷移、docs検索を確認する。

## Failure handling and rollback

- staging検証が失敗した場合、production cutoverを行わない。
- production asset deploy後、custom domain接続前に失敗した場合、公開trafficは変更しない。
- custom domain接続後に失敗した場合、直前のWorker versionへrollbackする。
- domainまたは証明書の問題ではcustom domainを外し、apex／wwwの直前routeを復元する。
- docs障害はdocs domainだけをrollbackし、portal、Points、Marketsへ波及させない。
- rollback後も失敗URL、deployment/version ID、時刻、復旧操作だけを記録し、tokenやsecret値は保存しない。

## Scope

この変更に含めるもの:

- main/docs packageのWrangler設定とdeploy/smoke scripts
- package test、workflow contract test
- portal/docs専用GitHub Actions
- DEC-269に沿ったapex／www Terraform定義と運用文書
- staging／productionの初回Worker deploy、custom domain、DNS cutover
- GitHub EnvironmentとCloudflare deploy secretsの設定

この変更に含めないもの:

- canonical documentation本文の変更
- Points／Marketsのapplication、database、Worker deploy
- Vercel project自体の削除
- Cloudflare Access、WAF、D1、KV、R2など静的配信に不要なresource
