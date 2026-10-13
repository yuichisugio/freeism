# 固定公開ページの原稿読み込み

Markets の `/terms`、`/privacy`、`/help`、`/docs` は、それぞれ日本語と英語の原稿を一つのページに表示する。
原稿8件は `src/content/fixed-pages/` に置き、`src/content/fixed-page-sources.ts` が Vite の `?raw` import で読み込む。
読み込んだ原稿の改行は LF に揃え、`fixed-pages.tsx` が Markdown として描画する。
日本語を正本、英語を参照訳とし、言語選択の動作は `fixed-page-language.ts` に従う。
