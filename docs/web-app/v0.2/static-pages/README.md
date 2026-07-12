# v0.2 固定公開ページ本文

本directoryは、PointsとMarketsがbuild時にSSGする固定公開ページの本文正本である。両アプリは同じMarkdownを読み、見出し・段落・箇条書きを意味損失なくrenderする。route componentへ本文を複製しない。

| Route      | 日本語正本                         | 英語参照訳                         | 備考                                           |
| ---------- | ---------------------------------- | ---------------------------------- | ---------------------------------------------- |
| `/terms`   | [`terms.ja.md`](./terms.ja.md)     | [`terms.en.md`](./terms.en.md)     | 旧Next.js本文5節を移植。法務review前の既存本文 |
| `/privacy` | [`privacy.ja.md`](./privacy.ja.md) | [`privacy.en.md`](./privacy.en.md) | 旧Next.js本文7節を移植。法務review前の既存本文 |
| `/help`    | [`help.ja.md`](./help.ja.md)       | [`help.en.md`](./help.en.md)       | v0.2の利用者向け入口                           |
| `/docs`    | [`docs.ja.md`](./docs.ja.md)       | [`docs.en.md`](./docs.en.md)       | 詳細仕様への固定入口                           |

## 言語と法務上の位置付け

- 4ページすべてで日本語を仕様・法務上の正本とし、英語は日本語から意味を加減しない参照翻訳とする。
- 各固定HTMLはMarkdown本文の外側に「日本語版を仕様・法務上の正本とし、英語版は参照翻訳です。」「The Japanese version is the authoritative specification and legal text. The English version is provided for reference.」という二言語の位置付けを表示する。
- `terms.ja.md`と`privacy.ja.md`の本文変更は、framework移行と同じcommitへ混ぜない。旧sourceとのsection title／paragraph／list item hash回帰testを通し、Next.js importとpresentation classだけを除去する。
- 英語参照訳はproduction release前に日本語とのbilingual reviewを必須とする。機械翻訳や自動同期に日本語正本を更新させず、英語から日本語を逆生成しない。

## 静的render契約

- 各routeの単一HTMLに、日本語Markdownと英語Markdownの全内容をbuild時に静的renderする。localeごとにURL、query、redirect、別HTMLを作らない。
- 日本語と英語を包む各language section／content containerへそれぞれ`lang="ja"`と`lang="en"`を付ける。client enhancementが無効な時は両言語を隠さず、どちらも読むことができる。
- client enhancementが有効な時の初期表示は、同一originに保存した明示選択、browser言語、日本語fallbackの順で決定する。利用者がkeyboardとscreen readerで操作できる日本語／Englishの明示toggleを常に表示する。
- 選択言語を変えてもnavigationやnetwork requestを発生させず、既に同じHTMLにあるcontentの表示だけを切り替える。これによりlocaleに依存しない1 URL／1 cache objectの不変条件を維持する。
- 日本語と英語のcanonical Markdownを別々に正規化してcontent hashを生成し、両方のsection／paragraph／list itemとhashがPoints／Marketsのrender結果に残ることを回帰testで検証する。
