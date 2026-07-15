# Freeism メインサイト・ドキュメントサイト設計

## 目的

- `https://freeism.app/` を無料主義全体の入口にし、思想・仕組みの概要を伝えたうえで、ドキュメント、ポイント管理、マーケットの各独立サイトへ案内する。
- 既存の `projects/documentation` を `projects/docs-web-app` へ移し、`https://docs.freeism.app/` で公開できる Blume（Astro製）ドキュメントサイトにする。
- `points.freeism.app` と `markets.freeism.app` の独立した責務は変更しない。

## 採用方針

### 検討したアプローチ

1. **メインサイトをAstro、ドキュメントサイトをBlumeで構築する（採用）**
   - メインサイトは素のAstro、ドキュメントサイトはAstro製のBlumeとする。
   - 静的HTML中心で、認証・API・Cookieを持たない入口として境界が明確になる。
   - 2サイトでビルド基盤を共有できるが、デプロイ成果物と公開ドメインは分離する。
2. **メインサイトだけ既存 Next.js に追加する**
   - 旧 `projects/web-app` と今回の入口が混ざり、廃止予定の実装・Vercel設定へ依存するため不採用。
3. **巨大な日英Markdownを最初から章別に分割する**
   - サイドバーは読みやすくなる一方、既存の155件前後のページ内アンカー、重複見出し、言語リンクを大量に変更するため、初回移行では不採用。

## プロジェクト境界

| プロジェクト | 公開URL | 責務 |
| --- | --- | --- |
| `projects/main-web-app` | `https://freeism.app/` | 無料主義の概要と関連サイトへの案内 |
| `projects/docs-web-app` | `https://docs.freeism.app/` | 無料主義v3の日英仕様書、ノート、全文検索 |
| `projects/points-web-app` | `https://points.freeism.app/` | 評価軸、ポイント付与、残高管理 |
| `projects/markets-web-app` | `https://markets.freeism.app/` | 商材情報を含むAuction |

メインサイトとドキュメントサイトは認証、Cookie、API、runtimeデータを共有しない。相互連携は通常のHTTPSリンクだけとする。

## メインサイト

### ページの役割

初見の利用者が「無料主義とは何か」と「どこから詳しく読めるか」を短時間で理解する1ページのポータルにする。

### 情報構成

1. ヘッダー：Freeism、ドキュメント、Points、Markets。
2. ヒーロー：「価値を受け取る人ではなく、価値を生み出した貢献へ報いる仕組み」という入口の説明。
3. 3つの役割：供給者、評価者、需要者。
4. 3つの入口：Docs、Points、Markets。各サービスの責務を一文で明示する。
5. 目標：「この世の全ての人が満足度の高い人生を送れる社会」。
6. フッター：各サイトへのリンクとGitHubリポジトリへのリンク。

### 視覚設計

- **主題**：無料主義を初めて知る人に、思想と実装が分離された「公共インフラの案内図」として見せる。
- **色**：既存の主色 `#4880FF` を `Freeism Blue` とし、`Deep Ink #10233F`、`Signal Cyan #4ED7E8`、`Proof Lime #BDEB7A`、`Cloud #F5F8FC`、`White #FFFFFF` を使う。
- **書体**：見出しは日本語セリフ体（`Yu Mincho` / `Hiragino Mincho ProN`）、本文とUIは可読性の高い日本語ゴシック体（`BIZ UDPGothic` / `Hiragino Kaku Gothic ProN`）。外部font取得に依存しない。
- **レイアウト**：中央のFreeismを起点にDocs／Points／Marketsへ線が伸びる「関連プロジェクト軌道図」を署名要素にする。カードを並べるだけの構成にはしない。
- **動き**：初回表示時に軌道線と3入口を1回だけ段階表示する。`prefers-reduced-motion` では動きを無効にする。
- **品質**：モバイルでは軌道図を縦方向の案内へ変形し、キーボードフォーカス、十分なコントラスト、意味のあるランドマークを備える。

## ドキュメントサイト

- Blumeを使用し、日本語をroot locale、英語を `/en/` に置く。
- `origin/main` の `projects/documentation` にあるMarkdownをcanonical sourceとし、移動後も全対象ファイルをバイト単位で変更しない。
- Blumeのfilesystem content sourceまたはcustom pageからcanonical Markdownを読み込み、metadataやrouteは別設定で与える。canonical Markdownへfrontmatterを追加しない。
- 初回移行では `freeism.ja.md` と `freeism.en.md` を単一ページのまま保持し、既存見出しとアンカーへの影響を抑える。
- `note.ja.md` と `note.en.md` は各言語の「図解・ノート」ページとして読み込む。
- 既存textlint、lint-staged、Husky設定を `docs-web-app` に移す。
- Mermaidの20図、raw HTML、表、外部リンクを静的ビルドで確認する。
- 既存本文の内容修正や大規模な章分割は今回行わない。

## リポジトリ整合

- package名を `docs-web-app` に変更し、root script、lockfile importer、Husky、CODEOWNERS、README、Issue/PR templateの参照を更新する。
- `freeism.app` と `www.freeism.app` をPointsへ恒久転送する現行仕様は、新しいポータルを正本とする決定で上書きする。
- 実装時点では既存Vercel workflowを`projects/web-app`の実変更時だけ発火するpath guardへ狭める。最新mainとの統合時はlegacy workflow自体が削除済みのため、削除を優先して復活させない。
- DNS、Cloudflare custom domain、ホスティングプロジェクトの外部設定はこのブランチの対象外とする。

## 検証

- メインサイト：構造テスト、リンク先テスト、アクセシビリティの静的検査、Astro check、production build。
- ドキュメントサイト：origin/main blobとのSHA-256一致、日英ページ、言語切替、Mermaid、既存見出し・アンカー、Blume check、production build、textlint。
- workspace：frozen lockfile install、対象packageのlint/test/build、`git diff --check`。
- ブラウザ：desktop/mobile screenshot、主要リンク、console error、reduced motionを確認する。
