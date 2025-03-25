"use client";

// サーバーサイド機能は別のファイルにインポートされるため、ここではインポートしない
import { isR2Enabled } from "./r2-client-config";

// 画像MIMEタイプの列挙型
export enum ImageMimeType {
  JPEG = "image/jpeg",
  JPG = "image/jpg",
  PNG = "image/png",
  WEBP = "image/webp",
  GIF = "image/gif",
  AVIF = "image/avif",
}

// 画像拡張子の列挙型
export enum ImageExtension {
  JPEG = "jpg",
  JPG = "jpg",
  PNG = "png",
  WEBP = "webp",
  GIF = "gif",
  AVIF = "avif",
}

// 共通のロギング関数
export const logger = {
  warn: (message: string, ...args: any[]) => {
    console.warn(`[R2 Service] ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[R2 Service] ${message}`, ...args);
  },
  info: (message: string, ...args: any[]) => {
    console.info(`[R2 Service] ${message}`, ...args);
  },
};

/**
 * 画像アップロード機能が有効かどうかを確認（クライアントサイド用）
 */
export function isImageUploadEnabled(): boolean {
  // process.env.NEXT_PUBLIC_* 形式の環境変数のみクライアントサイドでアクセス可能
  return isR2Enabled();
}

/**
 * アップロードできる画像タイプの配列
 */
export const ACCEPTED_IMAGE_TYPES: Record<ImageMimeType, string[]> = {
  [ImageMimeType.JPEG]: [".jpg", ".jpeg"],
  [ImageMimeType.JPG]: [".jpg", ".jpeg"],
  [ImageMimeType.PNG]: [".png"],
  [ImageMimeType.WEBP]: [".webp"],
  [ImageMimeType.GIF]: [".gif"],
  [ImageMimeType.AVIF]: [".avif"],
};

/**
 * 最大ファイルサイズ（5MB）
 */
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
