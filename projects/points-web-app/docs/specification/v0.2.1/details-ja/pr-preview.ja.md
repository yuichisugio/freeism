# Points PR Version URL と OAuth

Points v0.2.1 のレビュー環境は、staging の Worker `points-worker-staging` に PR ごとの Version URL を割り当てる。実装は `wrangler.jsonc`、`.github/workflows/points-pr-preview.yml` と Points の設定検査・smoke script に置く。

## 目的と担当（5W1H）

| 観点       | 仕様                                                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 誰が       | 同一リポジトリの PR 更新を GitHub Actions が配信し、レビュアーが URL で確認する。staging の設定・migration は運営者が管理する。    |
| いつ       | PR の作成・更新・再開時に同じ alias へ新しい version を upload する。PR を閉じた後も URL は残る。                                  |
| どこへ     | staging 本体と同じ `points-worker-staging` の `workers.dev` Version URL に配信する。D1 と外部接続先は staging のものを使う。       |
| 何を・なぜ | PR ごとに確認できる URL を設け、固定した staging OAuth callback と共有データを使って認証を含む変更を確認する。                     |
| どのように | `wrangler versions upload --preview-alias points-pr-<PR番号>` を使い、生成される URL とアプリの build・runtime origin を合わせる。 |

## URL、Worker と資源

- alias は `points-pr-<PR番号>`、URL は `https://points-pr-<PR番号>-points-worker-staging.<workers.dev subdomain>.workers.dev` とする。2026-10-01 に Cloudflare アカウントの subdomain は `kyogoku` と読み取り確認済みで、想定 URL は `https://points-pr-<PR番号>-points-worker-staging.kyogoku.workers.dev`。初回 upload 時に Wrangler の実際の URL と照合する。
- staging Worker で `preview_urls: true` を有効にする。PR 更新時は同じ alias に version を upload し、URL を PR コメントと job summary に表示する。Version URL は alias の現在の version を参照し、PR close 後も参照できる。終了画面や close 時の削除処理は設けない。
- Version URL の version は staging Worker の D1 binding と通常の staging 変数を継承する。Secret は同じ Worker で**直前に upload された version の Secret**を upload 時に継承する。稼働中の staging version の Secret を実行時に参照する構成ではない。`DB` は staging D1 を共有するため、PR 間と staging 本体のデータは共通である。production D1 と production の認証情報は分離する。
- CI は build 時の CSP 用 host と、runtime の `APP_ORIGIN`・`APP_HOST` だけを PR URL に合わせる。その他の staging 変数、D1 binding、既存の Worker Secret は保持する。Secret は upload 時点の version に取り込まれるため、Secret 変更後は対象 PR の version を再 upload する。
- Cron Trigger は staging 本体へデプロイした version で実行する。PR Version URL の受入では staging 本体の cron 動作を別に確認する。

## OAuth と利用者連携

