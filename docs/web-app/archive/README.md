# Webアプリ旧資料archive

このディレクトリは、旧 `projects/web-app` の仕様、実装観測、検討過程を情報欠落なく保存するためのarchiveです。

## 重要

archive内の資料は、すべて**非正規**です。現行実装の要件、採用技術、認証方式、データモデル、デプロイ方式の判断根拠には使用しません。

旧資料には、Next.js、Prisma、Supabase、Vercel、SSE、Upstash Redis、Task、グループ、通知、画像アップロードなど、v0.2で撤回または置換された記述が含まれます。内容を再採用する場合は、現行の横断仕様と各appの仕様へ改めて明記してください。

## 保管内容

### 旧README

- [旧WebアプリREADME](./readme/README.ja.md)

### v0.1共通・旧モノリス資料

- [旧v0.1索引](./v0.1/index.ja.md)
- [概要](./v0.1/details/overview.md)
- [アーキテクチャ](./v0.1/details/architecture.md)
- [認証](./v0.1/details/auth.md)
- [データモデル](./v0.1/details/data-model.md)
- [エラーハンドリング](./v0.1/details/response.md)
- [通知](./v0.1/details/notification.md)
- [その他の旧要件](./v0.1/details/other.md)

v0.1のドメイン固有資料は、[Pointsのv0.1索引](../../../projects/points-web-app/docs/v0.1/index.ja.md)と[Marketsのv0.1索引](../../../projects/markets-web-app/docs/v0.1/index.ja.md)から参照できます。

### 旧v0.2統合案・検討メモ

- [旧統合設計](./v0.2/combined-design.ja.md)
- [旧キャッシュ設計](./v0.2/cache.md)
- [旧検討メモ](./v0.2/consideration-notes.md)

旧統合設計と旧検討メモは、採用済み事項と撤回済み事項が混在した原資料です。現行の正本は、[Webアプリ横断ドキュメント](../README.md)から参照してください。

## 旧リンクについて

archiveは原文保存を優先しているため、本文中の相対リンクや `projects/web-app/...` の実装パスが旧配置を指す場合があります。現在の移動先は[移設manifest](../doc-migration-manifest.md)で確認してください。
