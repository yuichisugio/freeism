/**
 * Workers結合テストのエントリーポイント。
 * 本番の`src/index.ts`は画面のTanStack Startを含むため、Honoアプリと公開プロフィール専用のエントリーポイントだけを公開する。
 * @see ../vite.config.ts
 */
export { default } from "../src/backend/app";
export { PublicProfileEntrypoint } from "../src/public-profile";
