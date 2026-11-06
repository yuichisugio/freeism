import { createStart } from "@tanstack/react-start";

/**
 * TanStack Startの設定。
 * 画面はセッションに応じて描画するため、ルートを既定でサーバーで描画しない（`defaultSsr: false`）。
 * 静的な内容のトップページ（`/`）だけを事前生成で描画し、ほかの画面の事前生成したHTMLは画面の中身を含まないshellになる。
 * @see https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr
 */
export const startInstance = createStart(() => ({ defaultSsr: false }));
