# 依頼: 固定公開ページを src の Markdown から読む

Points Web アプリの固定公開ページを、`docs/static-pages` と Vite プラグイン経由ではなく、`src` 内の Markdown を直接読む方式に変更してください。この文書の範囲だけを実装し、完了条件を満たしたら終了してください。

## 目的

`/terms`、`/privacy`、`/help`、`/docs` の本文正本を `src` に置き、画面はその Markdown を import して表示します。ビルド専用プラグインと仮想モジュールをやめます。

## 現状

- 本文は `projects/points-web-app/docs/static-pages/` にある。公開対象は `terms`、`privacy`、`help`、`docs` の `ja` と `en`。同じディレクトリの `README.md` は原稿一覧、言語の位置付け、表示方法の説明であり、公開ページではない。
- `projects/points-web-app/build/fixed-pages-plugin.ts` がビルド時にこれらの Markdown を読み、改行を `\n` に揃え、SHA-256 を付けて `virtual:fixed-pages` を出力する。
- `vite.config.ts` と `vitest.config.ts` がこのプラグインを登録する。
- `src/content/fixed-pages.tsx` が仮想モジュールを読み、両言語を1つの HTML に描画する。各言語節に `lang` と `data-source-sha256` を付ける。ハッシュはこの属性と描画テストにだけ使われ、ページ機能には使われていない。
- `src/content/virtual-fixed-pages.d.ts` が仮想モジュールの型である。
- `src/routes/{terms,privacy,help,docs}.tsx` は `FixedPage` に route 名を渡すだけである。
- `src/routes/index.test.tsx` は `FixedPageView` に本文とハッシュを渡して描画を確認する。仮想モジュールの実データには依存しない。
- 仕様索引 `docs/specification/v0.2/index.ja.md` と `docs/specification/v0.2.1/index.ja.md` は `../../static-pages/README.md` を参照する。
- `tsconfig.json` の `include` に `build/**/*.ts` がある。`build/` にある実装ファイルはこのプラグインだけである。
- 同じリポジトリの Markets は、独自の `docs/v0.2/static-pages` と `build/fixed-pages-plugin.ts` を持つ。今回の対象外である。

## 完了後の形

```text
projects/points-web-app/src/content/fixed-pages/
  terms.ja.md
  terms.en.md
  privacy.ja.md
  privacy.en.md
  help.ja.md
  help.en.md
  docs.ja.md
  docs.en.md
projects/points-web-app/src/content/fixed-page-sources.ts
```

- `fixed-page-sources.ts` が8つの Markdown を `?raw` で import する。このプロジェクトでは `test/worker/static-routing.worker.test.ts` が既に `?raw` を使っている。
- import した文字列の改行を、現行プラグインと同じ `\r\n?` から `\n` への置換で正規化する。
- `fixed-pages.tsx` は `fixed-page-sources.ts` の `fixedPages` を表示する。`FixedPage` と `FixedPageView` の呼び出し方は維持する。
- `sourceSha256` と `data-source-sha256` を削除する。両言語の同時出力、`lang`、言語切替の挙動は維持する。
- 既存の `src/routes/index.test.tsx` からハッシュ用の入力値と属性の確認を削除し、両言語の描画確認を残す。
- `build/fixed-pages-plugin.ts`、`src/content/virtual-fixed-pages.d.ts`、両 config のプラグイン登録、`tsconfig.json` の `build/**/*.ts` を削除する。
- `docs/static-pages/README.md` を削除し、仕様索引2件の固定公開ページリンクは `../../../src/content/fixed-pages/` に更新する。
- `help.ja.md` と `help.en.md` から Accounts v0.1 仕様へのリンクを削除する。

## 実装手順

1. 追跡済みの公開 Markdown 8ファイルを `git mv` で `docs/static-pages/` から `src/content/fixed-pages/` へ移し、`docs/static-pages/README.md` を削除する。
2. `fixed-page-sources.ts` を追加し、8ファイルを route と言語の対応で `fixedPages` にまとめる。route は `"terms" | "privacy" | "help" | "docs"`、言語は `ja` と `en`。
3. `help.ja.md` と `help.en.md` から Accounts v0.1 仕様へのリンクを削除する。
4. `fixed-pages.tsx` の import を仮想モジュールから `fixed-page-sources.ts` に差し替え、ハッシュ属性と既存テストのハッシュ関連部分を削除する。本文の描画と言語切替は維持する。
5. プラグイン、仮想モジュールの型、config の登録、`tsconfig.json` の `build/**/*.ts` を削除する。
6. 仕様索引2件の固定公開ページリンクを新しい原稿ディレクトリへ更新する。

## 制約

- 公開8ファイルの本文、見出し、箇条書きは維持する。`help.ja.md` と `help.en.md` の Accounts v0.1 仕様リンクだけは削除する。
- route ファイルへ本文を複製しない。
- Markets、Accounts、他アプリの固定ページは変更しない。
- 画面の見た目、言語切替、両言語を1 HTML に出す契約は変更しない。
