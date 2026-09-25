import { createStart } from "@tanstack/react-start";

/**
 * TanStack Startの設定。
 * 画面はセッションに応じて描画するSPAのため、すべてのルートをサーバーで描画しない（`defaultSsr: false`）。
 * 事前生成する`index.html`は画面の中身を含まないshellになり、どのパスを直接開いてもブラウザーで最初から描画する。
 * @see https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr
 */
export const startInstance = createStart(() => ({ defaultSsr: false }));
