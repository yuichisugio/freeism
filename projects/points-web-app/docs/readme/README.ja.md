# Freeism Points Webアプリ

- [Freeism Points Webアプリ](#freeism-points-webアプリ)
  - [言語](#言語)
  - [概要](#概要)
  - [詳細](#詳細)
  - [技術方針](#技術方針)
  - [ドキュメント](#ドキュメント)

## 言語

日本語（本ページ）| [English](../../README.md)

## 概要

「無料主義」に関連するポイント管理サービス

## 詳細

- 評価軸の管理
- パッケージの管理
- ポイント付与、残高
- Freeism Points独自のOAuth Provider/API提供
- 外部アカウントの管理・所有権証明・公開・照合は、`projects/accounts-web-app`を情報連携先として利用します。
- 管理するポイントの使用先は、`projects/markets-web-app`を使用します。

## 技術方針

- Cloudflare Workers、Workers Static Assets、D1
- Hono、Drizzle、Better Auth
- TanStack Start、Vite+
- SPAとSSGを使用し、runtime SSRとServer Functionsは使用しない

## ドキュメント

- [v0.1](../specification/v0.1/index.ja.md)
- [v0.2](../specification/v0.2/index.ja.md)
- [v0.3](../specification/v0.3/index.ja.md)
- [v0.4](../specification/v0.4/index.ja.md)
