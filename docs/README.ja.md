# freeism（無料主義）

- [freeism（無料主義）](#freeism無料主義)
  - [言語](#言語)
  - [概要](#概要)
  - [フォルダ構造](#フォルダ構造)
  - [初期設定](#初期設定)
  - [リリース運用](#リリース運用)

## 言語

日本語（本ページ）| [English](../README.md)

## 概要

- 「無料主義」に関連する Webアプリ、分析ツール、仕様ドキュメントをまとめたモノレポです。

## フォルダ構造

```
freeism/
├── README.md                 # README（英語）
├── CODE_OF_CONDUCT.md        # 行動規範（英語）
├── LICENSE                   # ライセンス
├── docs/                     # リポジトリ用ドキュメント
└── projects/                 # モノレポ管理対象のプロジェクト
    ├── docs-web-app/         # 無料主義の仕様
    ├── main-web-app/         # freeism.app ポータル
    ├── points-web-app/       # points.freeism.app
    ├── markets-web-app/      # markets.freeism.app
    ├── web-app/              # v0.2切替まで保持する旧実装
    ├── calc-contrib/         # 貢献度の算出
    └── depchecker/           # 依存関係の取得
```

| パス(README.md)                                                      | 説明                              |
| -------------------------------------------------------------------- | --------------------------------- |
| [`projects/main-web-app/`](../projects/main-web-app/)                | freeism.app ポータル              |
| [`projects/docs-web-app/`](../projects/docs-web-app/README.md)       | docs.freeism.app と無料主義の仕様 |
| [`projects/points-web-app/`](../projects/points-web-app/README.md)   | Points Web アプリ                 |
| [`projects/markets-web-app/`](../projects/markets-web-app/README.md) | Markets Web アプリ                |
| [`docs/web-app/`](./web-app/README.md)                               | Web アプリ横断仕様                |
| [`projects/web-app/`](../projects/web-app/README.md)                 | v0.2切替まで保持する旧Next.js実装 |
| [`projects/calc-contrib/`](../projects/calc-contrib/README.md)       | 貢献度を算出するソフトウェア      |
| [`projects/depchecker/`](../projects/depchecker/README.md)           | 依存関係を取得するソフトウェア    |

## 初期設定

```shell
mise trust
```

```shell
mise run init
```

## リリース運用

リリース対象の変更では、`pnpm changeset` を実行し、対象アプリ、semver の更新種別、利用者向けの要約を入力します。生成された `.changeset/*.md` を通常のプルリクエストに含めてください。`main` へのマージ後、Changesets が Version PR を作成または更新します。Version PR をマージすると、パッケージのバージョンと `CHANGELOG.md` が確定します。文書のみ、CI のみ、Changesets 設定のみの変更では Changeset は不要です。

このワークフローは npm 公開、Git タグ、GitHub Release を作成しません。