- staging 本体に OAuth Proxy と Accounts Generic OAuth 対応コードを先にデプロイする。staging と PR URL の `OAUTH_PROXY_PRODUCTION_URL` は `https://staging.points.freeism.app` とし、Proxy は固定 callback から開始元の PR URL へ戻す。production の値は production 自身の URL とする。`PREVIEW_WORKERS_SUBDOMAIN` は確認済みの `kyogoku` に合わせ、`trustedOrigins` は `points-pr-*-points-worker-staging.kyogoku.workers.dev` のホスト形式と必要な origin に限定する。subdomain 変更時は staging の許可設定と CI の URL 設定を一緒に変更する。
- Google と GitHub の OAuth アプリへ、`https://staging.points.freeism.app/api/auth/callback/google` と `https://staging.points.freeism.app/api/auth/callback/github` をそれぞれ一度登録する。
- Accounts は接続先 client ごとに、Points 管理画面の `listAccountsConnections` が表示する `registration.redirectUri` を一度登録する。staging と PR URL では `https://staging.points.freeism.app/api/auth/callback/accounts-<connectionId>` に固定する。
- staging と PR URL は同じ Worker の `BETTER_AUTH_SECRETS`、`ACCOUNTS_KEY_ENCRYPTION_KEY`、Google・GitHub 資格情報を共有する。production の D1 と鍵は別に管理する。staging Worker に既存登録した Secret の名前・値は remote で未確認であり、実値を文書・ログへ記載しない。
- Accounts はログイン済み Points 本人が明示的に連携する。`POST /api/accounts-links/attempts` が Better Auth `linkSocial` を開始し、固定 callback と Proxy を経て `GET /api/accounts-links/finish?ticket=...` で元の Points session と ticket を照合し、`accounts_links` と snapshot を更新する。複数の Accounts 接続先と既存の接続先管理を維持する。通常の Accounts sign-in は拒否する。
- Accounts ユーザーは接続先 origin と ID Token の `sub` の組で区別する。Better Auth 内部に必要な email はその組から決定的に生成し、Accounts の実 email は本人識別に使わない。`allowDifferentEmails: true`、`disableImplicitLinking: true`、`updateUserInfoOnLink: false` を維持し、email 一致による暗黙の統合やプロフィール上書きを行わない。Accounts が公開する email の仕様は変えない。
- Accounts 認可コードの token 交換は `private_key_jwt` と DPoP proof、nonce 再試行を使い、ID Token の署名・issuer・audience・nonce を検証する。資源 API の Client Credentials + DPoP は維持する。詳しい本人照合と失敗表示は[Accounts との情報連携](combined-design.ja.md#3-accountsとの情報連携)を参照する。

## 初回設定と PR の更新

1. 運営者は staging D1 の必要な migration を staging デプロイ workflow で適用し、OAuth Proxy・Accounts Generic OAuth・`preview_urls: true` に対応した staging Worker を先にデプロイする。Google・GitHub と各 Accounts client の固定 callback を登録し、staging の OAuth 往復を確認する。
2. GitHub Actions は既存 Environment `web-app-staging` の `CLOUDFLARE_ACCOUNT_ID` と `CLOUDFLARE_API_TOKEN` を使う。token には対象 Worker の version upload に必要な権限を与える。同一リポジトリの PR のみを対象にし、fork PR に資格情報を渡さない。
3. PR の `opened`、`synchronize`、`reopened` で `vp check --no-fmt`、コード・設定範囲の `vp fmt --check`、unit・Worker test と staging を基にした PR URL 用 build を行い、同じ staging Worker へ version を upload する。`PREVIEW_WORKERS_SUBDOMAIN` は生成設定から読み取り、CSP の build host を PR URL に合わせる。upload は生成設定と runtime の `APP_HOST`・`APP_ORIGIN` を指定する。

   ```sh
   cd projects/points-web-app
   CLOUDFLARE_ENV=staging pnpm exec vp build
   preview_subdomain="$(jq -er '.vars.PREVIEW_WORKERS_SUBDOMAIN' dist/server/wrangler.json)"
   pnpm exec tsx scripts/preview-generated.ts "$preview_subdomain"
   preview_host="points-pr-${PR_NUMBER}-points-worker-staging.${preview_subdomain}.workers.dev"
   preview_origin="https://${preview_host}"
   APP_HOST="$preview_host" APP_ORIGIN="$preview_origin" pnpm exec tsx scripts/generate-static-security-headers.ts . preview "$preview_host"
   pnpm exec wrangler versions upload --config dist/server/wrangler.json --preview-alias "points-pr-${PR_NUMBER}" --var "APP_HOST:${preview_host}" --var "APP_ORIGIN:${preview_origin}"
   ```

   `PR_NUMBER` は対象 PR 番号、Cloudflare 資格情報は GitHub Environment から渡す。build 時だけ必要な値は workflow の build 専用値を使う。upload は新 version を作り、staging 本体の稼働 version は切り替えない。

4. upload 後に同じ alias の URL を smoke し、PR コメントと job summary に表示する。PR を閉じた後も URL と共有 D1 のデータは残る。

## staging D1 と受入確認

- PR の CI は migration を実行しない。共有 staging D1 の migration は `.github/workflows/cloudflare-test.yml` の `pnpm --filter @freeism/points-web-app db:migrate:staging` で一元適用し、staging 本体をデプロイする。schema 変更 PR では対応 migration が適用されるまで Version URL の DB 操作が失敗し得る。適用時は staging 本体と他の PR URL への影響を確認し、必要な PR version を再 upload する。
- CI smoke は匿名リクエストで HTML/navigation の Basic 認証 `401` challenge、公開 JSON API の `200`、認証必須 API の `401` / `403` を検査する。実 URL の受入では、資格情報付きの HTML と参照 JS・CSS asset の配信、Cookie、Google・GitHub のログインと明示連携、Accounts の本人による明示連携と `accounts_links`・snapshot 更新を確認する。staging 固定 callback から元の PR URL と同じ Points ユーザーに戻ることも確認する。
- 2026-10-01 時点で subdomain `kyogoku` は読み取り確認済み。Version URL の実 upload、共有 D1 migration、GitHub Actions 実行、Google・GitHub・Accounts の実 OAuth 往復、資格情報付き HTML・asset の実 URL 検査は未実施であり、実機受入は未完了。

参考: [Cloudflare Workers Version URLs](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/)、[Wrangler versions upload](https://developers.cloudflare.com/workers/wrangler/commands/workers/)。
