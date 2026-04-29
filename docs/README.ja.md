# freeism（無料主義）

- [freeism（無料主義）](#freeism無料主義)
  - [言語](#言語)
  - [概要](#概要)
  - [フォルダ構造](#フォルダ構造)
  - [初期設定](#初期設定)

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
├── documentation/            # 無料主義の仕様
├── web-app/                  # 無料主義アプリ
├── calc-contrib/             # 貢献度の算出
└── depchecker/               # 依存関係の取得
```

| パス(README.md)                                  | 説明                                                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [`documentation/`](../documentation/README.md) | 無料主義の仕様 |
| [`web-app/`](../web-app/README.md)             | Web アプリ |
| [`calc-contrib/`](../calc-contrib/README.md)   | 貢献度を算出するソフトウェア |
| [`depchecker/`](../depchecker/README.md)       | 依存関係を取得するソフトウェア |

## 初期設定

```shell
mise trust
```

```shell
mise run init
```
