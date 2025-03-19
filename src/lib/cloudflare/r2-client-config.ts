"use client";

/**
 * クライアントサイドで使用可能なR2の設定状態
 * 環境変数に直接アクセスせず、事前定義された値のみを使用
 */
export const clientR2Config = {
  isEnabled: process.env.NEXT_PUBLIC_ENABLE_IMAGE_UPLOAD === "true",
};

/**
 * 画像アップロード機能が有効かどうかを確認（クライアントサイド用）
 */
export function isR2Enabled(): boolean {
  return clientR2Config.isEnabled;
}
