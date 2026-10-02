# Points PR Version URL と OAuth の実装・検証計画

作成日: 2026-10-01。仕様正本は [PR Version URL と OAuth](../specification/v0.2.1/details-ja/pr-preview.ja.md)。この文書には作業順、進捗、検証結果、未受入事項を記録する。

## 作業順と進捗

- [x] **Accounts 認証経路のローカル実装**: Generic OAuth + OAuth Proxy、既存 `oauth4webapi` による ID Token / nonce / PKCE / DPoP 検証、元の Points 本人と session の照合、`accounts_links` への確定、Accounts 通常 sign-in の拒否を実装した。実 Hono / auth factory を使うローカルテストで正常・拒否経路を確認した。
- [x] **Google/GitHub Proxy のローカル実装**: sign-in と明示 link を実 Hono / auth factory のローカルテストで確認した。
- [x] **Version URL 配信コードのローカル検証**: PR 番号ごとの alias、同じ staging Worker への `wrangler versions upload`、生成設定と build / runtime host、PR workflow、smoke の契約テストと build を確認した。実 upload は受入項目として残す。
- [ ] **staging の先行準備**: staging D1 の `0026` migration を適用し、OAuth Proxy・Accounts Generic OAuth・`preview_urls: true` を含む staging Worker を通常デプロイする。staging Worker の Secret 名の存在と OAuth 実動作による整合、および固定 Google/GitHub callback と接続先 Accounts client の callback 登録を実環境で確認する。
- [ ] **実 PR の配信受入**: 同一リポジトリ PR の GitHub Actions で upload、URL コメントと job summary、匿名・資格情報付き HTML / asset / API smoke、同じ alias での更新、PR close 後の URL の状態を実測する。
- [ ] **OAuth と共有データの実機受入**: Version URL → staging 固定 callback → 元の Version URL への Google/GitHub sign-in・link と Accounts 本人連携を、実 Provider と実 staging D1 で確認する。`accounts_links`、snapshot、既存 Client Credentials 経路、Points 自身の OAuth Provider の委任と Refresh Token の回帰を確認する。
- [x] **文書と差分の最終照合**: 仕様正本、PR workflow、staging 運用手順、実コードの記述を照合した。生成 staging 設定の D1 と変数を確認し、production D1・鍵・callback を PR 配信設定へ含めていないことをローカルでレビューした。

## 技術成立確認の記録

Better Auth 1.7.6 の OAuth Proxy は固定 callback 側の `getUserInfo` に `expectedIdTokenNonce` を渡さない。Accounts の移行では保存した nonce と PKCE verifier を別途照合し、ID Token の署名・issuer・audience・nonce を検証する実装を採った。ローカルの実 Hono / auth factory テストでは、通常 staging と Preview 相当の戻り、別 session、不正 nonce・issuer、同じ `sub` の別 origin、再連携を確認した。実 Accounts サービスとの往復は未確認。

Accounts の一時 core account 行は正常 callback の after hook で即時削除し、検証済み `sub` を単回 ticket に保存する。finish で元の Points user / session を照合して `accounts_links` に確定する。domain 保存に失敗した場合は再連携を開始する。正常経路の削除はローカルで確認した。

## 検証ログ

| 対象                        | 結果                                                   | 範囲                                                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 単体テスト                  | 46ファイル295件成功                                    | Version URL 切替後の全体実行。旧方式の配信テスト削除後の件数。                                                                                                                                                             |
| Worker テスト               | 36ファイル235件成功                                    | Version URL 切替前の全体実行。今回の変更は配信設定に限られるため、この認証・ドメイン検証結果を再利用する。切替固有の配信契約は別行で確認する。                                                                             |
| OAuth 結合テスト            | Accounts 7件、Google/GitHub 4件成功                    | 実 Hono / auth factory とローカル Provider。実外部 Provider と Cloudflare 配信は含まない。                                                                                                                                 |
| Version URL 契約テスト      | Preview 契約2件と staging smoke を含む6件成功          | upload / smoke のローカル契約検証。実 upload は含まない。                                                                                                                                                                  |
| ビルド                      | staging build 成功、5ページ生成                        | Version URL 切替後。生成設定は staging vars、`preview_urls: true`、`workers_dev: false`、staging D1、assets、required Secret 8名を保持。`preview-generated` は `kyogoku` で成功し、CSP host も一致。実 upload は含まない。 |
| 静的検査                    | `check --no-fmt`: 314ファイル、error 0件、warning 20件 | Version URL 切替後の確認。対象 workflow を含む format 範囲318ファイルは成功。全体 `check` は旧仕様文書4件と並行編集中の統合仕様1件の format 指摘で未通過。                                                                 |
| Cloudflare 読み取り専用確認 | account subdomain `kyogoku`                            | Version URL の実 upload、親 staging Worker の Secret 名の存在、実 callback は未確認。                                                                                                                                      |

## 未受入とレビュー記録

- Version URL の upload は staging 親 Worker の `preview_urls: true` や OAuth Proxy の先行配信を行わない。通常の staging deploy と D1 migration は未実施であり、実 URL と OAuth 往復を受け入れる前に必要。
- 親 staging Worker の Secret 名の読み取りは、この非対話環境で Cloudflare 認証資格情報がなく実行できなかった。値は読み取らず、実 OAuth 往復で整合を確認する。Secret を変更した場合は対象 PR の version を再 upload して反映を確認する。
- 一時 core account 行の INSERT と after hook 削除の間に Worker が停止した場合の残存は理論上の懸念で、到達証拠はない。追加の掃除処理は今回設けない。認可・ID Token 検証失敗は一般的な失敗表示とし、同意拒否の UI 表示は復元済み。
- 実 Cloudflare 配信、GitHub Actions の実行、資格情報付き HTML / asset 取得、Google/GitHub/Accounts の実 OAuth、共有 staging D1 の migration は未確認。これらの証拠が揃うまで受入完了としない。
