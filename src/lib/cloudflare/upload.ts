"use client";

// サーバーサイド機能は別のファイルにインポートされるため、ここではインポートしない
// import { createR2Client, getR2BucketName, getR2PublicUrl } from "./r2-client";
// 代わりにクライアントサイド用の設定をインポート
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

// 画像拡張子の列挙型。列挙型は、列挙型の名前.プロパティ名でアクセスする。
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
 * 署名付きアップロードURLを生成するためのAPIエンドポイントを呼び出す
 * クライアントサイドから使用するメソッド
 * @param fileType アップロードするファイルのMIMEタイプ
 * @param fileName オプションのファイル名（指定しない場合はUUIDを生成）
 * @returns 署名付きURLと、アップロード後のパブリックURLのオブジェクト
 */
export async function getSignedUploadUrl(
  fileType: string,
  fileName?: string,
): Promise<{
  signedUrl: string;
  publicUrl: string | null;
  key: string;
} | null> {
  // 画像アップロード機能が無効の場合はnullを返す
  if (!isImageUploadEnabled()) {
    logger.warn("画像アップロード機能が無効です");
    return null;
  }

  try {
    // APIエンドポイントを呼び出す
    const response = await fetch("/api/upload/get-signed-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileType,
        fileName,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "署名付きURLの取得に失敗しました");
    }

    return await response.json();
  } catch (error) {
    logger.error("署名付きURLの取得中にエラーが発生しました", error);
    return null;
  }
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
