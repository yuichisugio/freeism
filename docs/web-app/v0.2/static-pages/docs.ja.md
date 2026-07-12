# ドキュメント

このページはFreeism Web App v0.2の固定ドキュメント入口です。

## 共通仕様

- アーキテクチャ: `docs/web-app/v0.2/architecture.md`
- 認証・外部ID: `docs/web-app/v0.2/authentication.md`
- Points–Markets契約: `docs/web-app/v0.2/points-markets-contract.md`
- セキュリティとデリバリー: `docs/web-app/v0.2/security-and-delivery.md`
- 設計判断台帳: `docs/web-app/v0.2/decision-register.md`

## アプリ別仕様

- Points: `projects/points-web-app/docs/v0.2/index.ja.md`
- Markets: `projects/markets-web-app/docs/v0.2/index.ja.md`

公開ページにはrepository pathをそのまま操作する機能を置かず、build時に上記Markdownから固定navigationと要約を生成します。認証済みデータやruntime server functionは使用しません。
