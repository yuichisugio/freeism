"use client";

/**
 * クライアントサイドで使用可能なR2の設定状態
 * 環境変数に直接アクセスせず、事前定義された値のみを使用
 */
export const clientR2Config = {
  isEnabled: process.env.NEXT_PUBLIC_ENABLE_IMAGE_UPLOAD === "true",
};

/**
 * R2（Cloudflare）が有効かどうかを確認する関数
 * @returns R2が有効かどうか
 */
export function isR2Enabled(): boolean {
  return !!process.env.NEXT_PUBLIC_CLOUDFLARE_R2_ENABLED === true;
}
