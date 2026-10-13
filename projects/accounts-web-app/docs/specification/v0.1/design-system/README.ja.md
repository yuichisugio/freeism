# Accounts デザインシステム v0.1 の資産一式

Freeism Accounts と同じ見た目を他のサービスで再現するためのファイル一式。
値はすべて実装（`src/frontend/styles.css`、`src/backend/views/public-profile-page.tsx`、`src/frontend/features/app-shell/components/icons.tsx`）とモック（`design-system.ja.html`）から写している。

| 文書・ファイル | 役割 |
| --- | --- |
| [`./design-system.ja.md`](./design-system.ja.md) | 規則（トークンの役割、部品・レイアウト・画面の決まり）。迷ったらここを正とする |
| [`./design-system.ja.html`](./design-system.ja.html) | 見本（トークン表・部品見本・全画面の動くモック）。ブラウザーで開いて見た目を確かめる |
| この一式 | 規則と見本を他のサービスに持ち込むための資産（CSS・アイコン・書体の読み込み） |

## 目次

- [1. ファイル一覧](#1-ファイル一覧)
- [2. 導入手順](#2-導入手順)
- [3. アイコン](#3-アイコン)
- [4. ダーク対応](#4-ダーク対応)
- [5. 寸法の倍率 `--scale`](#5-寸法の倍率---scale)
- [6. JavaScript を使わないページ（公開プロフィール）](#6-javascript-を使わないページ公開プロフィール)
- [7. 命名規則](#7-命名規則)
- [8. 禁止事項](#8-禁止事項)
- [9. 実装との同期](#9-実装との同期)

## 1. ファイル一覧

| ファイル | 役割 | 出典 |
| --- | --- | --- |
| [`tokens.css`](./tokens.css) | トークン（色・書体・文字サイズ・太さ・行間・間隔・角丸・影・アイコンと操作部品・レイアウトの寸法・ブランド色）。ライト・ダークの3ブロック | `styles.css` のトークンと `@theme`。太さと `--radius-pill` は `design-system.ja.md` 3.2・3.4 |
| [`heroui-overrides.css`](./heroui-overrides.css) | HeroUI v3 + Tailwind CSS 4 向けの上書き（`@theme`、HeroUI の変数とトークンの対応、`@layer base`、`@layer components`） | `styles.css` をそのまま |
| [`components.css`](./components.css) | HeroUI を使わない画面向けの部品と画面の CSS（クラス名で使う） | `design-system.ja.html` の `<style>` |
| [`icons.svg`](./icons.svg) | アイコンの SVG スプライト（`<symbol id="i-…">`） | `icons.tsx`（形）、モックと公開プロフィールの `<symbol>`（id） |
| [`fonts.html`](./fonts.html) | Google Fonts の `<link>`（preconnect とスタイルシート）とフォールバックの指定 | `src/frontend/routes/__root.tsx` |
| [`public-profile-inline.css`](./public-profile-inline.css) | JavaScript を使わない静的ページのインライン CSS の例 | `public-profile-page.tsx` の `styles`（`scaled()` を展開） |

## 2. 導入手順

どの構成でも、書体 → トークン → 部品の順に読み込む。

### 2.1 書体

[`fonts.html`](./fonts.html) の3行の `<link>` を `<head>` に置く。

- 読み込むウェイトは Zen Maru Gothic 500/700（見出し・ロゴ・番号）、Noto Sans JP 400/500/700（本文）、M PLUS 1 Code 400/500（URL・ID・コード）。
- `display=swap` のため、読み込むまではフォールバック（`tokens.css` の `--font-*` の後ろの書体）で表示する。
- CSP で外部の読み込みを許可しないページは `<link>` を置かず、同じ `--font-*` の指定のまま端末の書体で表示する（[6](#6-javascript-を使わないページ公開プロフィール)）。

### 2.2 トークン

[`tokens.css`](./tokens.css) を**レイヤー（`@layer`）に入れずに**読み込む。

```html
<link rel="stylesheet" href="/design-system/tokens.css">
```

- 部品の CSS は色・寸法の直値を持たず、`var(--surface)`・`var(--space-4)` のようにトークンだけを参照する。
- トークンの役割は `design-system.ja.md` の [3. トークン](./design-system.ja.md#3-トークン) を見る。

### 2.3 HeroUI v3 + Tailwind CSS 4 の場合

アプリの CSS の入口で、Tailwind・HeroUI の後にこの一式を読み込む。

```css
@import "tailwindcss";
@import "@heroui/styles";
@import "./design-system/tokens.css";
@import "./design-system/heroui-overrides.css";
```

- [`heroui-overrides.css`](./heroui-overrides.css) は次の4つを持つ。
  1. `@theme`: 書体（`font-display`・`font-sans`・`font-mono`）、文字サイズ（`text-2xs`〜`text-3xl`、行間 1.7）、`leading-tight`、角丸（`rounded-sm`〜`rounded-2xl`）のユーティリティを作る。値は `tokens.css` の同じ名前のトークンと同じ。
  2. `@theme inline`: HeroUI に無い色のユーティリティ（`border-border-strong`・`bg-highlight`・`text-highlight-foreground`・`bg-favicon-plate`・`text-favicon-fallback`・`text-brand-github`）。
  3. `:root`: HeroUI だけが持つ変数（`--overlay`・`--field-*`・`--radius` など）をトークンへ向ける。Tailwind の `--spacing` も `calc(4px * var(--scale))` にし、`p-4` が `--space-4` と同じ値になる。
  4. `@layer base` と `@layer components`: 本文・見出し・リンク・フォーカス、ボタン・チップ・カード・ダイアログ・ポップオーバー・アラート・入力欄・チェックボックス・確認ダイアログの調整。
- HeroUI の変数は `@layer theme` の中で定義されるため、レイヤーに入れない `tokens.css` と `:root` の対応が優先される。
- 部品と規則の対応（`Button` の `variant`、`Chip` の `color` など）は `design-system.ja.md` の [7.6](./design-system.ja.md#76-heroui-の部品の対応) を見る。
- 寸法のトークン（`--page-max`・`--col-lead` など）は `@theme` に登録していないため、`max-w-(--page-max)` のように変数参照のユーティリティで使う。
- ブレークポイントは 640px が `max-sm:`、820px と 480px が `max-[820px]:`・`max-[480px]:`。
- 確認した版は `@heroui/react`・`@heroui/styles` 3.2.6、`tailwindcss` 4.3.3。

### 2.4 HeroUI を使わない場合

[`components.css`](./components.css) を `tokens.css` の後に読み込み、クラス名で組み立てる。

```html
<link rel="stylesheet" href="/design-system/tokens.css">
<link rel="stylesheet" href="/design-system/components.css">
```

| 部品 | クラス |
| --- | --- |
| 基本の要素 | `body`・`h1`〜`h3`・`a`・`:focus-visible` の指定、`.mono`・`.muted`・`.small`・`.num`（等幅数字）・`.sr-only` |
| ボタン | `.btn` に種別 `.btn-primary`・`.btn-secondary`・`.btn-soft`・`.btn-tertiary`・`.btn-ghost`・`.btn-danger`・`.btn-danger-soft`、小 `.btn-sm`、アイコンだけ `.btn-icon` |
| チップ | `.chip` に `.chip-success`・`.chip-default`・`.chip-warning`・`.chip-danger`・`.chip-accent`・`.chip-highlight` |
| カード | `.card`（面・枠・角丸・影）＋ `.card-pad`（内側の余白と縦の並び）、`.card-head`・`.card-title` |
| 入力 | `.field`・`.field-label`・`.field-desc`・`.input`（`textarea.input`・`.input.mono`・`[aria-invalid="true"]`）・`.mark.required`・`.mark.optional`・`.counter` |
| チェックボックス | `<input type="checkbox" class="checkbox">`（`indeterminate` も可） |
| 分割ボタン | `.seg` の中に `<button aria-pressed>` |
| メッセージ | 情報 `.soft-note.info`（`.warning`・`.danger` もある）、エラー通知 `.notice`、URL検証の結果 `.result-box` |
| サービスアイコン | 台 `.svc-badge`、中のアイコン `.svc`・`.favicon`・`.favicon-fallback` |
| ヘッダー・フッター・ページ | `.app-header`・`.brand`・`.tabs`（`aria-current="page"`）・`.header-end`・`.icon-btn`・`.pill-btn`・`.app-footer`・`.page`・`.page-title`・`.page-lead`・`.help-pill`・`.section-title` |
| ポップオーバー | `.account-menu`・`.sessions`・`.session`・`.menu-item`・`.menu-icon`・`.menu-sep`・`.avatar`、言語 `.lang-switch`・`.lang-menu` |
| 表 | `.table-card` > `.table-scroll` > `table.sticky-table`（見出し行と先頭列を sticky）、一覧 `.data-table`、公開設定 `.vis` |
| 保存バー | `.save-dock`（左に `.save-status`、`.spacer`、右にボタン） |
| ダイアログ | `<dialog class="dialog">` > `.dialog-body` > `.dialog-head`・`.dialog-actions` |
| アコーディオン | `<details class="acc">` > `<summary>` と `.acc-body` |
| トースト | `.toast`（`role="status"`） |

画面ごとの配置（`.hero`・`.steps`・`.q-card`・`.consent-page`・`.profile-page`・`.help-layout`・`.legal-card` など）も同じファイルにある。
組み方の実例は `design-system.ja.html` の各画面の HTML を見る。

```html
<div class="card card-pad">
  <h2 class="card-title">公開プロフィールURL</h2>
  <div class="actions-row">
    <button class="btn btn-primary" type="button">保存</button>
    <button class="btn btn-secondary btn-sm" type="button"><svg aria-hidden="true"><use href="#i-copy"/></svg>コピー</button>
    <span class="chip chip-success"><svg aria-hidden="true"><use href="#i-check"/></svg>OAuth</span>
  </div>
</div>

<dialog class="dialog" aria-labelledby="confirm-title">
  <div class="dialog-body">
    <div class="dialog-head">
      <h2 class="tone-danger" id="confirm-title"><svg aria-hidden="true"><use href="#i-alert"/></svg>この証明を解除しますか？</h2>
      <button class="btn btn-ghost btn-sm btn-icon" type="button" aria-label="閉じる"><svg aria-hidden="true"><use href="#i-close"/></svg></button>
    </div>
    <p>…</p>
    <div class="dialog-actions">
      <button class="btn btn-tertiary btn-sm" type="button">キャンセル</button>
      <button class="btn btn-danger btn-sm" type="button">解除する</button>
    </div>
  </div>
</dialog>
```

- ダイアログは `showModal()` で開き、背面は `::backdrop`（`--backdrop`）になる。
- `.vis` の最小幅は公開先の列数 `--dest-count`、詳細行の中身の幅はスクロール領域の幅 `--scroll-w` を、スクリプトから要素に設定する。
- 開閉・ポップオーバー・トーストの動きは CSS に含まない（規則は `design-system.ja.md` の 4.8・4.9・4.15）。

`components.css` はモックの見た目を、実装に合わせて次の点だけ変えている。

- モックが px の直値で持つ部品の寸法（チップの高さ 24px・チップ内のアイコン 12px・サービスアイコンの台 36px・ロゴ 28px など）は、実装と同じく `calc(Npx * var(--scale))` にした。
- モックのフレーム幅で判定する `@container frame` は、画面幅の `@media (max-width: 820px / 640px / 480px)` にした。狭い幅のアカウント切替メニューの幅は `calc(100vw - var(--space-8))`。
- `.btn-icon` は幅を `--control-h` にし、`.btn-sm` と併用したときに `--control-h-sm` にした（閉じるボタンは `btn btn-ghost btn-sm btn-icon`）。

## 3. アイコン

[`icons.svg`](./icons.svg) をページの `<body>` の先頭にそのまま置き（先頭のコメントは省いてよい）、`<use>` で参照する。

```html
<svg class="…" aria-hidden="true"><use href="#i-check"/></svg>
```

- 同じオリジンに置いたファイルを `<use href="/design-system/icons.svg#i-check"/>` で参照してもよい。
- 大きさは使う側の `<svg>` の `width`・`height` で決める。ボタン内・情報メッセージ・キャレットは `--icon-sm`、ヘッダーの人アイコン・ログインボタンのサービスアイコン・ファビコンは `--icon-md`（`components.css` は部品ごとに指定済み）。
- 線のアイコンは `currentColor` で描くため、色は親の `color` で決める。
- 装飾として `aria-hidden="true"` を付け、意味は隣の文字か `aria-label` で伝える。
- 塗りと線は図形ごとに属性で指定しているため、ページ全体の `svg` への線の指定（公開プロフィールなど）を受けない。

| id | 形 | 主な用途 |
| --- | --- | --- |
| `i-logo` | 主色の角丸四角に「A」と強調色の点（`--accent`・`--accent-foreground`・`--highlight`） | ヘッダーのロゴ（28px × `--scale`） |
| `i-google` | Google のロゴ（`--brand-google-*`） | ログイン・連携ボタン、サービスアイコン |
| `i-github` | GitHub のロゴ（`currentColor`） | ログイン・連携ボタン、サービスアイコン（台に載せるときは `color: var(--brand-github)`） |
| `i-orcid` | ORCID のロゴ（`--brand-orcid`・`--brand-on`） | ログイン・連携ボタン、サービスアイコン |
| `i-person` | 人 | ヘッダー右のアカウント切替 |
| `i-help` | 丸に「?」 | 「使い方」への丸いリンク |
| `i-check` | チェック | 成功のチップ、メニューの選択中 |
| `i-alert` | 丸に「!」 | 確認ダイアログの見出し |
| `i-info` | 丸に「i」 | 情報メッセージ |
| `i-chevron` | 下向きのキャレット | ドロップダウン・アコーディオン・「詳細」の開閉（開いたら 180° 回転） |
| `i-arrow` | 右向きの矢印 | アカウント切替メニューのほかのユーザー |
| `i-external` | 外部リンク | 新しいタブで開くリンクの右 |
| `i-copy` | コピー | 「コピー」ボタン |
| `i-plus` | 追加 | 「アカウントを追加」「新しいクライアントを登録」 |
| `i-upload` | アップロード | 「ファイルを選択」 |
| `i-download` | ダウンロード | 「データ出力」「テンプレートをダウンロード」 |
| `i-logout` | ログアウト | 「「{表示名}」からログアウト」 |
| `i-close` | × | ダイアログの閉じるボタン |
| `i-globe` | 地球儀 | 言語ドロップダウン、ファビコンの代替 |

- ブランドのロゴは `--brand-*` を参照し、トークンが無いページでも同じ色になるよう、トークンと同じ値をフォールバックに書いている。ブランド色はテーマで変えない。
- ファビコンの台と配信（`https://www.google.com/s2/favicons?domain={host}&sz=64`）の扱いは `design-system.ja.md` の [4.12](./design-system.ja.md#412-サービスアイコンfavicon) を見る。

## 4. ダーク対応

`tokens.css` の色は次の3ブロックで定義する。

| ブロック | 当たるとき |
| --- | --- |
| `:root` | 既定（ライト） |
| `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` | システムがダークで、`<html data-theme="light">` でないとき |
| `:root[data-theme="dark"]` | `<html data-theme="dark">` のとき（システムの設定より優先） |

- 2つ目と3つ目のブロックは同じ値にする。ブランド色と寸法はダークのブロックに書かない。
- テーマは `<html>` の `data-theme` で切り替える。「ライト」は `light`、「ダーク」は `dark`、「システム」は属性なし。
- 初回描画のちらつきを避けるため、保存したテーマを描画前に付けるスクリプトを `<head>` に置く（Accounts は localStorage のキー `accounts.theme`。他のサービスは自分のキーにする）。

```html
<script>try{var t=localStorage.getItem("accounts.theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>
```

- 色の切替はトークンだけで行い、部品の CSS にダーク用の指定を書かない。Tailwind の `dark:` 変種も使わない。
- `color-scheme` はブロックごとに `light` / `dark` を指定済みで、スクロールバーやフォーム部品の既定色も合う。

## 5. 寸法の倍率 `--scale`

- 文字サイズ・間隔・角丸・アイコンと操作部品・レイアウトの寸法は、基準値 × `--scale`（1.1）で定義する（例: `--text-md: calc(14px * var(--scale))` は 15.4px）。
- 新しい寸法を書くときも `calc(Npx * var(--scale))` にし、トークンがあればトークンを使う。
- 行間・`--prose-max`（`ch`）・`--table-max-h`・ブレークポイント・枠線の太さ・フォーカスの輪郭・影・`--radius-pill` には掛けない。
- `--scale` を変えると全体の大きさが揃って変わる。サービスごとに値を変えず、Accounts と同じ 1.1 のまま使う。

## 6. JavaScript を使わないページ（公開プロフィール）

外部のサイトが読む静的な HTML など、ビルドした CSS やスクリプトを使わないページは、必要な規則だけをインラインの `<style>` に書く。
[`public-profile-inline.css`](./public-profile-inline.css) が実例（`src/backend/views/public-profile-page.tsx` と同じ値・同じ順序）。

- トークンは使う分だけを `:root` に書き、`--scale` も同じ 1.1 にする。寸法は `calc(Npx*var(--scale))` で書く。
- テーマの切替スクリプトを置かないため、`:root` と `@media (prefers-color-scheme: dark) { :root { … } }` の2ブロックにし、閲覧者のシステムの設定に従う。ダークの値は `tokens.css` のダークと同じ。
- Web フォントは読み込まず、`--font-*` と同じ指定で端末の書体を使う。
- アイコンは使う `<symbol>` だけをページ内に置く。全体の `svg` に線の指定を置くため、塗りのアイコンは図形ごとに `fill` と `stroke` を指定する（`icons.svg` は指定済み）。実装の `<symbol>` は GitHub のロゴを `#24292F` で塗るため、`icons.svg` の `i-github` を使うときは `.brand-icon` の `color` を `#24292f` にする。
- 開閉は `<details>` と `<summary>`、言語の切替は `?lang=` 付きのリンクで行う。

## 7. 命名規則

- ファイル名とクラス名は kebab-case（リポジトリの [命名規則](../../../../../../docs/web-app/v0.2/naming-convention.md)）。
- トークンは `--{役割}`、段階は `--{役割}-{段階}` にする。
  - 色: 面は `--background`・`--surface`・`--surface-secondary`、文字は `--foreground`・`--muted`、意味の色は `--accent`・`--success`・`--warning`・`--danger`・`--highlight`。淡い面は `-soft`、上に載る文字は `-foreground`、ホバーは `-hover`、ブランドは `--brand-{サービス}`。
  - 大きさ: `--text-{2xs|xs|sm|md|lg|xl|2xl|3xl}`、`--radius-{sm|md|lg|xl|2xl|pill}`、`--icon-{sm|md}`、間隔は4px 刻みの番号 `--space-{1|2|3|4|5|6|8|10|14}`（`--space-N` = 4px × N × `--scale`）。
  - 部品とレイアウトの寸法: `--control-h`・`--input-h`・`--checkbox`・`--avatar`、`--{対象}-w`・`--{対象}-max`、表の列は `--col-{列}`（狭い幅は `-compact`）。
- 部品のクラスは `.{部品}`、種別は `.{部品}-{種別}`（`.btn-primary`・`.chip-success`）、状態は属性（`aria-pressed`・`aria-expanded`・`aria-current`・`aria-invalid`）か `.is-{状態}`（`.is-current`・`.is-selected`）にする。
- アイコンの id は `i-{名前}`。

## 8. 禁止事項

- 部品に色・寸法の直値を書かない。トークンを使う（例外は [5](#5-寸法の倍率---scale) の倍率を掛けない値）。
- `tokens.css` を `@layer` に入れない。HeroUI の変数に負け、ダークの値が当たらなくなる。
- ダークの2ブロックの片方だけを変えない。Tailwind の `dark:` 変種・HeroUI の `.dark` を使わない。
- 強調色（`--highlight`）は「未保存」と「前回使用」以外に使わない。
- 1つの面に主ボタン（`.btn-primary`）を2つ置かない。
- チップを押せる部品にしない（状態を示すだけ）。
- ブランドのロゴの形と色を変えない。テーマで色を変えない。
- OAuth Provider（Google・GitHub・ORCID）のアイコンにファビコンの配信を使わない（`i-google`・`i-github`・`i-orcid` を使う）。
- `--scale` をサービスごとに変えない。

## 9. 実装との同期

- 値の正は実装（`styles.css`・`public-profile-page.tsx`・`icons.tsx`）とする。実装を変えたら、同じ変更をこの一式と `design-system.ja.md` に入れる。
  - `styles.css` のトークン・`@theme` → `tokens.css`、`heroui-overrides.css`
  - `styles.css` の HeroUI の対応・`@layer` → `heroui-overrides.css`
  - `icons.tsx` → `icons.svg`
  - `public-profile-page.tsx` の `styles` → `public-profile-inline.css`
  - モックの `<style>` → `components.css`（[2.4](#24-heroui-を使わない場合) の変更点を保つ）
